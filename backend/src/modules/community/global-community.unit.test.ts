import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  book: { findFirst: vi.fn() },
  comment: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
  checkText: vi.fn(),
  userBlock: { findMany: vi.fn() },
}));
vi.mock('../../shared/db/prisma', () => ({ prisma: mocks }));
vi.mock('../../shared/moderation/moderation.service', () => ({ ModerationService: { checkText: mocks.checkText } }));
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';

beforeEach(() => {
  vi.resetAllMocks(); mocks.checkText.mockResolvedValue({ flagged: false });
  mocks.userBlock.findMany.mockResolvedValue([]);
  mocks.comment.create.mockImplementation(async ({ data }) => ({ ...data, id: 'new', user: { displayName: 'Reader' } }));
  mocks.comment.findMany.mockResolvedValue([]); mocks.comment.count.mockResolvedValue(0);
});

describe('shared community', () => {
  it('creates a post without looking up a book', async () => {
    await CommunityService.createComment({ userId: 'reader', body: 'Any good books to recommend?' });
    expect(mocks.book.findFirst).not.toHaveBeenCalled();
    expect(mocks.comment.create.mock.calls[0][0].data.bookId).toBeNull();
  });
  it('includes general posts and existing published-book posts, excluding drafts', async () => {
    await CommunityService.listComments({ page: 2, limit: 20, sort: 'recent' });
    expect(mocks.comment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 20, where: { parentId: null, isDeleted: false, OR: [{ bookId: null }, { book: { isPublished: true } }] },
    }));
    expect(mocks.book.findFirst).not.toHaveBeenCalled();
  });
  it.each([null, 'existing-book'])('preserves a parent association when replying globally (%s)', async bookId => {
    mocks.comment.findFirst.mockResolvedValue({ id: 'parent', parentId: null, userId: 'reader', bookId });
    await CommunityService.createComment({ userId: 'reader', body: 'A reply', parentId: 'parent' });
    expect(mocks.comment.create.mock.calls[0][0].data.bookId).toBe(bookId);
  });
  it('rejects replying to deleted or unavailable parents', async () => {
    mocks.comment.findFirst.mockResolvedValue(null);
    await expect(CommunityService.createComment({ userId: 'reader', body: 'Reply', parentId: 'missing' })).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.comment.create).not.toHaveBeenCalled();
  });
  it('accepts actual UUID comment IDs through the controller', async () => {
    const parentId = '00000000-0000-4000-8000-000000000001';
    mocks.comment.findFirst.mockResolvedValue({ id: parentId, parentId: null, userId: 'reader', bookId: null });
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };
    await CommunityController.createComment({ params: {}, body: { body: 'Reply', parentId }, user: { sub: 'reader' } } as any, reply as any);
    expect(reply.status).toHaveBeenCalledWith(201);
  });
  it('rejects blank posts and invalid pagination', async () => {
    await expect(CommunityController.createComment({ params: {}, body: { body: '   ' }, user: { sub: 'reader' } } as any, {} as any)).rejects.toThrow();
    await expect(CommunityController.listComments({ params: {}, query: { page: '-1' } } as any, {} as any)).rejects.toThrow();
    expect(mocks.comment.create).not.toHaveBeenCalled();
  });
});
