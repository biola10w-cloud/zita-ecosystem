# ZITA Backend — Phase 3 Part 3: Subscriptions, Offline Keys, Analytics, Admin

---

## src/modules/subscriptions/apple.verifier.ts

```typescript
import axios from 'axios';
import { config } from '../../config';

export interface AppleReceiptResponse {
  status: number;
  receipt: {
    in_app: AppleTransaction[];
  };
  latest_receipt_info?: AppleTransaction[];
  pending_renewal_info?: Array<{
    auto_renew_status: string;
    expiration_intent?: string;
  }>;
}

export interface AppleTransaction {
  product_id:               string;
  transaction_id:           string;
  original_transaction_id:  string;
  purchase_date_ms:         string;
  expires_date_ms:          string;
  is_trial_period:          string;  // "true" | "false"
  cancellation_date_ms?:    string;
}

export interface ParsedAppleSubscription {
  productId:            string;
  transactionId:        string;
  originalTransactionId: string;
  purchasedAt:          Date;
  expiresAt:            Date;
  isTrial:              boolean;
  isCancelled:          boolean;
}

/**
 * Apple Receipt Verifier
 *
 * Verifies a StoreKit receipt against Apple's servers.
 * Always verify server-to-server — never trust client claims.
 *
 * Production strategy:
 * - Try production endpoint first
 * - If status 21007 (sandbox receipt), retry sandbox endpoint
 * - Status 0 = valid
 */
export class AppleVerifier {
  static async verify(
    receiptData: string,
  ): Promise<ParsedAppleSubscription> {
    const payload = {
      'receipt-data': receiptData,
      password: config.APPLE_SHARED_SECRET,
      'exclude-old-transactions': true,
    };

    let response = await AppleVerifier.callApple(
      config.APPLE_VERIFY_URL,
      payload,
    );

    // 21007 = This receipt is from the test environment (sandbox)
    if (response.status === 21007) {
      response = await AppleVerifier.callApple(
        config.APPLE_SANDBOX_VERIFY_URL,
        payload,
      );
    }

    if (response.status !== 0) {
      const err: any = new Error(`Apple receipt verification failed: status ${response.status}`);
      err.statusCode = 400;
      err.code = 'INVALID_RECEIPT';
      throw err;
    }

    // Get the most recent transaction from latest_receipt_info
    const transactions = response.latest_receipt_info ?? response.receipt.in_app;
    if (!transactions || transactions.length === 0) {
      const err: any = new Error('No transactions found in receipt');
      err.statusCode = 400;
      throw err;
    }

    // Sort by expires_date descending to get latest
    const latest = transactions.sort(
      (a, b) => Number(b.expires_date_ms) - Number(a.expires_date_ms),
    )[0];

    return {
      productId:             latest.product_id,
      transactionId:         latest.transaction_id,
      originalTransactionId: latest.original_transaction_id,
      purchasedAt:           new Date(Number(latest.purchase_date_ms)),
      expiresAt:             new Date(Number(latest.expires_date_ms)),
      isTrial:               latest.is_trial_period === 'true',
      isCancelled:           !!latest.cancellation_date_ms,
    };
  }

  private static async callApple(
    url: string,
    payload: object,
  ): Promise<AppleReceiptResponse> {
    const response = await axios.post<AppleReceiptResponse>(url, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  }
}
```

---

## src/modules/subscriptions/google.verifier.ts

```typescript
import { google } from 'googleapis';
import fs from 'fs';
import { config } from '../../config';

export interface ParsedGoogleSubscription {
  productId:             string;
  orderId:               string;
  originalOrderId:       string;
  purchasedAt:           Date;
  expiresAt:             Date;
  isTrial:               boolean;
  isCancelled:           boolean;
  autoRenewing:          boolean;
  paymentState:          number;  // 0=pending, 1=received, 2=free trial
}

/**
 * Google Play Subscription Verifier
 *
 * Uses the Google Play Developer API to verify subscription purchases.
 * Requires a service account with "Financial data viewer" permissions
 * on the Google Play Console.
 *
 * Authentication: Service account JSON key file (never expose this).
 */
export class GoogleVerifier {
  private static androidPublisher = google.androidpublisher('v3');

  private static async getAuthClient() {
    const keyFile = JSON.parse(
      fs.readFileSync(config.GOOGLE_SERVICE_ACCOUNT_KEY_PATH, 'utf8'),
    );

    const auth = new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    return auth.getClient();
  }

  static async verify(
    productId: string,
    purchaseToken: string,
  ): Promise<ParsedGoogleSubscription> {
    const authClient = await GoogleVerifier.getAuthClient();

    const response = await GoogleVerifier.androidPublisher.purchases.subscriptions.get(
      {
        packageName: config.GOOGLE_PACKAGE_NAME,
        subscriptionId: productId,
        token: purchaseToken,
        auth: authClient as any,
      },
    );

    const sub = response.data;

    if (!sub.expiryTimeMillis) {
      const err: any = new Error('Invalid subscription — no expiry time');
      err.statusCode = 400;
      throw err;
    }

    const isCancelled =
      sub.cancelReason !== undefined || sub.userCancellationTimeMillis !== undefined;

    const isTrial = sub.paymentState === 2;  // 2 = free trial

    return {
      productId,
      orderId:          sub.orderId ?? purchaseToken,
      originalOrderId:  sub.linkedPurchaseToken ?? sub.orderId ?? purchaseToken,
      purchasedAt:      new Date(Number(sub.startTimeMillis ?? 0)),
      expiresAt:        new Date(Number(sub.expiryTimeMillis)),
      isTrial,
      isCancelled,
      autoRenewing:     sub.autoRenewing ?? false,
      paymentState:     sub.paymentState ?? 0,
    };
  }
}
```

