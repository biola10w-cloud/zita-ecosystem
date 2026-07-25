import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { config } from '../../config';

/**
 * Load the RSA public key.
 *
 * On Railway (and any cloud host):
 *   Set JWT_PUBLIC_KEY env var to the full PEM string.
 *   Railway cannot mount files, so we read from env first.
 *
 * Locally:
 *   Set JWT_PUBLIC_KEY_PATH to the path of your public.pem file.
 *   Falls back to file if env var is not set.
 */
function loadPublicKey(): string {
  // 1. Prefer env variable (Railway, Heroku, etc.)
  if (process.env.JWT_PUBLIC_KEY) {
    return process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');
  }
  // 2. Fall back to file path (local dev)
  if (config.JWT_PUBLIC_KEY_PATH) {
    try {
      return fs.readFileSync(config.JWT_PUBLIC_KEY_PATH, 'utf8');
    } catch {
      console.warn('⚠ Could not read JWT_PUBLIC_KEY_PATH, and JWT_PUBLIC_KEY env is not set.');
    }
  }
  throw new Error('JWT public key not configured. Set JWT_PUBLIC_KEY or JWT_PUBLIC_KEY_PATH.');
}

/**
 * Load the RSA private key.
 *
 * Same strategy — env var first, file fallback.
 */
export function loadPrivateKey(): string {
  if (process.env.JWT_PRIVATE_KEY) {
    return process.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
  if (config.JWT_PRIVATE_KEY_PATH) {
    try {
      return fs.readFileSync(config.JWT_PRIVATE_KEY_PATH, 'utf8');
    } catch {
      console.warn('⚠ Could not read JWT_PRIVATE_KEY_PATH, and JWT_PRIVATE_KEY env is not set.');
    }
  }
  throw new Error('JWT private key not configured. Set JWT_PRIVATE_KEY or JWT_PRIVATE_KEY_PATH.');
}

// Load once at startup — not on every request
const publicKey = loadPublicKey();

export interface JwtPayload {
  sub:      string;
  email:    string;
  role:     string;
  deviceId: string;
  iat:      number;
  exp:      number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' },
    });
  }

  try {
    request.user = jwt.verify(
      authHeader.slice(7),
      publicKey,
      { algorithms: ['RS256'] },
    ) as JwtPayload;
  } catch (err) {
    const code = err instanceof jwt.TokenExpiredError
      ? 'TOKEN_EXPIRED'
      : 'INVALID_TOKEN';
    return reply.status(401).send({
      success: false,
      error: { code, message: 'Invalid or expired token' },
    });
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
    }
    if (!roles.includes(request.user.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    }
  };
}
