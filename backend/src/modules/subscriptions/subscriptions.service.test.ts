import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { prisma } from '../../shared/db/prisma';
import { SubscriptionsService } from './subscriptions.service';
import { AppleVerifier } from './apple.verifier';
import { GoogleVerifier } from './google.verifier';

vi.mock('./apple.verifier');
vi.mock('./google.verifier');

describe('SubscriptionsService', () => {
  let userId: string;
  let userId2: string;

  beforeEach(async () => {
    const user1 = await prisma.user.create({
      data: {
        email: `sub-${Date.now()}-${Math.random()}@example.com`,
        passwordHash: 'hash',
        displayName: 'Test User',
        role: 'READER',
      },
    });
    userId = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: `sub2-${Date.now()}-${Math.random()}@example.com`,
        passwordHash: 'hash',
        displayName: 'Test User 2',
        role: 'READER',
      },
    });
    userId2 = user2.id;

    // Ensure no stale queued mock values leak between tests
    vi.mocked(AppleVerifier.verify).mockReset();
    vi.mocked(GoogleVerifier.verify).mockReset();
  });

  afterAll(async () => {
    await prisma.offlineKey.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Apple IAP Verification', () => {
    it('should verify Apple receipt and create subscription', async () => {
      vi.mocked(AppleVerifier.verify).mockResolvedValueOnce({
        productId: 'com.zita.premium.monthly',
        transactionId: 'apple-txn-123',
        originalTransactionId: 'apple-orig-123',
        purchasedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isTrial: false,
        isCancelled: false,
      });

      const subscription = await SubscriptionsService.verify(userId, {
        platform: 'IOS',
        receipt: 'mock-receipt-data',
        productId: 'com.zita.premium.monthly',
      });

      expect(subscription).toBeDefined();
      expect(subscription.userId).toBe(userId);
      expect(subscription.platform).toBe('IOS');
      expect(subscription.status).toBe('ACTIVE');
      expect(subscription.platformProductId).toBe('com.zita.premium.monthly');
    });

    it('should handle trial subscription', async () => {
      vi.mocked(AppleVerifier.verify).mockResolvedValueOnce({
        productId: 'com.zita.premium.trial',
        transactionId: 'apple-trial-123',
        originalTransactionId: 'apple-trial-orig',
        purchasedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isTrial: true,
        isCancelled: false,
      });

      const subscription = await SubscriptionsService.verify(userId, {
        platform: 'IOS',
        receipt: 'trial-receipt',
        productId: 'com.zita.premium.trial',
      });

      expect(subscription.status).toBe('TRIALING');
      expect(subscription.trialStart).not.toBeNull();
      expect(subscription.trialEnd).not.toBeNull();
    });

    it('should handle cancelled subscription', async () => {
      vi.mocked(AppleVerifier.verify).mockResolvedValueOnce({
        productId: 'com.zita.premium.monthly',
        transactionId: 'apple-txn-456',
        originalTransactionId: 'apple-orig-456',
        purchasedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 1000),
        isTrial: false,
        isCancelled: true,
      });

      const subscription = await SubscriptionsService.verify(userId, {
        platform: 'IOS',
        receipt: 'cancelled-receipt',
        productId: 'com.zita.premium.monthly',
      });

      expect(subscription.status).toBe('CANCELLED');
      expect(subscription.cancelledAt).not.toBeNull();
    });

    it('should update existing subscription (idempotent upsert)', async () => {
      vi.mocked(AppleVerifier.verify).mockResolvedValueOnce({
        productId: 'com.zita.premium.monthly',
        transactionId: 'apple-txn-789',
        originalTransactionId: 'apple-orig-789',
        purchasedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isTrial: false,
        isCancelled: false,
      });

      const sub1 = await SubscriptionsService.verify(userId, {
        platform: 'IOS',
        receipt: 'receipt-1',
        productId: 'com.zita.premium.monthly',
      });

      vi.mocked(AppleVerifier.verify).mockResolvedValueOnce({
        productId: 'com.zita.premium.monthly',
        transactionId: 'apple-txn-789-updated',
        originalTransactionId: 'apple-orig-789',
        purchasedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        isTrial: false,
        isCancelled: false,
      });

      const sub2 = await SubscriptionsService.verify(userId, {
        platform: 'IOS',
        receipt: 'receipt-2',
        productId: 'com.zita.premium.monthly',
      });

      expect(sub2.id).toBe(sub1.id);
      expect(sub2.currentPeriodEnd.getTime()).toBeGreaterThan(sub1.currentPeriodEnd.getTime());
    });

    it('should require a receipt for iOS', async () => {
      await expect(
        SubscriptionsService.verify(userId, {
          platform: 'IOS',
          productId: 'com.zita.premium.monthly',
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('Google IAP Verification', () => {
    it('should verify Google purchase token and create subscription', async () => {
      vi.mocked(GoogleVerifier.verify).mockResolvedValueOnce({
        productId: 'zita_premium_monthly',
        orderId: 'google-order-123',
        originalOrderId: 'google-order-123',
        transactionId: 'google-txn-123',
        originalTransactionId: 'google-order-123',
        purchasedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isTrial: false,
        isCancelled: false,
        autoRenewing: true,
        paymentState: 1,
      });

      const subscription = await SubscriptionsService.verify(userId2, {
        platform: 'ANDROID',
        purchaseToken: 'mock-purchase-token',
        productId: 'zita_premium_monthly',
      });

      expect(subscription).toBeDefined();
      expect(subscription.userId).toBe(userId2);
      expect(subscription.platform).toBe('ANDROID');
      expect(subscription.status).toBe('ACTIVE');
      expect(subscription.platformProductId).toBe('zita_premium_monthly');
    });

    it('should handle Google trial subscription', async () => {
      vi.mocked(GoogleVerifier.verify).mockResolvedValueOnce({
        productId: 'zita_premium_trial',
        orderId: 'google-trial-123',
        originalOrderId: 'google-trial-123',
        transactionId: 'google-trial-txn',
        originalTransactionId: 'google-trial-123',
        purchasedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isTrial: true,
        isCancelled: false,
        autoRenewing: true,
        paymentState: 2,
      });

      const subscription = await SubscriptionsService.verify(userId2, {
        platform: 'ANDROID',
        purchaseToken: 'trial-token',
        productId: 'zita_premium_trial',
      });

      expect(subscription.status).toBe('TRIALING');
    });

    it('should handle auto-renewing cancellation', async () => {
      vi.mocked(GoogleVerifier.verify).mockResolvedValueOnce({
        productId: 'zita_premium_monthly',
        orderId: 'google-cancel-123',
        originalOrderId: 'google-cancel-123',
        transactionId: 'google-cancel-txn',
        originalTransactionId: 'google-cancel-123',
        purchasedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        isTrial: false,
        isCancelled: true,
        autoRenewing: false,
        paymentState: 1,
      });

      const subscription = await SubscriptionsService.verify(userId2, {
        platform: 'ANDROID',
        purchaseToken: 'cancel-token',
        productId: 'zita_premium_monthly',
      });

      expect(subscription.status).toBe('CANCELLED');
      expect(subscription.cancelledAt).not.toBeNull();
    });

    it('should require a purchaseToken for Android', async () => {
      await expect(
        SubscriptionsService.verify(userId2, {
          platform: 'ANDROID',
          productId: 'zita_premium_monthly',
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('Subscription Retrieval', () => {
    it('should get active subscription for user', async () => {
      vi.mocked(AppleVerifier.verify).mockResolvedValueOnce({
        productId: 'com.zita.premium.monthly',
        transactionId: 'apple-get-123',
        originalTransactionId: 'apple-get-orig',
        purchasedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isTrial: false,
        isCancelled: false,
      });

      await SubscriptionsService.verify(userId, {
        platform: 'IOS',
        receipt: 'receipt',
        productId: 'com.zita.premium.monthly',
      });

      const subscription = await SubscriptionsService.getSubscription(userId);

      expect(subscription).toBeDefined();
      expect(subscription?.userId).toBe(userId);
      expect(subscription?.status).toBe('ACTIVE');
    });

    it('should return null for user without subscription', async () => {
      const subscription = await SubscriptionsService.getSubscription(userId);
      expect(subscription).toBeNull();
    });
  });

  describe('Apple Notifications', () => {
    it('should handle DID_RENEW notification', async () => {
      const originalTxnId = `apple-orig-renew-${Date.now()}`;
      vi.mocked(AppleVerifier.verify).mockResolvedValueOnce({
        productId: 'com.zita.premium.monthly',
        transactionId: 'apple-123',
        originalTransactionId: originalTxnId,
        purchasedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isTrial: false,
        isCancelled: false,
      });

      const sub = await SubscriptionsService.verify(userId, {
        platform: 'IOS',
        receipt: 'receipt',
        productId: 'com.zita.premium.monthly',
      });

      const renewalDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      await SubscriptionsService.handleAppleNotification({
        notification_type: 'DID_RENEW',
        unified_receipt: {
          latest_receipt_info: [
            {
              product_id: 'com.zita.premium.monthly',
              transaction_id: 'apple-renewal-456',
              original_transaction_id: originalTxnId,
              purchase_date_ms: Date.now().toString(),
              expires_date_ms: renewalDate.getTime().toString(),
              is_trial_period: 'false',
            },
          ],
        },
      });

      const updated = await SubscriptionsService.getSubscription(userId);
      expect(updated?.status).toBe('ACTIVE');
      expect(updated?.currentPeriodEnd.getTime()).toBeGreaterThan(sub.currentPeriodEnd.getTime());
    });

    it('should handle CANCEL notification', async () => {
      const originalTxnId = `apple-cancel-orig-${Date.now()}`;
      vi.mocked(AppleVerifier.verify).mockResolvedValueOnce({
        productId: 'com.zita.premium.monthly',
        transactionId: 'apple-cancel-123',
        originalTransactionId: originalTxnId,
        purchasedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isTrial: false,
        isCancelled: false,
      });

      await SubscriptionsService.verify(userId, {
        platform: 'IOS',
        receipt: 'receipt',
        productId: 'com.zita.premium.monthly',
      });

      await SubscriptionsService.handleAppleNotification({
        notification_type: 'CANCEL',
        unified_receipt: {
          latest_receipt_info: [
            {
              product_id: 'com.zita.premium.monthly',
              transaction_id: 'apple-cancel-123',
              original_transaction_id: originalTxnId,
              purchase_date_ms: Date.now().toString(),
              expires_date_ms: Date.now().toString(),
              is_trial_period: 'false',
            },
          ],
        },
      });

      const subscription = await SubscriptionsService.getSubscription(userId);
      expect(subscription?.status).toBe('CANCELLED');
      expect(subscription?.cancelledAt).not.toBeNull();
    });

    it('should handle DID_FAIL_TO_RENEW notification', async () => {
      const originalTxnId = `apple-fail-orig-${Date.now()}`;
      vi.mocked(AppleVerifier.verify).mockResolvedValueOnce({
        productId: 'com.zita.premium.monthly',
        transactionId: 'apple-fail-123',
        originalTransactionId: originalTxnId,
        purchasedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
        isTrial: false,
        isCancelled: false,
      });

      await SubscriptionsService.verify(userId, {
        platform: 'IOS',
        receipt: 'receipt',
        productId: 'com.zita.premium.monthly',
      });

      await SubscriptionsService.handleAppleNotification({
        notification_type: 'DID_FAIL_TO_RENEW',
        unified_receipt: {
          latest_receipt_info: [
            {
              product_id: 'com.zita.premium.monthly',
              transaction_id: 'apple-fail-123',
              original_transaction_id: originalTxnId,
              purchase_date_ms: (Date.now() - 30 * 24 * 60 * 60 * 1000).toString(),
              expires_date_ms: Date.now().toString(),
              is_trial_period: 'false',
            },
          ],
        },
      });

      const subscription = await SubscriptionsService.getSubscription(userId);
      expect(subscription?.status).toBe('PAST_DUE');
    });

    it('should ignore notification for unknown transaction', async () => {
      // Should not throw even when subscription is not found
      await expect(
        SubscriptionsService.handleAppleNotification({
          notification_type: 'DID_RENEW',
          unified_receipt: {
            latest_receipt_info: [
              {
                product_id: 'com.zita.premium.monthly',
                transaction_id: 'unknown-txn',
                original_transaction_id: 'unknown-orig',
                purchase_date_ms: Date.now().toString(),
                expires_date_ms: Date.now().toString(),
                is_trial_period: 'false',
              },
            ],
          },
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Google Notifications', () => {
    it('should handle subscription renewal notification', async () => {
      const orderId = `google-renew-${Date.now()}`;
      vi.mocked(GoogleVerifier.verify).mockResolvedValueOnce({
        productId: 'zita_premium_monthly',
        orderId,
        originalOrderId: orderId,
        transactionId: 'google-txn-123',
        originalTransactionId: orderId,
        purchasedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isTrial: false,
        isCancelled: false,
        autoRenewing: true,
        paymentState: 1,
      });

      await SubscriptionsService.verify(userId2, {
        platform: 'ANDROID',
        purchaseToken: 'token',
        productId: 'zita_premium_monthly',
      });

      vi.mocked(GoogleVerifier.verify).mockResolvedValueOnce({
        productId: 'zita_premium_monthly',
        orderId,
        originalOrderId: orderId,
        transactionId: 'google-txn-renewed',
        originalTransactionId: orderId,
        purchasedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        isTrial: false,
        isCancelled: false,
        autoRenewing: true,
        paymentState: 1,
      });

      // notificationType 2 = SUBSCRIPTION_RENEWED -> ACTIVE
      await SubscriptionsService.handleGoogleNotification({
        subscriptionNotification: {
          version: '1.0',
          packageName: 'com.zita.app',
          eventTimeMillis: Date.now().toString(),
          subscriptionId: 'zita_premium_monthly',
          purchaseToken: 'token',
          notificationType: 2,
        },
      });

      const updated = await SubscriptionsService.getSubscription(userId2);
      expect(updated?.status).toBe('ACTIVE');
    });

    it('should handle subscription cancelled notification', async () => {
      const orderId = `google-cancel-${Date.now()}`;
      vi.mocked(GoogleVerifier.verify).mockResolvedValueOnce({
        productId: 'zita_premium_monthly',
        orderId,
        originalOrderId: orderId,
        transactionId: 'google-cancel-txn',
        originalTransactionId: orderId,
        purchasedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isTrial: false,
        isCancelled: false,
        autoRenewing: true,
        paymentState: 1,
      });

      await SubscriptionsService.verify(userId2, {
        platform: 'ANDROID',
        purchaseToken: 'cancel-token',
        productId: 'zita_premium_monthly',
      });

      vi.mocked(GoogleVerifier.verify).mockResolvedValueOnce({
        productId: 'zita_premium_monthly',
        orderId,
        originalOrderId: orderId,
        transactionId: 'google-cancel-txn',
        originalTransactionId: orderId,
        purchasedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isTrial: false,
        isCancelled: true,
        autoRenewing: false,
        paymentState: 1,
      });

      // notificationType 3 = SUBSCRIPTION_CANCELED
      await SubscriptionsService.handleGoogleNotification({
        subscriptionNotification: {
          version: '1.0',
          packageName: 'com.zita.app',
          eventTimeMillis: Date.now().toString(),
          subscriptionId: 'zita_premium_monthly',
          purchaseToken: 'cancel-token',
          notificationType: 3,
        },
      });

      const updated = await SubscriptionsService.getSubscription(userId2);
      expect(updated?.status).toBe('CANCELLED');
    });
  });

  describe('Subscription Status Transitions', () => {
    it('should transition from TRIALING to ACTIVE', async () => {
      vi.mocked(AppleVerifier.verify).mockResolvedValueOnce({
        productId: 'com.zita.premium.monthly',
        transactionId: 'apple-trial-trans-123',
        originalTransactionId: 'apple-trial-orig',
        purchasedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isTrial: true,
        isCancelled: false,
      });

      const trial = await SubscriptionsService.verify(userId, {
        platform: 'IOS',
        receipt: 'trial-receipt',
        productId: 'com.zita.premium.monthly',
      });
      expect(trial.status).toBe('TRIALING');

      vi.mocked(AppleVerifier.verify).mockResolvedValueOnce({
        productId: 'com.zita.premium.monthly',
        transactionId: 'apple-paid-456',
        originalTransactionId: 'apple-trial-orig',
        purchasedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isTrial: false,
        isCancelled: false,
      });

      const active = await SubscriptionsService.verify(userId, {
        platform: 'IOS',
        receipt: 'paid-receipt',
        productId: 'com.zita.premium.monthly',
      });
      expect(active.status).toBe('ACTIVE');
    });

    it('should transition from ACTIVE to PAST_DUE on billing failure', async () => {
      vi.mocked(AppleVerifier.verify).mockResolvedValueOnce({
        productId: 'com.zita.premium.monthly',
        transactionId: 'apple-billing-123',
        originalTransactionId: 'apple-billing-orig',
        purchasedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isTrial: false,
        isCancelled: false,
      });

      const active = await SubscriptionsService.verify(userId, {
        platform: 'IOS',
        receipt: 'receipt',
        productId: 'com.zita.premium.monthly',
      });
      expect(active.status).toBe('ACTIVE');

      await SubscriptionsService.handleAppleNotification({
        notification_type: 'DID_FAIL_TO_RENEW',
        unified_receipt: {
          latest_receipt_info: [
            {
              product_id: 'com.zita.premium.monthly',
              transaction_id: 'apple-billing-123',
              original_transaction_id: 'apple-billing-orig',
              purchase_date_ms: (Date.now() - 30 * 24 * 60 * 60 * 1000).toString(),
              expires_date_ms: Date.now().toString(),
              is_trial_period: 'false',
            },
          ],
        },
      });

      const pastDue = await SubscriptionsService.getSubscription(userId);
      expect(pastDue?.status).toBe('PAST_DUE');
    });
  });

  describe('Subscription Plans', () => {
    it('should list available plans', () => {
      const plans = SubscriptionsService.getPlans();

      expect(Array.isArray(plans)).toBe(true);
      expect(plans.length).toBeGreaterThan(0);
      expect(plans[0]).toHaveProperty('id');
      expect(plans[0]).toHaveProperty('price');
    });
  });
});
