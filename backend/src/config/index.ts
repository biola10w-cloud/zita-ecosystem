import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV:               z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT:                   z.string().default('3000').transform(Number),
  API_BASE_URL:           z.string().url(),
  DATABASE_URL:           z.string(),
  REDIS_URL:              z.string(),
  JWT_PRIVATE_KEY_PATH:   z.string().optional(),
  JWT_PUBLIC_KEY_PATH:    z.string().optional(),
  // Inline PEM alternative to the *_PATH file variables — needed on hosts
  // where shipping a keys/ file isn't practical (paste the PEM contents,
  // literal "\n" line breaks are unescaped automatically).
  JWT_PRIVATE_KEY:        z.string().optional(),
  JWT_PUBLIC_KEY:         z.string().optional(),
  JWT_ACCESS_EXPIRY:      z.string().default('15m'),
  JWT_REFRESH_EXPIRY:     z.string().default('30d'),
  AWS_REGION:             z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID:      z.string(),
  AWS_SECRET_ACCESS_KEY:  z.string(),
  S3_BUCKET_NAME:         z.string(),
  S3_ENDPOINT:            z.string().optional(),
  KMS_KEY_ARN:            z.string(),
  // Apple/Google IAP — defaulted so the server can boot without these set
  // (web-first launches via Stripe don't need them until native apps ship).
  // Verification calls will simply fail at request time if left as defaults.
  APPLE_SHARED_SECRET:    z.string().default(''),
  APPLE_VERIFY_URL:       z.string().url().default('https://buy.itunes.apple.com/verifyReceipt'),
  APPLE_SANDBOX_VERIFY_URL: z.string().url().default('https://sandbox.itunes.apple.com/verifyReceipt'),
  GOOGLE_SERVICE_ACCOUNT_KEY_PATH: z.string().default(''),
  GOOGLE_PACKAGE_NAME:    z.string().default(''),
  // Optional — comma-separated list of allowed origins in production;
  // falls back to the ZITA default domains if unset.
  CORS_ORIGINS:           z.string().optional(),
  // Optional — only required when translation jobs actually run
  GOOGLE_TRANSLATE_API_KEY: z.string().optional(),
  // Optional — only required when Stripe (web) payments are enabled
  STRIPE_SECRET_KEY:        z.string().optional(),
  STRIPE_WEBHOOK_SECRET:    z.string().optional(),
  // Optional — only required when each respective integration is enabled
  SENDGRID_API_KEY:         z.string().optional(),
  EMAIL_FROM_ADDRESS:       z.string().optional(),
  SENTRY_DSN:               z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_KEY_PATH: z.string().optional(),
  CDN_BASE_URL:             z.string().optional(),
  OPENAI_API_KEY:           z.string().optional(),
});

// Throws at startup if any required env var is missing.
// This prevents silent misconfiguration in production.
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('âŒ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
