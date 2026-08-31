import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OfflineService } from './offline.service';
import { authenticate } from '../../shared/middleware/authenticate';
import { rateLimits } from '../../shared/middleware/rateLimiter';

const grantKeySchema = z.object({
  deviceId:            z.string().cuid(),
  devicePublicKeyPem:  z.string().min(100),  // RSA PEM public key
  isDeviceCompromised: z.boolean().default(false),
});

export async function offlineRoutes(app: FastifyInstance) {
  // POST /api/v1/books/:slug/offline-key
  app.post('/:slug/offline-key', {
    preHandler: [authenticate],
    config: { rateLimit: rateLimits.heavy },
  }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const body = grantKeySchema.parse(request.body);

    const result = await OfflineService.grantOfflineKey(
      request.user!.sub,
      slug,
      body.deviceId,
      body.devicePublicKeyPem,
      body.isDeviceCompromised,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  // DELETE /api/v1/books/:slug/offline-key
  app.delete('/:slug/offline-key', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { deviceId } = request.body as { deviceId: string };

    await OfflineService.revokeOfflineKey(request.user!.sub, slug, deviceId);
    return reply.send({ success: true, data: null });
  });

  // GET /api/v1/books/offline
  app.get('/offline', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { deviceId } = request.query as { deviceId: string };
    const books = await OfflineService.listOfflineBooks(request.user!.sub, deviceId);
    return reply.send({ success: true, data: books });
  });
}
