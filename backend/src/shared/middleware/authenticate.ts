import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { config } from '../../config';
import { prisma } from '../db/prisma';

// Load RSA public key once at startup
const publicKey = fs.readFileSync(config.JWT_PUBLIC_KEY_PATH, 'utf8');

export interface JwtPayload {
  sub: string;       // userId
  email: string;
  role: string;
  deviceId: string;
  iat: number;
  exp: number;
}

// Augment FastifyRequest with our user type
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

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
    }) as JwtPayload;

    request.user = payload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return reply.status(401).send({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Access token expired' },
      });
    }

    return reply.status(401).send({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid access token' },
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
