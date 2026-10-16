import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { jwtPublicKey as publicKey } from '../security/jwtKeys';
import { prisma } from '../db/prisma';

export interface JwtPayload {
  sub: string;       // userId
  email: string;
  role: string;
  deviceId: string;
  sid: string;       // Session ID; revocation applies before the JWT expires.
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

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
    }) as JwtPayload;

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

  // Check the precise session, not just the device: browsers can share a
  // fingerprint and revoked JWTs must not remain valid for another 15 minutes.
  const session = typeof payload.sid === 'string' ? await prisma.session.findFirst({
    where: { id: payload.sid, userId: payload.sub, deviceId: payload.deviceId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  }) : null;
  if (!session) return reply.status(401).send({
    success: false, error: { code: 'SESSION_ENDED', message: 'This session has ended. Your account may have signed in elsewhere. Please sign in again.' },
  });
  request.user = payload;
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
