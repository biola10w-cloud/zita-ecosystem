# ZITA Backend — Phase 3 Part 2: Modules (Auth, Books, Reader, Community)

---

## src/modules/auth/auth.service.ts

```typescript
import crypto from 'crypto';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { prisma } from '../../shared/db/prisma';
import { config } from '../../config';
import { JwtPayload } from '../../shared/middleware/authenticate';

// Load RSA keys once at startup
const privateKey = fs.readFileSync(config.JWT_PRIVATE_KEY_PATH, 'utf8');
const publicKey  = fs.readFileSync(config.JWT_PUBLIC_KEY_PATH, 'utf8');

const BCRYPT_ROUNDS = 12; // High cost — tokens are long-lived

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
    preferredLanguage: string;
  };
  tokens: AuthTokens;
}

export class AuthService {
  // ─── Registration ──────────────────────────────────────────────

  static async register(
    email: string,
    password: string,
    displayName: string,
    deviceFingerprint: string,
    platform: 'IOS' | 'ANDROID' | 'WEB',
  ): Promise<LoginResult> {
    // Normalise email
    const normalisedEmail = email.toLowerCase().trim();

    // Hash password — bcrypt with 12 rounds
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user + device in a transaction
    const { user, device } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalisedEmail,
          passwordHash,
          displayName: displayName.trim(),
          role: 'READER',
        },
      });

      const device = await tx.device.create({
        data: {
          userId: user.id,
          fingerprint: deviceFingerprint,
          platform,
        },
      });

      return { user, device };
    });

    const tokens = await AuthService.issueTokens(user, device.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
      },
      tokens,
    };
  }

  // ─── Login ─────────────────────────────────────────────────────

  static async login(
    email: string,
    password: string,
    deviceFingerprint: string,
    platform: 'IOS' | 'ANDROID' | 'WEB',
  ): Promise<LoginResult> {
    const normalisedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalisedEmail },
    });

    // Constant-time comparison to prevent user enumeration
    const passwordMatch = user?.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, '$2b$12$invalidhashpadding000000000000000000000000000000000000');

    if (!user || !passwordMatch) {
      const err: any = new Error('Invalid email or password');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // Upsert device — same fingerprint = update lastSeen
    const device = await prisma.device.upsert({
      where: {
        userId_fingerprint: {
          userId: user.id,
          fingerprint: deviceFingerprint,
        },
      },
      update: {
        lastSeenAt: new Date(),
        platform,
      },
      create: {
        userId: user.id,
        fingerprint: deviceFingerprint,
        platform,
      },
    });

    const tokens = await AuthService.issueTokens(user, device.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
      },
      tokens,
    };
  }

  // ─── Token refresh ─────────────────────────────────────────────

  static async refresh(refreshToken: string): Promise<AuthTokens> {
    // Find session by refresh token hash
    // We store the bcrypt hash, not the raw token
    const sessions = await prisma.session.findMany({
      where: {
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      include: { user: true },
      take: 1000, // Limit scan — in production use a Redis lookup
    });

    let matchedSession = null;
    for (const session of sessions) {
      const match = await bcrypt.compare(refreshToken, session.refreshToken);
      if (match) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      const err: any = new Error('Invalid or expired refresh token');
      err.statusCode = 401;
      err.code = 'INVALID_REFRESH_TOKEN';
      throw err;
    }

    // Rotate: revoke old session, issue new tokens
    // This is the key security property — refresh tokens are single-use
    const newTokens = await prisma.$transaction(async (tx) => {
      // Revoke old session
      await tx.session.update({
        where: { id: matchedSession!.id },
        data: { revokedAt: new Date() },
      });

      // Issue new tokens
      return AuthService.issueTokens(
        matchedSession!.user,
        matchedSession!.deviceId,
        tx,
      );
    });

    return newTokens;
  }

  // ─── Logout ────────────────────────────────────────────────────

  static async logout(userId: string, deviceId: string): Promise<void> {
    // Revoke all sessions for this device
    await prisma.session.updateMany({
      where: {
        userId,
        deviceId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  // ─── Token issuance (internal) ─────────────────────────────────

  private static async issueTokens(
    user: { id: string; email: string; role: string },
    deviceId: string,
    tx?: any,
  ): Promise<AuthTokens> {
    const db = tx ?? prisma;

    // Access token — RS256 JWT, 15-minute expiry
    // Signed with private key; verified with public key (no DB lookup needed)
    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        deviceId,
      } satisfies Omit<JwtPayload, 'iat' | 'exp'>,
      privateKey,
      {
        algorithm: 'RS256',
        expiresIn: config.JWT_ACCESS_EXPIRY,
      },
    );

    // Refresh token — opaque 256-bit random value
    // We store a bcrypt hash (never the raw token) in the DB
    const rawRefreshToken  = nanoid(64);
    const hashedRefreshToken = await bcrypt.hash(rawRefreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await db.session.create({
      data: {
        userId: user.id,
        deviceId,
        refreshToken: hashedRefreshToken,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken, // Only time the raw token is exposed
    };
  }
}
```

