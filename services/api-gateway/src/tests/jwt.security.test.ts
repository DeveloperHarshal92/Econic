import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import { createApp } from '../app';
import { validateJwtConfig, config } from '../config';
import { verifyToken, signToken } from '../middleware';

const app = createApp();

describe('JWT Security & Configuration Validation (Stage 1)', () => {
  describe('Startup Secret Validation (validateJwtConfig)', () => {
    it('should throw fatal error in production when JWT_SECRET is missing or empty', () => {
      expect(() => validateJwtConfig('production', '')).toThrow(/missing in production\/staging/);
      expect(() => validateJwtConfig('staging', '   ')).toThrow(/missing in production\/staging/);
    });

    it('should throw fatal error in production when JWT_SECRET uses a known insecure development default', () => {
      expect(() => validateJwtConfig('production', 'dev-secret-change-me')).toThrow(/known insecure development default/);
      expect(() => validateJwtConfig('staging', 'change-me-in-production')).toThrow(/known insecure development default/);
      expect(() => validateJwtConfig('production', 'secret')).toThrow(/known insecure development default/);
      expect(() => validateJwtConfig('production', 'password')).toThrow(/known insecure development default/);
    });

    it('should throw fatal error in production when JWT_SECRET is shorter than 32 characters', () => {
      expect(() => validateJwtConfig('production', 'short-secret-12345')).toThrow(/at least 32 characters long/);
    });

    it('should accept strong 32+ character secrets in production', () => {
      const strongSecret = 'super-secure-production-jwt-secret-key-32chars!';
      expect(() => validateJwtConfig('production', strongSecret)).not.toThrow();
      expect(() => validateJwtConfig('staging', strongSecret)).not.toThrow();
    });

    it('should permit development fallback in development and test environments', () => {
      expect(() => validateJwtConfig('development', 'dev-secret-change-me')).not.toThrow();
      expect(() => validateJwtConfig('test', 'dev-secret-change-me')).not.toThrow();
    });
  });

  describe('JWT Verification & Expiration Enforcement (verifyToken)', () => {
    it('should reject tokens with missing numeric expiration claim (exp)', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ id: 'admin-1', role: 'admin' })).toString('base64url'); // No exp!
      const sig = crypto.createHmac('sha256', config.jwt.secret).update(`${header}.${payload}`).digest('base64url');
      const token = `${header}.${payload}.${sig}`;

      expect(() => verifyToken(token)).toThrow(/missing valid numeric expiration claim/);
    });

    it('should reject tokens with non-numeric expiration claim', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ id: 'admin-1', role: 'admin', exp: 'never' })).toString('base64url');
      const sig = crypto.createHmac('sha256', config.jwt.secret).update(`${header}.${payload}`).digest('base64url');
      const token = `${header}.${payload}.${sig}`;

      expect(() => verifyToken(token)).toThrow(/missing valid numeric expiration claim/);
    });

    it('should reject expired tokens', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 60; // Expired 1 minute ago
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ id: 'admin-1', role: 'admin', exp: pastExp })).toString('base64url');
      const sig = crypto.createHmac('sha256', config.jwt.secret).update(`${header}.${payload}`).digest('base64url');
      const token = `${header}.${payload}.${sig}`;

      expect(() => verifyToken(token)).toThrow(/Authentication token has expired/);
    });

    it('should reject tokens with unsupported algorithm in header', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ id: 'admin-1', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })
      ).toString('base64url');
      const sig = crypto.createHmac('sha256', config.jwt.secret).update(`${header}.${payload}`).digest('base64url');
      const token = `${header}.${payload}.${sig}`;

      expect(() => verifyToken(token)).toThrow(/Unsupported token algorithm/);
    });

    it('should reject tokens with invalid signature', () => {
      const token = signToken({ id: 'admin-1', role: 'admin' });
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.tampered-signature`;

      expect(() => verifyToken(tamperedToken)).toThrow(/Invalid authentication token signature/);
    });

    it('should reject malformed tokens with invalid structure', () => {
      expect(() => verifyToken('not-a-token')).toThrow(/Malformed authentication token/);
      expect(() => verifyToken('part1.part2')).toThrow(/Malformed authentication token/);
      expect(() => verifyToken('..')).toThrow(/Malformed authentication token/);
    });

    it('should reject tokens missing valid subject id or with invalid role', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ id: '', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })
      ).toString('base64url');
      const sig = crypto.createHmac('sha256', config.jwt.secret).update(`${header}.${payload}`).digest('base64url');
      const token = `${header}.${payload}.${sig}`;

      expect(() => verifyToken(token)).toThrow(/missing valid subject identifier/);

      const invalidRolePayload = Buffer.from(
        JSON.stringify({ id: 'user-1', role: 'super-admin', exp: Math.floor(Date.now() / 1000) + 3600 })
      ).toString('base64url');
      const sig2 = crypto.createHmac('sha256', config.jwt.secret).update(`${header}.${invalidRolePayload}`).digest('base64url');
      const token2 = `${header}.${invalidRolePayload}.${sig2}`;

      expect(() => verifyToken(token2)).toThrow(/invalid role claim/);
    });
  });

  describe('Route-Level Role Authorization Boundary', () => {
    it('should deny non-admin users from product mutation routes with 403 FORBIDDEN', async () => {
      const userToken = signToken({ id: 'regular-user-id', role: 'user', email: 'user@vetu.com' });

      const postRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Hacked Product' });

      expect(postRes.status).toBe(403);
      expect(postRes.body.error.code).toBe('FORBIDDEN');

      const patchRes = await request(app)
        .patch('/api/products/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Tampered' });

      expect(patchRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete('/api/products/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${userToken}`);

      expect(deleteRes.status).toBe(403);
    });
  });
});