---

## src/modules/subscriptions/subscriptions.service.ts

```typescript
import { prisma } from '../../shared/db/prisma';
import { AppleVerifier } from './apple.verifier';
import { GoogleVerifier } from './google.verifier';

export interface VerifyPayload {
  platform:       'IOS' | 'ANDROID';
  receipt?:       string;   // iOS: base64 receipt data
  purchaseToken?: string;   // Android: purchase token
  productId:      string;
}

export class SubscriptionsService {
  // ─── Verify and activate a subscription ───────────────────────

  /**
   * Central subscription verification method.
   *
   * Called after the in-app purchase callback on the device.
   * We verify server-to-server with Apple/Google — never trust
   * the receipt data alone.
   *
   * Idempotent — safe to call multiple times for the same transaction.
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

  // ─── Get current subscription ──────────────────────────────────

  static async getSubscription(userId: string) {
    return prisma.subscription.findUnique({
      where: { userId },
    });
  }

  // ─── Handle Apple server-to-server notification ────────────────

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
        // Auto-renew toggled off — don't change status until expiry
        break;
    }
  }

  // ─── Handle Google Play developer notification ─────────────────

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
      return; // Can't verify — skip
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

  // ─── Revoke all offline keys for a user ───────────────────────

  static async revokeOfflineKeys(userId: string) {
    await prisma.offlineKey.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ─── Get available plans ───────────────────────────────────────

  static getPlans() {
    return [
      {
        id: 'com.zita.monthly',
        name: 'Monthly Premium',
        price: 9.99,
        currency: 'USD',
        period: 'monthly',
        trialDays: 7,
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
```

---

## src/modules/subscriptions/subscriptions.routes.ts

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SubscriptionsService } from './subscriptions.service';
import { authenticate } from '../../shared/middleware/authenticate';
import { rateLimits } from '../../shared/middleware/rateLimiter';

const verifySchema = z.object({
  platform:       z.enum(['IOS', 'ANDROID']),
  receipt:        z.string().optional(),
  purchaseToken:  z.string().optional(),
  productId:      z.string(),
});

