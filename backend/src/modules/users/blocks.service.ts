import { prisma } from '../../shared/db/prisma';

export class BlocksService {
  static async excludedIds(userId?: string): Promise<string[]> {
    if (!userId) return [];
    const rows = await prisma.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    return rows.map(row => row.blockerId === userId ? row.blockedId : row.blockerId);
  }

  static list(userId: string) {
    return prisma.userBlock.findMany({
      where: { blockerId: userId }, orderBy: { createdAt: 'desc' },
      select: { blockedId: true, createdAt: true, blocked: { select: { displayName: true } } },
    });
  }

  static async block(userId: string, blockedId: string) {
    if (userId === blockedId) throw Object.assign(new Error('You cannot block yourself.'), { statusCode: 400 });
    if (!await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } })) {
      throw Object.assign(new Error('Reader not found.'), { statusCode: 404 });
    }
    await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId } },
      create: { blockerId: userId, blockedId }, update: {},
    });
  }

  static async unblock(userId: string, blockedId: string) {
    await prisma.userBlock.deleteMany({ where: { blockerId: userId, blockedId } });
  }
}
