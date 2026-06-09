import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { config } from '../../config';

const publicKey = fs.readFileSync(config.JWT_PUBLIC_KEY_PATH, 'utf8');

export interface JwtPayload { sub: string; email: string; role: string; deviceId: string; iat: number; exp: number; }

declare module 'fastify' { interface FastifyRequest { user?: JwtPayload; } }

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' } });
  try {
    request.user = jwt.verify(authHeader.slice(7), publicKey, { algorithms: ['RS256'] }) as JwtPayload;
  } catch (err) {
    const code = err instanceof jwt.TokenExpiredError ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    return reply.status(401).send({ success: false, error: { code, message: 'Invalid or expired token' } });
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    if (!roles.includes(request.user.role)) return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
  };
}
