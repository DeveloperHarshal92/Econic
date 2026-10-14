import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.API_PORT || '4000', 10),
  host: process.env.API_HOST || '0.0.0.0',

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiry: process.env.JWT_EXPIRY || '7d',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },

  cors: {
    origins: [
      process.env.SHELL_URL || 'http://localhost:3000',
      process.env.CATALOG_URL || 'http://localhost:3001',
      process.env.CART_URL || 'http://localhost:3002',
      process.env.CHECKOUT_URL || 'http://localhost:3003',
    ],
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
} as const;
