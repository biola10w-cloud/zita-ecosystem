# ZITA Backend — Phase 3: Complete Node.js/TypeScript Codebase

---

## PROJECT STRUCTURE

```
zita-backend/
├── package.json
├── tsconfig.json
├── .env.example
├── prisma/
│   └── schema.prisma            ← (defined in Phase 1)
├── src/
│   ├── app.ts                   ← Fastify app factory
│   ├── server.ts                ← Entry point
│   ├── config/
│   │   └── index.ts             ← Env config with validation
│   ├── shared/
│   │   ├── middleware/
│   │   │   ├── authenticate.ts  ← JWT verification
│   │   │   ├── requireRole.ts   ← RBAC
│   │   │   ├── rateLimiter.ts   ← Redis sliding window
│   │   │   └── errorHandler.ts  ← Global error formatter
│   │   ├── encryption/
│   │   │   ├── bookCrypto.ts    ← AES-256-GCM book encryption
│   │   │   └── keyManager.ts    ← KMS envelope encryption
│   │   ├── queue/
│   │   │   ├── queues.ts        ← Bull queue definitions
│   │   │   └── workers/
│   │   │       ├── translationWorker.ts
│   │   │       └── encryptionWorker.ts
│   │   ├── storage/
│   │   │   └── s3.ts            ← S3/R2 client
│   │   └── db/
│   │       └── prisma.ts        ← Prisma singleton
│   └── modules/
│       ├── auth/
│       │   ├── auth.routes.ts
│       │   ├── auth.controller.ts
│       │   └── auth.service.ts
│       ├── users/
│       │   ├── users.routes.ts
│       │   ├── users.controller.ts
│       │   └── users.service.ts
│       ├── books/
│       │   ├── books.routes.ts
│       │   ├── books.controller.ts
│       │   └── books.service.ts
│       ├── reader/
│       │   ├── reader.routes.ts
│       │   ├── reader.controller.ts
│       │   └── reader.service.ts
│       ├── community/
│       │   ├── community.routes.ts
│       │   ├── community.controller.ts
│       │   └── community.service.ts
│       ├── subscriptions/
│       │   ├── subscriptions.routes.ts
│       │   ├── subscriptions.controller.ts
│       │   ├── subscriptions.service.ts
│       │   ├── apple.verifier.ts
│       │   └── google.verifier.ts
│       ├── offline/
│       │   ├── offline.routes.ts
│       │   ├── offline.controller.ts
│       │   └── offline.service.ts
│       ├── analytics/
│       │   ├── analytics.routes.ts
│       │   ├── analytics.controller.ts
│       │   └── analytics.service.ts
│       └── admin/
│           ├── admin.routes.ts
│           ├── admin.controller.ts
│           └── admin.service.ts
└── workers/
    └── index.ts                 ← Worker process (separate from API)
```

---

## package.json

```json
{
  "name": "zita-backend",
  "version": "1.0.0",
  "description": "ZITA Reading Ecosystem — Backend API",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "workers": "tsx watch workers/index.ts",
    "db:migrate": "prisma migrate deploy",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "@aws-sdk/client-kms": "^3.490.0",
    "@aws-sdk/client-s3": "^3.490.0",
    "@aws-sdk/s3-request-presigner": "^3.490.0",
    "@fastify/cors": "^9.0.1",
    "@fastify/helmet": "^11.1.1",
    "@fastify/multipart": "^8.1.0",
    "@fastify/rate-limit": "^9.1.0",
    "@prisma/client": "^5.9.1",
    "axios": "^1.6.7",
    "bcryptjs": "^2.4.3",
    "bull": "^4.12.2",
    "fastify": "^4.26.2",
    "googleapis": "^134.0.0",
    "ioredis": "^5.3.2",
    "jsonwebtoken": "^9.0.2",
    "nanoid": "^5.0.5",
    "node-forge": "^1.3.1",
    "pino": "^8.18.0",
    "uuid": "^9.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/bull": "^4.10.0",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/node": "^20.11.10",
    "@types/node-forge": "^1.3.11",
    "@types/uuid": "^9.0.7",
    "prisma": "^5.9.1",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vitest": "^1.2.2"
  }
}
```

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "workers/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## .env.example