export async function subscriptionsRoutes(app: FastifyInstance) {
  // GET /api/v1/subscriptions/plans  (public)
  app.get('/plans', async (_, reply) => {
    return reply.send({ success: true, data: SubscriptionsService.getPlans() });
  });

  // GET /api/v1/subscriptions/me  (auth)
  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const sub = await SubscriptionsService.getSubscription(request.user!.sub);
    return reply.send({ success: true, data: sub });
  });

  // POST /api/v1/subscriptions/verify  (auth)
  app.post('/verify', {
    preHandler: [authenticate],
    config: { rateLimit: rateLimits.heavy },
  }, async (request, reply) => {
    const body = verifySchema.parse(request.body);
    const sub = await SubscriptionsService.verify(request.user!.sub, body);
    return reply.send({ success: true, data: sub });
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
```

---

## src/modules/offline/offline.service.ts

```typescript
import { prisma } from '../../shared/db/prisma';
import { KeyManager } from '../../shared/encryption/keyManager';
import { BookCrypto } from '../../shared/encryption/bookCrypto';
import { BooksService } from '../books/books.service';

const OFFLINE_KEY_TTL_DAYS = 30;  // Offline access lasts 30 days from grant

export class OfflineService {
  // ─── Grant offline access ──────────────────────────────────────

  /**
   * Offline Key Delivery Process:
   *
   * 1. Verify user has active subscription or purchased the book
   * 2. Verify device is not rooted/jailbroken (client sends isCompromised flag)
   * 3. Fetch and unwrap the book's BEK from KMS
   * 4. Re-encrypt BEK with the device's RSA public key
   *    → Only that device's private key (in hardware) can decrypt it
   * 5. Store the device-encrypted key as OfflineKey record
   * 6. Return the device-encrypted key to the app
   *
   * The app stores this encrypted key in secure storage.
   * When reading offline, it decrypts the BEK using its hardware private key,
   * then uses the BEK to decrypt downloaded chapter files.
   */
  static async grantOfflineKey(
    userId: string,
    bookSlug: string,
    deviceId: string,
    devicePublicKeyPem: string,
    isDeviceCompromised: boolean,
  ) {
    // Security check: refuse offline access on rooted/jailbroken devices
    if (isDeviceCompromised) {
      const err: any = new Error(
        'Offline access is not available on rooted or jailbroken devices',
      );
      err.statusCode = 403;
      err.code = 'COMPROMISED_DEVICE';
      throw err;
    }

    // Verify the device belongs to this user
    const device = await prisma.device.findFirst({
      where: { id: deviceId, userId },
    });

    if (!device) {
      const err: any = new Error('Device not found');
      err.statusCode = 404;
      throw err;
    }

    // Verify access
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
      select: { id: true, encryptedFileKey: true },
    });

    const access = await BooksService.checkUserAccess(userId, book.id);
    if (!access.hasAccess) {
      const err: any = new Error('Subscription required for offline access');
      err.statusCode = 403;
      err.code = 'ACCESS_DENIED';
      throw err;
    }

    // Unwrap BEK from KMS
    const bek = await KeyManager.unwrapKey(book.encryptedFileKey);
    const bekHex = bek.toString('hex');

    // Re-encrypt BEK with device's RSA public key
    const deviceEncryptedBek = BookCrypto.encryptKeyForDevice(
      bekHex,
      devicePublicKeyPem,
    );

    // Calculate expiry: min(subscription expiry, now + 30 days)
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + OFFLINE_KEY_TTL_DAYS);

    const validUntil =
      sub && sub.currentPeriodEnd < defaultExpiry
        ? sub.currentPeriodEnd
        : defaultExpiry;

    // Upsert OfflineKey record
    const offlineKey = await prisma.offlineKey.upsert({
      where: {
        userId_deviceId_bookId: {
          userId,
          deviceId,
          bookId: book.id,
        },
      },
      create: {
        userId,
        deviceId,
        bookId: book.id,
        encryptedDecryptionKey: deviceEncryptedBek,
        validUntil,
      },
      update: {
        encryptedDecryptionKey: deviceEncryptedBek,
        validUntil,
        revokedAt: null,  // Re-activate if previously revoked
      },
    });

    return {
      encryptedKey: offlineKey.encryptedDecryptionKey,
      validUntil:   offlineKey.validUntil,
      bookId:       book.id,
    };
  }

  // ─── Revoke offline key ────────────────────────────────────────

  static async revokeOfflineKey(
    userId: string,
    bookSlug: string,
    deviceId: string,
  ) {
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
      select: { id: true },
    });

    await prisma.offlineKey.updateMany({
      where: { userId, bookId: book.id, deviceId },
      data: { revokedAt: new Date() },
    });
  }

  // ─── List offline books for a device ──────────────────────────

  static async listOfflineBooks(userId: string, deviceId: string) {
    const keys = await prisma.offlineKey.findMany({
      where: {
        userId,
        deviceId,
        revokedAt: null,
        validUntil: { gt: new Date() },
      },
      include: {
        book: {
          select: {
            id: true,
            slug: true,
            title: true,
            authorName: true,
            coverUrl: true,
            totalChapters: true,
          },
        },
      },
    });

    return keys.map((k) => ({
      book:      k.book,
      validUntil: k.validUntil,
    }));
  }

  // ─── Cleanup expired keys (run as a cron job) ─────────────────

  static async cleanupExpiredKeys() {
    const result = await prisma.offlineKey.updateMany({
      where: {
        validUntil: { lt: new Date() },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { revokedCount: result.count };
  }
}
```

---

## src/modules/offline/offline.routes.ts

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OfflineService } from './offline.service';
import { authenticate } from '../../shared/middleware/authenticate';
import { rateLimits } from '../../shared/middleware/rateLimiter';

const grantKeySchema = z.object({
  deviceId:            z.string().cuid(),
  devicePublicKeyPem:  z.string().min(100),  // RSA PEM public key
  isDeviceCompromised: z.boolean().default(false),
});

export async function offlineRoutes(app: FastifyInstance) {
  // POST /api/v1/books/:slug/offline-key
  app.post('/:slug/offline-key', {
    preHandler: [authenticate],
    config: { rateLimit: rateLimits.heavy },
  }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const body = grantKeySchema.parse(request.body);

    const result = await OfflineService.grantOfflineKey(
      request.user!.sub,
      slug,
      body.deviceId,
      body.devicePublicKeyPem,
      body.isDeviceCompromised,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  // DELETE /api/v1/books/:slug/offline-key
  app.delete('/:slug/offline-key', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { deviceId } = request.body as { deviceId: string };

    await OfflineService.revokeOfflineKey(request.user!.sub, slug, deviceId);
    return reply.send({ success: true, data: null });
  });

  // GET /api/v1/books/offline
  app.get('/offline', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { deviceId } = request.query as { deviceId: string };
    const books = await OfflineService.listOfflineBooks(request.user!.sub, deviceId);
    return reply.send({ success: true, data: books });
  });
}
```

---

## src/modules/analytics/analytics.service.ts

```typescript
import { prisma } from '../../shared/db/prisma';

export class AnalyticsService {
  // ─── Ingest a batch of events from the app ────────────────────

  static async ingestEvents(
    userId: string,
    events: Array<{
      eventType:  string;
      bookId?:    string;
      properties: Record<string, any>;
      occurredAt: string;
    }>,
  ) {
    // Validate event types against allowlist
    const allowedEventTypes = new Set([
      'chapter_open',
      'reading_session_end',
      'book_like',
      'book_unlike',
      'comment_posted',
      'search_performed',
      'app_opened',
      'subscription_started',
      'subscription_cancelled',
    ]);

    const validEvents = events.filter((e) =>
      allowedEventTypes.has(e.eventType),
    );

    await prisma.analyticsEvent.createMany({
      data: validEvents.map((e) => ({
        userId,
        bookId:     e.bookId ?? null,
        eventType:  e.eventType,
        properties: e.properties,
        occurredAt: new Date(e.occurredAt),
      })),
      skipDuplicates: true,
    });
  }

  // ─── Admin analytics dashboard data ───────────────────────────

  static async getDashboardStats(days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      totalUsers,
      activeSubscriptions,
      trialSubscriptions,
      newUsersThisPeriod,
      totalReadingEvents,
      topBooks,
      dailyActiveUsers,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Active subscriptions
      prisma.subscription.count({
        where: { status: 'ACTIVE' },
      }),

      // Trial subscriptions
      prisma.subscription.count({
        where: { status: 'TRIALING' },
      }),

      // New users in period
      prisma.user.count({
        where: { createdAt: { gte: since } },
      }),

      // Total reading sessions
      prisma.analyticsEvent.count({
        where: {
          eventType: 'reading_session_end',
          occurredAt: { gte: since },
        },
      }),

      // Top books by reading activity
      prisma.analyticsEvent.groupBy({
        by: ['bookId'],
        where: {
          eventType: 'chapter_open',
          occurredAt: { gte: since },
          bookId: { not: null },
        },
        _count: { bookId: true },
        orderBy: { _count: { bookId: 'desc' } },
        take: 10,
      }),

      // Daily active users (past 7 days)
      prisma.$queryRaw`
        SELECT
          DATE(occurred_at) as date,
          COUNT(DISTINCT user_id) as active_users
        FROM analytics_events
        WHERE occurred_at >= NOW() - INTERVAL '7 days'
          AND user_id IS NOT NULL
        GROUP BY DATE(occurred_at)
        ORDER BY date ASC
      `,
    ]);

    // Enrich top books with metadata
    const topBookIds = topBooks.map((b) => b.bookId!).filter(Boolean);
    const bookDetails = topBookIds.length > 0
      ? await prisma.book.findMany({
          where: { id: { in: topBookIds } },
          select: { id: true, title: true, authorName: true, coverUrl: true },
        })
      : [];

    const topBooksEnriched = topBooks.map((b) => ({
      ...bookDetails.find((d) => d.id === b.bookId),
      readCount: b._count.bookId,
    }));

    return {
      overview: {
        totalUsers,
        activeSubscriptions,
        trialSubscriptions,
        newUsersThisPeriod,
        totalReadingEvents,
      },
      topBooks: topBooksEnriched,
      dailyActiveUsers,
    };
  }

  // ─── Reading time stats for a user ────────────────────────────

  static async getUserReadingStats(userId: string) {
    const [totalSessions, completedBooks, currentStreak, highlights] =
      await Promise.all([
        prisma.analyticsEvent.count({
          where: { userId, eventType: 'reading_session_end' },
        }),

        prisma.readingProgress.count({
          where: { userId, completedAt: { not: null } },
        }),

        AnalyticsService.calculateStreak(userId),

        prisma.highlight.count({ where: { userId } }),
      ]);

    const inProgressBooks = await prisma.readingProgress.findMany({
      where: {
        userId,
        completedAt: null,
        percentComplete: { gt: 0 },
      },
      include: {
        book: {
          select: {
            id: true,
            slug: true,
            title: true,
            authorName: true,
            coverUrl: true,
            totalChapters: true,
          },
        },
      },
      orderBy: { lastReadAt: 'desc' },
      take: 10,
    });

    const recentHighlights = await prisma.highlight.findMany({
      where: { userId },
      include: {
        book: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      streakDays:      currentStreak,
      completedBooks,
      totalSessions,
      highlightCount:  highlights,
      inProgressBooks,
      highlights:      recentHighlights,
    };
  }

  // ─── Calculate reading streak ──────────────────────────────────

  private static async calculateStreak(userId: string): Promise<number> {
    // Get distinct reading days ordered descending
    const readingDays = await prisma.$queryRaw<Array<{ date: Date }>>`
      SELECT DISTINCT DATE(last_read_at) as date
      FROM reading_progress
      WHERE user_id = ${userId}
      ORDER BY date DESC
    `;

    if (readingDays.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < readingDays.length; i++) {
      const day = new Date(readingDays[i].date);
      day.setHours(0, 0, 0, 0);

      const expected = new Date(today);
      expected.setDate(today.getDate() - i);

      if (day.getTime() === expected.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}
```

---

## src/modules/analytics/analytics.routes.ts

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AnalyticsService } from './analytics.service';
import { authenticate } from '../../shared/middleware/authenticate';
import { requireRole } from '../../shared/middleware/authenticate';
import { rateLimits } from '../../shared/middleware/rateLimiter';

const eventsSchema = z.object({
  events: z.array(z.object({
    eventType:  z.string(),
    bookId:     z.string().optional(),
    properties: z.record(z.any()).default({}),
    occurredAt: z.string().datetime(),
  })).max(50), // Batch limit
});

export async function analyticsRoutes(app: FastifyInstance) {
  // POST /api/v1/analytics/events — batch ingest from app
  app.post('/events', {
    preHandler: [authenticate],
    config: { rateLimit: rateLimits.analytics },
  }, async (request, reply) => {
    const { events } = eventsSchema.parse(request.body);
    await AnalyticsService.ingestEvents(request.user!.sub, events);
    return reply.status(202).send({ success: true, data: null });
  });

  // GET /api/v1/analytics/me — user's own stats
  app.get('/me', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const stats = await AnalyticsService.getUserReadingStats(request.user!.sub);
    return reply.send({ success: true, data: stats });
  });

  // GET /api/v1/analytics/dashboard — admin only
  app.get('/dashboard', {
    preHandler: [authenticate, requireRole('ADMIN')],
  }, async (request, reply) => {
    const { days } = request.query as { days?: string };
    const stats = await AnalyticsService.getDashboardStats(Number(days ?? 30));
    return reply.send({ success: true, data: stats });
  });
}
```

---

## src/modules/admin/admin.service.ts

```typescript
import { prisma } from '../../shared/db/prisma';
import { S3Service } from '../../shared/storage/s3';
import { encryptionQueue, translationQueue } from '../../shared/queue/queues';
import { nanoid } from 'nanoid';

