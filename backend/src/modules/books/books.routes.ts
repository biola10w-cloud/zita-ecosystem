import { FastifyInstance } from 'fastify';
import { readingTestAccess } from './reading-access';
import { BooksController } from './books.controller';
import { authenticate } from '../../shared/middleware/authenticate';
import { rateLimits } from '../../shared/middleware/rateLimiter';

export async function booksRoutes(app: FastifyInstance) {
  // Public routes
  app.get('/access-policy', { preHandler: [authenticate] }, async (request) => ({ success: true, data: { readingTestAccess: await readingTestAccess(request.user!.sub) } }));
  app.get('/',            { config: { rateLimit: rateLimits.api } }, BooksController.list);
  app.get('/categories',  { config: { rateLimit: rateLimits.api } }, BooksController.categories);
  app.get('/featured',    { config: { rateLimit: rateLimits.api } }, BooksController.featured);
  app.get('/trending',    { config: { rateLimit: rateLimits.api } }, BooksController.trending);
  app.get('/:slug',       { config: { rateLimit: rateLimits.api } }, BooksController.getOne);

  // Authenticated routes
  app.post('/:slug/like',   { preHandler: [authenticate] }, BooksController.like);
  app.delete('/:slug/like', { preHandler: [authenticate] }, BooksController.unlike);
}