---

## src/modules/auth/auth.controller.ts

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { prisma } from '../../shared/db/prisma';

const registerSchema = z.object({
  email:             z.string().email(),
  password:          z.string().min(8).max(128),
  displayName:       z.string().min(2).max(50).trim(),
  deviceFingerprint: z.string().min(32).max(128),
  platform:          z.enum(['IOS', 'ANDROID', 'WEB']).default('WEB'),
});

const loginSchema = z.object({
  email:             z.string().email(),
  password:          z.string().min(1),
  deviceFingerprint: z.string().min(32).max(128),
  platform:          z.enum(['IOS', 'ANDROID', 'WEB']).default('WEB'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const AuthController = {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const body = registerSchema.parse(request.body);

    const result = await AuthService.register(
      body.email,
      body.password,
      body.displayName,
      body.deviceFingerprint,
      body.platform,
    );

    return reply.status(201).send({
      success: true,
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      },
    });
  },

  async login(request: FastifyRequest, reply: FastifyReply) {
    const body = loginSchema.parse(request.body);

    const result = await AuthService.login(
      body.email,
      body.password,
      body.deviceFingerprint,
      body.platform,
    );

    return reply.send({
      success: true,
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      },
    });
  },

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = refreshSchema.parse(request.body);
    const tokens = await AuthService.refresh(refreshToken);

    return reply.send({
      success: true,
      data: tokens,
    });
  },

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    await AuthService.logout(user.sub, user.deviceId);

    return reply.send({ success: true, data: null });
  },

  async me(request: FastifyRequest, reply: FastifyReply) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.user!.sub },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        preferredLanguage: true,
        createdAt: true,
        subscription: {
          select: {
            status: true,
            currentPeriodEnd: true,
            trialEnd: true,
          },
        },
      },
    });

    return reply.send({ success: true, data: user });
  },
};
```

---

## src/modules/auth/auth.routes.ts

```typescript
import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';
import { authenticate } from '../../shared/middleware/authenticate';
import { rateLimits } from '../../shared/middleware/rateLimiter';

export async function authRoutes(app: FastifyInstance) {
  // POST /api/v1/auth/register
  app.post('/register', {
    config: { rateLimit: rateLimits.auth },
  }, AuthController.register);

  // POST /api/v1/auth/login
  app.post('/login', {
    config: { rateLimit: rateLimits.auth },
  }, AuthController.login);

  // POST /api/v1/auth/refresh
  app.post('/refresh', {
    config: { rateLimit: rateLimits.auth },
  }, AuthController.refresh);

  // POST /api/v1/auth/logout  (requires auth)
  app.post('/logout', {
    preHandler: [authenticate],
  }, AuthController.logout);

  // GET /api/v1/auth/me  (requires auth)
  app.get('/me', {
    preHandler: [authenticate],
  }, AuthController.me);
}
```

---

## src/modules/books/books.service.ts

```typescript
import { prisma } from '../../shared/db/prisma';
import { Prisma } from '@prisma/client';

export interface BooksQuery {
  type?:     'BOOK' | 'STORY' | 'SUMMARY';
  language?: string;
  tag?:      string;
  page:      number;
  limit:     number;
}

export class BooksService {
  // ─── List books with filtering/pagination ──────────────────────