```env
# Server
NODE_ENV=development
PORT=3000
API_BASE_URL=https://api.zita.app

# Database
DATABASE_URL=postgresql://zita:password@localhost:5432/zita_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# AWS / Cloudflare R2
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET_NAME=zita-books
S3_ENDPOINT=https://your-account.r2.cloudflarestorage.com  # R2 endpoint

# AWS KMS (envelope encryption master key)
KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789:key/your-key-id

# Apple IAP
APPLE_SHARED_SECRET=your_apple_shared_secret
APPLE_VERIFY_URL=https://buy.itunes.apple.com/verifyReceipt
APPLE_SANDBOX_VERIFY_URL=https://sandbox.itunes.apple.com/verifyReceipt

# Google IAP
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./keys/google-service-account.json
GOOGLE_PACKAGE_NAME=com.zita.app

# Encryption
BOOK_ENCRYPTION_ALGORITHM=aes-256-gcm
```

---

## src/config/index.ts

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV:               z.enum(['development', 'staging', 'production']).default('development'),
  PORT:                   z.string().default('3000').transform(Number),
  API_BASE_URL:           z.string().url(),
  DATABASE_URL:           z.string(),
  REDIS_URL:              z.string(),
  JWT_PRIVATE_KEY_PATH:   z.string(),
  JWT_PUBLIC_KEY_PATH:    z.string(),
  JWT_ACCESS_EXPIRY:      z.string().default('15m'),
  JWT_REFRESH_EXPIRY:     z.string().default('30d'),
  AWS_REGION:             z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID:      z.string(),
  AWS_SECRET_ACCESS_KEY:  z.string(),
  S3_BUCKET_NAME:         z.string(),
  S3_ENDPOINT:            z.string().optional(),
  KMS_KEY_ARN:            z.string(),
  APPLE_SHARED_SECRET:    z.string(),
  APPLE_VERIFY_URL:       z.string().url(),
  APPLE_SANDBOX_VERIFY_URL: z.string().url(),
  GOOGLE_SERVICE_ACCOUNT_KEY_PATH: z.string(),
  GOOGLE_PACKAGE_NAME:    z.string(),
});

// Throws at startup if any required env var is missing.
// This prevents silent misconfiguration in production.
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
```

---

## src/shared/db/prisma.ts

```typescript
import { PrismaClient } from '@prisma/client';
import { config } from '../../config';

// Singleton pattern — critical for serverless/long-running processes
// to avoid connection pool exhaustion.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: config.NODE_ENV === 'development'
      ? ['query', 'warn', 'error']
      : ['warn', 'error'],
    errorFormat: 'minimal',
  });

