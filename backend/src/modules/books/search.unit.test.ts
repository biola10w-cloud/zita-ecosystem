import { expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ book: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) } }));
vi.mock('../../shared/db/prisma', () => ({ prisma: db }));
import { BooksService } from './books.service';

it('searches title and author case-insensitively within published books and preserves category and pagination', async () => {
  await BooksService.list({ search: '  Jane  ', categorySlug: 'fiction', page: 2, limit: 24 });
  const args = db.book.findMany.mock.calls[0][0];
  expect(args.skip).toBe(24);
  expect(args.where.isPublished).toBe(true);
  expect(args.where.AND).toEqual([{ OR: [
    { title: { contains: 'Jane', mode: 'insensitive' } },
    { authorName: { contains: 'Jane', mode: 'insensitive' } },
  ] }]);
  expect(args.where.OR).toContainEqual({ categories: { some: { category: { OR: [{ slug: 'fiction' }, { parent: { slug: 'fiction' } }] } } } });
  expect(db.book.count).toHaveBeenCalledWith({ where: args.where });
});