  static async list(query: BooksQuery) {
    const { type, language, tag, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BookWhereInput = {
      isPublished: true,
      ...(type     && { contentType: type }),
      ...(language && { language }),
      ...(tag && {
        tags: { some: { tag: { name: tag } } },
      }),
    };

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          authorName: true,
          description: true,
          coverUrl: true,
          contentType: true,
          language: true,
          totalChapters: true,
          estimatedMinutes: true,
          isPremium: true,
          price: true,
          publishedAt: true,
          tags: { select: { tag: { select: { name: true } } } },
          _count: {
            select: { likes: true, comments: true },
          },
        },
      }),
      prisma.book.count({ where }),
    ]);

    return {
      books: books.map(BooksService.formatBook),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Featured books ────────────────────────────────────────────

  static async getFeatured() {
    // Featured = published, premium, ordered by a combination of
    // recency and like count. In production this could be a manual
    // editorial selection stored in a FeaturedBook table.
    return prisma.book.findMany({
      where: { isPublished: true },
      orderBy: [
        { likes: { _count: 'desc' } },
        { publishedAt: 'desc' },
      ],
      take: 10,
      select: {
        id: true,
        slug: true,
        title: true,
        authorName: true,
        description: true,
        coverUrl: true,
        contentType: true,
        isPremium: true,
        estimatedMinutes: true,
        _count: { select: { likes: true } },
      },
    });
  }

  // ─── Trending books ────────────────────────────────────────────

  static async getTrending() {
    // Trending = most reading activity in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const topBookIds = await prisma.analyticsEvent.groupBy({
      by: ['bookId'],
      where: {
        eventType: 'chapter_open',
        occurredAt: { gte: sevenDaysAgo },
        bookId: { not: null },
      },
      _count: { bookId: true },
      orderBy: { _count: { bookId: 'desc' } },
      take: 20,
    });

    if (topBookIds.length === 0) {
      // Fallback for new platforms with no analytics yet
      return BooksService.getFeatured();
    }

    const ids = topBookIds.map((b) => b.bookId!);

    return prisma.book.findMany({
      where: { id: { in: ids }, isPublished: true },
      select: {
        id: true,
        slug: true,
        title: true,
        authorName: true,
        coverUrl: true,
        contentType: true,
        isPremium: true,
        estimatedMinutes: true,
        language: true,
        _count: { select: { likes: true } },
      },
    });
  }

  // ─── Single book ───────────────────────────────────────────────

  static async getBySlug(slug: string, userId?: string) {
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug, isPublished: true },
      include: {
        tags: { include: { tag: true } },
        translations: {
          select: { language: true, status: true },
          where: { status: 'COMPLETED' },
        },
        _count: { select: { likes: true, comments: true } },
      },
    });

    // Check if user has liked this book
    let isLiked = false;
    let userProgress = null;
    let hasPurchased = false;

    if (userId) {
      const [like, progress, purchase] = await Promise.all([
        prisma.bookLike.findUnique({
          where: { userId_bookId: { userId, bookId: book.id } },
        }),
        prisma.readingProgress.findUnique({
          where: { userId_bookId: { userId, bookId: book.id } },
        }),
        prisma.purchase.findFirst({
          where: { userId, bookId: book.id },
        }),
      ]);

      isLiked = !!like;
      userProgress = progress;
      hasPurchased = !!purchase;
    }

    return {
      ...BooksService.formatBook(book),
      availableLanguages: book.translations.map((t) => t.language),
      isLiked,
      userProgress,
      hasPurchased,
    };
  }

  // ─── Check access ──────────────────────────────────────────────

  static async checkUserAccess(
    userId: string,
    bookId: string,
  ): Promise<{ hasAccess: boolean; reason: string }> {
    const [book, subscription, purchase] = await Promise.all([
      prisma.book.findUnique({ where: { id: bookId } }),
      prisma.subscription.findUnique({ where: { userId } }),
      prisma.purchase.findFirst({ where: { userId, bookId } }),
    ]);

    if (!book) return { hasAccess: false, reason: 'BOOK_NOT_FOUND' };
    if (!book.isPremium) return { hasAccess: true, reason: 'FREE' };
    if (purchase) return { hasAccess: true, reason: 'PURCHASED' };

    if (subscription) {
      const now = new Date();
      const isActive =
        ['ACTIVE', 'TRIALING'].includes(subscription.status) &&
        subscription.currentPeriodEnd > now;

      if (isActive) return { hasAccess: true, reason: 'SUBSCRIPTION' };
    }

    return { hasAccess: false, reason: 'NO_ACCESS' };
  }

  // ─── Format helper ─────────────────────────────────────────────

  private static formatBook(book: any) {
    return {
      ...book,
      tags: book.tags?.map((t: any) => t.tag?.name ?? t.name) ?? [],
      likeCount: book._count?.likes ?? 0,
      commentCount: book._count?.comments ?? 0,
      _count: undefined,
    };
  }
}
```

---

## src/modules/books/books.controller.ts

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { BooksService } from './books.service';

const listQuerySchema = z.object({
  type:     z.enum(['BOOK', 'STORY', 'SUMMARY']).optional(),
  language: z.string().length(2).optional(),
  tag:      z.string().optional(),
  page:     z.string().default('1').transform(Number),
  limit:    z.string().default('20').transform(Number),
});

export const BooksController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listQuerySchema.parse(request.query);
    const result = await BooksService.list(query);
    return reply.send({ success: true, data: result.books, meta: result.pagination });
  },

  async featured(request: FastifyRequest, reply: FastifyReply) {
    const books = await BooksService.getFeatured();
    return reply.send({ success: true, data: books });
  },

  async trending(request: FastifyRequest, reply: FastifyReply) {
    const books = await BooksService.getTrending();
    return reply.send({ success: true, data: books });
  },

  async getOne(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const userId = request.user?.sub;
    const book = await BooksService.getBySlug(slug, userId);
    return reply.send({ success: true, data: book });
  },

  async like(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const userId = request.user!.sub;

    const book = await import('../../shared/db/prisma').then(m =>
      m.prisma.book.findUniqueOrThrow({ where: { slug } })
    );

    const { prisma } = await import('../../shared/db/prisma');
    await prisma.bookLike.upsert({
      where: { userId_bookId: { userId, bookId: book.id } },
      create: { userId, bookId: book.id },
      update: {},
    });

    return reply.send({ success: true, data: null });
  },

  async unlike(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const userId = request.user!.sub;

    const { prisma } = await import('../../shared/db/prisma');
    const book = await prisma.book.findUniqueOrThrow({ where: { slug } });

    await prisma.bookLike.deleteMany({
      where: { userId, bookId: book.id },
    });

    return reply.send({ success: true, data: null });
  },
};
```

