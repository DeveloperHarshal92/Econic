import { OrderModel, IOrder, IShippingAddress, ProductModel } from '../models';
import { cartService } from './cart.service';
import { AppError } from '../middleware/error.middleware';
import { publishInventoryEvent, INVENTORY_CHANNELS } from '../events/inventoryEvents';
import { logger } from '../utils/logger';

export interface CreateOrderInput {
  sessionId: string;
  shippingAddress: IShippingAddress;
  idempotencyKey?: string;
}

export class OrderService {
  /**
   * Create an order from current cart items
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

    const orderNumber = 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const mockPaymentIntentId = 'pi_' + Math.random().toString(36).substring(2, 12);
    const mockClientSecret = mockPaymentIntentId + '_secret_' + Math.random().toString(36).substring(2, 8);

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
        provider: 'stripe',
        paymentIntentId: mockPaymentIntentId,
        clientSecret: mockClientSecret,
      },
      idempotencyKey,
      processedWebhookEvents: [],
    });

    logger.info('Order created successfully', { orderNumber, total });
    return order;
  }

  /**
   * Process payment confirmation (e.g. from Stripe Webhook or direct capture)
   */
  async confirmOrderPayment(
    paymentIntentId: string,
    webhookEventId?: string
  ): Promise<IOrder> {
    const order = await OrderModel.findOne({
      'paymentDetails.paymentIntentId': paymentIntentId,
    });

    if (!order) {
      throw new AppError('Order with specified payment intent not found', 404);
    }

    // Idempotency check for webhook events
    if (webhookEventId && order.processedWebhookEvents.includes(webhookEventId)) {
      logger.info('Webhook event already processed', { webhookEventId, orderNumber: order.orderNumber });
      return order;
    }

    if (order.paymentStatus !== 'succeeded') {
      order.paymentStatus = 'succeeded';
      order.status = 'confirmed';

      // Deduct inventory consistently in database and trigger event
      for (const item of order.items) {
        await publishInventoryEvent(INVENTORY_CHANNELS.UPDATED, {
          sku: item.variantSku,
          quantity: -item.quantity, // Negative delta decreases stock
          reason: 'order_placed',
          orderId: order.orderNumber,
        });
      }

      // Clear the user's cart
      await cartService.clearCart(order.sessionId);

      logger.info('Order payment confirmed and inventory deducted', {
        orderNumber: order.orderNumber,
      });
    }

    if (webhookEventId) {
      order.processedWebhookEvents.push(webhookEventId);
    }

    await order.save();
    return order;
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
