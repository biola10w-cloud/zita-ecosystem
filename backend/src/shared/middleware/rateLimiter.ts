import { FastifyInstance } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';
import { config } from '../../config';

const redis = new Redis(config.REDIS_URL);

export async function registerRateLimiter(app: FastifyInstance) {
  await app.register(fastifyRateLimit, {
    global: false, // Apply per-route, not globally
    redis,
    keyGenerator: (request) => {
      // Rate limit by user ID if authenticated, else by IP
      return (request.user?.sub ?? request.ip) + ':' + request.routerPath;
    },
  });
}

// Pre-built rate limit configs for different route types
export const rateLimits = {
  // Auth endpoints â€” strict to prevent brute force
  auth: {
    max: 5,
    timeWindow: '15 minutes',
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Please try again in 15 minutes.',
      },
    }),
  },

  // Standard API calls
  api: {
    max: 100,
    timeWindow: '1 minute',
  },

  // Expensive operations (translation, encryption)
  heavy: {
    max: 20,
    timeWindow: '1 minute',
  },

  // Analytics ingestion
  analytics: {
    max: 200,
    timeWindow: '1 minute',
  },
};
