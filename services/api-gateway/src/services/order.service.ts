import mongoose from 'mongoose';
import crypto from 'crypto';
import { OrderModel, IOrder, IShippingAddress, ProductModel } from '../models';
import { cartService } from './cart.service';
import { productService } from './product.service';
import { AppError } from '../middleware/error.middleware';
import { publishInventoryEvent, INVENTORY_CHANNELS } from '../events/inventoryEvents';
import { razorpayService } from './razorpay.service';
import { logger } from '../utils/logger';

export interface CreateOrderInput {
  sessionId: string;
  shippingAddress: IShippingAddress;
  idempotencyKey?: string;
}

export interface VerifyPaymentInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export class OrderService {
  /**
   * Create an order from current cart items and initialize Razorpay order
   */
  async createOrderFromCart(input: CreateOrderInput): Promise<IOrder> {
    const { sessionId, shippingAddress, idempotencyKey } = input;

    // Check idempotency if key provided
    if (idempotencyKey) {
      const existing = await OrderModel.findOne({ idempotencyKey });
      if (existing) {
        logger.info('Returning existing order for idempotencyKey', { idempotencyKey });
        return existing;
      }
    }

    const cart = await cartService.getOrCreateCart(sessionId);
    if (cart.items.length === 0) {
      throw new AppError('Cannot create an order from an empty cart', 400);
    }

    // Re-verify inventory for every item in cart
    for (const item of cart.items) {
      const product = await ProductModel.findById(item.productId);
      if (!product || !product.isActive) {
        throw new AppError(`Product "${item.productName}" is no longer available`, 400);
      }
      const variant = product.variants.find((v) => v.sku === item.variantSku);
      if (!variant || variant.inventory < item.quantity) {
        throw new AppError(
          `Insufficient stock for "${item.productName} - ${item.variantName}". Only ${variant ? variant.inventory : 0} available.`,
          400
        );
      }
    }

    const subtotal = cart.subtotal;
    const shipping = subtotal > 150 ? 0 : 15.0;
    const tax = Math.round(subtotal * 0.08 * 100) / 100;
    const total = Math.round((subtotal + shipping + tax) * 100) / 100;
    const amountPaise = Math.round(total * 100);

    const orderNumber = 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create order with Razorpay
    const razorpayOrder = await razorpayService.createRazorpayOrder({
      amountPaise,
      currency: 'INR',
      receipt: orderNumber,
      notes: {
        orderNumber,
        sessionId,
      },
    });

    const order = await OrderModel.create({
      orderNumber,
      sessionId,
      items: cart.items.map((i) => ({
        productId: i.productId,
        variantSku: i.variantSku,
        productName: i.productName,
        variantName: i.variantName,
        price: i.price,
        quantity: i.quantity,
      })),
      shippingAddress,
      subtotal,
      shipping,
      tax,
      total,
      status: 'pending',
      paymentStatus: 'pending',
      paymentDetails: {
        provider: 'razorpay',
        razorpayOrderId: razorpayOrder.id,
        currency: 'INR',
        amountPaise,
      },
      idempotencyKey,
      processedWebhookEvents: [],
    });

    logger.info('Order and Razorpay order created successfully', {
      orderNumber,
      razorpayOrderId: razorpayOrder.id,
      total,
      amountPaise,
    });

    return order;
  }

  /**
   * Securely verify Razorpay payment and transition order to confirmed state
   */
  /**
   * Securely verify Razorpay payment and transition order to confirmed state.
   * - Performs Razorpay network check outside of any database transaction.
   * - Enforces idempotency under concurrent retries.
   * - Deducts inventory atomically in MongoDB (preventing negative stock or overselling).
   * - Coordinates with MongoDB replica set transactions where supported, or atomic fallbacks where not supported.
   * - Recovers safely if stock was depleted during payment by holding order for review.
   */
  async verifyPaymentAndConfirmOrder(input: VerifyPaymentInput): Promise<IOrder> {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = input;

    // 1. Verify HMAC-SHA256 signature using timing-safe comparison
    const isValidSignature = razorpayService.verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValidSignature) {
      logger.warn('Payment verification failed: Invalid Razorpay signature', {
        razorpayOrderId,
        razorpayPaymentId,
      });
      throw AppError.badRequest('Invalid payment signature');
    }

    // 2. Retrieve corresponding internal order
    let order = await OrderModel.findOne({
      'paymentDetails.razorpayOrderId': razorpayOrderId,
    });

    if (!order) {
      logger.warn('Order not found for Razorpay order ID', { razorpayOrderId });
      throw AppError.notFound('Order not found for the provided Razorpay order ID');
    }

