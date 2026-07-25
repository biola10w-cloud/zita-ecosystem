import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV:               z.enum(['development', 'staging', 'production']).default('development'),
  API_BASE_URL:           z.string().url().optional().default('http://localhost:3000'),
  DATABASE_URL:           z.string(),
  REDIS_URL:              z.string(),
  JWT_PRIVATE_KEY_PATH:   z.string().optional().default(''),
  JWT_PUBLIC_KEY_PATH:    z.string().optional().default(''),
  JWT_ACCESS_EXPIRY:      z.string().default('15m'),
  JWT_REFRESH_EXPIRY:     z.string().default('30d'),
  AWS_REGION:             z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID:      z.string().optional().default(''),
  AWS_SECRET_ACCESS_KEY:  z.string().optional().default(''),
  S3_BUCKET_NAME:         z.string().optional().default(''),
  S3_ENDPOINT:            z.string().optional(),
  KMS_KEY_ARN:            z.string().optional().default(''),
  APPLE_SHARED_SECRET:    z.string().optional().default(''),
  APPLE_VERIFY_URL:       z.string().url().optional().default('https://buy.itunes.apple.com/verifyReceipt'),
  APPLE_SANDBOX_VERIFY_URL: z.string().url().optional().default('https://sandbox.itunes.apple.com/verifyReceipt'),
  GOOGLE_SERVICE_ACCOUNT_KEY_PATH: z.string().optional().default(''),
  GOOGLE_PACKAGE_NAME:    z.string().optional().default(''),
  WATERMARK_SECRET:       z.string().default('change-me-in-production'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;

