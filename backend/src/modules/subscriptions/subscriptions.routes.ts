import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe.service';
import { authenticate } from '../../shared/middleware/authenticate';
import { rateLimits } from '../../shared/middleware/rateLimiter';

const verifySchema = z.object({
  platform:       z.enum(['IOS', 'ANDROID']),
  receipt:        z.string().optional(),
  purchaseToken:  z.string().optional(),
  productId:      z.string(),
});

const checkoutSchema = z.object({
  successUrl: z.string().url(),
  cancelUrl:  z.string().url(),
});

export async function subscriptionsRoutes(app: FastifyInstance) {
  // Stripe webhook signature verification needs the raw request body.
  // Scoped to this plugin only — other route modules keep normal JSON parsing.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    (req as any).rawBody = body;
    if (body.length === 0) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(body.toString('utf8')));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // GET /api/v1/subscriptions/plans  (public)
  app.get('/plans', async (_, reply) => {
    return reply.send({ success: true, data: SubscriptionsService.getPlans() });
  });

  // GET /api/v1/subscriptions/me  (auth)
  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const sub = await SubscriptionsService.getSubscription(request.user!.sub);
    return reply.send({ success: true, data: sub });
  });

  // POST /api/v1/subscriptions/verify  (auth) — App Store / Play Store IAP
  app.post('/verify', {
    preHandler: [authenticate],
    config: { rateLimit: rateLimits.heavy },
  }, async (request, reply) => {
    const body = verifySchema.parse(request.body);
    const sub = await SubscriptionsService.verify(request.user!.sub, body);
    return reply.send({ success: true, data: sub });
  });

  // ─── Stripe (web): card, Apple Pay, Google Pay, PayPal ─────────

  // POST /api/v1/subscriptions/stripe/checkout  (auth)
  app.post('/stripe/checkout', {
    preHandler: [authenticate],
    config: { rateLimit: rateLimits.heavy },
  }, async (request, reply) => {
    const { successUrl, cancelUrl } = checkoutSchema.parse(request.body);
    const session = await StripeService.createCheckoutSession(
      request.user!.sub,
      request.user!.email,
      successUrl,
      cancelUrl,
    );
    return reply.send({ success: true, data: { url: session.url, sessionId: session.id } });
  });

  // POST /api/v1/subscriptions/stripe/portal  (auth) — manage/cancel billing
  app.post('/stripe/portal', { preHandler: [authenticate] }, async (request, reply) => {
    const { returnUrl } = request.body as { returnUrl: string };
    const existing = await SubscriptionsService.getSubscription(request.user!.sub);

    if (!existing?.stripeCustomerId) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NO_STRIPE_CUSTOMER', message: 'No Stripe subscription found for this account' },
      });
    }

    const portal = await StripeService.createBillingPortalSession(existing.stripeCustomerId, returnUrl);
    return reply.send({ success: true, data: { url: portal.url } });
  });

  // POST /api/v1/subscriptions/webhooks/stripe  (signature-verified, no auth)
  app.post('/webhooks/stripe', async (request, reply) => {
    const signature = request.headers['stripe-signature'] as string | undefined;
    const rawBody = (request as any).rawBody as Buffer | undefined;

    if (!signature || !rawBody) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_SIGNATURE' } });
    }

    let event;
    try {
      event = StripeService.constructWebhookEvent(rawBody, signature);
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_SIGNATURE', message: err.message } });
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await SubscriptionsService.syncFromStripeSubscription(event.data.object as any);
        break;
    }

    return reply.status(200).send('OK');
  });

  // ─── Webhook routes (no auth — verified by payload signature) ──

  // POST /api/v1/subscriptions/webhooks/apple
  app.post('/webhooks/apple', async (request, reply) => {
    // In production: verify Apple's JWT signature here
    await SubscriptionsService.handleAppleNotification(request.body);
    return reply.status(200).send('OK');
  });

  // POST /api/v1/subscriptions/webhooks/google
  app.post('/webhooks/google', async (request, reply) => {
    // In production: verify Google's Pub/Sub HMAC signature here
    const message = (request.body as any)?.message;
    if (message?.data) {
      const decoded = JSON.parse(
        Buffer.from(message.data, 'base64').toString('utf8'),
      );
      await SubscriptionsService.handleGoogleNotification(decoded);
    }
    return reply.status(200).send('OK');
  });
}

