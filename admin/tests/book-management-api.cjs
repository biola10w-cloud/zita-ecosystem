const http = require('node:http');
const categories = [{ id: 'growth', name: 'Personal Growth', children: [{ id: 'habits', name: 'Habits' }] }, { id: 'business', name: 'Business', children: [] }];
const original = { id: 'book', slug: 'original-book', title: 'Original Book', authorName: 'Original Author', description: 'Original description', contentType: 'BOOK', language: 'en', estimatedMinutes: 30, isPremium: false, price: null, tags: ['original'], categories: [{ id: 'growth', name: 'Personal Growth' }], category: { id: 'growth', name: 'Personal Growth' }, isPublished: true, encryptionStatus: 'READY', totalChapters: 2 };
let book = structuredClone(original);
let edits = [];
let deletes = 0;
let fail = false;
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let raw = ''; for await (const chunk of req) raw += chunk;
  const send = (status, data, success = true) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success, data, meta: { total: book ? 1 : 0, pages: book ? 1 : 0 }, ...(!success ? { error: { message: 'Test service unavailable' } } : {}) })); };
  if (url.pathname === '/__reset') { book = structuredClone(original); edits = []; deletes = 0; fail = false; return send(200, null); }
  if (url.pathname === '/__state') return send(200, { book, edits, deletes });
  if (url.pathname === '/__failure') { fail = JSON.parse(raw).fail; return send(200, null); }
  if (req.headers.authorization !== 'Bearer access') return send(401, null, false);
  if (url.pathname === '/api/v1/admin/categories') return send(200, categories);
  if (url.pathname === '/api/v1/admin/books') return send(200, book ? [book] : []);
  if (url.pathname === '/api/v1/admin/books/book') {
    if (!book) return send(404, null, false);
    if (req.method === 'GET') return send(200, book);
    if (fail) return send(503, null, false);
    if (req.method === 'PUT') {
      const input = JSON.parse(raw); edits.push(input);
      book = { ...book, ...input, categories: input.categoryIds.map(id => categories.flatMap(c => [c, ...c.children]).find(c => c.id === id)) };
      return send(200, book);
    }
    if (req.method === 'DELETE') { deletes++; book = null; return send(200, null); }
  }
  send(404, null, false);
}).listen(4321, '127.0.0.1');
