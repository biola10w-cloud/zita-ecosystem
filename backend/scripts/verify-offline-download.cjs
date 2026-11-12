// Uses only a disposable reader and its temporary access record. Credentials
// and downloaded chapter text remain in memory and are never printed.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', async () => {
  const vars = JSON.parse(input);
  const db = new PrismaClient({ datasources: { db: { url: vars.DATABASE_PUBLIC_URL } } });
  const suffix = crypto.randomUUID();
  const email = `offline-check-${suffix}@example.invalid`;
  const password = crypto.randomBytes(32).toString('base64url');
  const origin = 'https://zita-ecosystem-production.up.railway.app/api/v1';
  let user;
  try {
    const book = await db.book.findFirstOrThrow({
      where: { isPublished: true }, orderBy: { totalChapters: 'desc' },
      select: { id: true, slug: true, chapters: { select: { chapterIndex: true }, orderBy: { chapterIndex: 'asc' } } },
    });
    assert(book.chapters.length > 20, 'Use a book exceeding the previous burst limit');
    user = await db.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 12),
      displayName: 'Temporary offline check', role: 'READER', purchases: { create: { bookId: book.id } } } });
    const login = await fetch(`${origin}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, deviceFingerprint: suffix, platform: 'WEB' }),
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(login.status, 200, 'Temporary reader login');
    const session = await login.json();
    const start = Date.now();
    let characters = 0;
    for (const chapter of book.chapters) {
      const response = await fetch(`${origin}/books/${encodeURIComponent(book.slug)}/chapters/${chapter.chapterIndex}/content`, {
        headers: { Authorization: `Bearer ${session.data.accessToken}` }, signal: AbortSignal.timeout(30000),
      });
      assert.equal(response.status, 200, `Chapter ${chapter.chapterIndex} downloads successfully`);
      assert.equal(Number(response.headers.get('x-ratelimit-limit')), 600, 'Dedicated reader limit is deployed');
      const result = await response.json();
      assert.equal(typeof result.data.content, 'string');
      characters += result.data.content.length;
    }
    assert(characters > 0, 'Downloaded book contains text');
    console.log(JSON.stringify({ downloadedChapters: book.chapters.length, elapsedSeconds: (Date.now() - start) / 1000, rateLimited: false }));
  } catch (error) {
    console.error(JSON.stringify({ error: error.name, message: error instanceof assert.AssertionError ? error.message : 'Download verification failed' }));
    process.exitCode = 1;
  } finally {
    if (user) await db.user.deleteMany({ where: { id: user.id, email } });
    await db.$disconnect();
    console.log('Disposable reader and its access/session records removed.');
  }
});