export interface CreateBookInput {
  title:            string;
  authorName:       string;
  description:      string;
  contentType:      'BOOK' | 'STORY' | 'SUMMARY';
  language:         string;
  estimatedMinutes: number;
  isPremium:        boolean;
  price?:           number;
  tags:             string[];
}

export class AdminService {
  // ─── Create book + trigger encryption pipeline ─────────────────

  static async createBook(
    input: CreateBookInput,
    rawFileBuffer: Buffer,
    coverBuffer: Buffer,
    coverMimeType: string,
  ) {
    // Generate a stable slug from the title
    const baseSlug = input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const uniqueSuffix = nanoid(6).toLowerCase();
    const slug = `${baseSlug}-${uniqueSuffix}`;

    // 1. Upload raw (unencrypted) file to temporary S3 location
    //    This will be deleted by the encryption worker after processing
    const rawS3Key = `temp/raw/${slug}-${Date.now()}.txt`;
    await S3Service.uploadEncryptedContent(rawS3Key, rawFileBuffer);

    // 2. Upload cover (public asset)
    const coverKey = `covers/${slug}`;
    const coverUrl = await S3Service.uploadPublicAsset(
      coverKey,
      coverBuffer,
      coverMimeType,
    );

    // 3. Upsert tags
    const tagRecords = await Promise.all(
      input.tags.map((name) =>
        prisma.tag.upsert({
          where: { name: name.toLowerCase() },
          create: { name: name.toLowerCase() },
          update: {},
        }),
      ),
    );

    // 4. Create book record (not yet published — awaiting encryption)
    const book = await prisma.book.create({
      data: {
        title:            input.title,
        slug,
        authorName:       input.authorName,
        description:      input.description,
        coverUrl,
        contentType:      input.contentType as any,
        language:         input.language,
        totalChapters:    0,              // Set by encryption worker
        estimatedMinutes: input.estimatedMinutes,
        isPremium:        input.isPremium,
        price:            input.price ?? null,
        isPublished:      false,          // Published after encryption
        encryptedFileKey: 'pending',      // Set by encryption worker
        fileIv:           'pending',
        fileAuthTag:      'pending',
        tags: {
          create: tagRecords.map((tag) => ({ tagId: tag.id })),
        },
      },
    });

    // 5. Queue encryption job
    const encryptionJob = await encryptionQueue.add(
      {
        bookId:       book.id,
        rawS3Key,
        chapterCount: 0,  // Worker will auto-detect from content
      },
      { priority: 1 },
    );

    return {
      book,
      encryptionJobId: encryptionJob.id,
    };
  }

