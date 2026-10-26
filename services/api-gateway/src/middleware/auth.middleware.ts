import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';
import { config } from '../config';

export interface AuthUser {
  id: string;
  role: 'admin' | 'user';
  email?: string;
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Generate a signed HS256 JWT using Node's crypto library.
 */
export function signToken(payload: AuthUser, expiresInSeconds = 3600): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.jwt.secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode an HS256 JWT token using timing-safe signature comparison.
 * Strictly enforces HS256 algorithm, numeric expiration claim (exp), and claim types.
 */
export function verifyToken(token: string): AuthUser {
  if (!config.jwt.secret || config.jwt.secret.trim().length === 0) {
    throw AppError.internal('Authentication configuration is missing or invalid on the server');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw AppError.unauthorized('Malformed authentication token');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw AppError.unauthorized('Malformed authentication token');
  }

  // 1. Validate header structure and enforce HS256 algorithm
  let header: any;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  } catch {
    throw AppError.unauthorized('Malformed authentication token header');
  }

  if (!header || typeof header !== 'object' || header.alg !== 'HS256') {
    throw AppError.unauthorized('Unsupported token algorithm: only HS256 is permitted');
  }

  // 2. Validate HMAC-SHA256 signature using timing-safe comparison
  const expectedSignature = crypto
    .createHmac('sha256', config.jwt.secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  const sigBuffer = Buffer.from(signatureB64);
  const expSigBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expSigBuffer.length || !crypto.timingSafeEqual(sigBuffer, expSigBuffer)) {
    throw AppError.unauthorized('Invalid authentication token signature');
  }

  // 3. Validate payload structure and claims
  let payload: any;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    throw AppError.unauthorized('Invalid authentication token payload');
  }

  if (!payload || typeof payload !== 'object') {
    throw AppError.unauthorized('Invalid authentication token claims');
  }

  // 4. Strict numeric expiration claim enforcement
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
    throw AppError.unauthorized('Authentication token missing valid numeric expiration claim');
  }

  const now = Math.floor(Date.now() / 1000);
  if (now > payload.exp) {
    throw AppError.unauthorized('Authentication token has expired');
  }

  // 5. Strict role claim validation
  if (typeof payload.id !== 'string' || payload.id.trim().length === 0) {
    throw AppError.unauthorized('Authentication token missing valid subject identifier');
  }

  if (payload.role !== 'admin' && payload.role !== 'user') {
    throw AppError.unauthorized('Authentication token has invalid role claim');
  }

  return payload as AuthUser;
}

/**
 * Middleware that requires a valid Bearer token.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('Authentication required: Bearer token missing');
  }

  const token = authHeader.slice(7).trim();
  const user = verifyToken(token);
  req.user = user;
  next();
}

/**
 * Middleware that requires an authenticated user with 'admin' role.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      throw AppError.forbidden('Admin authorization required');
    }
    next();
  });
}

/**
 * Helper to extract and verify auth optionally if present, without throwing on absence.
 */
export function getOptionalAuth(req: Request): AuthUser | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return undefined;
  }
  try {
    const token = authHeader.slice(7).trim();
    return verifyToken(token);
  } catch {
    return undefined;
  }
}
