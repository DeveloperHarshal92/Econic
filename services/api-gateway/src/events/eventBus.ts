import crypto from 'crypto';
import { getRedisClient, createRedisSubscriberClient } from '../config/redis';
import { logger } from '../utils/logger';

export type EventHandler<T = unknown> = (data: T) => Promise<void> | void;

export interface EventEnvelope<T = unknown> {
  eventId: string;
  senderId: string;
  channel: string;
  data: T;
  timestamp: string;
}

export class EventBus {
  private static instance: EventBus;
  private handlers = new Map<string, Set<EventHandler>>();
  private registeredChannels = new Set<string>();
  private activeSubscriptions = new Set<string>();
  private isSubscriberInitialized = false;
  private readonly instanceId = crypto.randomUUID();

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Publish an event to Redis (for inter-process/cluster communication) and execute locally.
   * Uses senderId to prevent duplicate execution when the event is received back via Redis subscriber.
   */
  public async publish<T>(channel: string, data: T): Promise<void> {
    const envelope: EventEnvelope<T> = {
      eventId: crypto.randomUUID(),
      senderId: this.instanceId,
      channel,
      data,
      timestamp: new Date().toISOString(),
    };

    const payload = JSON.stringify(envelope);

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

    // Execute local handlers for current process
    this.triggerLocal(channel, data);
  }

  /**
   * Subscribe an event handler to a channel
   */
  public subscribe<T>(channel: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler as EventHandler);
    this.registeredChannels.add(channel);

    this.ensureRedisSubscriber(channel);
  }

  /**
   * Clear all subscribers (useful for test resets)
   */
  public clear(): void {
    this.handlers.clear();
    this.registeredChannels.clear();
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

  private ensureRedisSubscriber(channel?: string): void {
    try {
      const sub = createRedisSubscriberClient();

      if (!this.isSubscriberInitialized) {
        this.isSubscriberInitialized = true;

        sub.on('message', (chan, message) => {
          try {
            const envelope: EventEnvelope = JSON.parse(message);

            // FIX: If this event was published by this same instance, ignore it
            // because this instance already executed it locally in publish().
            if (envelope.senderId === this.instanceId) {
              return;
            }

            this.triggerLocal(chan, envelope.data);
          } catch {
            // Fallback for non-envelope plain JSON messages
            try {
              const rawData = JSON.parse(message);
              this.triggerLocal(chan, rawData);
            } catch {
              // Ignore non-parseable payload
            }
          }
        });

        // When subscriber client connects or reconnects, subscribe to all registered channels
        sub.on('ready', () => {
          this.activeSubscriptions.clear();
          for (const ch of this.registeredChannels) {
            this.subscribeChannelOnRedis(sub, ch);
          }
        });

        // If not connected yet, initiate connection
        if (sub.status === 'wait') {
          sub.connect().catch((err) => {
            logger.debug('Redis subscriber connect deferred or failed', {
              error: err instanceof Error ? err.message : 'Unknown error',
            });
          });
        }
      }

      if (channel && sub.status === 'ready') {
        this.subscribeChannelOnRedis(sub, channel);
      }
    } catch (err) {
      logger.debug('Redis subscriber setup skipped', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  private subscribeChannelOnRedis(sub: ReturnType<typeof createRedisSubscriberClient>, channel: string): void {
    if (this.activeSubscriptions.has(channel)) {
      return;
    }

    sub.subscribe(channel, (err) => {
      if (err) {
        logger.error('Failed to subscribe to Redis channel', { channel, error: err.message });
      } else {
        this.activeSubscriptions.add(channel);
        logger.info(`Subscribed to Redis channel: ${channel}`);
      }
    });
  }
}

export const eventBus = EventBus.getInstance();
