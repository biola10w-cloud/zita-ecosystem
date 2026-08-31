import { google } from 'googleapis';
import fs from 'fs';
import { config } from '../../config';

export interface ParsedGoogleSubscription {
  productId:             string;
  orderId:               string;
  originalOrderId:       string;
  transactionId:         string;
  originalTransactionId: string;
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
      const err: any = new Error('Invalid subscription â€” no expiry time');
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
      transactionId:    sub.orderId ?? purchaseToken,
      originalTransactionId: sub.linkedPurchaseToken ?? sub.orderId ?? purchaseToken,
      purchasedAt:      new Date(Number(sub.startTimeMillis ?? 0)),
      expiresAt:        new Date(Number(sub.expiryTimeMillis)),
      isTrial,
      isCancelled,
      autoRenewing:     sub.autoRenewing ?? false,
      paymentState:     sub.paymentState ?? 0,
    };
  }
}
