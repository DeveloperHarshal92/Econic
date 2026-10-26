import mongoose from 'mongoose';
import { CartModel, ICart, ProductModel } from '../models';
import { AppError } from '../middleware/error.middleware';
import { publishInventoryEvent, INVENTORY_CHANNELS } from '../events/inventoryEvents';
import { logger } from '../utils/logger';

export interface AddItemInput {
  productId: string;
  variantSku: string;
  quantity: number;
}

export class CartService {
  /**
   * Get an existing cart by session ID or create a new empty one
   */
  async getOrCreateCart(sessionId: string): Promise<ICart> {
    let cart = await CartModel.findOne({ sessionId });
    if (!cart) {
      cart = await CartModel.create({
        sessionId,
        items: [],
        subtotal: 0,
        itemCount: 0,
      });
    }
    return cart;
  }

  /**
   * Add item to cart with server-side inventory validation
   */
  async addItem(sessionId: string, input: AddItemInput): Promise<ICart> {
    const { productId, variantSku, quantity } = input;

    if (quantity <= 0) {
      throw new AppError('Quantity must be greater than zero', 400);
    }

    // Server-side product & variant validation
    const product = await ProductModel.findById(productId);
    if (!product || !product.isActive) {
      throw new AppError('Product not found or inactive', 404);
    }

    const variant = product.variants.find(
      (v) => v.sku.toUpperCase() === variantSku.toUpperCase()
    );
    if (!variant) {
      throw new AppError('Product variant not found', 404);
    }

    if (!variant.isAvailable || variant.inventory < quantity) {
      throw new AppError(
        `Insufficient inventory. Only ${variant.inventory} available.`,
        400
      );
    }

    const cart = await this.getOrCreateCart(sessionId);
    const existingIndex = cart.items.findIndex(
      (i) => i.variantSku.toUpperCase() === variantSku.toUpperCase()
    );

    const primaryImg = product.images.find((img) => img.isPrimary) || product.images[0];

    if (existingIndex > -1) {
      const existingItem = cart.items[existingIndex]!;
      const totalQty = existingItem.quantity + quantity;

      if (totalQty > variant.inventory) {
        throw new AppError(
          `Cannot add ${quantity} more. Total in cart (${totalQty}) exceeds available stock (${variant.inventory}).`,
          400
        );
      }

      existingItem.quantity = totalQty;
      existingItem.price = variant.price; // Update to current price
    } else {
      cart.items.push({
        productId: product.id,
        variantSku: variant.sku,
        productName: product.name,
        variantName: variant.name,
        price: variant.price,
        quantity,
        imageUrl: primaryImg?.url,
      });
    }

    await cart.save();

    // Publish event via Redis
    await publishInventoryEvent(INVENTORY_CHANNELS.RESERVED, {
      sku: variant.sku,
      quantity,
      reason: 'cart_add',
      sessionId,
    });

    logger.info('Item added to cart', { sessionId, sku: variant.sku, quantity });
    return cart;
  }

  /**
   * Update quantity of an item in the cart
   */
  async updateQuantity(
    sessionId: string,
    variantSku: string,
    quantity: number
  ): Promise<ICart> {
    const cart = await this.getOrCreateCart(sessionId);
    const itemIndex = cart.items.findIndex(
      (i) => i.variantSku.toUpperCase() === variantSku.toUpperCase()
    );

    if (itemIndex === -1) {
      throw new AppError('Item not found in cart', 404);
    }

    if (quantity <= 0) {
      return this.removeItem(sessionId, variantSku);
    }

    // Verify stock availability
    const product = await ProductModel.findById(cart.items[itemIndex]!.productId);
    if (product) {
      const variant = product.variants.find(
        (v) => v.sku.toUpperCase() === variantSku.toUpperCase()
      );
      if (variant && variant.inventory < quantity) {
        throw new AppError(
          `Only ${variant.inventory} units available for this item`,
          400
        );
      }
    }

    cart.items[itemIndex]!.quantity = quantity;
    await cart.save();

    logger.info('Cart item quantity updated', { sessionId, sku: variantSku, quantity });
    return cart;
  }

  /**
   * Remove an item from the cart
   */
  async removeItem(sessionId: string, variantSku: string): Promise<ICart> {
    const cart = await this.getOrCreateCart(sessionId);
    const itemIndex = cart.items.findIndex(
      (i) => i.variantSku.toUpperCase() === variantSku.toUpperCase()
    );

    if (itemIndex > -1) {
      const removed = cart.items[itemIndex]!;
      cart.items.splice(itemIndex, 1);
      await cart.save();

      await publishInventoryEvent(INVENTORY_CHANNELS.RELEASED, {
        sku: removed.variantSku,
        quantity: removed.quantity,
        reason: 'cart_remove',
        sessionId,
      });

      logger.info('Item removed from cart', { sessionId, sku: variantSku });
    }

    return cart;
  }

  /**
   * Clear all items from cart
   */
  async clearCart(sessionId: string, session?: mongoose.ClientSession | null): Promise<ICart> {
    const cart = await this.getOrCreateCart(sessionId);
    cart.items = [];
    await cart.save(session ? { session } : {});
    logger.info('Cart cleared', { sessionId });
    return cart;
  }
}

export const cartService = new CartService();
