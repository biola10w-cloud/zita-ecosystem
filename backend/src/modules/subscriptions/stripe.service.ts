import Stripe from 'stripe';
import { config } from '../../config';
import { prisma } from '../../shared/db/prisma';

// $6.00/month — single unified web subscription price.
export const MONTHLY_PRICE_USD_CENTS = 600;

/**
 * Stripe integration — web checkout for card, Apple Pay, Google Pay,
 * and PayPal.
 *
 * Apple Pay / Google Pay require no separate `payment_method_types`
 * entry: Stripe Checkout automatically surfaces them as express wallet
 * buttons under the `card` method for eligible browsers/devices. PayPal
 * must additionally be enabled for the Stripe account in the Dashboard.
 */
export class StripeService {
  private static _client: Stripe | null = null;

  private static get client(): Stripe {
    if (!config.STRIPE_SECRET_KEY) {
      const err: any = new Error(
        'STRIPE_SECRET_KEY is not configured — set it in .env to enable web payments',
      );
      err.statusCode = 503;
      err.code = 'STRIPE_NOT_CONFIGURED';
      throw err;
    }

    if (!StripeService._client) {
      // Pin to the API version bundled with the installed SDK's types
      StripeService._client = new Stripe(config.STRIPE_SECRET_KEY, {
        apiVersion: '2025-02-24.acacia',
      });
    }

    return StripeService._client;
  }

  static isConfigured(): boolean {
    return !!config.STRIPE_SECRET_KEY;
  }

  // ─── Customer ───────────────────────────────────────────────────

  private static async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    const existing = await prisma.subscription.findUnique({ where: { userId } });
    if (existing?.stripeCustomerId) {
      return existing.stripeCustomerId;
    }

    const customer = await StripeService.client.customers.create({
      email,
      metadata: { userId },
    });

    return customer.id;
  }

  // ─── Checkout ───────────────────────────────────────────────────

  static async createCheckoutSession(
    userId: string,
    email: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    const customerId = await StripeService.getOrCreateCustomer(userId, email);

    return StripeService.client.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card', 'paypal'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: MONTHLY_PRICE_USD_CENTS,
            recurring: { interval: 'month' },
            product_data: { name: 'ZITA Monthly Premium' },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: { userId },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId },
    });
  }

  static async createBillingPortalSession(customerId: string, returnUrl: string) {
    return StripeService.client.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  // ─── Webhooks ───────────────────────────────────────────────────

  static constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    if (!config.STRIPE_WEBHOOK_SECRET) {
      const err: any = new Error('STRIPE_WEBHOOK_SECRET is not configured');
      err.statusCode = 503;
      throw err;
    }

    return StripeService.client.webhooks.constructEvent(
      rawBody,
      signature,
      config.STRIPE_WEBHOOK_SECRET,
    );
  }

  static async cancelSubscription(stripeSubscriptionId: string) {
    return StripeService.client.subscriptions.cancel(stripeSubscriptionId);
  }

  // ─── Status mapping ─────────────────────────────────────────────

  static mapStatus(stripeStatus: Stripe.Subscription.Status): string {
    switch (stripeStatus) {
      case 'trialing':
        return 'TRIALING';
      case 'active':
        return 'ACTIVE';
      case 'past_due':
      case 'unpaid':
      case 'incomplete':
        return 'PAST_DUE';
      case 'canceled':
      case 'incomplete_expired':
        return 'CANCELLED';
      default:
        return 'EXPIRED';
    }
  }
}
