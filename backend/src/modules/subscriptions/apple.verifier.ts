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
 * Always verify server-to-server â€” never trust client claims.
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