---

## src/modules/books/books.routes.ts

```typescript
import { FastifyInstance } from 'fastify';
import { BooksController } from './books.controller';
import { authenticate } from '../../shared/middleware/authenticate';
import { rateLimits } from '../../shared/middleware/rateLimiter';

export async function booksRoutes(app: FastifyInstance) {
  // Public routes
  app.get('/',          { config: { rateLimit: rateLimits.api } }, BooksController.list);
  app.get('/featured',  { config: { rateLimit: rateLimits.api } }, BooksController.featured);
  app.get('/trending',  { config: { rateLimit: rateLimits.api } }, BooksController.trending);
  app.get('/:slug',     { config: { rateLimit: rateLimits.api } }, BooksController.getOne);

  // Authenticated routes
  app.post('/:slug/like',   { preHandler: [authenticate] }, BooksController.like);
  app.delete('/:slug/like', { preHandler: [authenticate] }, BooksController.unlike);
}
```

---

## src/modules/reader/reader.service.ts

```typescript
import { prisma } from '../../shared/db/prisma';
import { S3Service } from '../../shared/storage/s3';
import { BookCrypto } from '../../shared/encryption/bookCrypto';
import { KeyManager } from '../../shared/encryption/keyManager';
import { BooksService } from '../books/books.service';

export class ReaderService {
  // ─── Get decrypted chapter content ────────────────────────────

  /**
   * Retrieve and decrypt a single chapter for online reading.
   *
   * Security flow:
   * 1. Verify user has active subscription or purchased the book
   * 2. Fetch encrypted chapter from S3
   * 3. Unwrap BEK from KMS (requires valid AWS credentials)
   * 4. Decrypt with AES-256-GCM — authTag verifies integrity
   * 5. Return plaintext UTF-8 content
   *
   * The plaintext never touches disk — lives in memory only
   * for the duration of this request.
   */
  static async getChapterContent(
    userId: string,
    bookSlug: string,
    chapterIndex: number,
    language?: string,
  ): Promise<string> {
    // Verify access
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
      include: {
        chapters: {
          where: { chapterIndex },
          take: 1,
        },
      },
    });

    const access = await BooksService.checkUserAccess(userId, book.id);
    if (!access.hasAccess) {
      const err: any = new Error('Subscription required to access this content');
      err.statusCode = 403;
      err.code = 'ACCESS_DENIED';
      throw err;
    }

    const chapter = book.chapters[0];
    if (!chapter) {
      const err: any = new Error('Chapter not found');
      err.statusCode = 404;
      throw err;
    }

    // If translation requested, use translated chapter key
    let encryptedKey = chapter.encryptedKey;
    let iv = chapter.iv;
    let authTag = chapter.authTag;
    let wrappedBek = book.encryptedFileKey;

    if (language && language !== book.language) {
      const translation = await prisma.bookTranslation.findUnique({
        where: { bookId_language: { bookId: book.id, language } },
      });

      if (translation?.status === 'COMPLETED' && translation.encryptedFileKey) {
        encryptedKey = `books/${book.id}/translations/${language}/chapters/${chapterIndex}.enc`;
        wrappedBek   = translation.encryptedFileKey;
        iv           = translation.iv ?? iv;
        authTag      = translation.authTag ?? authTag;
      }
    }

    // Fetch encrypted ciphertext from S3
    const ciphertext = await S3Service.downloadEncryptedContent(encryptedKey);

    // Unwrap BEK from KMS
    const bek = await KeyManager.unwrapKey(wrappedBek);

    // Decrypt
    const plaintext = BookCrypto.decrypt({ iv, authTag, ciphertext }, bek);

    // Track analytics event asynchronously (don't await — non-blocking)
    prisma.analyticsEvent.create({
      data: {
        userId,
        bookId: book.id,
        eventType: 'chapter_open',
        properties: { chapterIndex, language: language ?? book.language },
      },
    }).catch(() => {}); // Swallow analytics failures

    return plaintext.toString('utf8');
  }

  // ─── Save reading progress ─────────────────────────────────────

  static async saveProgress(
    userId: string,
    bookSlug: string,
    chapterIndex: number,
    scrollPosition: number,
  ): Promise<void> {
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
      select: { id: true, totalChapters: true },
    });

    const percentComplete = book.totalChapters > 0
      ? ((chapterIndex + scrollPosition) / book.totalChapters) * 100
      : 0;

    const isCompleted = percentComplete >= 99;

    await prisma.readingProgress.upsert({
      where: {
        userId_bookId: { userId, bookId: book.id },
      },
      create: {
        userId,
        bookId: book.id,
        chapterIndex,
        scrollPosition,
        percentComplete,
        lastReadAt: new Date(),
        completedAt: isCompleted ? new Date() : null,
      },
      update: {
        chapterIndex,
        scrollPosition,
        percentComplete,
        lastReadAt: new Date(),
        ...(isCompleted && { completedAt: new Date() }),
      },
    });

    // Increment total read seconds via analytics
    await prisma.analyticsEvent.create({
      data: {
        userId,
        bookId: book.id,
        eventType: 'reading_session_end',
        properties: { chapterIndex, scrollPosition, percentComplete },
      },
    });
  }

  // ─── Get progress ──────────────────────────────────────────────

  static async getProgress(userId: string, bookSlug: string) {
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
    });

    return prisma.readingProgress.findUnique({
      where: {
        userId_bookId: { userId, bookId: book.id },
      },
    });
  }

  // ─── Save highlight ────────────────────────────────────────────

  static async saveHighlight(
    userId: string,
    bookSlug: string,
    chapterIndex: number,
    startOffset: number,
    endOffset: number,
    text: string,
    color: string,
    note?: string,
  ) {
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
    });

    return prisma.highlight.create({
      data: {
        userId,
        bookId: book.id,
        chapterIndex,
        startOffset,
        endOffset,
        text,
        color,
        note,
      },
    });
  }

  // ─── Get highlights for a book ─────────────────────────────────

  static async getHighlights(userId: string, bookSlug: string) {
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
    });

    return prisma.highlight.findMany({
      where: { userId, bookId: book.id },
      orderBy: [{ chapterIndex: 'asc' }, { startOffset: 'asc' }],
    });
  }
}
```

