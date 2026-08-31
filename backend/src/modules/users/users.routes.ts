import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../shared/middleware/authenticate';
import { prisma } from '../../shared/db/prisma';

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
  preferredLanguage: z.string().trim().length(2).optional(),
}).strict();

export async function usersRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.sub },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        preferredLanguage: true,
        createdAt: true,
        subscription: {
          select: { status: true, currentPeriodEnd: true },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    return { success: true, data: user };
  });

  app.patch('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const input = profileSchema.parse(request.body);
    const user = await prisma.user.update({
      where: { id: request.user!.sub },
      data: input,
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        preferredLanguage: true,
        createdAt: true,
      },
    });

    return { success: true, data: user };
  });

  app.get('/me/devices', { preHandler: [authenticate] }, async (request) => {
    const devices = await prisma.device.findMany({
      where: { userId: request.user!.sub },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, platform: true, lastSeenAt: true, createdAt: true },
    });

    return { success: true, data: devices };
  });

  app.delete('/me/devices/:deviceId', { preHandler: [authenticate] }, async (request, reply) => {
    const params = z.object({ deviceId: z.string().uuid() }).parse(request.params);
    const device = await prisma.device.findFirst({
      where: { id: params.deviceId, userId: request.user!.sub },
      select: { id: true },
    });

    if (!device) {
      return reply.status(404).send({
        success: false,
        error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found' },
      });
    }

    await prisma.$transaction([
      prisma.session.deleteMany({ where: { deviceId: device.id } }),
      prisma.offlineKey.deleteMany({ where: { deviceId: device.id } }),
      prisma.device.delete({ where: { id: device.id } }),
    ]);

    return { success: true, data: { id: device.id } };
  });
}
