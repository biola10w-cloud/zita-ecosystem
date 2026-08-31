import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';
import { authenticate } from '../../shared/middleware/authenticate';
import { rateLimits } from '../../shared/middleware/rateLimiter';

export async function authRoutes(app: FastifyInstance) {
  // POST /api/v1/auth/register
  app.post('/register', {
    config: { rateLimit: rateLimits.auth },
  }, AuthController.register);

  // POST /api/v1/auth/login
  app.post('/login', {
    config: { rateLimit: rateLimits.auth },
  }, AuthController.login);

  // POST /api/v1/auth/refresh
  app.post('/refresh', {
    config: { rateLimit: rateLimits.auth },
  }, AuthController.refresh);

  // POST /api/v1/auth/forgot-password
  app.post('/forgot-password', {
    config: { rateLimit: rateLimits.auth },
  }, AuthController.forgotPassword);

  // POST /api/v1/auth/reset-password
  app.post('/reset-password', {
    config: { rateLimit: rateLimits.auth },
  }, AuthController.resetPassword);

  // POST /api/v1/auth/logout  (requires auth)
  app.post('/logout', {
    preHandler: [authenticate],
  }, AuthController.logout);

  // GET /api/v1/auth/me  (requires auth)
  app.get('/me', {
    preHandler: [authenticate],
  }, AuthController.me);
}