---

## src/modules/reader/reader.controller.ts

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ReaderService } from './reader.service';

const progressSchema = z.object({
  chapterIndex:   z.number().int().min(0),
  scrollPosition: z.number().min(0).max(1),
});

const highlightSchema = z.object({
  chapterIndex: z.number().int().min(0),
  startOffset:  z.number().int().min(0),
  endOffset:    z.number().int().min(0),
  text:         z.string().min(1).max(2000),
  color:        z.string().default('#FFD700'),
  note:         z.string().max(500).optional(),
});

export const ReaderController = {
  async getChapterContent(request: FastifyRequest, reply: FastifyReply) {
    const { slug, index } = request.params as { slug: string; index: string };
    const { language } = request.query as { language?: string };
    const userId = request.user!.sub;

    const content = await ReaderService.getChapterContent(
      userId,
      slug,
      parseInt(index),
      language,
    );

    return reply.send({ success: true, data: { content } });
  },

  async saveProgress(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const body = progressSchema.parse(request.body);
    const userId = request.user!.sub;

    await ReaderService.saveProgress(
      userId,
      slug,
      body.chapterIndex,
      body.scrollPosition,
    );

    return reply.send({ success: true, data: null });
  },

  async getProgress(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const progress = await ReaderService.getProgress(request.user!.sub, slug);
    return reply.send({ success: true, data: progress });
  },

  async saveHighlight(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const body = highlightSchema.parse(request.body);
    const userId = request.user!.sub;

    const highlight = await ReaderService.saveHighlight(
      userId, slug,
      body.chapterIndex, body.startOffset, body.endOffset,
      body.text, body.color, body.note,
    );

    return reply.status(201).send({ success: true, data: highlight });
  },

  async getHighlights(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const highlights = await ReaderService.getHighlights(request.user!.sub, slug);
    return reply.send({ success: true, data: highlights });
  },
};
```

---

## src/modules/reader/reader.routes.ts

```typescript
import { FastifyInstance } from 'fastify';
import { ReaderController } from './reader.controller';
import { authenticate } from '../../shared/middleware/authenticate';
import { rateLimits } from '../../shared/middleware/rateLimiter';

