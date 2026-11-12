import { beforeEach, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { ZodError } from 'zod';

const mocks = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), delete: vi.fn() },
  book: { findMany: vi.fn(), deleteMany: vi.fn() },
  deletedBook: { createMany: vi.fn() }, analyticsEvent: { deleteMany: vi.fn() },
  compare: vi.fn(), cancelForAccountDeletion: vi.fn(), $transaction: vi.fn(),
}));
vi.mock('../../shared/db/prisma', () => ({ prisma: mocks }));
vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare } }));
vi.mock('../subscriptions/stripe.service', () => ({ StripeService: mocks }));
vi.mock('../../shared/middleware/rateLimiter', () => ({ rateLimits: { auth: {} } }));
vi.mock('../../shared/middleware/authenticate', () => ({ authenticate: async (req: any, reply: any) => {
  if (!req.headers.authorization) return reply.status(401).send({ success: false });
  req.user = { sub: 'reader' };
} }));
import { AccountDeletionService } from './account-deletion.service';
import { usersRoutes } from './users.routes';

const user = { id: 'reader', passwordHash: 'hash', subscription: null as any };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.findUnique.mockResolvedValue(user);
  mocks.compare.mockResolvedValue(true);
  mocks.book.findMany.mockResolvedValue([]);
  mocks.$transaction.mockImplementation(callback => callback(mocks));
});

it('rejects incorrect passwords without cancelling billing or deleting data', async () => {
  mocks.compare.mockResolvedValue(false);
  await expect(AccountDeletionService.delete('reader', 'wrong')).rejects.toMatchObject({ statusCode: 400 });
  expect(mocks.$transaction).not.toHaveBeenCalled();
  expect(mocks.cancelForAccountDeletion).not.toHaveBeenCalled();
});

it('cancels Stripe billing before deleting the local account', async () => {
  mocks.user.findUnique.mockResolvedValue({ ...user, subscription: { platform: 'STRIPE', stripeSubscriptionId: 'sub', originalTransactionId: 'sub', status: 'ACTIVE' } });
  await AccountDeletionService.delete('reader', 'password');
  expect(mocks.cancelForAccountDeletion).toHaveBeenCalledWith('sub');
  expect(mocks.cancelForAccountDeletion.mock.invocationCallOrder[0]).toBeLessThan(mocks.user.delete.mock.invocationCallOrder[0]);
  expect(mocks.analyticsEvent.deleteMany).toHaveBeenCalledWith({ where: { userId: 'reader' } });
  expect(mocks.user.delete).toHaveBeenCalledWith({ where: { id: 'reader' } });
});

it('preserves the account when Stripe cancellation fails', async () => {
  mocks.user.findUnique.mockResolvedValue({ ...user, subscription: { platform: 'STRIPE', stripeSubscriptionId: 'sub' } });
  mocks.cancelForAccountDeletion.mockRejectedValue(new Error('Billing offline'));
  await expect(AccountDeletionService.delete('reader', 'password')).rejects.toThrow('Billing offline');
  expect(mocks.$transaction).not.toHaveBeenCalled();
});

it('rejects deletion if billing or the password changed after confirmation', async () => {
  mocks.user.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce({ ...user, passwordHash: 'changed' });
  await expect(AccountDeletionService.delete('reader', 'password')).rejects.toMatchObject({ statusCode: 409 });
  expect(mocks.user.delete).not.toHaveBeenCalled();
});

it('queues only user-owned uploads for durable file removal', async () => {
  mocks.book.findMany.mockResolvedValue([{ id: 'own-book', slug: 'own' }]);
  await AccountDeletionService.delete('reader', 'password');
  expect(mocks.book.findMany).toHaveBeenCalledWith({ where: { authorId: 'reader' }, select: { id: true, slug: true } });
  expect(mocks.deletedBook.createMany).toHaveBeenCalledWith({ data: [{ id: 'own-book', slug: 'own' }], skipDuplicates: true });
  expect(mocks.book.deleteMany).toHaveBeenCalledWith({ where: { authorId: 'reader' } });
});

it('allows native subscription holders to delete without claiming to cancel store billing', async () => {
  mocks.user.findUnique.mockResolvedValue({ ...user, subscription: { platform: 'IOS', originalTransactionId: 'apple', status: 'ACTIVE' } });
  await AccountDeletionService.delete('reader', 'password');
  expect(mocks.cancelForAccountDeletion).not.toHaveBeenCalled();
  expect(mocks.user.delete).toHaveBeenCalledOnce();
});

it('requires authentication and explicit confirmation at the endpoint', async () => {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => reply.status(error instanceof ZodError ? 400 : 500).send({ success: false }));
  await app.register(usersRoutes, { prefix: '/users' });
  expect((await app.inject({ method: 'DELETE', url: '/users/me', payload: { password: 'password', confirmation: 'DELETE' } })).statusCode).toBe(401);
  expect((await app.inject({ method: 'DELETE', url: '/users/me', headers: { authorization: 'reader' }, payload: { password: 'password' } })).statusCode).toBe(400);
  expect(mocks.user.delete).not.toHaveBeenCalled();
  expect((await app.inject({ method: 'DELETE', url: '/users/me', headers: { authorization: 'reader' }, payload: { password: 'password', confirmation: 'DELETE' } })).statusCode).toBe(200);
  expect(mocks.user.delete).toHaveBeenCalledWith({ where: { id: 'reader' } });
  await app.close();
});
