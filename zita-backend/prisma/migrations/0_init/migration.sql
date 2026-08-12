-- CreateEnum
CREATE TYPE "Role" AS ENUM ('READER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('BOOK', 'STORY', 'SUMMARY');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'SPOILER', 'INAPPROPRIATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'ACTIONED', 'DISMISSED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'READER',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "pushToken" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coverUrl" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "totalChapters" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "isPremium" BOOLEAN NOT NULL DEFAULT true,
    "price" DECIMAL(10,2),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "encryptedFileKey" TEXT NOT NULL,
    "fileIv" TEXT NOT NULL,
    "fileAuthTag" TEXT NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_translations" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" "TranslationStatus" NOT NULL DEFAULT 'PENDING',
    "translatedTitle" TEXT,
    "translatedDescription" TEXT,
    "encryptedFileKey" TEXT,
    "iv" TEXT,
    "authTag" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_tags" (
    "bookId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "book_tags_pkey" PRIMARY KEY ("bookId","tagId")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "platform" "Platform" NOT NULL,
    "platformProductId" TEXT NOT NULL,
    "platformTransactionId" TEXT NOT NULL,
    "originalTransactionId" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "platformTransactionId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "encryptedDecryptionKey" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterIndex" INTEGER NOT NULL DEFAULT 0,
    "scrollPosition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percentComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReadSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "reading_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "highlights" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterIndex" INTEGER NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#FFD700',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_likes" (
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,

    CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("userId","commentId")
);

-- CreateTable
CREATE TABLE "book_likes" (
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,

    CONSTRAINT "book_likes_pkey" PRIMARY KEY ("userId","bookId")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "bookId" TEXT,
    "eventType" TEXT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_userId_deviceId_idx" ON "sessions"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "devices_userId_fingerprint_key" ON "devices"("userId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "books_slug_key" ON "books"("slug");

-- CreateIndex
CREATE INDEX "books_slug_idx" ON "books"("slug");

-- CreateIndex
CREATE INDEX "books_isPublished_isPremium_idx" ON "books"("isPublished", "isPremium");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_bookId_chapterIndex_key" ON "chapters"("bookId", "chapterIndex");

-- CreateIndex
CREATE UNIQUE INDEX "book_translations_bookId_language_key" ON "book_translations"("bookId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_platformTransactionId_key" ON "purchases"("platformTransactionId");

-- CreateIndex
CREATE INDEX "purchases_userId_idx" ON "purchases"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "offline_keys_userId_deviceId_bookId_key" ON "offline_keys"("userId", "deviceId", "bookId");

-- CreateIndex
CREATE INDEX "offline_keys_validUntil_idx" ON "offline_keys"("validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "reading_progress_userId_bookId_key" ON "reading_progress"("userId", "bookId");

-- CreateIndex
CREATE INDEX "comments_bookId_parentId_idx" ON "comments"("bookId", "parentId");

-- CreateIndex
CREATE INDEX "analytics_events_eventType_occurredAt_idx" ON "analytics_events"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_userId_occurredAt_idx" ON "analytics_events"("userId", "occurredAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_translations" ADD CONSTRAINT "book_translations_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_keys" ADD CONSTRAINT "offline_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_keys" ADD CONSTRAINT "offline_keys_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_keys" ADD CONSTRAINT "offline_keys_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_likes" ADD CONSTRAINT "book_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_likes" ADD CONSTRAINT "book_likes_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON UPDATE CASCADE;