export async function readerRoutes(app: FastifyInstance) {
  // All reader routes require authentication
  const auth = { preHandler: [authenticate] };
  const heavy = { preHandler: [authenticate], config: { rateLimit: rateLimits.heavy } };

  // GET /api/v1/books/:slug/chapters/:index/content
  app.get('/:slug/chapters/:index/content', heavy, ReaderController.getChapterContent);

  // POST /api/v1/books/:slug/progress
  app.post('/:slug/progress', auth, ReaderController.saveProgress);

  // GET /api/v1/books/:slug/progress
  app.get('/:slug/progress', auth, ReaderController.getProgress);

  // POST /api/v1/books/:slug/highlights
  app.post('/:slug/highlights', auth, ReaderController.saveHighlight);

  // GET /api/v1/books/:slug/highlights
  app.get('/:slug/highlights', auth, ReaderController.getHighlights);
}
```

---

## src/modules/community/community.service.ts

```typescript
import { prisma } from '../../shared/db/prisma';

export interface CreateCommentInput {
  userId:   string;
  bookSlug: string;
  body:     string;
  parentId?: string;
}

export interface ListCommentsQuery {
  bookSlug: string;
  page:     number;
  limit:    number;
  sort:     'recent' | 'popular';
}

export class CommunityService {
  // ─── List top-level comments (with first replies inline) ────────

