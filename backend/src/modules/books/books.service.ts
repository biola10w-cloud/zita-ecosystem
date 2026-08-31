import { prisma } from '../../shared/db/prisma';
import { Prisma } from '@prisma/client';

export interface BooksQuery {
  type?:       'BOOK' | 'STORY' | 'SUMMARY';
  language?:   string;
  tag?:        string;
  categoryId?: string;
  categorySlug?: string;
  authorId?:   string;
  page:        number;
  limit:       number;
}

export class BooksService {
  // â”€â”€â”€ List books with filtering/pagination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async list(query: BooksQuery) {
    const { type, language, tag, categoryId, categorySlug, authorId, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BookWhereInput = {
      isPublished: true,
      ...(type       && { contentType: type }),
      ...(language   && { language }),
      ...(tag && {
        tags: { some: { tag: { name: tag } } },
      }),
      // A category filter matches the category itself, or (if it's a
      // top-level category) any of its subcategories.
      ...(categoryId && {
        OR: [{ categoryId }, { category: { parentId: categoryId } }],
      }),
      ...(categorySlug && {
        OR: [
          { category: { slug: categorySlug } },
          { category: { parent: { slug: categorySlug } } },
        ],
      }),
      ...(authorId     && { authorId }),
    };

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          authorName: true,
          authorId: true,
          description: true,
          coverUrl: true,
          contentType: true,
          language: true,
          totalChapters: true,
          estimatedMinutes: true,
          isPremium: true,
          price: true,
          publishedAt: true,
          category: { select: { id: true, name: true, slug: true, icon: true } },
          tags: { select: { tag: { select: { name: true } } } },
          _count: {
            select: { likes: true, comments: true },
          },
        },
      }),
      prisma.book.count({ where }),
    ]);

    return {
      books: books.map(BooksService.formatBook),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // â”€â”€â”€ Featured books â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async getFeatured() {
    // Featured = published, premium, ordered by a combination of
    // recency and like count. In production this could be a manual
    // editorial selection stored in a FeaturedBook table.
    return prisma.book.findMany({
      where: { isPublished: true },
      orderBy: [
        { likes: { _count: 'desc' } },
        { publishedAt: 'desc' },
      ],
      take: 10,
      select: {
        id: true,
        slug: true,
        title: true,
        authorName: true,
        description: true,
        coverUrl: true,
        contentType: true,
        isPremium: true,
        estimatedMinutes: true,
        _count: { select: { likes: true } },
      },
    });
  }

  // â”€â”€â”€ Trending books â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async getTrending() {
    // Trending = most reading activity in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const topBookIds = await prisma.analyticsEvent.groupBy({
      by: ['bookId'],
      where: {
        eventType: 'chapter_open',
        occurredAt: { gte: sevenDaysAgo },
        bookId: { not: null },
      },
      _count: { bookId: true },
      orderBy: { _count: { bookId: 'desc' } },
      take: 20,
    });

    if (topBookIds.length === 0) {
      // Fallback for new platforms with no analytics yet
      return BooksService.getFeatured();
    }

    const ids = topBookIds.map((b) => b.bookId!);

    return prisma.book.findMany({
      where: { id: { in: ids }, isPublished: true },
      select: {
        id: true,
        slug: true,
        title: true,
        authorName: true,
        coverUrl: true,
        contentType: true,
        isPremium: true,
        estimatedMinutes: true,
        language: true,
        _count: { select: { likes: true } },
      },
    });
  }

  // Categories

  /**
   * Nested tree of top-level categories with their subcategories,
   * for the homepage category-picker dropdown.
   */
  static async listCategories() {
    const topLevel = await prisma.category.findMany({
      where: { parentId: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        children: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            _count: { select: { books: { where: { isPublished: true } } } },
          },
        },
        _count: { select: { books: { where: { isPublished: true } } } },
      },
    });

    return topLevel.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      bookCount: c._count.books + c.children.reduce((sum, ch) => sum + ch._count.books, 0),
      subcategories: c.children.map((ch) => ({
        id: ch.id,
        name: ch.name,
        slug: ch.slug,
        bookCount: ch._count.books,
      })),
    }));
  }

  // â”€â”€â”€ Single book â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async getBySlug(slug: string, userId?: string) {
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug, isPublished: true },
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true } },
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        tags: { include: { tag: true } },
        translations: {
          select: { language: true, status: true },
          where: { status: 'COMPLETED' },
        },
        _count: { select: { likes: true, comments: true } },
      },
    });

    // Check if user has liked this book
    let isLiked = false;
    let userProgress = null;
    let hasPurchased = false;

    if (userId) {
      const [like, progress, purchase] = await Promise.all([
        prisma.bookLike.findUnique({
          where: { userId_bookId: { userId, bookId: book.id } },
        }),
        prisma.readingProgress.findUnique({
          where: { userId_bookId: { userId, bookId: book.id } },
        }),
        prisma.purchase.findFirst({
          where: { userId, bookId: book.id },
        }),
      ]);

      isLiked = !!like;
      userProgress = progress;
      hasPurchased = !!purchase;
    }

    return {
      ...BooksService.formatBook(book),
      availableLanguages: book.translations.map((t) => t.language),
      isLiked,
      userProgress,
      hasPurchased,
    };
  }

  // â”€â”€â”€ Check access â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async checkUserAccess(
    userId: string,
    bookId: string,
  ): Promise<{ hasAccess: boolean; reason: string }> {
    const [book, subscription, purchase] = await Promise.all([
      prisma.book.findUnique({ where: { id: bookId } }),
      prisma.subscription.findUnique({ where: { userId } }),
      prisma.purchase.findFirst({ where: { userId, bookId } }),
    ]);

    if (!book) return { hasAccess: false, reason: 'BOOK_NOT_FOUND' };
    if (!book.isPremium) return { hasAccess: true, reason: 'FREE' };
    if (purchase) return { hasAccess: true, reason: 'PURCHASED' };

    if (subscription) {
      const now = new Date();
      const isActive =
        ['ACTIVE', 'TRIALING'].includes(subscription.status) &&
        subscription.currentPeriodEnd > now;

      if (isActive) return { hasAccess: true, reason: 'SUBSCRIPTION' };
    }

    return { hasAccess: false, reason: 'NO_ACCESS' };
  }

  // â”€â”€â”€ Format helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private static formatBook(book: any) {
    return {
      ...book,
      tags: book.tags?.map((t: any) => t.tag?.name ?? t.name) ?? [],
      likeCount: book._count?.likes ?? 0,
      commentCount: book._count?.comments ?? 0,
      _count: undefined,
    };
  }
}