  // ─── Publish a book (after encryption is complete) ────────────

  static async publishBook(bookId: string) {
    const book = await prisma.book.findUniqueOrThrow({
      where: { id: bookId },
    });

    // Ensure encryption is done
    if (book.encryptedFileKey === 'pending') {
      const err: any = new Error('Book encryption is still in progress');
      err.statusCode = 409;
      err.code = 'ENCRYPTION_PENDING';
      throw err;
    }

    return prisma.book.update({
      where: { id: bookId },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }

  // ─── Request translation ───────────────────────────────────────

  static async requestTranslation(bookId: string, targetLanguage: string) {
    // Prevent duplicate translation requests
    const existing = await prisma.bookTranslation.findUnique({
      where: { bookId_language: { bookId, language: targetLanguage } },
    });

    if (existing && ['PENDING', 'PROCESSING', 'COMPLETED'].includes(existing.status)) {
      const err: any = new Error(
        `Translation to ${targetLanguage} already exists (status: ${existing.status})`,
      );
      err.statusCode = 409;
      throw err;
    }

    const translation = await prisma.bookTranslation.upsert({
      where: { bookId_language: { bookId, language: targetLanguage } },
      create: { bookId, language: targetLanguage, status: 'PENDING' },
      update: { status: 'PENDING' },
    });

    const job = await translationQueue.add({
      bookId,
      targetLanguage,
      translationId: translation.id,
    });

    return { translation, jobId: job.id };
  }

  // ─── List users with filters ───────────────────────────────────

  static async listUsers(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email:       { contains: search, mode: 'insensitive' as const } },
            { displayName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          createdAt: true,
          subscription: {
            select: { status: true, currentPeriodEnd: true },
          },
          _count: {
            select: { comments: true, highlights: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // ─── Update user role ──────────────────────────────────────────

  static async updateUserRole(userId: string, role: 'READER' | 'MODERATOR' | 'ADMIN') {
    return prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
      select: { id: true, email: true, role: true },
    });
  }

  // ─── List pending reports ──────────────────────────────────────

  static async listReports(status: string = 'PENDING', page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where: { status: status as any },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          comment: {
            include: {
              user: {
                select: { id: true, displayName: true },
              },
              book: {
                select: { id: true, title: true, slug: true },
              },
            },
          },
        },
      }),
      prisma.report.count({ where: { status: status as any } }),
    ]);

    return {
      reports,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // ─── Review a report ───────────────────────────────────────────

  static async reviewReport(
    reportId: string,
    action: 'ACTIONED' | 'DISMISSED',
    reviewerId: string,
  ) {
    const report = await prisma.report.findUniqueOrThrow({
      where: { id: reportId },
      include: { comment: true },
    });

    await prisma.$transaction(async (tx) => {
      // Update report status
      await tx.report.update({
        where: { id: reportId },
        data: {
          status: action as any,
          reviewedAt: new Date(),
        },
      });

      // If actioned, delete the offending comment
      if (action === 'ACTIONED') {
        await tx.comment.update({
          where: { id: report.commentId },
          data: {
            isDeleted: true,
            body: '[Removed by moderator]',
          },
        });
      }
    });
  }
}
```

---

## src/modules/admin/admin.routes.ts

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AdminService } from './admin.service';
import { authenticate, requireRole } from '../../shared/middleware/authenticate';

const adminGuard = { preHandler: [authenticate, requireRole('ADMIN')] };
const modGuard   = { preHandler: [authenticate, requireRole('ADMIN', 'MODERATOR')] };

const createBookSchema = z.object({
  title:            z.string().min(1).max(200),
  authorName:       z.string().min(1).max(100),
  description:      z.string().min(1).max(5000),
  contentType:      z.enum(['BOOK', 'STORY', 'SUMMARY']),
  language:         z.string().length(2),
  estimatedMinutes: z.number().int().min(1),
  isPremium:        z.boolean().default(true),
  price:            z.number().optional(),
  tags:             z.array(z.string()).default([]),
});

export async function adminRoutes(app: FastifyInstance) {
  // ─── Book management ───────────────────────────────────────────

  // POST /api/v1/admin/books — upload + encrypt
  app.post('/books', adminGuard, async (request, reply) => {
    // Handle multipart: metadata (JSON field) + file + cover
    const parts = request.parts();
    let metadata: any = null;
    let rawFileBuffer: Buffer | null = null;
    let coverBuffer: Buffer | null = null;
    let coverMimeType = 'image/jpeg';

    for await (const part of parts) {
      if (part.type === 'field' && part.fieldname === 'metadata') {
        metadata = JSON.parse(part.value as string);
      } else if (part.type === 'file' && part.fieldname === 'content') {
        rawFileBuffer = await part.toBuffer();
      } else if (part.type === 'file' && part.fieldname === 'cover') {
        coverBuffer = await part.toBuffer();
        coverMimeType = part.mimetype;
      }
    }

    if (!metadata || !rawFileBuffer || !coverBuffer) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FILES', message: 'metadata, content, and cover are required' },
      });
    }

    const input = createBookSchema.parse(metadata);
    const result = await AdminService.createBook(
      input,
      rawFileBuffer,
      coverBuffer,
      coverMimeType,
    );

    return reply.status(202).send({ success: true, data: result });
  });

  // PUT /api/v1/admin/books/:id/publish
  app.put('/books/:id/publish', adminGuard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const book = await AdminService.publishBook(id);
    return reply.send({ success: true, data: book });
  });

  // POST /api/v1/admin/translations
  app.post('/translations', adminGuard, async (request, reply) => {
    const { bookId, targetLanguage } = request.body as any;
    const result = await AdminService.requestTranslation(bookId, targetLanguage);
    return reply.status(202).send({ success: true, data: result });
  });

  // ─── User management ───────────────────────────────────────────

  // GET /api/v1/admin/users
  app.get('/users', adminGuard, async (request, reply) => {
    const { page = '1', limit = '20', search } = request.query as any;
    const result = await AdminService.listUsers(
      Number(page),
      Number(limit),
      search,
    );
    return reply.send({ success: true, data: result.users, meta: result.pagination });
  });

  // PUT /api/v1/admin/users/:id/role
  app.put('/users/:id/role', adminGuard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { role } = request.body as { role: 'READER' | 'MODERATOR' | 'ADMIN' };
    const user = await AdminService.updateUserRole(id, role);
    return reply.send({ success: true, data: user });
  });

  // ─── Moderation ────────────────────────────────────────────────

  // GET /api/v1/admin/reports
  app.get('/reports', modGuard, async (request, reply) => {
    const { status = 'PENDING', page = '1', limit = '20' } = request.query as any;
    const result = await AdminService.listReports(status, Number(page), Number(limit));
    return reply.send({ success: true, data: result.reports, meta: result.pagination });
  });

  // PUT /api/v1/admin/reports/:id
  app.put('/reports/:id', modGuard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { action } = request.body as { action: 'ACTIONED' | 'DISMISSED' };
    await AdminService.reviewReport(id, action, request.user!.sub);
    return reply.send({ success: true, data: null });
  });
}
```

