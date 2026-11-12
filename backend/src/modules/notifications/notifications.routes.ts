import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../shared/middleware/authenticate';
import { NotificationsService } from './notifications.service';

export async function notificationsRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async request => ({
    success: true,
    data: await NotificationsService.list(request.user!.sub),
  }));

  app.get('/unread-count', { preHandler: [authenticate] }, async request => ({
    success: true,
    data: { unreadCount: await NotificationsService.unreadCount(request.user!.sub) },
  }));

  app.patch('/read-all', { preHandler: [authenticate] }, async request => {
    await NotificationsService.markAllRead(request.user!.sub);
    return { success: true, data: null };
  });

  app.patch('/:id/read', { preHandler: [authenticate] }, async request => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await NotificationsService.markRead(request.user!.sub, id);
    return { success: true, data: null };
  });
}