if (config.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
```

---

## src/app.ts

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { config } from './config';
import { errorHandler } from './shared/middleware/errorHandler';

// Route modules
import { authRoutes }          from './modules/auth/auth.routes';
import { usersRoutes }         from './modules/users/users.routes';
import { booksRoutes }         from './modules/books/books.routes';
import { readerRoutes }        from './modules/reader/reader.routes';
import { communityRoutes }     from './modules/community/community.routes';
import { subscriptionsRoutes } from './modules/subscriptions/subscriptions.routes';
import { offlineRoutes }       from './modules/offline/offline.routes';
import { analyticsRoutes }     from './modules/analytics/analytics.routes';
import { adminRoutes }         from './modules/admin/admin.routes';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'warn' : 'info',
      // Redact sensitive fields from logs
      redact: ['req.headers.authorization', 'req.body.password'],
    },
    trustProxy: true,
  });

  // ─── Security plugins ─────────────────────────────────────────────

  await app.register(helmet, {
    contentSecurityPolicy: false, // API-only, no HTML
  });

  await app.register(cors, {
    origin: config.NODE_ENV === 'production'
      ? ['https://zita.app', 'https://admin.zita.app']
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });

  // ─── File uploads (admin book upload) ────────────────────────────

  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB max book file
      files: 2,                     // cover + content
    },
  });

  // ─── Routes ───────────────────────────────────────────────────────

  await app.register(authRoutes,          { prefix: '/api/v1/auth' });
  await app.register(usersRoutes,         { prefix: '/api/v1/users' });
  await app.register(booksRoutes,         { prefix: '/api/v1/books' });
  await app.register(readerRoutes,        { prefix: '/api/v1/books' });
  await app.register(communityRoutes,     { prefix: '/api/v1' });
  await app.register(subscriptionsRoutes, { prefix: '/api/v1/subscriptions' });
  await app.register(offlineRoutes,       { prefix: '/api/v1/books' });
  await app.register(analyticsRoutes,     { prefix: '/api/v1/analytics' });
  await app.register(adminRoutes,         { prefix: '/api/v1/admin' });

  // ─── Error handler ────────────────────────────────────────────────

  app.setErrorHandler(errorHandler);

  // ─── Health check ─────────────────────────────────────────────────

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }));

  return app;
}
```

---

## src/server.ts

```typescript
import { buildApp } from './app';
import { config } from './config';

async function start() {
  const app = await buildApp();

  try {
    await app.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });
    console.log(`🚀 ZITA API running on port ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
```

---

## src/shared/middleware/errorHandler.ts

```typescript
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Zod validation errors — map to 400
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        fields: error.flatten().fieldErrors,
      },
    });
  }

  // Prisma known errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      // Unique constraint violation
      return reply.status(409).send({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Resource already exists',
        },
      });
    }
    if (error.code === 'P2025') {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        },
      });
    }
  }

  // Application-level errors with explicit status code
  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code ?? 'ERROR',
        message: error.message,
      },
    });
  }

  // Unknown errors — never leak internal details in production
  request.log.error(error);

  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
```

---

## src/shared/middleware/authenticate.ts

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { config } from '../../config';
import { prisma } from '../db/prisma';

// Load RSA public key once at startup
const publicKey = fs.readFileSync(config.JWT_PUBLIC_KEY_PATH, 'utf8');

export interface JwtPayload {
  sub: string;       // userId
  email: string;
  role: string;
  deviceId: string;
  iat: number;
  exp: number;
}

// Augment FastifyRequest with our user type
declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' },
    });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
    }) as JwtPayload;

    request.user = payload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return reply.status(401).send({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Access token expired' },
      });
    }

    return reply.status(401).send({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid access token' },
    });
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
    }

    if (!roles.includes(request.user.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    }
  };
}
```

---

## src/shared/middleware/rateLimiter.ts

```typescript
import { FastifyInstance } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';
import { config } from '../../config';

const redis = new Redis(config.REDIS_URL);

export async function registerRateLimiter(app: FastifyInstance) {
  await app.register(fastifyRateLimit, {
    global: false, // Apply per-route, not globally
    redis,
    keyGenerator: (request) => {
      // Rate limit by user ID if authenticated, else by IP
      return (request.user?.sub ?? request.ip) + ':' + request.routerPath;
    },
  });
}

// Pre-built rate limit configs for different route types
export const rateLimits = {
  // Auth endpoints — strict to prevent brute force
  auth: {
    max: 5,
    timeWindow: '15 minutes',
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Please try again in 15 minutes.',
      },
    }),
  },

  // Standard API calls
  api: {
    max: 100,
    timeWindow: '1 minute',
  },

  // Expensive operations (translation, encryption)
  heavy: {
    max: 20,
    timeWindow: '1 minute',
  },

  // Analytics ingestion
  analytics: {
    max: 200,
    timeWindow: '1 minute',
  },
};
```

---

## src/shared/encryption/bookCrypto.ts

