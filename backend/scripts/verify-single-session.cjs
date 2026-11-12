// Local verification with real JWT/bcrypt and an in-memory session store.
// No database, network calls or production credentials are used.
// Run after npm run build: node scripts/verify-single-session.cjs
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const user = { id: 'reader', email: 'reader@example.test', role: 'READER' };
let sessions = [];
let queue = Promise.resolve();
let onLock = null;
const matches = (row, where) => Object.entries(where).every(([key, value]) => key === 'expiresAt' ? row.expiresAt > value.gt : row[key] === value);
const db = {
  $queryRaw: async (sql) => { assert.match(sql.join(''), /FOR UPDATE/); if (onLock) { const run = onLock; onLock = null; run(); } return []; },
  user: { findUnique: async () => user },
  device: { upsert: async () => ({ id: 'shared-device-fingerprint' }) },
  offlineKey: { updateMany: async () => ({ count: 0 }) },
  session: {
    create: async ({ data }) => { const row = { ...data, revokedAt: null }; sessions.push(row); return row; },
    updateMany: async ({ where, data }) => { const rows = sessions.filter(row => matches(row, where)); rows.forEach(row => Object.assign(row, data)); return { count: rows.length }; },
    findMany: async ({ where }) => sessions.filter(row => matches(row, where)).map(row => ({ ...row, user })),
    findFirst: async ({ where }) => sessions.find(row => matches(row, where)) || null,
  },
};
db.$transaction = run => { const next = queue.then(() => run(db)); queue = next.catch(() => undefined); return next; };
function mock(module, exports) { const id = require.resolve(`../dist/src/${module}`); require.cache[id] = { id, filename: id, loaded: true, exports }; }
mock('config', { config: { JWT_ACCESS_EXPIRY: '15m' } });
mock('shared/db/prisma', { prisma: db });
mock('shared/security/jwtKeys', { jwtPrivateKey: keys.privateKey, jwtPublicKey: keys.publicKey });
const { AuthService } = require('../dist/src/modules/auth/auth.service');
const { authenticate } = require('../dist/src/shared/middleware/authenticate');
const login = () => AuthService.login(user.email, 'test-password', 'same-fingerprint'.padEnd(32, '0'), 'WEB');
async function authorized(token) {
  const request = { headers: { authorization: `Bearer ${token}` } };
  const reply = { status(code) { this.code = code; return this; }, send() {} };
  await authenticate(request, reply);
  return !!request.user;
}
(async () => {
  user.passwordHash = await bcrypt.hash('test-password', 4);
  const first = await login(); const second = await login();
  assert.equal(await authorized(first.tokens.accessToken), false);
  assert.equal(await authorized(second.tokens.accessToken), true);
  await assert.rejects(AuthService.refresh(first.tokens.refreshToken), error => error.statusCode === 401);
  assert.equal(sessions.filter(row => !row.revokedAt).length, 1);
  const next = await AuthService.refresh(second.tokens.refreshToken);
  assert.equal(await authorized(second.tokens.accessToken), false);
  assert.equal(await authorized(next.accessToken), true);
  const old = jwt.decode(first.tokens.accessToken);
  await AuthService.logout(old.sub, old.deviceId, old.sid);
  assert.equal(await authorized(next.accessToken), true);
  onLock = () => { sessions.forEach(row => { row.revokedAt = new Date(); }); };
  await assert.rejects(AuthService.refresh(next.refreshToken), error => error.statusCode === 401);
  const tokens = await Promise.all([login(), login()]);
  assert.equal(sessions.filter(row => !row.revokedAt).length, 1);
  const validity = await Promise.all(tokens.map(result => authorized(result.tokens.accessToken)));
  assert.equal(validity.filter(Boolean).length, 1);
  const legacy = jwt.sign({ sub: user.id, deviceId: 'shared-device-fingerprint' }, keys.privateKey, { algorithm: 'RS256' });
  assert.equal(await authorized(legacy), false);
  console.log('PASS: old access/refresh revoked, current refresh works, stale logout isolated, refresh race rejected, concurrent logins serialized, legacy access rejected.');
})().catch(error => { console.error(error); process.exitCode = 1; });
