import Redis, { RedisOptions } from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;
let subscriberClient: Redis | null = null;
let isShuttingDown = false;

/**
 * Builds safe ioredis connection options supporting both REDIS_URL and separate env vars.
 * Handles URL decoding for passwords with special characters and enables TLS when rediss:// is used.
 */
export function buildRedisOptions(role: 'client' | 'subscriber' = 'client'): RedisOptions {
  let options: RedisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest: role === 'subscriber' ? null : 3,
    enableReadyCheck: true,
    retryStrategy(times) {
      if (isShuttingDown) {
        return null;
      }
      // Reconnect with backoff capped at 5s
      const delay = Math.min(times * 300, 5000);
      return delay;
    },
    reconnectOnError(err) {
      // Do not endlessly spin-reconnect on permanent authentication errors
      if (err.message.includes('NOAUTH') || err.message.includes('WRONGPASS')) {
        return false;
      }
      return 1;
    },
  };

  const rawUrl = config.redis.url ? config.redis.url.trim() : '';

  if (rawUrl) {
    try {
      const parsedUrl = new URL(rawUrl);
      const isTls = parsedUrl.protocol === 'rediss:';

      options.host = parsedUrl.hostname || 'localhost';
      options.port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : isTls ? 6380 : 6379;

      if (parsedUrl.username) {
        options.username = decodeURIComponent(parsedUrl.username);
      }
      if (parsedUrl.password) {
        options.password = decodeURIComponent(parsedUrl.password);
      }
      if (isTls) {
        options.tls = {};
      }
      if (parsedUrl.pathname && parsedUrl.pathname.length > 1) {
        const dbIndex = parseInt(parsedUrl.pathname.slice(1), 10);
        if (!isNaN(dbIndex)) {
          options.db = dbIndex;
        }
      }
    } catch {
      logger.warn('Failed to parse REDIS_URL as a standard URL, using fallback host/port');
      options.host = config.redis.host;
      options.port = config.redis.port;
    }
  } else {
    options.host = config.redis.host;
    options.port = config.redis.port;
  }

  // Explicit env vars override or supply missing auth
  if (config.redis.username) {
    options.username = config.redis.username;
  }
  if (config.redis.password) {
    options.password = config.redis.password;
  }

  return options;
}

/**
 * Returns a masked endpoint string safe for logging without exposing passwords.
 */
export function getSanitizedRedisEndpoint(options: RedisOptions): string {
  const protocol = options.tls ? 'rediss:' : 'redis:';
  const host = options.host || 'localhost';
  const port = options.port || 6379;
  const user = options.username ? `${options.username}:` : '';
  const auth = options.password ? `${user}***@` : options.username ? `${options.username}@` : '';
  return `${protocol}//${auth}${host}:${port}/${options.db ?? 0}`;
}

/**
 * Attaches standard connection lifecycle event listeners to an ioredis instance.
 */
function attachLifecycleListeners(client: Redis, role: 'primary' | 'subscriber'): void {
  const sanitized = getSanitizedRedisEndpoint(client.options);

  // 'ready' fires ONLY after successful TCP connect AND authentication
  client.on('ready', () => {
    logger.info(`✅ Redis ${role} connected and ready`, { endpoint: sanitized });
  });

  client.on('connect', () => {
    logger.debug(`Redis ${role} TCP connection established`, { endpoint: sanitized });
  });

  client.on('error', (err: Error) => {
    if (err.message.includes('NOAUTH') || err.message.includes('WRONGPASS')) {
      logger.error(`Redis ${role} authentication error: credentials rejected by Redis server. Check REDIS_PASSWORD / REDIS_URL configuration.`, {
        error: err.message,
        endpoint: sanitized,
      });
    } else {
      logger.error(`Redis ${role} connection error`, {
        error: err.message,
        endpoint: sanitized,
      });
    }
  });

  client.on('close', () => {
    logger.warn(`Redis ${role} connection closed`, { endpoint: sanitized });
  });

  client.on('reconnecting', (delay: number) => {
    logger.debug(`Redis ${role} reconnecting in ${delay}ms...`);
  });
}

/**
 * Get or initialize the primary Redis client (singleton)
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const options = buildRedisOptions('client');
    redisClient = new Redis(options);
    attachLifecycleListeners(redisClient, 'primary');
  }

  return redisClient;
}

/**
 * Create a dedicated Redis subscriber client for pub/sub subscriptions
 */
export function createRedisSubscriberClient(): Redis {
  if (!subscriberClient) {
    const options = buildRedisOptions('subscriber');
    subscriberClient = new Redis(options);
    attachLifecycleListeners(subscriberClient, 'subscriber');
  }

  return subscriberClient;
}

/**
 * Connect the primary Redis client
 */
export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  if (client.status === 'ready' || client.status === 'connecting') {
    return;
  }

  try {
    await client.connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('NOAUTH') || message.includes('WRONGPASS')) {
      logger.error('❌ Redis authentication failed: please check your Redis credentials', { error: message });
    } else {
      logger.warn('⚠️ Redis connection failed (non-critical, falling back to in-memory events)', { error: message });
    }
  }
}

/**
 * Gracefully disconnect both primary and subscriber Redis clients
 */
export async function disconnectRedis(): Promise<void> {
  isShuttingDown = true;
  const clientsToDisconnect: Promise<unknown>[] = [];

  if (subscriberClient) {
    const sub = subscriberClient;
    subscriberClient = null;
    clientsToDisconnect.push(
      sub.quit().catch(() => sub.disconnect())
    );
  }

  if (redisClient) {
    const main = redisClient;
    redisClient = null;
    clientsToDisconnect.push(
      main.quit().catch(() => main.disconnect())
    );
  }

  await Promise.allSettled(clientsToDisconnect);
  logger.info('Redis disconnected gracefully');
  isShuttingDown = false;
}
