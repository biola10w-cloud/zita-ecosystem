import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  subscriptions: { retrieve: vi.fn(), cancel: vi.fn() },
  user: { findUnique: vi.fn() }, subscription: { upsert: vi.fn() },
}));
vi.mock('../../config', () => ({ config: { STRIPE_SECRET_KEY: 'test-only' } }));
vi.mock('../../shared/db/prisma', () => ({ prisma: mocks }));
vi.mock('../subscriptions/apple.verifier', () => ({ AppleVerifier: {} }));
vi.mock('../subscriptions/google.verifier', () => ({ GoogleVerifier: {} }));
import { StripeService } from '../subscriptions/stripe.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
beforeEach(() => { vi.resetAllMocks(); (StripeService as any)._client = mocks; });

it('cancels active Stripe billing without creating a prorated invoice', async () => {
  mocks.subscriptions.retrieve.mockResolvedValue({ status: 'active' });
  await StripeService.cancelForAccountDeletion('sub');
  expect(mocks.subscriptions.cancel).toHaveBeenCalledWith('sub', { invoice_now: false, prorate: false });
});
it('allows retry after billing was already cancelled', async () => {
  mocks.subscriptions.retrieve.mockResolvedValue({ status: 'canceled' });
  await StripeService.cancelForAccountDeletion('sub');
  expect(mocks.subscriptions.cancel).not.toHaveBeenCalled();
});
it('ignores late Stripe notifications after account removal', async () => {
  mocks.user.findUnique.mockResolvedValue(null);
  await SubscriptionsService.syncFromStripeSubscription({ metadata: { userId: 'deleted-reader' } } as any);
  expect(mocks.subscription.upsert).not.toHaveBeenCalled();
});
