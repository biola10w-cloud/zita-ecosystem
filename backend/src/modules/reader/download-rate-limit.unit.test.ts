import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';

vi.mock('ioredis', () => ({ default: class {} }));
vi.mock('../../config', () => ({ config: { REDIS_URL: '' } }));
vi.mock('../../shared/middleware/authenticate', () => ({
  authenticate: async (request: any, reply: any) => {
    if (!request.headers.authorization) return reply.status(401).send({ success: false });
    request.user = { sub: request.headers.authorization };
  },
}));
vi.mock('./reader.controller', () => {
  const handler = async () => ({ success: true, data: { content: 'Chapter text' } });
  return { ReaderController: Object.fromEntries([
    'getChapterContent', 'requestTranslation', 'getChapterAudio', 'saveProgress',
    'getProgress', 'saveHighlight', 'getHighlights',
  ].map(name => [name, handler])) };
});
import { readerRoutes } from './reader.routes';

describe('offline chapter download rate limits', () => {
  it('allows a full download, isolates readers on one IP, and still bounds bursts', async () => {
    const app = Fastify();
    await app.register(rateLimit, { global: false });
    await app.register(readerRoutes, { prefix: '/books' });
    const read = (index: number, user = 'reader-one') => app.inject({
      method: 'GET', url: `/books/test-book/chapters/${index}/content`,
      headers: { authorization: user }, remoteAddress: '127.0.0.1',
    });
    try {
      for (let chapter = 0; chapter < 120; chapter++) {
        expect((await read(chapter)).statusCode).toBe(200);
      }
      for (let request = 120; request < 600; request++) await read(0);
      const blocked = await read(0);
      expect(blocked.statusCode).toBe(429);
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
      expect((await read(0, 'reader-two')).statusCode).toBe(200);
      expect((await app.inject('/books/test-book/chapters/0/content')).statusCode).toBe(401);
      for (let request = 0; request < 20; request++) {
        expect((await app.inject({ method: 'POST', url: '/books/test-book/translations',
          headers: { authorization: 'reader-one' } })).statusCode).toBe(200);
      }
      expect((await app.inject({ method: 'POST', url: '/books/test-book/translations',
        headers: { authorization: 'reader-one' } })).statusCode).toBe(429);
    } finally { await app.close(); }
  });
});
