import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

const mocks = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  book: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
  subscription: { findUnique: vi.fn() },
  purchase: { findFirst: vi.fn() },
  download: vi.fn(),
}));
vi.mock('../../shared/db/prisma', () => ({ prisma: mocks }));
vi.mock('../../shared/storage/s3', () => ({ S3Service: { downloadEncryptedContent: mocks.download } }));
import { BooksService } from './books.service';
import { readingTestAccess } from './reading-access';
import { assetsRoutes } from './assets.routes';

beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('READING_TEST_EMAILS', ''); });
afterEach(() => vi.unstubAllEnvs());

describe('publication access', () => {
  it('temporarily allows premium published books without changing stored pricing', async () => {
    mocks.user.findUnique.mockResolvedValue({ email: 'Tester@Example.com' });
    const book = { isPremium: true, isPublished: true };
    mocks.book.findUnique.mockResolvedValue(book);
    expect((await BooksService.checkUserAccess('reader', 'book')).hasAccess).toBe(false);
    vi.stubEnv('READING_TEST_EMAILS', 'tester@example.com');
    expect(await BooksService.checkUserAccess('reader', 'book')).toEqual({ hasAccess: true, reason: 'TEST_ACCESS' });

    expect(book.isPremium).toBe(true);
    vi.stubEnv('READING_TEST_EMAILS', '');
    expect((await BooksService.checkUserAccess('reader', 'book')).hasAccess).toBe(false);

  });
  it('rejects unlisted or missing users and ignores the obsolete global flag', async () => {
    vi.stubEnv('READING_TEST_EMAILS', 'tester@example.com');
    vi.stubEnv('READING_TEST_ACCESS', 'true');
    mocks.user.findUnique.mockResolvedValue({ email: 'other@example.com' });
    expect(await readingTestAccess('other')).toBe(false);
    mocks.user.findUnique.mockResolvedValue(null);
    expect(await readingTestAccess('missing')).toBe(false);
  });
  it('never unlocks drafts or missing books during testing', async () => {
    vi.stubEnv('READING_TEST_EMAILS', 'tester@example.com');
    mocks.book.findUnique.mockResolvedValue({ isPremium: true, isPublished: false });
    expect((await BooksService.checkUserAccess('reader', 'draft')).hasAccess).toBe(false);
    mocks.book.findUnique.mockResolvedValue(null);
    expect((await BooksService.checkUserAccess('reader', 'missing')).hasAccess).toBe(false);
  });
  it.each([false, true])('denies a draft even with entitlements (premium=%s)', async (isPremium) => {
    mocks.book.findUnique.mockResolvedValue({ isPremium, isPublished: false });
    mocks.purchase.findFirst.mockResolvedValue({ id: 'purchase' });
    mocks.subscription.findUnique.mockResolvedValue({ status: 'ACTIVE', currentPeriodEnd: new Date('2099-01-01') });
    expect((await BooksService.checkUserAccess('reader', 'draft')).hasAccess).toBe(false);
  });
  it('allows a published free book', async () => {
    mocks.book.findUnique.mockResolvedValue({ isPremium: false, isPublished: true });
    expect(await BooksService.checkUserAccess('reader', 'book')).toEqual({ hasAccess: true, reason: 'FREE' });
  });
  it('selects chapter navigation without requesting encryption secrets', async () => {
    mocks.book.findUniqueOrThrow.mockImplementation(async ({ select }) => {
      expect(select.encryptedFileKey).toBeUndefined();
      expect(select.fileIv).toBeUndefined();
      expect(select.fileAuthTag).toBeUndefined();
      expect(select.chapters.select).toEqual({ chapterIndex: true, title: true, wordCount: true });
      return { id: 'book', translations: [], chapters: [{ chapterIndex: 0, title: 'Start', wordCount: 10 }] };
    });
    expect((await BooksService.getBySlug('book')).chapters).toHaveLength(1);
  });
});

describe('public cover boundary', () => {
  async function request(url: string) {
    const app = Fastify();
    await app.register(assetsRoutes, { prefix: '/api/v1/assets' });
    try { return await app.inject(url); } finally { await app.close(); }
  }
  it('serves a raster cover from the fixed public prefix', async () => {
    mocks.download.mockResolvedValue(Buffer.from('89504e470d0a1a0a', 'hex'));
    const response = await request('/api/v1/assets/covers/example-123');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(mocks.download).toHaveBeenCalledWith('public/covers/example-123');
  });
  it.each(['/api/v1/assets/covers/..%2F..%2Fbooks', '/api/v1/assets/books/secret', '/api/v1/assets/covers/name%2Fsecret'])('rejects arbitrary paths: %s', async (url) => {
    expect((await request(url)).statusCode).toBe(404);
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it('does not serve active HTML or SVG content', async () => {
    mocks.download.mockResolvedValue(Buffer.from('<svg onload="alert(1)"/>'));
    expect((await request('/api/v1/assets/covers/example')).statusCode).toBe(404);
  });
  it('returns 404 for a missing cover', async () => {
    mocks.download.mockRejectedValue(Object.assign(new Error('missing'), { name: 'NoSuchKey' }));
    expect((await request('/api/v1/assets/covers/missing')).statusCode).toBe(404);
  });
});