```typescript
import crypto from 'crypto';

export interface EncryptedContent {
  iv: string;         // hex-encoded 12-byte GCM nonce
  authTag: string;    // hex-encoded 16-byte GCM authentication tag
  ciphertext: Buffer; // encrypted content
}

export interface BookEncryptionKey {
  key: Buffer;        // 32-byte AES-256 key
  keyHex: string;     // hex-encoded for storage
}

/**
 * AES-256-GCM encryption.
 *
 * Why GCM mode:
 * - Provides both confidentiality AND integrity (authenticated encryption)
 * - The authTag verifies the ciphertext hasn't been tampered with
 * - IV is 12 bytes (96-bit) — optimal for GCM
 * - Each chapter gets a unique random IV, preventing nonce reuse
 */
export class BookCrypto {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12;   // GCM recommended nonce size
  private static readonly KEY_LENGTH = 32;  // 256-bit key

  /**
   * Generate a new random book encryption key.
   * One key per book — shared across all chapters.
   * The key is then wrapped by KMS (envelope encryption).
   */
  static generateKey(): BookEncryptionKey {
    const key = crypto.randomBytes(BookCrypto.KEY_LENGTH);
    return { key, keyHex: key.toString('hex') };
  }

  /**
   * Encrypt a book chapter's content.
   *
   * @param plaintext - Raw chapter content (UTF-8 string or Buffer)
   * @param key       - 32-byte AES-256 key
   * @returns Encrypted content with IV and auth tag
   */
  static encrypt(plaintext: string | Buffer, key: Buffer): EncryptedContent {
    const iv = crypto.randomBytes(BookCrypto.IV_LENGTH);
    const cipher = crypto.createCipheriv(BookCrypto.ALGORITHM, key, iv);

    const input = typeof plaintext === 'string'
      ? Buffer.from(plaintext, 'utf8')
      : plaintext;

    const encrypted = Buffer.concat([
      cipher.update(input),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      ciphertext: encrypted,
    };
  }

  /**
   * Decrypt a book chapter.
   * Throws if authTag verification fails — content has been tampered with.
   */
  static decrypt(encrypted: EncryptedContent, key: Buffer): Buffer {
    const iv      = Buffer.from(encrypted.iv, 'hex');
    const authTag = Buffer.from(encrypted.authTag, 'hex');

    const decipher = crypto.createDecipheriv(
      BookCrypto.ALGORITHM,
      key,
      iv,
    );

    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted.ciphertext),
      decipher.final(),
    ]);
  }

  /**
   * Encrypt the book encryption key with a device's RSA public key.
   * Used for offline key delivery.
   *
   * The BEK (book encryption key) is wrapped with the device's RSA-OAEP
   * public key. Only that device's private key (in Secure Enclave /
   * Android Keystore) can unwrap it.
   */
  static encryptKeyForDevice(bekHex: string, devicePublicKeyPem: string): string {
    const keyBuffer = Buffer.from(bekHex, 'hex');

    const encrypted = crypto.publicEncrypt(
      {
        key: devicePublicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      keyBuffer,
    );

    return encrypted.toString('base64');
  }
}
```

---

## src/shared/encryption/keyManager.ts

```typescript
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { config } from '../../config';

/**
 * KMS Key Manager — Envelope Encryption
 *
 * Pattern:
 * 1. Generate random 32-byte BEK (Book Encryption Key) per book
 * 2. Encrypt BEK using AWS KMS master key → store encrypted BEK in DB
 * 3. When needed, call KMS to decrypt the BEK → use to decrypt content
 *
 * This means:
 * - Raw BEKs never exist on disk
 * - KMS provides audit logs of every key usage
 * - Rotating the master key invalidates all content keys
 */
export class KeyManager {
  private static client = new KMSClient({
    region: config.AWS_REGION,
  });

  /**
   * Wrap (encrypt) a book encryption key with the KMS master key.
   * Store the result (wrappedKey) in the database.
   */
  static async wrapKey(rawKeyHex: string): Promise<string> {
    const command = new EncryptCommand({
      KeyId: config.KMS_KEY_ARN,
      Plaintext: Buffer.from(rawKeyHex, 'hex'),
      EncryptionAlgorithm: 'RSAES_OAEP_SHA_256',
    });

    const response = await KeyManager.client.send(command);

    if (!response.CiphertextBlob) {
      throw new Error('KMS encryption failed — no ciphertext returned');
    }

    return Buffer.from(response.CiphertextBlob).toString('base64');
  }

  /**
   * Unwrap (decrypt) a previously wrapped book encryption key.
   * This is called when:
   * - A user requests to read a chapter (online)
   * - A user requests offline access (key is then re-encrypted for device)
   */
  static async unwrapKey(wrappedKeyBase64: string): Promise<Buffer> {
    const ciphertextBlob = Buffer.from(wrappedKeyBase64, 'base64');

    const command = new DecryptCommand({
      KeyId: config.KMS_KEY_ARN,
      CiphertextBlob: ciphertextBlob,
      EncryptionAlgorithm: 'RSAES_OAEP_SHA_256',
    });

    const response = await KeyManager.client.send(command);

    if (!response.Plaintext) {
      throw new Error('KMS decryption failed — no plaintext returned');
    }

    return Buffer.from(response.Plaintext);
  }
}
```

