import { prisma } from '../../shared/db/prisma';

export class AnalyticsService {
  // â”€â”€â”€ Ingest a batch of events from the app â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async ingestEvents(
    userId: string,
    events: Array<{
      eventType:  string;
      bookId?:    string;
      properties: Record<string, any>;
      occurredAt: string;
    }>,
  ) {
    // Validate event types against allowlist
    const allowedEventTypes = new Set([
      'chapter_open',
      'reading_session_end',
      'book_like',
      'book_unlike',
      'comment_posted',
      'search_performed',
      'app_opened',
      'subscription_started',
      'subscription_cancelled',
    ]);

    const validEvents = events.filter((e) =>
      allowedEventTypes.has(e.eventType),
    );

    await prisma.analyticsEvent.createMany({
      data: validEvents.map((e) => ({
        userId,
        bookId:     e.bookId ?? null,
        eventType:  e.eventType,
        properties: e.properties,
        occurredAt: new Date(e.occurredAt),
      })),
      skipDuplicates: true,
    });
  }

  // â”€â”€â”€ Admin analytics dashboard data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async getDashboardStats(days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      totalUsers,
      activeSubscriptions,
      trialSubscriptions,
      newUsersThisPeriod,
      totalReadingEvents,
      topBooks,
      dailyActiveUsers,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Active subscriptions
      prisma.subscription.count({
        where: { status: 'ACTIVE' },
      }),

      // Trial subscriptions
      prisma.subscription.count({
        where: { status: 'TRIALING' },
      }),

      // New users in period
      prisma.user.count({
        where: { createdAt: { gte: since } },
      }),

      // Total reading sessions
      prisma.analyticsEvent.count({
        where: {
          eventType: 'reading_session_end',
          occurredAt: { gte: since },
        },
      }),

      // Top books by reading activity
      prisma.analyticsEvent.groupBy({
        by: ['bookId'],
        where: {
          eventType: 'chapter_open',
          occurredAt: { gte: since },
          bookId: { not: null },
        },
        _count: { bookId: true },
        orderBy: { _count: { bookId: 'desc' } },
        take: 10,
      }),

      // Daily active users (past 7 days)
      prisma.$queryRaw`
        SELECT
          DATE(occurred_at) as date,
          COUNT(DISTINCT user_id) as active_users
        FROM analytics_events
        WHERE occurred_at >= NOW() - INTERVAL '7 days'
          AND user_id IS NOT NULL
        GROUP BY DATE(occurred_at)
        ORDER BY date ASC
      `,
    ]);

    // Enrich top books with metadata
    const topBookIds = topBooks.map((b) => b.bookId!).filter(Boolean);
    const bookDetails = topBookIds.length > 0
      ? await prisma.book.findMany({
          where: { id: { in: topBookIds } },
          select: { id: true, title: true, authorName: true, coverUrl: true },
        })
      : [];

    const topBooksEnriched = topBooks.map((b) => ({
      ...bookDetails.find((d) => d.id === b.bookId),
      readCount: b._count.bookId,
    }));

    return {
      overview: {
        totalUsers,
        activeSubscriptions,
        trialSubscriptions,
        newUsersThisPeriod,
        totalReadingEvents,
      },
      topBooks: topBooksEnriched,
      dailyActiveUsers,
    };
  }

  // â”€â”€â”€ Reading time stats for a user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async getUserReadingStats(userId: string) {
    const [totalSessions, completedBooks, currentStreak, highlights] =
      await Promise.all([
        prisma.analyticsEvent.count({
          where: { userId, eventType: 'reading_session_end' },
        }),

        prisma.readingProgress.count({
          where: { userId, completedAt: { not: null } },
        }),

        AnalyticsService.calculateStreak(userId),

        prisma.highlight.count({ where: { userId } }),
      ]);

    const inProgressBooks = await prisma.readingProgress.findMany({
      where: {
        userId,
        completedAt: null,
        percentComplete: { gt: 0 },
      },
      include: {
        book: {
          select: {
            id: true,
            slug: true,
            title: true,
            authorName: true,
            coverUrl: true,
            totalChapters: true,
          },
        },
      },
      orderBy: { lastReadAt: 'desc' },
      take: 10,
    });

    const recentHighlights = await prisma.highlight.findMany({
      where: { userId },
      include: {
        book: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      streakDays:      currentStreak,
      completedBooks,
      totalSessions,
      highlightCount:  highlights,
      inProgressBooks,
      highlights:      recentHighlights,
    };
  }

  // â”€â”€â”€ Calculate reading streak â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private static async calculateStreak(userId: string): Promise<number> {
    // Get distinct reading days ordered descending
    const readingDays = await prisma.$queryRaw<Array<{ date: Date }>>`
      SELECT DISTINCT DATE(last_read_at) as date
      FROM reading_progress
      WHERE user_id = ${userId}
      ORDER BY date DESC
    `;

    if (readingDays.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < readingDays.length; i++) {
      const day = new Date(readingDays[i].date);
      day.setHours(0, 0, 0, 0);

      const expected = new Date(today);
      expected.setDate(today.getDate() - i);

      if (day.getTime() === expected.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}
