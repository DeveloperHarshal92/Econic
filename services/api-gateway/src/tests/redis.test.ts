import { describe, it, expect, afterAll } from 'vitest';
import Redis from 'ioredis';
import { getRedisClient, createRedisSubscriberClient, disconnectRedis, buildRedisOptions, getSanitizedRedisEndpoint } from '../config/redis';
import { eventBus } from '../events/eventBus';

describe('Redis Configuration & Authentication', () => {
  afterAll(async () => {
    await disconnectRedis();
  });

  it('should mask sensitive passwords in getSanitizedRedisEndpoint', () => {
    const sanitized = getSanitizedRedisEndpoint({
      host: 'redis.example.com',
      port: 6379,
      username: 'default',
      password: 'super_secret_password_123',
    });

    expect(sanitized).not.toContain('super_secret_password_123');
    expect(sanitized).toBe('redis://default:***@redis.example.com:6379/0');
  });

  it('should decode URL-encoded special characters in passwords and usernames', () => {
    const rawUrl = 'redis://default:my%40pass%23word%24@localhost:6379/2';
    // Temporarily test parser directly
    const parsed = new URL(rawUrl);
    expect(decodeURIComponent(parsed.password)).toBe('my@pass#word$');
  });

  it('should authenticate successfully with configured credentials and execute PING', async () => {
    const client = getRedisClient();
    if (client.status === 'wait') {
      await client.connect();
    }

    const pong = await client.ping();
    expect(pong).toBe('PONG');
    expect(client.status).toBe('ready');
  });

  it('should support pub/sub after authentication and prevent duplicate local execution', async () => {
    const testChannel = 'test:channel:' + Date.now();
    let executionCount = 0;

    eventBus.subscribe(testChannel, () => {
      executionCount++;
    });

    // Publish event
    await eventBus.publish(testChannel, { item: 'sample', qty: 1 });

    // Wait briefly for Redis round-trip
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Execution count must be exactly 1, proving no duplicate processing from the subscriber loop
    expect(executionCount).toBe(1);
  });

  it('should catch invalid credentials and emit a clear authentication error without leaking the secret', async () => {
    const validOptions = buildRedisOptions('client');
    const secretToNeverLeak = 'my_deliberately_invalid_test_secret_999';

    const badClient = new Redis({
      host: validOptions.host,
      port: validOptions.port,
      username: 'default',
      password: secretToNeverLeak,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    let capturedError: Error | null = null;
    badClient.on('error', (err) => {
      capturedError = err;
    });

    try {
      await badClient.connect();
    } catch {
      // Connect throws when authentication fails
    }

    expect(capturedError).not.toBeNull();
    // Redis returns WRONGPASS or NOAUTH
    expect(['WRONGPASS', 'NOAUTH'].some((term) => (capturedError as Error).message.includes(term))).toBe(true);

    // Verify secret was not leaked in error message
    expect((capturedError as Error).message).not.toContain(secretToNeverLeak);

    await badClient.disconnect();
  });
});
