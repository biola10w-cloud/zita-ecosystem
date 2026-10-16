const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const { NextRequest } = require('next/server');

const source = fs.readFileSync(path.join(__dirname, '../middleware.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, loaded, loaded.exports);
const { middleware } = loaded.exports;

function request(route, cookie = '') {
  return middleware(new NextRequest(`https://admin.example.com${route}`, {
    headers: { cookie },
  }));
}

test('expired access session redirects protected pages to login', () => {
  for (const route of ['/books', '/books/new', '/categories']) {
    const response = request(route, 'zita_admin_refresh=remaining-refresh-token');
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), 'https://admin.example.com/login');
  }
});

test('refresh-only session can reach login without a redirect loop', () => {
  assert.equal(request('/login', 'zita_admin_refresh=remaining-refresh-token').status, 200);
});

test('access cookie permits dashboard and redirects login to books', () => {
  const cookie = 'zita_admin_session=access-token';
  assert.equal(request('/books', cookie).status, 200);
  assert.equal(request('/login', cookie).headers.get('location'), 'https://admin.example.com/books');
});

test('signed-out sessions retain access to authentication endpoints', () => {
  assert.equal(request('/books').status, 307);
  assert.equal(request('/login').status, 200);
  assert.equal(request('/api/auth/login').status, 200);
  assert.equal(request('/api/auth/refresh', 'zita_admin_refresh=refresh-token').status, 200);
  assert.equal(request('/books', 'zita_admin_session=').status, 307);
});