  static async listComments(query: ListCommentsQuery) {
    const { bookSlug, page, limit, sort } = query;
    const skip = (page - 1) * limit;

    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
      select: { id: true },
    });

    const orderBy = sort === 'popular'
      ? [{ likes: { _count: 'desc' as const } }, { createdAt: 'desc' as const }]
      : [{ createdAt: 'desc' as const }];

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: {
          bookId:    book.id,
          parentId:  null,       // Top-level only
          isDeleted: false,
        },
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          // Include first 3 replies inline
          replies: {
            where: { isDeleted: false },
            take: 3,
            orderBy: { createdAt: 'asc' },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
              _count: { select: { likes: true } },
            },
          },
          _count: {
            select: { likes: true, replies: true },
          },
        },
      }),
      prisma.comment.count({
        where: { bookId: book.id, parentId: null, isDeleted: false },
      }),
    ]);

    return {
      comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Create comment or reply ───────────────────────────────────

  static async createComment(input: CreateCommentInput) {
    const { userId, bookSlug, body, parentId } = input;

    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
      select: { id: true },
    });

    // If a parentId is provided, validate it exists and belongs to this book
    if (parentId) {
      const parent = await prisma.comment.findFirst({
        where: { id: parentId, bookId: book.id, isDeleted: false },
      });
      if (!parent) {
        const err: any = new Error('Parent comment not found');
        err.statusCode = 404;
        throw err;
      }
      // Prevent deep nesting — only one level of replies
      if (parent.parentId !== null) {
        const err: any = new Error('Cannot reply to a reply');
        err.statusCode = 400;
        err.code = 'NESTING_TOO_DEEP';
        throw err;
      }
    }

    const comment = await prisma.comment.create({
      data: {
        userId,
        bookId: book.id,
        body: body.trim(),
        parentId,
      },
      include: {
        user: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });

    return comment;
  }

  // ─── Edit comment ──────────────────────────────────────────────

  static async updateComment(
    commentId: string,
    userId: string,
    body: string,
  ) {
    const comment = await prisma.comment.findUniqueOrThrow({
      where: { id: commentId },
    });

    if (comment.userId !== userId) {
      const err: any = new Error('Cannot edit another user\'s comment');
      err.statusCode = 403;
      throw err;
    }

    if (comment.isDeleted) {
      const err: any = new Error('Cannot edit a deleted comment');
      err.statusCode = 400;
      throw err;
    }

    return prisma.comment.update({
      where: { id: commentId },
      data: { body: body.trim(), updatedAt: new Date() },
    });
  }

  // ─── Soft-delete comment ───────────────────────────────────────

  static async deleteComment(commentId: string, userId: string, userRole: string) {
    const comment = await prisma.comment.findUniqueOrThrow({
      where: { id: commentId },
    });

    // Owner or moderator/admin can delete
    const canDelete = comment.userId === userId ||
      ['ADMIN', 'MODERATOR'].includes(userRole);

    if (!canDelete) {
      const err: any = new Error('Cannot delete this comment');
      err.statusCode = 403;
      throw err;
    }

    // Soft delete — preserve thread structure, show "[deleted]" in UI
    await prisma.comment.update({
      where: { id: commentId },
      data: {
        isDeleted: true,
        body: '[This comment has been deleted]',
      },
    });
  }

  // ─── Like / unlike comment ─────────────────────────────────────

  static async likeComment(commentId: string, userId: string) {
    await prisma.commentLike.upsert({
      where: { userId_commentId: { userId, commentId } },
      create: { userId, commentId },
      update: {},
    });
  }

  static async unlikeComment(commentId: string, userId: string) {
    await prisma.commentLike.deleteMany({
      where: { userId, commentId },
    });
  }

  // ─── Report comment ────────────────────────────────────────────

  static async reportComment(
    commentId: string,
    reporterId: string,
    reason: string,
    details?: string,
  ) {
    // Prevent duplicate reports from the same user
    const existing = await prisma.report.findFirst({
      where: { commentId, reporterId },
    });

    if (existing) {
      const err: any = new Error('You have already reported this comment');
      err.statusCode = 409;
      throw err;
    }

    return prisma.report.create({
      data: {
        commentId,
        reporterId,
        reason: reason as any,
        details,
      },
    });
  }

  // ─── Get replies for a comment ─────────────────────────────────

  static async getReplies(parentId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [replies, total] = await Promise.all([
      prisma.comment.findMany({
        where: { parentId, isDeleted: false },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
          _count: { select: { likes: true } },
        },
      }),
      prisma.comment.count({ where: { parentId, isDeleted: false } }),
    ]);

    return {
      replies,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }
}
```

---

## src/modules/community/community.controller.ts

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { CommunityService } from './community.service';

const listQuerySchema = z.object({
  page:  z.string().default('1').transform(Number),
  limit: z.string().default('20').transform(Number),
  sort:  z.enum(['recent', 'popular']).default('recent'),
});

const createCommentSchema = z.object({
  body:     z.string().min(1).max(2000).trim(),
  parentId: z.string().cuid().optional(),
});

const updateCommentSchema = z.object({
  body: z.string().min(1).max(2000).trim(),
});

const reportSchema = z.object({
  reason:  z.enum(['SPAM', 'HARASSMENT', 'SPOILER', 'INAPPROPRIATE', 'OTHER']),
  details: z.string().max(500).optional(),
});

export const CommunityController = {
  async listComments(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const query = listQuerySchema.parse(request.query);

    const result = await CommunityService.listComments({
      bookSlug: slug,
      ...query,
    });

    return reply.send({
      success: true,
      data: result.comments,
      meta: result.pagination,
    });
  },

  async createComment(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const body = createCommentSchema.parse(request.body);
    const userId = request.user!.sub;

    const comment = await CommunityService.createComment({
      userId,
      bookSlug: slug,
      body: body.body,
      parentId: body.parentId,
    });

    return reply.status(201).send({ success: true, data: comment });
  },

  async updateComment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { body } = updateCommentSchema.parse(request.body);
    const updated = await CommunityService.updateComment(id, request.user!.sub, body);
    return reply.send({ success: true, data: updated });
  },

  async deleteComment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await CommunityService.deleteComment(id, request.user!.sub, request.user!.role);
    return reply.send({ success: true, data: null });
  },

  async likeComment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await CommunityService.likeComment(id, request.user!.sub);
    return reply.send({ success: true, data: null });
  },

  async unlikeComment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await CommunityService.unlikeComment(id, request.user!.sub);
    return reply.send({ success: true, data: null });
  },

  async reportComment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = reportSchema.parse(request.body);
    await CommunityService.reportComment(id, request.user!.sub, body.reason, body.details);
    return reply.status(201).send({ success: true, data: null });
  },

  async getReplies(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const query = listQuerySchema.parse(request.query);
    const result = await CommunityService.getReplies(id, query.page, query.limit);
    return reply.send({ success: true, data: result.replies, meta: result.pagination });
  },
};
```

