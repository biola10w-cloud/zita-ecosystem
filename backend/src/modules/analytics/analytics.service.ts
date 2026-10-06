import { prisma } from '../../shared/db/prisma';
import { readingStreakFromDates } from './reading-streak';

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
    const now = new Date();
    const since = new Date(now);
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - days + 1);
    const [totalUsers, activeSubscriptions, trialSubscriptions, newUsersThisPeriod, activity, topBooks, daily, progress] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE', currentPeriodEnd: { gt: now } } }),
      prisma.subscription.count({ where: { status: 'TRIALING', currentPeriodEnd: { gt: now } } }),
      prisma.user.count({ where: { createdAt: { gte: since, lte: now } } }),
      prisma.$queryRaw<Array<{ readers: number; opens: number }>>`
        SELECT COUNT(DISTINCT "userId")::int AS readers,
          COUNT(*) FILTER (WHERE "eventType" = 'chapter_open')::int AS opens
        FROM "AnalyticsEvent" WHERE "occurredAt" BETWEEN ${since} AND ${now}
          AND "eventType" IN ('chapter_open', 'reading_session_end')`,
      prisma.$queryRaw<Array<{ id: string; title: string; authorName: string; readers: number; opens: number }>>`
        SELECT b.id, b.title, b."authorName", COUNT(DISTINCT e."userId")::int AS readers,
          COUNT(*) FILTER (WHERE e."eventType" = 'chapter_open')::int AS opens
        FROM "AnalyticsEvent" e JOIN "Book" b ON b.id = e."bookId"
        WHERE e."occurredAt" BETWEEN ${since} AND ${now}
          AND e."eventType" IN ('chapter_open', 'reading_session_end')
        GROUP BY b.id, b.title, b."authorName"
        ORDER BY readers DESC, opens DESC, b.title ASC, b.id ASC LIMIT 10`,
      prisma.$queryRaw<Array<{ date: string; readers: number; opens: number }>>`
        SELECT TO_CHAR("occurredAt", 'YYYY-MM-DD') AS date,
          COUNT(DISTINCT "userId")::int AS readers,
          COUNT(*) FILTER (WHERE "eventType" = 'chapter_open')::int AS opens
        FROM "AnalyticsEvent" WHERE "occurredAt" BETWEEN ${since} AND ${now}
          AND "eventType" IN ('chapter_open', 'reading_session_end')
        GROUP BY TO_CHAR("occurredAt", 'YYYY-MM-DD') ORDER BY date`,
      prisma.readingProgress.aggregate({
        where: { lastReadAt: { gte: since, lte: now } },
        _count: { _all: true, completedAt: true }, _avg: { percentComplete: true },
      }),
    ]);
    const dailyActiveUsers = Array.from({ length: days }, (_, index) => {
      const date = new Date(since);
      date.setUTCDate(date.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return daily.find((row) => row.date === key) ?? { date: key, readers: 0, opens: 0 };
    });
    return {
      days,
      overview: {
        totalUsers, activeSubscriptions, trialSubscriptions, newUsersThisPeriod,
        activeReaders: activity[0]?.readers ?? 0,
        chapterOpens: activity[0]?.opens ?? 0,
        booksInProgress: progress._count._all - progress._count.completedAt,
        completedBooks: progress._count.completedAt,
        averageProgress: Math.round(progress._avg.percentComplete ?? 0),
      },
      topBooks, dailyActiveUsers,
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
        book: { isPublished: true },
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
      where: { userId, book: { isPublished: true } },
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
      SELECT DISTINCT DATE("occurredAt") as date
      FROM "AnalyticsEvent"
      WHERE "userId" = ${userId}
        AND "eventType" IN ('chapter_open', 'reading_session_end')
      ORDER BY date DESC
    `;

    return readingStreakFromDates(readingDays.map((entry) => entry.date));
  }
}
