const http = require('node:http');
const book = { id: 'test-book', slug: 'test-book', title: 'A Quiet Morning', authorName: 'Zita Test Author', description: 'A test book for checking the reader.', coverUrl: null, contentType: 'BOOK', estimatedMinutes: 12, isPremium: false, category: { name: 'Mindfulness', slug: 'mindfulness' }, tags: ['calm'], totalChapters: 3 };
let progress = { chapterIndex: 1, scrollPosition: 0.4 };
let failSave = false;
let failCatalog = false;
let refreshes = 0;
let empty = false;
let failStats = false;
let comments = [];
let reports = 0;
let failCommunity = false;
http.createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const url = new URL(req.url, 'http://localhost');
  const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  const ok = data => send(200, { success: true, data });
  if (url.pathname === '/__premium') { book.isPremium = true; return ok(null); }
  if (url.pathname === '/__cover') { book.coverUrl = 'http://127.0.0.1:4311/api/v1/assets/covers/test-book'; return ok(null); }
  if (url.pathname === '/api/v1/assets/covers/test-book') {
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cross-Origin-Resource-Policy': 'same-origin' });
    return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==', 'base64'));
  }
  if (url.pathname === '/__reset') { progress = { chapterIndex: 1, scrollPosition: 0.4 }; failSave = false; failCatalog = false; refreshes = 0; empty = false; failStats = false; comments = []; reports = 0; failCommunity = false; return ok(null); }
  if (url.pathname === '/__state') return ok({ progress, refreshes, comments, reports });
  if (url.pathname === '/__community_failure') { failCommunity = Boolean(body.fail); return ok(null); }
  if (url.pathname === '/__failure') { failSave = Boolean(body.save); failCatalog = Boolean(body.catalog); failStats = Boolean(body.stats); return ok(null); }
  if (url.pathname === '/__empty') { empty = true; return ok(null); }
  if (url.pathname.endsWith('/auth/login') || url.pathname.endsWith('/auth/register')) {
    if (body.password !== 'TestPassword123!') return send(401, { success: false, error: { message: 'Invalid credentials' } });
    return ok({ user: { id: 'reader' }, accessToken: 'access', refreshToken: 'refresh' });
  }
  if (url.pathname.endsWith('/auth/refresh')) {
    if (body.refreshToken !== 'refresh') return send(401, { success: false });
    refreshes++;
    return ok({ accessToken: 'access', refreshToken: 'refresh' });
  }
  if (url.pathname.endsWith('/auth/logout')) return ok(null);
  if (url.pathname.endsWith('/auth/forgot-password')) return ok(null);
  if (url.pathname.endsWith('/auth/reset-password')) return body.token === 'reset-token' ? ok(null) : send(400, { success: false, error: { message: 'This reset link has expired.' } });
  if (url.pathname === '/api/v1/books') return failCatalog ? send(503, { success: false }) : ok(empty ? [] : [book].filter(item => [item.title, item.authorName].some(value => value.toLowerCase().includes((url.searchParams.get('search') || '').trim().toLowerCase()))));
  if (url.pathname === '/api/v1/books/featured') return ok(empty ? [] : [book]);
  if (url.pathname === '/api/v1/books/categories') return ok([{ id: 'category', name: 'Mindfulness', slug: 'mindfulness', bookCount: 1 }]);
  if (url.pathname === '/api/v1/books/test-book') return ok(book);
  if (url.pathname === '/api/v1/community/posts' || url.pathname.endsWith('/comments') || url.pathname.startsWith('/api/v1/comments/')) {
    if (failCommunity) return send(503, { success: false, error: { message: 'Community unavailable' } });
    if (req.method !== 'GET' && req.headers.authorization !== 'Bearer access') return send(401, { success: false });
    const id = url.pathname.split('/comments/')[1]?.split('/')[0];
    if (url.pathname.endsWith('/like')) {
      const comment = comments.find(item => item.id === id);
      comment._count.likes = req.method === 'POST' ? 1 : 0; return ok(null);
    }
    if (url.pathname.endsWith('/report')) { reports++; return ok(null); }
    if (req.method === 'POST') {
      const comment = { id: `00000000-0000-4000-8000-${String(comments.length + 1).padStart(12, '0')}`, body: body.body, parentId: body.parentId || null, user: { id: 'reader', displayName: 'Test Reader' }, createdAt: new Date().toISOString(), _count: { likes: 0, replies: 0 } };
      comments.push(comment);
      if (body.parentId) comments.find(item => item.id === body.parentId)._count.replies++;
      return ok(comment);
    }
    const items = comments.filter(item => item.parentId === (url.pathname.endsWith('/replies') ? id : null));
    return send(200, { success: true, data: items, meta: { page: 1, pages: items.length ? 1 : 0, total: items.length } });
  }
  if (!req.headers.authorization) return send(401, { success: false, error: { message: 'Missing authorization header' } });
  if (url.pathname === '/api/v1/users/me') {
    if (req.headers.authorization !== 'Bearer access') return send(401, { success: false });
    return ok({ displayName: 'Test Reader', email: 'reader@example.test' });
  }
  if (url.pathname === '/api/v1/analytics/me') {
    if (failStats) return send(503, { success: false });
    return ok({ streakDays: empty ? 0 : 3, completedBooks: empty ? 0 : 2, totalSessions: empty ? 0 : 7, highlightCount: empty ? 0 : 1,
      inProgressBooks: empty ? [] : [{ id: 'progress', ...progress, percentComplete: 47, book }],
      highlights: empty ? [] : [{ id: 'highlight', text: 'A small moment of attention can change a day.', chapterIndex: 1, book }],
    });
  }
  if (url.pathname.endsWith('/progress')) {
    if (req.method === 'POST') {
      if (failSave) return send(503, { success: false, error: { message: 'Save unavailable' } });
      progress = body;
    }
    return ok(progress);
  }
  if (url.pathname.endsWith('/translations')) {
    if (body.language === 'sw') return send(404, { message: 'Route not found' });
    if (body.language === 'de') return send(503, { success: false, error: { message: 'Automatic translation is not available yet.' } });
    return ok({ status: 'COMPLETED' });
  }
  if (url.pathname.includes('/chapters/')) {
    const index = Number(url.pathname.split('/chapters/')[1].split('/')[0]);
    if (url.searchParams.get('language') === 'fr') return ok({ content: 'Bonjour. Voici le chapitre traduit en français.' });
    return ok({ content: `Chapter text ${index + 1}\n` + Array.from({ length: 35 }, (_, n) => `Paragraph ${n + 1}. A quiet morning offers room to pause, read, and think. We return to the page with a little more attention.`).join('\n') });
  }
  send(404, { success: false });
}).listen(4311, '127.0.0.1');
