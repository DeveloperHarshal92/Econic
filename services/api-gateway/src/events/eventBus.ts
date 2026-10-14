import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

export type EventHandler<T = unknown> = (data: T) => Promise<void> | void;

export class EventBus {
  private static instance: EventBus;
  private handlers = new Map<string, Set<EventHandler>>();
  private isSubscribed = false;

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Publish an event to a Redis channel and locally
   */
  public async publish<T>(channel: string, data: T): Promise<void> {
    const payload = JSON.stringify({
      channel,
      data,
      timestamp: new Date().toISOString(),
    });

    try {
      const redis = getRedisClient();
      if (redis.status === 'ready') {
        await redis.publish(channel, payload);
      }
    } catch (err) {
      logger.debug('Redis publish failed, falling back to local handlers', {
        channel,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    // Always trigger local subscribers for high-reliability in-memory execution
    this.triggerLocal(channel, data);
  }

  /**
   * Subscribe to a channel
   */
  public subscribe<T>(channel: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler as EventHandler);

    this.ensureRedisSubscriber(channel);
  }

  /**
   * Clear all subscribers (useful for testing)
   */
  public clear(): void {
    this.handlers.clear();
  }

  private triggerLocal<T>(channel: string, data: T): void {
    const channelHandlers = this.handlers.get(channel);
    if (channelHandlers) {
      channelHandlers.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          logger.error('Error in event handler', {
            channel,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      });
    }
  }

  private ensureRedisSubscriber(channel: string): void {
    try {
      const redis = getRedisClient();
      if (redis.status === 'ready' && !this.isSubscribed) {
        const sub = redis.duplicate();
        sub.subscribe(channel, (err) => {
          if (err) {
            logger.error('Failed to subscribe to Redis channel', { channel, error: err.message });
          } else {
            logger.info(`Subscribed to Redis channel: ${channel}`);
          }
        });

        sub.on('message', (chan, message) => {
          try {
            const parsed = JSON.parse(message);
            this.triggerLocal(chan, parsed.data);
          } catch {
            // Non-JSON message
          }
        });

        this.isSubscribed = true;
      }
    } catch {
      // In-memory fallback
    }
  }
}

export const eventBus = EventBus.getInstance();
