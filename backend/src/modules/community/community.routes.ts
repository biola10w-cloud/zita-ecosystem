import { FastifyInstance } from 'fastify';
import { CommunityController } from './community.controller';
import { authenticate } from '../../shared/middleware/authenticate';
import { rateLimits } from '../../shared/middleware/rateLimiter';

export async function communityRoutes(app: FastifyInstance) {
  const api = { config: { rateLimit: rateLimits.api } };

  // GET /api/v1/books/:slug/comments  (public)
  app.get('/books/:slug/comments', api, CommunityController.listComments);

  // POST /api/v1/books/:slug/comments  (auth required)
  app.post('/books/:slug/comments', {
    preHandler: [authenticate],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, CommunityController.createComment);

  // Comment actions
  app.put('/comments/:id',    { preHandler: [authenticate] }, CommunityController.updateComment);
  app.delete('/comments/:id', { preHandler: [authenticate] }, CommunityController.deleteComment);

  app.post('/comments/:id/like',   { preHandler: [authenticate] }, CommunityController.likeComment);
  app.delete('/comments/:id/like', { preHandler: [authenticate] }, CommunityController.unlikeComment);

  app.post('/comments/:id/report', { preHandler: [authenticate] }, CommunityController.reportComment);

  // GET replies for a comment
  app.get('/comments/:id/replies', api, CommunityController.getReplies);
}
