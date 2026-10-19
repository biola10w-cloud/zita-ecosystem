import { afterEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ user: { count: vi.fn() }, subscription: { count: vi.fn() }, readingProgress: { aggregate: vi.fn() }, $queryRaw: vi.fn() }));
vi.mock('../../shared/db/prisma', () => ({ prisma: db }));
import { AnalyticsService } from './analytics.service';

afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
describe('admin dashboard', () => {
  it('fills inactive UTC days, separates paid and trial subscribers, and handles an empty library', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
    db.user.count.mockResolvedValue(0); db.subscription.count.mockResolvedValue(0);
    db.$queryRaw.mockResolvedValueOnce([{ readers: 0, opens: 0 }]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    db.readingProgress.aggregate.mockResolvedValue({ _count: { _all: 0, completedAt: 0 }, _avg: { percentComplete: null } });
    const result = await AnalyticsService.getDashboardStats(7);
    expect(result.dailyActiveUsers).toHaveLength(7);
    expect(result.dailyActiveUsers[0]).toEqual({ date: '2026-09-18', readers: 0, opens: 0 });
    expect(result.dailyActiveUsers[6].date).toBe('2026-09-24');
    expect(result.overview.averageProgress).toBe(0);
    expect(result.topBooks).toEqual([]);
    expect(db.subscription.count).toHaveBeenCalledWith({ where: { status: 'ACTIVE', currentPeriodEnd: { gt: new Date() } } });
    expect(db.subscription.count).toHaveBeenCalledWith({ where: { status: 'TRIALING', currentPeriodEnd: { gt: new Date() } } });
    expect(db.$queryRaw.mock.calls[0][0].join('')).toContain('COUNT(DISTINCT "userId")');
  });
});
