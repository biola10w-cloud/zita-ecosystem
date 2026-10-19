import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const keys = require('node:crypto').generateKeyPairSync('rsa', {
    modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { keys, sessions: [] as any[], queue: Promise.resolve() as Promise<any>,
    user: { id: 'reader', email: 'reader@example.test', role: 'READER', displayName: 'Reader', passwordHash: 'hash:password' },
    compare: vi.fn(), lock: vi.fn(), offline: vi.fn(),
  };
});
vi.mock('../../config', () => ({ config: { JWT_ACCESS_EXPIRY: '15m' } }));
vi.mock('../../shared/security/jwtKeys', () => ({ jwtPrivateKey: state.keys.privateKey, jwtPublicKey: state.keys.publicKey }));
vi.mock('bcryptjs', () => ({ default: { hash: async (value: string) => `hash:${value}`, compare: state.compare } }));
vi.mock('../../shared/db/prisma', () => {
  const matches = (row: any, where: any) => Object.entries(where).every(([key, value]) => key === 'expiresAt' ? row.expiresAt > (value as any).gt : row[key] === value);
  const db: any = {
    $queryRaw: state.lock,
    user: { findUnique: async () => state.user },
    device: { upsert: async () => ({ id: 'shared-fingerprint-device' }) },
    offlineKey: { updateMany: state.offline },
    session: {
      create: async ({ data }: any) => { const row = { ...data, revokedAt: null }; state.sessions.push(row); return row; },
      updateMany: async ({ where, data }: any) => { const rows = state.sessions.filter(row => matches(row, where)); rows.forEach(row => Object.assign(row, data)); return { count: rows.length }; },
      findMany: async ({ where }: any) => state.sessions.filter(row => matches(row, where)).map(row => ({ ...row, user: state.user })),
      findFirst: async ({ where }: any) => state.sessions.find(row => matches(row, where)) || null,
    },
  };
  db.$transaction = (run: any) => { const next = state.queue.then(() => run(db)); state.queue = next.catch(() => undefined); return next; };
  return { prisma: db };
});

import { AuthService } from './auth.service';
import { authenticate } from '../../shared/middleware/authenticate';
import jwt from 'jsonwebtoken';

beforeEach(() => {
  state.sessions = []; state.queue = Promise.resolve(); vi.clearAllMocks();
  state.compare.mockImplementation(async (raw: string, hash: string) => hash === `hash:${raw}`);
  state.lock.mockResolvedValue([]); state.offline.mockResolvedValue({ count: 0 });
});
const login = () => AuthService.login(state.user.email, 'password', 'fingerprint'.padEnd(32, '0'), 'WEB');
async function authorize(token: string) {
  const request: any = { headers: { authorization: `Bearer ${token}` } };
  const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };
  await authenticate(request, reply as any);
  return { request, reply };
}

describe('one active session per account', () => {
  it('ends the previous login even when both apps use the same device fingerprint', async () => {
    const first = await login(); const second = await login();
    expect(state.sessions.filter(row => !row.revokedAt)).toHaveLength(1);
    expect((await authorize(first.tokens.accessToken)).reply.status).toHaveBeenCalledWith(401);
    expect((await authorize(second.tokens.accessToken)).request.user.sub).toBe('reader');
    await expect(AuthService.refresh(first.tokens.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  });
  it('rotates the current session without creating two active sessions', async () => {
    const first = await login(); const refreshed = await AuthService.refresh(first.tokens.refreshToken);
    expect(state.sessions.filter(row => !row.revokedAt)).toHaveLength(1);
    expect((await authorize(refreshed.accessToken)).request.user.sub).toBe('reader');
    expect((await authorize(first.tokens.accessToken)).reply.status).toHaveBeenCalledWith(401);
    expect(state.offline).toHaveBeenCalledTimes(1);
  });
  it('cannot revive a refresh session revoked while waiting for the account lock', async () => {
    const first = await login();
    state.lock.mockImplementationOnce(async () => { state.sessions[0].revokedAt = new Date(); return []; });
    await expect(AuthService.refresh(first.tokens.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
    expect(state.sessions).toHaveLength(1);
  });
  it('serializes simultaneous logins using a user row lock', async () => {
    const [first, second] = await Promise.all([login(), login()]);
    expect(state.lock).toHaveBeenCalledTimes(2);
    expect(state.lock.mock.calls[0][0].join('')).toContain('FOR UPDATE');
    expect(state.sessions.filter(row => !row.revokedAt)).toHaveLength(1);
    expect((await authorize(first.tokens.accessToken)).reply.status).toHaveBeenCalledWith(401);
    expect((await authorize(second.tokens.accessToken)).request.user).toBeDefined();
  });
  it('does not let a delayed old logout revoke a newer login on the same device', async () => {
    const first = await login(); const old = jwt.decode(first.tokens.accessToken) as any;
    const second = await login();
    await AuthService.logout(old.sub, old.deviceId, old.sid);
    expect((await authorize(second.tokens.accessToken)).request.user).toBeDefined();
  });
  it('rejects legacy access tokens with no session ID instead of bypassing revocation', async () => {
    const token = jwt.sign({ sub: 'reader', deviceId: 'shared-fingerprint-device' }, state.keys.privateKey, { algorithm: 'RS256' });
    expect((await authorize(token)).reply.status).toHaveBeenCalledWith(401);
  });
});
