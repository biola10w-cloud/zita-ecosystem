import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../shared/db/prisma';
import { ReaderService } from './reader.service';

describe('ReaderService', () => {
  let userId: string;
  let bookSlug: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `reader-${Date.now()}-${Math.random()}@example.com`,
        passwordHash: 'hash',
        displayName: 'Test Reader',
        role: 'READER',
      },
    });
    userId = user.id;

    const book = await prisma.book.create({
      data: {
        title: 'Test Book',
        slug: `test-book-${Date.now()}-${Math.random()}`,
        authorName: 'Test Author',
        description: 'Test description',
        language: 'en',
        isPremium: false,
        isPublished: true,
        publishedAt: new Date(),
        coverUrl: 'https://example.com/cover.jpg',
        totalChapters: 5,
      },
    });
    bookSlug = book.slug;
  });

  afterAll(async () => {
    await prisma.analyticsEvent.deleteMany();
    await prisma.readingProgress.deleteMany();
    await prisma.highlight.deleteMany();
    await prisma.book.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Reading Progress', () => {
    it('should save reading progress', async () => {
      await ReaderService.saveProgress(userId, bookSlug, 0, 0.25);
      const progress = await ReaderService.getProgress(userId, bookSlug);

      expect(progress).not.toBeNull();
      expect(progress?.chapterIndex).toBe(0);
      expect(progress?.scrollPosition).toBe(0.25);
    });

    it('should update progress on subsequent saves', async () => {
      await ReaderService.saveProgress(userId, bookSlug, 0, 0.25);
      await ReaderService.saveProgress(userId, bookSlug, 1, 0.5);
      const progress = await ReaderService.getProgress(userId, bookSlug);

      expect(progress?.chapterIndex).toBe(1);
      expect(progress?.scrollPosition).toBe(0.5);
    });

    it('should mark book completed at 99% progress', async () => {
      // Book has 5 chapters; (4 + 0.99) / 5 * 100 = 99.8%
      await ReaderService.saveProgress(userId, bookSlug, 4, 0.99);
      const progress = await ReaderService.getProgress(userId, bookSlug);

      expect(progress?.completedAt).not.toBeNull();
      expect(progress?.percentComplete).toBeGreaterThanOrEqual(99);
    });

    it('should track percent complete across chapters', async () => {
      await ReaderService.saveProgress(userId, bookSlug, 0, 1.0);
      const progress1 = await ReaderService.getProgress(userId, bookSlug);

      await ReaderService.saveProgress(userId, bookSlug, 2, 0.5);
      const progress2 = await ReaderService.getProgress(userId, bookSlug);

      expect(progress2!.percentComplete).toBeGreaterThan(progress1!.percentComplete);
    });

    it('should retrieve reading progress', async () => {
      await ReaderService.saveProgress(userId, bookSlug, 2, 0.75);
      const progress = await ReaderService.getProgress(userId, bookSlug);

      expect(progress).not.toBeNull();
      expect(progress?.chapterIndex).toBe(2);
      expect(progress?.scrollPosition).toBe(0.75);
    });

    it('should return null for book without progress', async () => {
      const progress = await ReaderService.getProgress(userId, bookSlug);
      expect(progress).toBeNull();
    });

    it('should update lastReadAt on subsequent reads', async () => {
      await ReaderService.saveProgress(userId, bookSlug, 0, 0.1);
      const progress1 = await ReaderService.getProgress(userId, bookSlug);

      await new Promise((r) => setTimeout(r, 50));
      await ReaderService.saveProgress(userId, bookSlug, 1, 0.2);
      const progress2 = await ReaderService.getProgress(userId, bookSlug);

      expect(progress2!.lastReadAt.getTime()).toBeGreaterThan(progress1!.lastReadAt.getTime());
    });
  });

  describe('Highlights', () => {
    it('should save highlight with valid data', async () => {
      const highlight = await ReaderService.saveHighlight(
        userId,
        bookSlug,
        0,
        50,
        150,
        'This is highlighted text',
        '#FFD700'
      );

      expect(highlight).toBeDefined();
      expect(highlight.userId).toBe(userId);
      expect(highlight.text).toBe('This is highlighted text');
      expect(highlight.color).toBe('#FFD700');
      expect(highlight.startOffset).toBe(50);
      expect(highlight.endOffset).toBe(150);
    });

    it('should save highlight with optional note', async () => {
      const highlight = await ReaderService.saveHighlight(
        userId,
        bookSlug,
        0,
        50,
        150,
        'Important passage',
        '#FF0000',
        'This is a key moment in the story'
      );

      expect(highlight.note).toBe('This is a key moment in the story');
    });

    it('should retrieve all highlights for a book', async () => {
      await ReaderService.saveHighlight(userId, bookSlug, 0, 50, 150, 'First highlight', '#FFD700');
      await ReaderService.saveHighlight(userId, bookSlug, 1, 100, 200, 'Second highlight', '#FF0000');
      await ReaderService.saveHighlight(userId, bookSlug, 2, 200, 300, 'Third highlight', '#00FF00');

      const highlights = await ReaderService.getHighlights(userId, bookSlug);

      expect(highlights).toHaveLength(3);
      expect(highlights.map((h) => h.text)).toContain('First highlight');
      expect(highlights.map((h) => h.text)).toContain('Second highlight');
      expect(highlights.map((h) => h.text)).toContain('Third highlight');
    });

    it('should return empty array when no highlights exist', async () => {
      const highlights = await ReaderService.getHighlights(userId, bookSlug);
      expect(highlights).toHaveLength(0);
    });

    it('should handle multiple highlights on same chapter', async () => {
      await ReaderService.saveHighlight(userId, bookSlug, 0, 50, 100, 'First', '#FFD700');
      await ReaderService.saveHighlight(userId, bookSlug, 0, 150, 200, 'Second', '#FF0000');
      await ReaderService.saveHighlight(userId, bookSlug, 0, 250, 300, 'Third', '#00FF00');

      const highlights = await ReaderService.getHighlights(userId, bookSlug);
      const chapter0 = highlights.filter((h) => h.chapterIndex === 0);

      expect(chapter0).toHaveLength(3);
    });

    it('should preserve highlight offset positions and order results', async () => {
      const testCases = [
        { start: 1500, end: 2000 },
        { start: 0, end: 50 },
        { start: 500, end: 1000 },
      ];

      for (const tc of testCases) {
        await ReaderService.saveHighlight(
          userId,
          bookSlug,
          0,
          tc.start,
          tc.end,
          `Text from ${tc.start} to ${tc.end}`,
          '#FFD700'
        );
      }

      const highlights = await ReaderService.getHighlights(userId, bookSlug);

      // Results are ordered by startOffset ascending
      expect(highlights[0].startOffset).toBe(0);
      expect(highlights[1].startOffset).toBe(500);
      expect(highlights[2].startOffset).toBe(1500);
    });
  });

  describe('Chapter Access', () => {
    it('should throw 404 when chapter does not exist', async () => {
      await expect(ReaderService.getChapterContent(userId, bookSlug, 0)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw when book does not exist', async () => {
      await expect(
        ReaderService.getChapterContent(userId, 'non-existent-slug', 0)
      ).rejects.toThrow();
    });

    it('should deny access to premium books without subscription or purchase', async () => {
      const premiumBook = await prisma.book.create({
        data: {
          title: 'Premium Book',
          slug: `premium-book-${Date.now()}`,
          authorName: 'Test Author',
          language: 'en',
          isPremium: true,
          isPublished: true,
          totalChapters: 5,
        },
      });

      await expect(
        ReaderService.getChapterContent(userId, premiumBook.slug, 0)
      ).rejects.toMatchObject({ statusCode: 403, code: 'ACCESS_DENIED' });
    });
  });
});
