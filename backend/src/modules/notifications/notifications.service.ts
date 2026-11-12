import { prisma } from '../../shared/db/prisma';
import { BlocksService } from '../users/blocks.service';

export class NotificationsService {
  static async list(userId: string) {
    const excluded = await BlocksService.excludedIds(userId);
    const where = {
      recipientId: userId,
      comment: { isDeleted: false },
      ...(excluded.length ? { actorId: { notIn: excluded } } : {}),
    };
    const [items, unreadCount] = await Promise.all([
      prisma.appNotification.findMany({
        where,
        take: 50,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          createdAt: true,
          readAt: true,
          commentId: true,
          actor: { select: { id: true, displayName: true } },
          comment: {
            select: {
              id: true,
              body: true,
              parentId: true,
              parent: {
                select: {
                  id: true,
                  body: true,
                  user: { select: { id: true, displayName: true } },
                },
              },
              book: { select: { slug: true, title: true } },
            },
          },
        },
      }),
      prisma.appNotification.count({ where: { ...where, readAt: null } }),
    ]);
    return { items, unreadCount };
  }

  static async unreadCount(userId: string) {
    const excluded = await BlocksService.excludedIds(userId);
    return prisma.appNotification.count({
      where: {
        recipientId: userId,
        readAt: null,
        comment: { isDeleted: false },
        ...(excluded.length ? { actorId: { notIn: excluded } } : {}),
      },
    });
  }

  static async markRead(userId: string, notificationId: string) {
    await prisma.appNotification.updateMany({
      where: { id: notificationId, recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  static async markAllRead(userId: string) {
    await prisma.appNotification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
