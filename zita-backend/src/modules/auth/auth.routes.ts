import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';
import { authenticate } from '../../shared/middleware/authenticate';

export async function authRoutes(app: FastifyInstance) {
  // Public
  app.post('/register', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, AuthController.register);
  app.post('/login',    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, AuthController.login);
  app.post('/refresh',  { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, AuthController.refresh);

  // Authenticated
  app.post('/logout', { preHandler: [authenticate] }, AuthController.logout);
  app.get('/me',      { preHandler: [authenticate] }, AuthController.me);
}