    const initialOrder: IOrder = order;

    // 3. Confirm that the Razorpay order ID belongs to this internal order
    if (initialOrder.paymentDetails?.razorpayOrderId !== razorpayOrderId) {
      logger.warn('Order mismatch during payment verification', {
        expected: initialOrder.paymentDetails?.razorpayOrderId,
        received: razorpayOrderId,
      });
      throw AppError.badRequest('Mismatched Razorpay order ID');
    }

    // 4. Server-side API verification with Razorpay (check payment status and amount)
    // NOTE: This network call is intentionally executed OUTSIDE any database transaction.
    try {
      const payment = await razorpayService.fetchPayment(razorpayPaymentId);
      if (payment) {
        if (payment.order_id && payment.order_id !== razorpayOrderId) {
          logger.warn('Razorpay payment does not match Razorpay order ID', {
            paymentOrderId: payment.order_id,
            razorpayOrderId,
          });
          throw AppError.badRequest('Payment does not match the order');
        }

        const acceptableStatuses = ['captured', 'authorized'];
        if (payment.status && !acceptableStatuses.includes(payment.status)) {
          logger.warn('Razorpay payment status is not acceptable', {
            paymentStatus: payment.status,
            razorpayPaymentId,
          });
          throw AppError.badRequest(`Payment is in an unconfirmed state: ${payment.status}`);
        }

        if (
          initialOrder.paymentDetails.amountPaise &&
          payment.amount &&
          payment.amount !== initialOrder.paymentDetails.amountPaise
        ) {
          logger.warn('Razorpay payment amount mismatch', {
            expected: initialOrder.paymentDetails.amountPaise,
            received: payment.amount,
          });
          throw AppError.badRequest('Payment amount mismatch');
        }
      }
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      logger.warn('Optional Razorpay payment fetch check failed; falling back to signature validation', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    // 5. Idempotent fulfillment check: if already confirmed, return existing order immediately
    if (initialOrder.paymentStatus === 'succeeded' && initialOrder.status === 'confirmed') {
      logger.info('Order payment already confirmed, returning existing order (idempotent)', {
        orderNumber: initialOrder.orderNumber,
      });
      return initialOrder;
    }

    // Check if order was already held for review due to prior inventory depletion
    if (
      initialOrder.paymentStatus === 'succeeded' &&
      (initialOrder.fulfillmentStatus === 'insufficient_stock_review_required' ||
        (initialOrder.paymentDetails as any).fulfillmentStatus === 'insufficient_stock_review_required')
    ) {
      logger.warn('Order was already marked for review due to inventory depletion', {
        orderNumber: initialOrder.orderNumber,
      });
      return initialOrder;
    }

    // 6. Execute atomic inventory deduction, order update, and cart clearing
    // Atomically claim processing for this order to prevent concurrent verification calls
    // from duplicating inventory decrements.
    const claimResult = await OrderModel.findOneAndUpdate(
      {
        _id: initialOrder._id,
        paymentStatus: 'pending',
      },
      {
        $set: {
          paymentStatus: 'processing',
          'paymentDetails.razorpayPaymentId': razorpayPaymentId,
          'paymentDetails.razorpaySignature': razorpaySignature,
        },
      },
      { new: true }
    );

    if (!claimResult) {
      // Another concurrent worker claimed or already completed this order confirmation.
      // Poll briefly for completion (up to 3 seconds)
      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const latest = await OrderModel.findById(initialOrder._id);
        if (latest) {
          if (latest.status === 'confirmed' && latest.paymentStatus === 'succeeded') {
            return latest as IOrder;
          }
          if (
            latest.fulfillmentStatus === 'insufficient_stock_review_required' ||
            (latest.paymentDetails as any)?.fulfillmentStatus === 'insufficient_stock_review_required'
          ) {
            throw AppError.unprocessable(
              `Payment verified successfully, but stock for an item was depleted by a concurrent order. Order ${latest.orderNumber} is held for manual review or refund.`
            );
          }
        }
      }
      const finalCheck = await OrderModel.findById(initialOrder._id);
      if (finalCheck && finalCheck.paymentStatus === 'succeeded') {
        return finalCheck as IOrder;
      }
      throw AppError.conflict('Concurrent order confirmation in progress. Please retry.');
    }

    // Check if MongoDB supports transactions (replica set)
    const isReplicaSet = Boolean(
      (mongoose.connection as any).client?.topology?.description?.setName ||
      (mongoose.connection as any).client?.topology?.description?.type === 'ReplicaSetWithPrimary'
    );

    const executeConfirmation = async (session: mongoose.ClientSession | null): Promise<IOrder> => {
      const decrementedItems: { sku: string; quantity: number }[] = [];
      let stockDepletedItem: { sku: string; name: string } | null = null;

      // Atomically decrement inventory for every item
      for (const item of initialOrder.items) {
        const adj = await productService.adjustVariantInventory(
          item.variantSku,
          -item.quantity,
          session
        );

        if (!adj.success) {
          stockDepletedItem = { sku: item.variantSku, name: item.productName };
          break;
        }

        decrementedItems.push({ sku: item.variantSku, quantity: item.quantity });
      }

      // Handle insufficient stock discovered during payment confirmation
      if (stockDepletedItem) {
        // Rollback any partially decremented items if transactions not available
        if (!session) {
          for (const dec of decrementedItems) {
            await productService.adjustVariantInventory(dec.sku, dec.quantity, null);
          }
        }

        // Recoverable state: payment is confirmed on gateway, but fulfillment requires manual review/refund
        await OrderModel.updateOne(
          { _id: initialOrder._id },
          {
            $set: {
              paymentStatus: 'succeeded',
              status: 'processing',
              fulfillmentStatus: 'insufficient_stock_review_required',
              'paymentDetails.razorpayPaymentId': razorpayPaymentId,
              'paymentDetails.razorpaySignature': razorpaySignature,
              'paymentDetails.fulfillmentStatus': 'insufficient_stock_review_required',
            },
          },
          session ? { session } : {}
        );

        logger.error('Order stock depleted during payment confirmation — held for review', {
          orderNumber: initialOrder.orderNumber,
          razorpayOrderId,
          razorpayPaymentId,
          depletedSku: stockDepletedItem.sku,
        });

        throw AppError.unprocessable(
          `Payment verified successfully, but insufficient stock for "${stockDepletedItem.name}" (depleted by a concurrent order). Order ${initialOrder.orderNumber} is held for manual review or refund.`
        );
      }

      // All items successfully and atomically decremented
      await OrderModel.updateOne(
        { _id: initialOrder._id },
        {
          $set: {
            paymentStatus: 'succeeded',
            status: 'confirmed',
            fulfillmentStatus: 'fulfilled',
            'paymentDetails.razorpayPaymentId': razorpayPaymentId,
            'paymentDetails.razorpaySignature': razorpaySignature,
            'paymentDetails.fulfillmentStatus': 'fulfilled',
          },
        },
        session ? { session } : {}
      );

      await cartService.clearCart(initialOrder.sessionId, session);
      const confirmedDoc = await OrderModel.findById(initialOrder._id).session(session || null);
      return (confirmedDoc as IOrder) || initialOrder;
    };

    let confirmedResult: IOrder;

    try {
      if (isReplicaSet) {
        const session = await mongoose.startSession();
        try {
          let txOrder: IOrder;
          await session.withTransaction(async () => {
            txOrder = await executeConfirmation(session);
          });
          confirmedResult = txOrder!;
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('replica set') || msg.includes('Transaction numbers')) {
            // Fallback if replica set check was false-positive
            confirmedResult = await executeConfirmation(null);
          } else {
            throw err;
          }
        } finally {
          await session.endSession();
        }
      } else {
        // Standalone MongoDB environment (e.g. dev or in-memory tests)
        confirmedResult = await executeConfirmation(null);
      }
    } catch (err) {
      if (!(err instanceof AppError && (err as any).statusCode === 422)) {
        await OrderModel.updateOne(
          { _id: initialOrder._id, paymentStatus: 'processing' },
          { $set: { paymentStatus: 'pending' } }
        );
      }
      throw err;
    }

    // 7. Publish informational notification events to Redis (after successful commit)
    for (const item of confirmedResult.items) {
      await publishInventoryEvent(INVENTORY_CHANNELS.UPDATED, {
        sku: item.variantSku,
        quantity: -item.quantity,
        reason: 'order_placed',
        orderId: confirmedResult.orderNumber,
        eventId: crypto.randomUUID(),
      });
    }

    logger.info('Order payment successfully verified and confirmed', {
      orderNumber: confirmedResult.orderNumber,
      razorpayOrderId,
      razorpayPaymentId,
    });

    return confirmedResult;
  }

  /**
   * Get order by orderNumber
   */
  async getOrderByNumber(orderNumber: string): Promise<IOrder> {
    const order = await OrderModel.findOne({ orderNumber });
    if (!order) {
      throw new AppError('Order not found', 404);
    }
    return order;
  }
}

export const orderService = new OrderService();
