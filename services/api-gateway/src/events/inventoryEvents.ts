import { eventBus } from './eventBus';
import { productService } from '../services/product.service';
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
  eventId?: string;
}

// In-memory LRU-like set to prevent duplicate event processing across replays
const processedEventIds = new Set<string>();
const MAX_PROCESSED_EVENTS = 5000;

function markEventProcessed(eventId: string): boolean {
  if (processedEventIds.has(eventId)) {
    return false; // Already processed
  }
  if (processedEventIds.size >= MAX_PROCESSED_EVENTS) {
    const first = processedEventIds.values().next().value;
    if (first) processedEventIds.delete(first);
  }
  processedEventIds.add(eventId);
  return true;
}

/**
 * Publish inventory change event to Redis for cross-instance notification and cache invalidation.
 */
export async function publishInventoryEvent(
  channel: string,
  payload: InventoryEventPayload
): Promise<void> {
  logger.info('Publishing inventory event', { channel, payload });
  await eventBus.publish(channel, payload);
}

/**
 * Initialize Inventory Event Subscriptions / Consumer.
 * In a multi-replica cluster:
 * 1. 'order_placed' events are informational notifications because the authoritative atomic
 *    decrement was already executed directly in MongoDB by the order confirmation workflow.
 * 2. 'restock' events are executed atomically using ProductService.adjustVariantInventory.
 * 3. Duplicate event deliveries are ignored via eventId tracking.
 */
export function initInventoryEventConsumer(): void {
  // Listen for inventory updates
  eventBus.subscribe<InventoryEventPayload>(
    INVENTORY_CHANNELS.UPDATED,
    async (payload) => {
      const { sku, quantity, reason, orderId, eventId } = payload;
      logger.info('Handling inventory update event', { sku, quantity, reason, orderId });

      // Deduplicate event by eventId if provided
      if (eventId && !markEventProcessed(eventId)) {
        logger.info('Duplicate inventory event ignored', { eventId, sku, reason });
        return;
      }

      // Authoritative order confirmation already mutated MongoDB directly
      if (reason === 'order_placed') {
        logger.debug('Skipping database inventory decrement for order_placed event: already committed authoritatively', {
          sku,
          orderId,
        });
        return;
      }

      // Restock or external adjustment: apply atomic MongoDB update
      try {
        const result = await productService.adjustVariantInventory(sku, quantity);
        if (result.success) {
          logger.info('Product inventory updated from event', {
            sku,
            newInventory: result.newInventory,
          });
        } else {
          logger.warn('Inventory event update could not be applied', {
            sku,
            error: result.error,
          });
        }
      } catch (err) {
        logger.error('Failed to update product inventory from event', {
          sku,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  );

  // Informational notifications for cart reservations and releases
  eventBus.subscribe<InventoryEventPayload>(
    INVENTORY_CHANNELS.RESERVED,
    async ({ sku, quantity, sessionId }) => {
      logger.debug('Cart reservation notification received', { sku, quantity, sessionId });
    }
  );

  eventBus.subscribe<InventoryEventPayload>(
    INVENTORY_CHANNELS.RELEASED,
    async ({ sku, quantity, sessionId }) => {
      logger.debug('Cart release notification received', { sku, quantity, sessionId });
    }
  );
}