---

## workers/index.ts

```typescript
/**
 * Worker process — runs separately from the API server.
 *
 * Why separate?
 * - Workers do CPU/memory intensive work (encryption, translation)
 * - Keeps API response times fast — never blocks on heavy work
 * - Can be scaled independently (more worker pods, fewer API pods)
 * - Crashes in workers don't take down the API
 *
 * Run with: npm run workers
 * In production: Docker container with CMD ["node", "dist/workers/index.js"]
 */

// Importing these files registers the Bull queue processors
import '../src/shared/queue/workers/encryptionWorker';
import '../src/shared/queue/workers/translationWorker';
import '../src/shared/db/prisma';

import { encryptionQueue, translationQueue, keyCleanupQueue } from '../src/shared/queue/queues';
import { OfflineService } from '../src/modules/offline/offline.service';

// Scheduled: clean up expired offline keys every hour
keyCleanupQueue.add({}, { repeat: { cron: '0 * * * *' } });
keyCleanupQueue.process(async () => {
  const result = await OfflineService.cleanupExpiredKeys();
  console.log(`Cleaned up ${result.revokedCount} expired offline keys`);
});

// Worker health logging
encryptionQueue.on('completed', (job) => {
  console.log(`[encryption] Job ${job.id} completed`);
});
encryptionQueue.on('failed', (job, err) => {
  console.error(`[encryption] Job ${job.id} failed:`, err.message);
});

translationQueue.on('completed', (job) => {
  console.log(`[translation] Job ${job.id} completed`);
});
translationQueue.on('failed', (job, err) => {
  console.error(`[translation] Job ${job.id} failed:`, err.message);
});

console.log('🔧 ZITA Workers running');
```

