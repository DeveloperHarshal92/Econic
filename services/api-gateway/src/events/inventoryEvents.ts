import { eventBus } from './eventBus';
import { ProductModel } from '../models';
import { logger } from '../utils/logger';

export const INVENTORY_CHANNELS = {
  UPDATED: 'inventory:updated',
  RESERVED: 'inventory:reserved',
  RELEASED: 'inventory:released',
} as const;

export interface InventoryEventPayload {
  sku: string;
  quantity: number;
  reason: 'cart_add' | 'cart_remove' | 'order_placed' | 'order_cancelled' | 'restock';
  orderId?: string;
  sessionId?: string;
}

/**
 * Publish inventory change event to Redis
 */
export async function publishInventoryEvent(
  channel: string,
  payload: InventoryEventPayload
): Promise<void> {
  logger.info('Publishing inventory event', { channel, payload });
  await eventBus.publish(channel, payload);
}

/**
 * Initialize Inventory Event Subscriptions / Consumer
 */
export function initInventoryEventConsumer(): void {
  // Listen for inventory updates
  eventBus.subscribe<InventoryEventPayload>(
    INVENTORY_CHANNELS.UPDATED,
    async ({ sku, quantity, reason }) => {
      logger.info('Handling inventory update event', { sku, quantity, reason });
      try {
        const product = await ProductModel.findOne({ 'variants.sku': sku });
        if (product) {
          const variant = product.variants.find((v) => v.sku === sku);
          if (variant) {
            variant.inventory = Math.max(0, variant.inventory + quantity);
            variant.isAvailable = variant.inventory > 0;
            await product.save();
            logger.info('Product inventory updated from event', {
              sku,
              newInventory: variant.inventory,
            });
          }
        }
      } catch (err) {
        logger.error('Failed to update product inventory from event', {
          sku,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  );
}
