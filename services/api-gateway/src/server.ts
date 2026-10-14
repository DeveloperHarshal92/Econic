import { createApp } from './app';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { initInventoryEventConsumer } from './events/inventoryEvents';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  try {
    // Connect to databases
    await connectDatabase();
    await connectRedis();

    // Start event consumers
    initInventoryEventConsumer();

    // Create and start server
    const app = createApp();
    const server = app.listen(config.port, config.host, () => {
      logger.info(`🚀 API Gateway running`, {
        port: config.port,
        env: config.env,
        url: `http://${config.host}:${config.port}`,
      });
    });

    // ─── Graceful Shutdown ───────────────────────────────
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — shutting down gracefully`);

      server.close(async () => {
        await disconnectDatabase();
        await disconnectRedis();
        logger.info('Server shut down cleanly');
        process.exit(0);
      });

      // Force exit after 10s
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Catch unhandled rejections
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to start server', { error: message });
    process.exit(1);
  }
}

bootstrap();
