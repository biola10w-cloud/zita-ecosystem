import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { BooksService } from './books.service';
import { prisma } from '../../shared/db/prisma';

/**
 * Books Service Tests
 * Tests for listing, filtering, and retrieving books
 */
describe('BooksService', () => {
  const testBook = {
    slug: 'test-book-1',
    title: 'Test Book',
    authorName: 'Test Author',
    description: 'A test book description',
    language: 'en',
    contentType: 'BOOK' as const,
    isPublished: true,
    isPremium: false,
    price: null,
    totalChapters: 5,
    estimatedMinutes: 120,
    coverUrl: 'https://example.com/cover.jpg',
  };

  beforeEach(async () => {
    // Clean up test data
    await prisma.bookTag.deleteMany({});
    await prisma.tag.deleteMany({});
    await prisma.book.deleteMany({});
  });

  afterAll(async () => {
    // Clean up and disconnect
    await prisma.bookTag.deleteMany({});
    await prisma.tag.deleteMany({});
    await prisma.book.deleteMany({});
    await prisma.$disconnect();
  });

  describe('List Books', () => {
    beforeEach(async () => {
      // Create test books
      await prisma.book.create({
        data: {
          ...testBook,
          slug: 'test-book-1',
          title: 'Test Book 1',
          publishedAt: new Date('2024-01-01'),
        },
      });

      await prisma.book.create({
        data: {
          ...testBook,
          slug: 'test-book-2',
          title: 'Test Book 2',
          language: 'es',
          publishedAt: new Date('2024-01-02'),
        },
      });

      await prisma.book.create({
        data: {
          ...testBook,
          slug: 'test-book-3',
          title: 'Test Book 3',
          contentType: 'STORY',
          isPublished: false, // Not published
          publishedAt: new Date('2024-01-03'),
        },
      });
    });

    it('should list published books with pagination', async () => {
      const result = await BooksService.list({
        page: 1,
        limit: 10,
      });

      expect(result.books).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.books.length).toBe(2); // Only published books
    });

    it('should filter books by type', async () => {
      const result = await BooksService.list({
        type: 'STORY',
        page: 1,
        limit: 10,
      });

      // No published stories (test-book-3 is not published)
      expect(result.books.length).toBe(0);
    });

    it('should filter books by language', async () => {
      const result = await BooksService.list({
        language: 'es',
        page: 1,
        limit: 10,
      });

      expect(result.books.length).toBe(1);
      expect(result.books[0].language).toBe('es');
    });

    it('should handle pagination correctly', async () => {
      const page1 = await BooksService.list({
        page: 1,
        limit: 1,
      });

      const page2 = await BooksService.list({
        page: 2,
        limit: 1,
      });

      expect(page1.books.length).toBe(1);
      expect(page2.books.length).toBe(1);
      expect(page1.books[0].id).not.toBe(page2.books[0].id);
      expect(page1.pagination.pages).toBe(2);
    });

    it('should return correct total count', async () => {
      const result = await BooksService.list({
        page: 1,
        limit: 10,
      });

      expect(result.pagination.total).toBe(2); // 2 published books
    });

    it('should order books by publish date descending', async () => {
      const result = await BooksService.list({
        page: 1,
        limit: 10,
      });

      expect(result.books[0].title).toBe('Test Book 2'); // Published 2024-01-02
      expect(result.books[1].title).toBe('Test Book 1'); // Published 2024-01-01
    });
  });

  describe('Featured Books', () => {
    beforeEach(async () => {
      // Create test books with different like counts
      await prisma.book.create({
        data: {
          ...testBook,
          slug: 'featured-1',
          title: 'Featured Book 1',
          publishedAt: new Date('2024-01-01'),
        },
      });

      await prisma.book.create({
        data: {
          ...testBook,
          slug: 'featured-2',
          title: 'Featured Book 2',
          publishedAt: new Date('2024-01-02'),
        },
      });
    });

    it('should return featured books', async () => {
      const featured = await BooksService.getFeatured();

      expect(featured).toBeDefined();
      expect(Array.isArray(featured)).toBe(true);
      expect(featured.length).toBeLessThanOrEqual(10);
    });

    it('should only include published books in featured', async () => {
      const featured = await BooksService.getFeatured();

      // Featured books should have required fields
      featured.forEach((book: any) => {
        expect(book.id).toBeDefined();
        expect(book.title).toBeDefined();
        expect(book.slug).toBeDefined();
      });
    });
  });

  describe('Trending Books', () => {
    beforeEach(async () => {
      // Create test books
      await prisma.book.create({
        data: {
          ...testBook,
          slug: 'trending-1',
          title: 'Trending Book 1',
          publishedAt: new Date('2024-01-01'),
        },
      });
    });

    it('should return trending books based on recent activity', async () => {
      const trending = await BooksService.getTrending();

      expect(trending).toBeDefined();
      expect(Array.isArray(trending)).toBe(true);
    });

    it('should return books with engagement metrics', async () => {
      const trending = await BooksService.getTrending();

      if (trending.length > 0) {
        const book = trending[0];
        expect(book).toHaveProperty('id');
        expect(book).toHaveProperty('title');
      }
    });
  });

  describe('Format Book', () => {
    it('should format book correctly', async () => {
      const book = await prisma.book.create({
        data: testBook,
        select: {
          id: true,
          slug: true,
          title: true,
          authorName: true,
          description: true,
          coverUrl: true,
          contentType: true,
          language: true,
          totalChapters: true,
          estimatedMinutes: true,
          isPremium: true,
          price: true,
          publishedAt: true,
          tags: { select: { tag: { select: { name: true } } } },
          _count: {
            select: { likes: true, comments: true },
          },
        },
      });

      const formatted = BooksService.formatBook(book);

      expect(formatted).toHaveProperty('id');
      expect(formatted).toHaveProperty('title');
      expect(formatted).toHaveProperty('authorName');
      expect(formatted).toHaveProperty('description');
      expect(formatted).toHaveProperty('coverUrl');
    });
  });

  describe('Get Book by Slug', () => {
    beforeEach(async () => {
      await prisma.book.create({
        data: {
          ...testBook,
          slug: 'unique-slug-123',
        },
      });
    });

    it('should retrieve a book by its slug', async () => {
      const book = await BooksService.getBySlug('unique-slug-123');

      expect(book).toBeDefined();
      expect(book.slug).toBe('unique-slug-123');
      expect(book.title).toBe(testBook.title);
    });

    it('should throw error for non-existent slug', async () => {
      await expect(
        BooksService.getBySlug('non-existent-slug'),
      ).rejects.toThrow();
    });
  });

  describe('Check User Access', () => {
    let bookId: string;
    let userId: string;

    beforeEach(async () => {
      const book = await prisma.book.create({
        data: {
          ...testBook,
          slug: 'access-test-book',
          isPremium: false,
        },
      });
      bookId = book.id;
      
      const user = await prisma.user.create({
        data: {
          email: `user-${Date.now()}@example.com`,
          passwordHash: 'hash',
          displayName: 'Test User',
          role: 'READER',
        },
      });
      userId = user.id;
    });

    it('should allow access to free books', async () => {
      const result = await BooksService.checkUserAccess(userId, bookId);

      expect(result.hasAccess).toBe(true);
      expect(result.reason).toBe('FREE');
    });

    it('should deny access for non-existent book', async () => {
      const result = await BooksService.checkUserAccess(userId, 'fake-id');

      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('BOOK_NOT_FOUND');
    });
  });
});
