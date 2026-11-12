import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  userBlock: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  user: { findUnique: vi.fn() },
  comment: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  checkText: vi.fn(),
}));
vi.mock('../../shared/db/prisma', () => ({ prisma: mocks }));
vi.mock('../../shared/moderation/moderation.service', () => ({ ModerationService: { checkText: mocks.checkText } }));
import { BlocksService } from './blocks.service';
import { CommunityService } from '../community/community.service';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.userBlock.findMany.mockResolvedValue([{ blockerId: 'reader', blockedId: 'hidden' }, { blockerId: 'other', blockedId: 'reader' }]);
  mocks.user.findUnique.mockResolvedValue({ id: 'hidden' });
  mocks.comment.findMany.mockResolvedValue([]); mocks.comment.count.mockResolvedValue(0);
  mocks.checkText.mockResolvedValue({ flagged: false });
});

it('makes blocks persistent and restricts unblock to the acting reader', async () => {
  await BlocksService.block('reader', 'hidden');
  expect(mocks.userBlock.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { blockerId: 'reader', blockedId: 'hidden' } }));
  await BlocksService.unblock('reader', 'hidden');
  expect(mocks.userBlock.deleteMany).toHaveBeenCalledWith({ where: { blockerId: 'reader', blockedId: 'hidden' } });
});
it('rejects self-blocking and missing users', async () => {
  await expect(BlocksService.block('reader', 'reader')).rejects.toMatchObject({ statusCode: 400 });
  mocks.user.findUnique.mockResolvedValue(null);
  await expect(BlocksService.block('reader', 'missing')).rejects.toMatchObject({ statusCode: 404 });
  expect(mocks.userBlock.upsert).not.toHaveBeenCalled();
});
it('filters both sides of a block from posts, inline replies and pagination counts', async () => {
  await CommunityService.listComments({ userId: 'reader', page: 1, limit: 20, sort: 'recent' });
  const args = mocks.comment.findMany.mock.calls[0][0];
  expect(args.where.userId.notIn).toEqual(['hidden', 'other']);
  expect(args.include.replies.where.userId.notIn).toEqual(['hidden', 'other']);
  expect(mocks.comment.count).toHaveBeenCalledWith({ where: args.where });
});
it('rejects replying to a blocked author even with a known comment ID', async () => {
  mocks.comment.findFirst.mockResolvedValue({ userId: 'hidden', parentId: null, bookId: null });
  await expect(CommunityService.createComment({ userId: 'reader', body: 'Reply', parentId: 'post' })).rejects.toMatchObject({ statusCode: 403 });
  expect(mocks.comment.create).not.toHaveBeenCalled();
});
it('does not expose replies when the parent discussion is hidden', async () => {
  mocks.comment.findFirst.mockResolvedValue(null);
  await expect(CommunityService.getReplies('post', 1, 20, 'reader')).rejects.toMatchObject({ statusCode: 404 });
  expect(mocks.comment.findMany).not.toHaveBeenCalled();
});
