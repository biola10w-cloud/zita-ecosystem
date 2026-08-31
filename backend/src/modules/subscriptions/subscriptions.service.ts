import { prisma } from '../../shared/db/prisma';
import { AppleVerifier } from './apple.verifier';
import { GoogleVerifier } from './google.verifier';
import { StripeService } from './stripe.service';
import type Stripe from 'stripe';

export interface VerifyPayload {
  platform:       'IOS' | 'ANDROID';
  receipt?:       string;   // iOS: base64 receipt data
  purchaseToken?: string;   // Android: purchase token
  productId:      string;
}

export class SubscriptionsService {
  // â”€â”€â”€ Verify and activate a subscription â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Central subscription verification method.
   *
   * Called after the in-app purchase callback on the device.
   * We verify server-to-server with Apple/Google â€” never trust
   * the receipt data alone.
   *
   * Idempotent â€” safe to call multiple times for the same transaction.
   */
  static async verify(userId: string, payload: VerifyPayload) {
    let parsed;
    let platform = payload.platform;

    if (payload.platform === 'IOS') {
      if (!payload.receipt) {
        const err: any = new Error('iOS receipt is required');
        err.statusCode = 400;
        throw err;
      }
      parsed = await AppleVerifier.verify(payload.receipt);
    } else {
      if (!payload.purchaseToken) {
        const err: any = new Error('Android purchaseToken is required');
        err.statusCode = 400;
        throw err;
      }
      parsed = await GoogleVerifier.verify(payload.productId, payload.purchaseToken);
    }

    const status = parsed.isCancelled
      ? 'CANCELLED'
      : parsed.isTrial
      ? 'TRIALING'
      : parsed.expiresAt > new Date()
      ? 'ACTIVE'
      : 'EXPIRED';

    // Upsert subscription record
    const subscription = await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        status:                status as any,
        platform:              platform as any,
        platformProductId:     parsed.productId,
        platformTransactionId: parsed.transactionId,
        originalTransactionId: parsed.originalTransactionId,
        currentPeriodStart:    parsed.purchasedAt,
        currentPeriodEnd:      parsed.expiresAt,
        ...(parsed.isTrial && {
          trialStart: parsed.purchasedAt,
          trialEnd:   parsed.expiresAt,
        }),
        ...(parsed.isCancelled && { cancelledAt: new Date() }),
      },
      update: {
        status:                status as any,
        platformTransactionId: parsed.transactionId,
        currentPeriodStart:    parsed.purchasedAt,
        currentPeriodEnd:      parsed.expiresAt,
        ...(parsed.isCancelled && { cancelledAt: new Date() }),
        updatedAt:             new Date(),
      },
    });

    return subscription;
  }

  // â”€â”€â”€ Get current subscription â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async getSubscription(userId: string) {
    return prisma.subscription.findUnique({
      where: { userId },
    });
  }

  // â”€â”€â”€ Handle Apple server-to-server notification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Apple sends server notifications for:
   * - DID_RENEW: subscription renewed
   * - CANCEL: user cancelled (via Apple support)
   * - DID_FAIL_TO_RENEW: billing failure
   * - DID_CHANGE_RENEWAL_STATUS: user toggled auto-renew
   * - REFUND: purchase was refunded
   */
  static async handleAppleNotification(notification: any) {
    const { notification_type, unified_receipt } = notification;
    const latestInfo = unified_receipt?.latest_receipt_info?.[0];

    if (!latestInfo) return;

    const originalTransactionId = latestInfo.original_transaction_id;

    const subscription = await prisma.subscription.findFirst({
      where: { originalTransactionId },
    });

    if (!subscription) return;

    switch (notification_type) {
      case 'DID_RENEW':
      case 'INITIAL_BUY':
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'ACTIVE',
            currentPeriodStart: new Date(Number(latestInfo.purchase_date_ms)),
            currentPeriodEnd:   new Date(Number(latestInfo.expires_date_ms)),
            updatedAt: new Date(),
          },
        });
        break;

      case 'CANCEL':
      case 'REFUND':
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            updatedAt: new Date(),
          },
        });
        // Revoke offline keys
        await SubscriptionsService.revokeOfflineKeys(subscription.userId);
        break;

      case 'DID_FAIL_TO_RENEW':
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'PAST_DUE', updatedAt: new Date() },
        });
        break;

      case 'DID_CHANGE_RENEWAL_STATUS':
        // Auto-renew toggled off â€” don't change status until expiry
        break;
    }
  }

  // â”€â”€â”€ Handle Google Play developer notification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Google sends real-time developer notifications via Cloud Pub/Sub.
   * Notification types follow a different numbering system.
   */
  static async handleGoogleNotification(notification: any) {
    const { subscriptionNotification } = notification;
    if (!subscriptionNotification) return;

    const { purchaseToken, subscriptionId, notificationType } = subscriptionNotification;

    // Fetch latest state from Google
    let parsed;
    try {
      parsed = await GoogleVerifier.verify(subscriptionId, purchaseToken);
    } catch {
      return; // Can't verify â€” skip
    }

    const subscription = await prisma.subscription.findFirst({
      where: { originalTransactionId: parsed.originalOrderId },
    });

    if (!subscription) return;

    // Notification types: 1=RECOVERED, 2=RENEWED, 3=CANCELED, 4=PURCHASED
    // 5=ON_HOLD, 6=IN_GRACE_PERIOD, 7=RESTARTED, 12=REVOKED, 13=EXPIRED
    const statusMap: Record<number, string> = {
      1: 'ACTIVE',
      2: 'ACTIVE',
      3: 'CANCELLED',
      4: 'ACTIVE',
      5: 'PAST_DUE',
      6: 'PAST_DUE',
      7: 'ACTIVE',
      12: 'CANCELLED',
      13: 'EXPIRED',
    };

    const newStatus = statusMap[notificationType];
    if (!newStatus) return;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: newStatus as any,
        currentPeriodEnd: parsed.expiresAt,
        ...(newStatus === 'CANCELLED' && { cancelledAt: new Date() }),
        updatedAt: new Date(),
      },
    });

    if (['CANCELLED', 'EXPIRED'].includes(newStatus)) {
      await SubscriptionsService.revokeOfflineKeys(subscription.userId);
    }
  }

  // â”€â”€â”€ Revoke all offline keys for a user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async revokeOfflineKeys(userId: string) {
    await prisma.offlineKey.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // â”€â”€â”€ Stripe (web checkout: card, Apple Pay, Google Pay, PayPal) â”€â”€â”€â”€

  /**
   * Upsert the local Subscription record from a Stripe Subscription
   * object. Called from the `customer.subscription.created/updated/
   * deleted` webhook handlers. The userId travels in `metadata.userId`,
   * set when the Checkout Session was created.
   */
  static async syncFromStripeSubscription(stripeSubscription: Stripe.Subscription) {
    const userId = stripeSubscription.metadata?.userId;
    if (!userId) return; // Not one of ours â€” ignore

    const status = StripeService.mapStatus(stripeSubscription.status);
    const item = stripeSubscription.items.data[0];
    const isTrial = stripeSubscription.status === 'trialing';
    const isCancelled = ['canceled', 'incomplete_expired'].includes(stripeSubscription.status);

    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        status: status as any,
        platform: 'STRIPE' as any,
        platformProductId: item?.price?.id ?? 'zita_stripe_monthly',
        platformTransactionId: (stripeSubscription.latest_invoice as string) ?? stripeSubscription.id,
        originalTransactionId: stripeSubscription.id,
        stripeCustomerId: stripeSubscription.customer as string,
        stripeSubscriptionId: stripeSubscription.id,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        ...(isTrial && {
          trialStart: new Date(stripeSubscription.current_period_start * 1000),
          trialEnd: new Date(stripeSubscription.current_period_end * 1000),
        }),
        ...(isCancelled && { cancelledAt: new Date() }),
      },
      update: {
        status: status as any,
        platformTransactionId: (stripeSubscription.latest_invoice as string) ?? stripeSubscription.id,
        stripeCustomerId: stripeSubscription.customer as string,
        stripeSubscriptionId: stripeSubscription.id,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        ...(isCancelled && { cancelledAt: new Date() }),
        updatedAt: new Date(),
      },
    });

    if (status === 'CANCELLED' || status === 'EXPIRED') {
      await SubscriptionsService.revokeOfflineKeys(userId);
    }
  }

  // â”€â”€â”€ Get available plans â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static getPlans() {
    return [
      {
        id: 'com.zita.monthly',
        name: 'Monthly Premium',
        price: 6.00,
        currency: 'USD',
        period: 'monthly',
        trialDays: 7,
        platforms: ['ios', 'android', 'web'],
        paymentMethods: ['apple_iap', 'google_iap', 'card', 'apple_pay', 'google_pay', 'paypal'],
        features: [
          'Unlimited book access',
          'Offline reading',
          'Voice assistant',
          '50+ languages',
          'Community access',
        ],
      },
      {
        id: 'com.zita.annual',
        name: 'Annual Premium',
        price: 79.99,
        currency: 'USD',
        period: 'annual',
        trialDays: 7,
        savings: '33%',
      },
    ];
  }
}
