import { FastifyInstance } from 'fastify';
import { ReaderController } from './reader.controller';
import { authenticate } from '../../shared/middleware/authenticate';
import { rateLimits } from '../../shared/middleware/rateLimiter';

export async function readerRoutes(app: FastifyInstance) {
  // All reader routes require authentication
  const auth = { preHandler: [authenticate] };
  const heavy = { preHandler: [authenticate], config: { rateLimit: rateLimits.heavy } };

  // GET /api/v1/books/:slug/chapters/:index/content
  app.get('/:slug/chapters/:index/content', heavy, ReaderController.getChapterContent);

  // GET /api/v1/books/:slug/chapters/:index/audio — "listen to the book"
  app.get('/:slug/chapters/:index/audio', heavy, ReaderController.getChapterAudio);

  // POST /api/v1/books/:slug/progress
  app.post('/:slug/progress', auth, ReaderController.saveProgress);

  // GET /api/v1/books/:slug/progress
  app.get('/:slug/progress', auth, ReaderController.getProgress);

  // POST /api/v1/books/:slug/highlights
  app.post('/:slug/highlights', auth, ReaderController.saveHighlight);

  // GET /api/v1/books/:slug/highlights
  app.get('/:slug/highlights', auth, ReaderController.getHighlights);
}