---

## src/shared/storage/s3.ts

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../config';
import { Readable } from 'stream';

const s3 = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
  // For Cloudflare R2 — override endpoint
  ...(config.S3_ENDPOINT && { endpoint: config.S3_ENDPOINT }),
});

export class S3Service {
  /**
   * Upload encrypted book content.
   * Content is ALWAYS pre-encrypted before reaching this method.
   * S3 never sees plaintext.
   */
  static async uploadEncryptedContent(
    key: string,
    ciphertext: Buffer,
    metadata?: Record<string, string>,
  ): Promise<void> {
    await s3.send(new PutObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: key,
      Body: ciphertext,
      ContentType: 'application/octet-stream',
      // Server-side encryption as a secondary layer
      ServerSideEncryption: 'AES256',
      Metadata: metadata,
    }));
  }

  /**
   * Download encrypted content.
   * Caller is responsible for decryption.
   */
  static async downloadEncryptedContent(key: string): Promise<Buffer> {
    const response = await s3.send(new GetObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: key,
    }));

    if (!response.Body) {
      throw new Error(`S3 object not found: ${key}`);
    }

    // Stream to buffer
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  /**
   * Upload public assets (book covers).
   * These are public — no encryption needed.
   */
  static async uploadPublicAsset(
    key: string,
    content: Buffer,
    contentType: string,
  ): Promise<string> {
    await s3.send(new PutObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: `public/${key}`,
      Body: content,
      ContentType: contentType,
    }));

    return `https://cdn.zita.app/public/${key}`;
  }

  static async deleteObject(key: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: key,
    }));
  }
}
```

---

## src/shared/queue/queues.ts

```typescript
import Bull from 'bull';
import { config } from '../../config';

// Queue factory — each queue connects to Redis
function createQueue<T>(name: string) {
  return new Bull<T>(name, config.REDIS_URL, {
    defaultJobOptions: {
      attempts: 3,                           // Retry up to 3 times
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,                 // Keep last 100 completed
      removeOnFail: 500,                     // Keep last 500 failed
    },
  });
}

// Translation job: translate a book into a target language
export interface TranslationJob {
  bookId: string;
  targetLanguage: string;  // ISO 639-1 code
  translationId: string;
}

// Encryption job: encrypt an uploaded raw book file
export interface EncryptionJob {
  bookId: string;
  rawS3Key: string;       // Temporary raw upload location
  chapterCount: number;
}

// Offline key cleanup job: revoke expired keys
export interface KeyCleanupJob {
  userId?: string;  // null = clean all expired keys globally
}

export const translationQueue = createQueue<TranslationJob>('translation');
export const encryptionQueue  = createQueue<EncryptionJob>('encryption');
export const keyCleanupQueue  = createQueue<KeyCleanupJob>('key-cleanup');
```

---

## src/shared/queue/workers/encryptionWorker.ts

```typescript
import { Job } from 'bull';
import { encryptionQueue, EncryptionJob } from '../queues';
import { BookCrypto } from '../../encryption/bookCrypto';
import { KeyManager } from '../../encryption/keyManager';
import { S3Service } from '../../storage/s3';
import { prisma } from '../../db/prisma';

