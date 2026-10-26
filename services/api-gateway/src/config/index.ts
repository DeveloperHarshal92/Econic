import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const KNOWN_INSECURE_DEV_SECRETS = [
  'dev-secret-change-me',
  'change-me-in-production',
  'secret',
  'jwt-secret',
  'password',
  '12345678',
  'admin',
];

export function validateJwtConfig(env: string, secret?: string): void {
  const isProdOrStaging = env === 'production' || env === 'staging';

  if (isProdOrStaging) {
    if (!secret || secret.trim().length === 0) {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production/staging. Application cannot start securely.');
    }
    if (KNOWN_INSECURE_DEV_SECRETS.includes(secret.toLowerCase())) {
      throw new Error('FATAL: JWT_SECRET must not use a known insecure development default in production/staging.');
    }
    if (secret.length < 32) {
      throw new Error('FATAL: JWT_SECRET must be at least 32 characters long in production/staging for HS256 security.');
    }
  }
}

const currentEnv = process.env.NODE_ENV || 'development';
const isDevOrTest = currentEnv === 'development' || currentEnv === 'test';
const resolvedJwtSecret = process.env.JWT_SECRET || (isDevOrTest ? 'dev-secret-change-me' : '');

export const config = {
  env: currentEnv,
  port: parseInt(process.env.API_PORT || '4000', 10),
  host: process.env.API_HOST || '0.0.0.0',

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce',
  },

  redis: {
    url: process.env.REDIS_URL || '',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    username: process.env.REDIS_USERNAME || process.env.REDIS_USER || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: resolvedJwtSecret,
    expiry: process.env.JWT_EXPIRY || '1h',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    currency: process.env.RAZORPAY_CURRENCY || 'INR',
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