---

## DEPLOYMENT GUIDE

### 1. Generate RSA key pair for JWT

```bash
# Generate 2048-bit RSA private key
openssl genrsa -out keys/private.pem 2048

# Extract public key
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
```

### 2. Database setup

```bash
# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Seed initial admin user
npx ts-node scripts/seed.ts
```

### 3. Docker Compose (local development)

```yaml
version: '3.9'
services:
  api:
    build: .
    ports: ['3000:3000']
    environment:
      - DATABASE_URL=postgresql://zita:zita@postgres:5432/zita_db
      - REDIS_URL=redis://redis:6379
    depends_on: [postgres, redis]

  workers:
    build: .
    command: node dist/workers/index.js
    environment:
      - DATABASE_URL=postgresql://zita:zita@postgres:5432/zita_db
      - REDIS_URL=redis://redis:6379
    depends_on: [postgres, redis]

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: zita
      POSTGRES_PASSWORD: zita
      POSTGRES_DB: zita_db
    volumes: ['postgres_data:/var/lib/postgresql/data']
    ports: ['5432:5432']

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']

volumes:
  postgres_data:
```

### 4. Production environment (AWS/GCP)

```
API Layer:         AWS ECS Fargate (auto-scaling, 2-10 replicas)
Workers:           AWS ECS Fargate (1-3 replicas, separate task definition)
Database:          AWS RDS PostgreSQL 16 (Multi-AZ, automated backups)
Redis:             AWS ElastiCache (cluster mode)
File Storage:      Cloudflare R2 (zero egress fees)
Encryption Keys:   AWS KMS (managed, audited)
Secrets:           AWS Secrets Manager
CDN (covers):      Cloudflare CDN
```

