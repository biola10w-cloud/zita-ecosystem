import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { ZodError } from 'zod';

const mocks = vi.hoisted(() => ({
  book: { findUniqueOrThrow: vi.fn(), update: vi.fn(), delete: vi.fn(), create: vi.fn() },
  category: { count: vi.fn() }, deletedBook: { create: vi.fn() },
  tag: { upsert: vi.fn() }, $transaction: vi.fn(),
  uploadPrivateSource: vi.fn(), uploadPublicAsset: vi.fn(), queue: { add: vi.fn() },
}));
vi.mock('../../shared/db/prisma', () => ({ prisma: mocks }));
vi.mock('../../shared/storage/s3', () => ({ S3Service: mocks }));
vi.mock('../../shared/queue/queues', () => ({ encryptionQueue: mocks.queue, translationQueue: mocks.queue }));
vi.mock('../../shared/middleware/authenticate', () => ({
  authenticate: async (req: any, reply: any) => { if (!req.headers.authorization) return reply.status(401).send({ success: false }); },
  requireRole: (...roles: string[]) => async (req: any, reply: any) => { if (!roles.includes(req.headers.authorization)) return reply.status(403).send({ success: false }); },
}));
import { AdminService } from './admin.service';
import { adminRoutes } from './admin.routes';

const input = { title: 'Updated title', authorName: 'Author', description: 'Description', contentType: 'BOOK' as const,
  language: 'en', estimatedMinutes: 30, isPremium: false, price: null, tags: ['Wisdom', 'wisdom'], categoryIds: ['one', 'two', 'one'] };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.category.count.mockResolvedValue(2);
  mocks.book.findUniqueOrThrow.mockResolvedValue({ id: 'book', slug: 'original-slug', category: null, categories: [], tags: [] });
  mocks.$transaction.mockImplementation((callback) => callback(mocks));
});

describe('book management', () => {
  it('replaces category assignments atomically and keeps the slug and content unchanged', async () => {
    await AdminService.updateBook('book', input);
    const data = mocks.book.update.mock.calls[0][0].data;
    expect(data.categories).toEqual({ deleteMany: {}, create: [{ categoryId: 'one' }, { categoryId: 'two' }] });
    expect(data.categoryId).toBe('one');
    expect(data.price).toBeNull();
    expect(data.tags.create).toHaveLength(1);
    expect(data).not.toHaveProperty('slug');
    expect(data).not.toHaveProperty('encryptedFileKey');
    expect(data).not.toHaveProperty('isPublished');
  });
  it('allows removing all categories and clearing the legacy primary category', async () => {
    mocks.category.count.mockResolvedValue(0);
    await AdminService.updateBook('book', { ...input, categoryIds: [] });
    expect(mocks.book.update.mock.calls[0][0].data).toMatchObject({ categoryId: null, categories: { deleteMany: {}, create: [] } });
  });
  it('rejects unknown categories without modifying the book', async () => {
    mocks.category.count.mockResolvedValue(1);
    await expect(AdminService.updateBook('book', input)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.book.update).not.toHaveBeenCalled();
  });
  it('records durable cleanup and deletes the book in the same transaction', async () => {
    mocks.book.findUniqueOrThrow.mockResolvedValue({ id: 'book', slug: 'original-slug' });
    await AdminService.deleteBook('book');
    expect(mocks.$transaction).toHaveBeenCalledOnce();
    expect(mocks.deletedBook.create).toHaveBeenCalledWith({ data: { id: 'book', slug: 'original-slug' } });
    expect(mocks.book.delete).toHaveBeenCalledWith({ where: { id: 'book' } });
  });
  it('does not delete if the durable cleanup request fails', async () => {
    mocks.deletedBook.create.mockRejectedValue(new Error('database failure'));
    await expect(AdminService.deleteBook('book')).rejects.toThrow('database failure');
    expect(mocks.book.delete).not.toHaveBeenCalled();
  });
  it('accepts multiple categories during upload and rejects invalid categories before storage writes', async () => {
    mocks.category.count.mockResolvedValue(1);
    await expect(AdminService.createBook({ ...input, price: undefined }, Buffer.from('content'), Buffer.from('89504e470d0a1a0a', 'hex'), 'image/png')).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.uploadPrivateSource).not.toHaveBeenCalled();
    mocks.category.count.mockResolvedValue(2);
    mocks.book.create.mockResolvedValue({ id: 'book' }); mocks.queue.add.mockResolvedValue({ id: 'job' });
    mocks.tag.upsert.mockResolvedValue({ id: 'tag' });
    await AdminService.createBook({ ...input, tags: [], price: undefined }, Buffer.from('content'), Buffer.from('89504e470d0a1a0a', 'hex'), 'image/png');
    expect(mocks.book.create.mock.calls[0][0].data.categories.create).toEqual([{ categoryId: 'one' }, { categoryId: 'two' }]);
  });
});

describe('admin endpoints', () => {
  async function request(method: 'GET' | 'PUT' | 'DELETE', role?: string, payload?: object) {
    const app = Fastify();
    app.setErrorHandler((error, _request, reply) => reply.status(error instanceof ZodError ? 400 : 500).send({ success: false }));
    await app.register(adminRoutes);
    try { return await app.inject({ method, url: '/books/book', headers: role ? { authorization: role } : {}, payload }); }
    finally { await app.close(); }
  }
  it.each(['GET', 'PUT', 'DELETE'] as const)('restricts %s to admins', async (method) => {
    expect((await request(method)).statusCode).toBe(401);
    expect((await request(method, 'READER')).statusCode).toBe(403);
    expect(mocks.book.delete).not.toHaveBeenCalled(); expect(mocks.book.update).not.toHaveBeenCalled();
  });
  it('validates edits and returns updated metadata', async () => {
    expect((await request('PUT', 'ADMIN', { ...input, title: '  ' })).statusCode).toBe(400);
    expect(mocks.book.update).not.toHaveBeenCalled();
    expect((await request('PUT', 'ADMIN', input)).statusCode).toBe(200);
  });
});
