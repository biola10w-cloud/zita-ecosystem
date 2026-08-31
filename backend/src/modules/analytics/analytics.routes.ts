import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AnalyticsService } from './analytics.service';
import { authenticate } from '../../shared/middleware/authenticate';
import { requireRole } from '../../shared/middleware/authenticate';
import { rateLimits } from '../../shared/middleware/rateLimiter';

const eventsSchema = z.object({
  events: z.array(z.object({
    eventType:  z.string(),
    bookId:     z.string().optional(),
    properties: z.record(z.any()).default({}),
    occurredAt: z.string().datetime(),
  })).max(50), // Batch limit
});

export async function analyticsRoutes(app: FastifyInstance) {
  // POST /api/v1/analytics/events â€” batch ingest from app
  app.post('/events', {
    preHandler: [authenticate],
    config: { rateLimit: rateLimits.analytics },
  }, async (request, reply) => {
    const { events } = eventsSchema.parse(request.body);
    await AnalyticsService.ingestEvents(request.user!.sub, events);
    return reply.status(202).send({ success: true, data: null });
  });

  // GET /api/v1/analytics/me â€” user's own stats
  app.get('/me', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const stats = await AnalyticsService.getUserReadingStats(request.user!.sub);
    return reply.send({ success: true, data: stats });
  });

  // GET /api/v1/analytics/dashboard â€” admin only
  app.get('/dashboard', {
    preHandler: [authenticate, requireRole('ADMIN')],
  }, async (request, reply) => {
    const { days } = request.query as { days?: string };
    const stats = await AnalyticsService.getDashboardStats(Number(days ?? 30));
    return reply.send({ success: true, data: stats });
  });
}