---

## src/modules/community/community.routes.ts

```typescript
import { FastifyInstance } from 'fastify';
import { CommunityController } from './community.controller';
import { authenticate } from '../../shared/middleware/authenticate';
import { rateLimits } from '../../shared/middleware/rateLimiter';

export async function communityRoutes(app: FastifyInstance) {
  const api = { config: { rateLimit: rateLimits.api } };

  // GET /api/v1/books/:slug/comments  (public)
  app.get('/books/:slug/comments', api, CommunityController.listComments);

  // POST /api/v1/books/:slug/comments  (auth required)
  app.post('/books/:slug/comments', {
    preHandler: [authenticate],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, CommunityController.createComment);

  // Comment actions
  app.put('/comments/:id',    { preHandler: [authenticate] }, CommunityController.updateComment);
  app.delete('/comments/:id', { preHandler: [authenticate] }, CommunityController.deleteComment);

  app.post('/comments/:id/like',   { preHandler: [authenticate] }, CommunityController.likeComment);
  app.delete('/comments/:id/like', { preHandler: [authenticate] }, CommunityController.unlikeComment);

  app.post('/comments/:id/report', { preHandler: [authenticate] }, CommunityController.reportComment);

  // GET replies for a comment
  app.get('/comments/:id/replies', api, CommunityController.getReplies);
}
```