/**
 * Encryption Worker
 *
 * Processes uploaded raw book files:
 * 1. Download raw file from temporary S3 location
 * 2. Parse into chapters (by heading or page markers)
 * 3. Generate a BEK (book encryption key)
 * 4. Encrypt each chapter individually with AES-256-GCM
 * 5. Upload each encrypted chapter to permanent S3 location
 * 6. Wrap the BEK with KMS
 * 7. Store metadata (s3 keys, IVs, auth tags) in DB
 * 8. Delete the raw temporary file
 */
encryptionQueue.process(async (job: Job<EncryptionJob>) => {
  const { bookId, rawS3Key, chapterCount } = job.data;
  job.log(`Starting encryption for book ${bookId}`);

  // 1. Download raw content
  const rawContent = await S3Service.downloadEncryptedContent(rawS3Key);
  const rawText = rawContent.toString('utf8');

  // 2. Parse chapters
  // Chapters are delimited by '=== CHAPTER N ===' markers in the raw file
  const chapters = parseChapters(rawText, chapterCount);

  // 3. Generate BEK
  const { key: bek, keyHex: bekHex } = BookCrypto.generateKey();

  // 4 & 5. Encrypt and upload each chapter
  const chapterRecords = [];

  for (let i = 0; i < chapters.length; i++) {
    await job.progress(Math.round((i / chapters.length) * 80));

    const encrypted = BookCrypto.encrypt(chapters[i].content, bek);
    const s3Key = `books/${bookId}/chapters/${i}.enc`;

    await S3Service.uploadEncryptedContent(s3Key, encrypted.ciphertext, {
      bookId,
      chapterIndex: String(i),
    });

    chapterRecords.push({
      bookId,
      chapterIndex: i,
      title: chapters[i].title,
      wordCount: chapters[i].content.split(' ').length,
      encryptedKey: s3Key,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    });
  }

  // 6. Wrap BEK with KMS
  const wrappedBek = await KeyManager.wrapKey(bekHex);

  // 7. Update book + create chapter records in DB
  await prisma.$transaction([
    prisma.book.update({
      where: { id: bookId },
      data: {
        encryptedFileKey: wrappedBek,
        fileIv: 'kms-managed',
        fileAuthTag: 'kms-managed',
        totalChapters: chapters.length,
      },
    }),
    prisma.chapter.createMany({
      data: chapterRecords,
    }),
  ]);

  // 8. Delete raw temporary file
  await S3Service.deleteObject(rawS3Key);

  await job.progress(100);
  job.log(`Encryption complete for book ${bookId}: ${chapters.length} chapters`);
});