### 5. Environment variable injection

```bash
# Never use .env in production
# Inject via ECS task definition / Kubernetes secrets

aws secretsmanager create-secret \
  --name zita/production \
  --secret-string file://secrets.json
```

### 6. Database connection pooling

```bash
# Use PgBouncer for connection pooling in production
# Each Fargate task opens up to 10 connections
# PgBouncer pools them to 100 max connections to RDS

DATABASE_URL=postgresql://zita:password@pgbouncer:5432/zita_db?pgbouncer=true
```

---

## TESTING PLAN

```typescript
// Example test file: src/modules/auth/auth.service.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  describe('login', () => {
    it('returns tokens on valid credentials', async () => {
      const result = await AuthService.login(
        'test@example.com',
        'password123',
        'abc123fingerprint',
        'IOS',
      );
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('throws INVALID_CREDENTIALS on wrong password', async () => {
      await expect(
        AuthService.login('test@example.com', 'wrong', 'fp', 'IOS'),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('takes same time for valid and invalid users (timing attack prevention)', async () => {
      const t1 = Date.now();
      await AuthService.login('nonexistent@x.com', 'pw', 'fp', 'IOS').catch(() => {});
      const t1_elapsed = Date.now() - t1;

      const t2 = Date.now();
      await AuthService.login('test@example.com', 'wrong', 'fp', 'IOS').catch(() => {});
      const t2_elapsed = Date.now() - t2;

      // Both should take ~bcrypt time (~100ms), not 0ms for missing user
      expect(Math.abs(t1_elapsed - t2_elapsed)).toBeLessThan(50);
    });
  });

  describe('refresh', () => {
    it('rotates refresh token on successful refresh', async () => {
      const { tokens } = await AuthService.login(
        'test@example.com', 'password123', 'fp', 'IOS',
      );
      const newTokens = await AuthService.refresh(tokens.refreshToken);
      expect(newTokens.refreshToken).not.toEqual(tokens.refreshToken);
    });

    it('rejects the old refresh token after rotation', async () => {
      const { tokens } = await AuthService.login(
        'test@example.com', 'password123', 'fp', 'IOS',
      );
      await AuthService.refresh(tokens.refreshToken);
      await expect(
        AuthService.refresh(tokens.refreshToken),
      ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    });
  });
});
```
