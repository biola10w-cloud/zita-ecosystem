import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import { expect, it, vi } from 'vitest';
vi.mock('../monitoring/sentry', () => ({ captureException: vi.fn() }));
import { errorHandler } from './errorHandler';

it('maps missing records in an encapsulated route to a safe 404', async () => {
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  await app.register(async routes => {
    routes.get('/missing', async () => {
      throw new Prisma.PrismaClientKnownRequestError('Internal database details', {
        code: 'P2025', clientVersion: '5.22.0',
      });
    });
  });
  try {
    const response = await app.inject('/missing');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } });
  } finally { await app.close(); }
});