function parseChapters(
  rawText: string,
  expectedCount: number,
): Array<{ title: string; content: string }> {
  // Split on chapter markers
  const chapterPattern = /^=== CHAPTER \d+ ===/gm;
  const parts = rawText.split(chapterPattern).filter(Boolean);

  if (parts.length === 0) {
    // Fallback: split roughly equal parts if no markers
    const wordsPerChapter = Math.ceil(
      rawText.split(' ').length / Math.max(expectedCount, 1),
    );
    const words = rawText.split(' ');
    const chapters = [];

    for (let i = 0; i < words.length; i += wordsPerChapter) {
      chapters.push({
        title: `Chapter ${Math.floor(i / wordsPerChapter) + 1}`,
        content: words.slice(i, i + wordsPerChapter).join(' '),
      });
    }
    return chapters;
  }

  return parts.map((part, i) => {
    const lines = part.trim().split('\n');
    const title = lines[0]?.startsWith('#')
      ? lines[0].replace(/^#+\s*/, '')
      : `Chapter ${i + 1}`;
    const content = lines.slice(1).join('\n').trim();
    return { title, content };
  });
}
```

---

## src/shared/queue/workers/translationWorker.ts

```typescript
import { Job } from 'bull';
import axios from 'axios';
import { translationQueue, TranslationJob } from '../queues';
import { BookCrypto } from '../../encryption/bookCrypto';
import { KeyManager } from '../../encryption/keyManager';
import { S3Service } from '../../storage/s3';
import { prisma } from '../../db/prisma';

/**
 * Translation Worker
 *
 * For each book translation job:
 * 1. Load source book chapters from S3 (decrypt)
 * 2. Send each chapter to Google Cloud Translation API
 * 3. Re-encrypt translated content
 * 4. Upload encrypted translated chapters to S3
 * 5. Update BookTranslation record status to COMPLETED
 *
 * Uses a per-chapter approach rather than full book to:
 * - Handle rate limits gracefully
 * - Allow partial progress recovery
 * - Reduce memory usage
 */
translationQueue.process(async (job: Job<TranslationJob>) => {
  const { bookId, targetLanguage, translationId } = job.data;
  job.log(`Translating book ${bookId} to ${targetLanguage}`);

  // Mark as processing
  await prisma.bookTranslation.update({
    where: { id: translationId },
    data: { status: 'PROCESSING' },
  });

  try {
    // Load book + chapters
    const book = await prisma.book.findUniqueOrThrow({
      where: { id: bookId },
      include: { chapters: { orderBy: { chapterIndex: 'asc' } } },
    });

    // Unwrap BEK from KMS
    const bek = await KeyManager.unwrapKey(book.encryptedFileKey);

    // Generate new BEK for translated content
    const { key: translatedBek, keyHex: translatedBekHex } =
      BookCrypto.generateKey();

    for (let i = 0; i < book.chapters.length; i++) {
      await job.progress(Math.round((i / book.chapters.length) * 90));

      const chapter = book.chapters[i];

      // Decrypt original chapter
      const encryptedData = await S3Service.downloadEncryptedContent(
        chapter.encryptedKey,
      );

      const originalText = BookCrypto.decrypt(
        {
          iv: chapter.iv,
          authTag: chapter.authTag,
          ciphertext: encryptedData,
        },
        bek,
      ).toString('utf8');

      // Translate via Google Cloud Translation
      const translatedText = await translateText(originalText, targetLanguage);

      // Re-encrypt with new BEK
      const reEncrypted = BookCrypto.encrypt(translatedText, translatedBek);
      const translatedS3Key =
        `books/${bookId}/translations/${targetLanguage}/chapters/${i}.enc`;

      await S3Service.uploadEncryptedContent(
        translatedS3Key,
        reEncrypted.ciphertext,
        { bookId, language: targetLanguage, chapterIndex: String(i) },
      );

      // Update chapter record with translated S3 key
      // (extend schema as needed for per-chapter translation keys)
    }

    // Wrap translated BEK
    const wrappedTranslatedBek = await KeyManager.wrapKey(translatedBekHex);

    // Translate book metadata (title, description)
    const [translatedTitle, translatedDescription] = await Promise.all([
      translateText(book.title, targetLanguage),
      translateText(book.description, targetLanguage),
    ]);

    // Mark complete
    await prisma.bookTranslation.update({
      where: { id: translationId },
      data: {
        status: 'COMPLETED',
        translatedTitle,
        translatedDescription,
        encryptedFileKey: wrappedTranslatedBek,
        iv: 'kms-managed',
        authTag: 'kms-managed',
        completedAt: new Date(),
      },
    });

    await job.progress(100);
    job.log(`Translation complete for ${bookId} → ${targetLanguage}`);
  } catch (error) {
    await prisma.bookTranslation.update({
      where: { id: translationId },
      data: { status: 'FAILED' },
    });
    throw error;
  }
});

async function translateText(text: string, targetLang: string): Promise<string> {
  // Google Cloud Translation API v2
  const response = await axios.post(
    `https://translation.googleapis.com/language/translate/v2`,
    {
      q: text,
      target: targetLang,
      format: 'text',
    },
    {
      params: { key: process.env.GOOGLE_TRANSLATE_API_KEY },
    },
  );

  return response.data.data.translations[0].translatedText;
}
```
