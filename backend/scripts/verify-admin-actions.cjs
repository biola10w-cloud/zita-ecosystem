// Creates and removes only its own disposable administrator and unpublished book.
// Database credentials arrive on stdin and are never printed.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', async () => {
  const { DATABASE_URL } = JSON.parse(input);
  const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  const suffix = crypto.randomUUID();
  const email = `zita-actions-${suffix}@example.invalid`;
  const password = crypto.randomBytes(32).toString('base64url');
  const origin = 'https://zita-admin-production.up.railway.app';
  let user, book;
  const request = (path, options = {}) => fetch(origin + path, { ...options, signal: AbortSignal.timeout(30000) });
  try {
    const before = await db.book.count({ where: { isPublished: true } });
    user = await db.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 12), displayName: 'Temporary action check', role: 'ADMIN' } });
    book = await db.book.create({ data: { slug: `zita-actions-${suffix}`, title: 'Temporary unpublished action check', authorName: 'Temporary check', description: 'Disposable deployment verification', estimatedMinutes: 1, isPublished: false } });
    const login = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(login.status, 200, 'Temporary administrator login');
    const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const page = await request(`/books/${book.id}/edit`, { headers: { Cookie: cookie } });
    const html = await page.text();
    console.log(JSON.stringify({ check: 'Edit page', status: page.status, form: html.includes('Save changes'), loadError: html.includes('Unable to load this book') }));
    const update = await request(`/api/books/${book.id}`, { method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Updated temporary action check', authorName: book.authorName, description: book.description, contentType: 'BOOK', language: 'en', estimatedMinutes: 1, isPremium: false, price: null, categoryIds: [], tags: [] }) });
    const updateBody = await update.json();
    console.log(JSON.stringify({ check: 'Edit save', status: update.status, success: updateBody.success, error: updateBody.error }));
    const remove = await request(`/api/books/${book.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
    const removeBody = await remove.json();
    console.log(JSON.stringify({ check: 'Delete disposable book', status: remove.status, success: removeBody.success, error: removeBody.error }));
    assert.equal(update.status, 200, 'Edit saves');
    assert.equal(remove.status, 200, 'Delete succeeds');
    assert.equal(await db.book.count({ where: { id: book.id } }), 0);
    assert.equal(await db.book.count({ where: { isPublished: true } }), before, 'Published book count preserved');
  } catch (error) {
    console.error(JSON.stringify({ check: 'Admin actions', error: error.name, message: error instanceof assert.AssertionError ? error.message : 'Verification failed' }));
    process.exitCode = 1;
  } finally {
    if (book) {
      await db.book.deleteMany({ where: { id: book.id, slug: `zita-actions-${suffix}`, isPublished: false } });
      await db.deletedBook.deleteMany({ where: { id: book.id, slug: `zita-actions-${suffix}` } });
    }
    if (user) await db.user.deleteMany({ where: { id: user.id, email } });
    await db.$disconnect();
    console.log('Disposable test data removed.');
  }
});
