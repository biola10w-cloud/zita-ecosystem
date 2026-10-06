// Read-only schema/analytics verification. Railway database variables arrive on
// stdin, remain in memory, and are never logged or written to disk.
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', async () => {
  let prisma;
  try {
    const variables = JSON.parse(input);
    assert.ok(variables.DATABASE_PUBLIC_URL, 'Public database connection is unavailable.');
    prisma = new PrismaClient({ datasources: { db: { url: variables.DATABASE_PUBLIC_URL } }, log: [] });
    // Supply only the database dependency; avoid loading unrelated production
    // configuration into this local read-only check.
    const modulePath = require.resolve('../dist/src/shared/db/prisma');
    require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: { prisma } };
    const { AnalyticsService } = require('../dist/src/modules/analytics/analytics.service');
    const stats = await AnalyticsService.getUserReadingStats('00000000-0000-4000-8000-000000000000');
    assert.equal(stats.streakDays, 0);
    assert.equal(stats.completedBooks, 0);
    assert.equal(stats.totalSessions, 0);
    assert.deepEqual(stats.inProgressBooks, []);
    assert.deepEqual(stats.highlights, []);
    console.log('PASS: reading statistics run against production schema for a nonexistent user. No records changed.');
  } catch (error) {
    console.error('Statistics verification failed:', error.code || error.name);
    process.exitCode = 1;
  } finally { if (prisma) await prisma.$disconnect(); }
});
