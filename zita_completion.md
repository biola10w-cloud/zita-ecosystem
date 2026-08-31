# ZITA — Completion: All Remaining Deliverables

---

## infrastructure/terraform/main.tf

```hcl
terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "zita-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# ─── VPC ──────────────────────────────────────────────────────────

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "zita-vpc"
  cidr = "10.0.0.0/16"

  azs              = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets   = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = false   # HA: one NAT per AZ
  enable_dns_hostnames   = true
  enable_dns_support     = true

  tags = { Project = "ZITA", Environment = var.environment }
}

# ─── KMS Master Key ───────────────────────────────────────────────

resource "aws_kms_key" "book_encryption" {
  description             = "ZITA book content master encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true   # Auto-rotate every year

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM"
        Effect = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "APIServerAccess"
        Effect = "Allow"
        Principal = { AWS = aws_iam_role.ecs_task_role.arn }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = { Project = "ZITA", Purpose = "BookEncryption" }
}

resource "aws_kms_alias" "book_encryption" {
  name          = "alias/zita-book-encryption"
  target_key_id = aws_kms_key.book_encryption.key_id
}

# ─── RDS PostgreSQL ───────────────────────────────────────────────

resource "aws_db_subnet_group" "zita" {
  name       = "zita-db-subnet-group"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "rds" {
  name   = "zita-rds-sg"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }
}

resource "aws_db_instance" "zita" {
  identifier     = "zita-production"
  engine         = "postgres"
  engine_version = "16.1"
  instance_class = var.db_instance_class   # db.r6g.large in production

  allocated_storage     = 100
  max_allocated_storage = 1000   # Auto-scaling storage
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.book_encryption.arn

  db_name  = "zita_db"
  username = "zita"
  password = random_password.db_password.result

  db_subnet_group_name   = aws_db_subnet_group.zita.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az               = true   # HA: standby in another AZ
  backup_retention_period = 14    # 14-day backups
  deletion_protection    = true
  skip_final_snapshot    = false
  final_snapshot_identifier = "zita-final-snapshot"

  performance_insights_enabled = true

  tags = { Project = "ZITA" }
}

# ─── ElastiCache Redis ────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "zita" {
  name       = "zita-redis-subnet"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_elasticache_replication_group" "zita" {
  replication_group_id = "zita-redis"
  description          = "ZITA Redis cluster for cache and queues"

  node_type            = "cache.r6g.large"
  num_cache_clusters   = 3     # 1 primary + 2 replicas
  automatic_failover_enabled = true
  multi_az_enabled     = true

  engine_version       = "7.1"
  port                 = 6379

  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  auth_token                  = random_password.redis_auth.result

  subnet_group_name    = aws_elasticache_subnet_group.zita.name

  tags = { Project = "ZITA" }
}

# ─── ECS Cluster ──────────────────────────────────────────────────

resource "aws_ecs_cluster" "zita" {
  name = "zita-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "zita" {
  cluster_name       = aws_ecs_cluster.zita.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

# ─── IAM Roles ────────────────────────────────────────────────────

resource "aws_iam_role" "ecs_task_role" {
  name = "zita-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "zita-ecs-task-policy"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey"]
        Resource = aws_kms_key.book_encryption.arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.books.arn}/*"
      },
      {
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:*:secret:zita/*"
      }
    ]
  })
}

# ─── S3 Books Bucket ──────────────────────────────────────────────

resource "aws_s3_bucket" "books" {
  bucket = "zita-books-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "books" {
  bucket = aws_s3_bucket.books.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "books" {
  bucket = aws_s3_bucket.books.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.book_encryption.arn
    }
    bucket_key_enabled = true   # Reduces KMS API calls by 99%
  }
}

# ─── Secrets Manager ──────────────────────────────────────────────

resource "aws_secretsmanager_secret" "zita" {
  for_each = toset([
    "zita/jwt-private-key",
    "zita/jwt-public-key",
    "zita/apple-shared-secret",
    "zita/google-service-account",
    "zita/watermark-secret",
    "zita/db-password",
  ])

  name                    = each.value
  recovery_window_in_days = 14
}

# ─── CloudWatch Alarms ────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "api_error_rate" {
  alarm_name          = "zita-api-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "ZITA API error rate exceeds 50 5XX in 1 minute"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "zita-api-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  extended_statistic  = "p95"
  threshold           = 0.5   # 500ms P95
  alarm_description   = "ZITA API P95 latency above 500ms"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_sns_topic" "alerts" {
  name = "zita-production-alerts"
}

data "aws_caller_identity" "current" {}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "random_password" "redis_auth" {
  length  = 32
  special = false
}
```

---

## infrastructure/terraform/variables.tf

```hcl
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (production, staging)"
  type        = string
  default     = "production"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.large"
}

variable "api_cpu" {
  description = "ECS task CPU units (1024 = 1 vCPU)"
  type        = number
  default     = 2048
}

variable "api_memory" {
  description = "ECS task memory in MB"
  type        = number
  default     = 4096
}
```

---

## scripts/seed.ts — Database seeder

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { BookCrypto } from '../src/shared/encryption/bookCrypto';
import { KeyManager } from '../src/shared/encryption/keyManager';
import { S3Service } from '../src/shared/storage/s3';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ZITA database...');

  // ─── Admin user ────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@ZITA2025!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@zita.app' },
    update: {},
    create: {
      email:        'admin@zita.app',
      passwordHash: adminHash,
      displayName:  'ZITA Admin',
      role:         'ADMIN',
      isEmailVerified: true,
    },
  });
  console.log(`✓ Admin user: ${admin.email}`);

  // ─── Moderator ─────────────────────────────────────────────────
  const modHash = await bcrypt.hash('Mod@ZITA2025!', 12);

  await prisma.user.upsert({
    where: { email: 'mod@zita.app' },
    update: {},
    create: {
      email:        'mod@zita.app',
      passwordHash: modHash,
      displayName:  'ZITA Moderator',
      role:         'MODERATOR',
      isEmailVerified: true,
    },
  });
  console.log('✓ Moderator user: mod@zita.app');

  // ─── Tags ──────────────────────────────────────────────────────
  const tagNames = [
    'fiction', 'non-fiction', 'africa', 'classic',
    'self-help', 'biography', 'science', 'history',
    'business', 'philosophy', 'summary',
  ];

  const tags = await Promise.all(
    tagNames.map((name) =>
      prisma.tag.upsert({
        where:  { name },
        update: {},
        create: { name },
      }),
    ),
  );
  console.log(`✓ Created ${tags.length} tags`);

  // ─── Sample free book (no encryption for seed) ──────────────────
  const sampleContent = `
=== CHAPTER 1 ===
# The Beginning

Okonkwo ruled his household with a heavy hand. His wives, especially the youngest,
lived in perpetual fear of his fiery temper, and so did his little children.

Perhaps down in his heart Okonkwo was not a cruel man. But his whole life was dominated
by fear, the fear of failure and of weakness. It was deeper and more intimate than the
fear of evil and capricious gods and of magic, the fear of the forest, and of the forces
of nature, malevolent, red in tooth and claw.

=== CHAPTER 2 ===
# The Village

In Umuofia, the drums began to beat. Okonkwo heard them from his obi and knew what
they signified. The sound of the drums filled him with a curious mixture of emotions.

He was a man of action, a man of war. Unlike his father he could stand the look of blood.
In Umuofia's latest war he was the first to bring home a human head. That was his fifth head.
`.trim();

  // Encrypt sample content
  console.log('🔐 Encrypting sample book...');
  const { key: bek, hex: bekHex } = BookCrypto.generateKey();
  const chapters = sampleContent.split('=== CHAPTER').filter(Boolean);

  let wrappedBek = 'dev-mode-no-kms'; // In dev, skip KMS
  try {
    wrappedBek = await KeyManager.wrapKey(bekHex);
  } catch {
    console.warn('⚠ KMS not available in dev — using placeholder BEK');
  }

  const book = await prisma.book.upsert({
    where: { slug: 'things-fall-apart' },
    update: {},
    create: {
      title:           'Things Fall Apart',
      slug:            'things-fall-apart',
      authorName:      'Chinua Achebe',
      description:     'A landmark of African literature, this story of Okonkwo, a proud Igbo warrior, explores the collision of tradition and colonialism in Nigeria. First published in 1958.',
      coverUrl:        'https://cdn.zita.app/public/covers/things-fall-apart.jpg',
      contentType:     'BOOK',
      language:        'en',
      totalChapters:   chapters.length,
      estimatedMinutes: 240,
      isPremium:       false,
      isPublished:     true,
      publishedAt:     new Date(),
      encryptedFileKey: wrappedBek,
      fileIv:          'seeded',
      fileAuthTag:     'seeded',
      tags: {
        create: [
          { tag: { connect: { name: 'fiction' } } },
          { tag: { connect: { name: 'africa' } } },
          { tag: { connect: { name: 'classic' } } },
        ],
      },
    },
  });
  console.log(`✓ Sample book: "${book.title}"`);

  // Create chapter records
  for (let i = 0; i < chapters.length; i++) {
    const content = chapters[i].trim();
    const encrypted = BookCrypto.encrypt(Buffer.from(content, 'utf8'), bek);

    // Upload to S3 (skip in dev if S3 unavailable)
    const s3Key = `books/${book.id}/chapters/${i}.enc`;
    try {
      await S3Service.uploadEncryptedContent(s3Key, encrypted.ciphertext);
    } catch {
      console.warn(`⚠ S3 not available — skipping chapter ${i} upload`);
    }

    await prisma.chapter.upsert({
      where: { bookId_chapterIndex: { bookId: book.id, chapterIndex: i } },
      update: {},
      create: {
        bookId:       book.id,
        chapterIndex: i,
        title:        `Chapter ${i + 1}`,
        wordCount:    content.split(' ').length,
        encryptedKey: s3Key,
        iv:           encrypted.iv,
        authTag:      encrypted.authTag,
      },
    });
  }
  console.log(`✓ Created ${chapters.length} chapters`);

  // ─── Sample subscription plans (no DB record — Apple/Google managed) ─
  console.log('✓ Subscription plans are managed by App Store / Play Console');

  // ─── Sample comment ────────────────────────────────────────────
  const reader = await prisma.user.upsert({
    where: { email: 'reader@zita.app' },
    update: {},
    create: {
      email:        'reader@zita.app',
      passwordHash: await bcrypt.hash('Reader@2025!', 12),
      displayName:  'Amara Okafor',
      role:         'READER',
      isEmailVerified: true,
    },
  });

  await prisma.comment.create({
    data: {
      userId: reader.id,
      bookId: book.id,
      body:   'The way Achebe portrays Okonkwo\'s fear is deeply human. He\'s not a villain — he\'s a man running from his father\'s shadow. Masterpiece.',
    },
  });
  console.log('✓ Sample comment created');

  console.log('\n✅ Seed complete!\n');
  console.log('Credentials:');
  console.log('  Admin:     admin@zita.app / Admin@ZITA2025!');
  console.log('  Moderator: mod@zita.app   / Mod@ZITA2025!');
  console.log('  Reader:    reader@zita.app / Reader@2025!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

---

## scripts/generate-keys.sh — RSA key generation script

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "🔑 Generating ZITA RSA key pair..."

mkdir -p keys

# Generate 2048-bit RSA private key
openssl genrsa -out keys/private.pem 2048
echo "✓ Private key generated: keys/private.pem"

# Extract public key
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
echo "✓ Public key generated: keys/public.pem"

# Print public key fingerprint for verification
echo ""
echo "Public key fingerprint (SHA-256):"
openssl pkey -pubin -in keys/public.pem -outform DER | \
  openssl dgst -sha256 -hex | \
  awk '{print $2}'

echo ""
echo "⚠  IMPORTANT:"
echo "   - keys/private.pem is in .gitignore — never commit it"
echo "   - In production, upload to AWS Secrets Manager:"
echo "     aws secretsmanager put-secret-value \\"
echo "       --secret-id zita/jwt-private-key \\"
echo "       --secret-string file://keys/private.pem"
```

---

## scripts/health-check.ts — Production health check script

```typescript
import axios from 'axios';

const API_URL = process.env.API_URL ?? 'https://api.zita.app';

interface HealthResult {
  service: string;
  status: 'OK' | 'FAIL';
  latency: number;
  error?: string;
}

async function checkEndpoint(
  name: string,
  url: string,
  expectedStatus = 200,
): Promise<HealthResult> {
  const start = Date.now();
  try {
    const res = await axios.get(url, { timeout: 5000 });
    const latency = Date.now() - start;
    return {
      service: name,
      status:  res.status === expectedStatus ? 'OK' : 'FAIL',
      latency,
    };
  } catch (err: any) {
    return {
      service: name,
      status:  'FAIL',
      latency: Date.now() - start,
      error:   err.message,
    };
  }
}

async function main() {
  console.log(`🩺 ZITA Health Check — ${new Date().toISOString()}\n`);

  const checks = await Promise.all([
    checkEndpoint('API Health',    `${API_URL}/health`),
    checkEndpoint('Books List',    `${API_URL}/api/v1/books?limit=1`),
    checkEndpoint('Featured',      `${API_URL}/api/v1/books/featured`),
    checkEndpoint('Plans',         `${API_URL}/api/v1/subscriptions/plans`),
    checkEndpoint('Auth (no token)', `${API_URL}/api/v1/auth/me`, 401),
  ]);

  let allOk = true;
  for (const result of checks) {
    const icon    = result.status === 'OK' ? '✅' : '❌';
    const latency = `${result.latency}ms`;
    console.log(`${icon} ${result.service.padEnd(24)} ${latency.padStart(8)}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.status === 'FAIL') allOk = false;
  }

  console.log('\nP95 target: < 200ms');
  const p95 = checks.map((c) => c.latency).sort((a, b) => a - b)[
    Math.floor(checks.length * 0.95)
  ];
  console.log(`Observed:   ${p95}ms`);

  if (!allOk) {
    console.error('\n❌ Health check FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ All systems operational');
  }
}

main();
```

---

## prisma/migrations/001_init.sql — Initial migration reference

```sql
-- This is generated by `prisma migrate dev`
-- Shown here for reference. Do not run manually.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('READER', 'MODERATOR', 'ADMIN');
CREATE TYPE "Platform" AS ENUM ('IOS', 'ANDROID', 'WEB');
CREATE TYPE "ContentType" AS ENUM ('BOOK', 'STORY', 'SUMMARY');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');
CREATE TYPE "TranslationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'SPOILER', 'INAPPROPRIATE', 'OTHER');
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'ACTIONED', 'DISMISSED');

-- CreateTable: users
CREATE TABLE "users" (
    "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "email"             TEXT NOT NULL,
    "password_hash"     TEXT,
    "display_name"      TEXT NOT NULL,
    "avatar_url"        TEXT,
    "role"              "Role" NOT NULL DEFAULT 'READER',
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateTable: sessions
CREATE TABLE "sessions" (
    "id"            TEXT NOT NULL,
    "user_id"       TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "device_id"     TEXT NOT NULL,
    "expires_at"    TIMESTAMP(3) NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at"    TIMESTAMP(3),
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sessions_refresh_token_key" ON "sessions"("refresh_token");
CREATE INDEX "sessions_user_device_idx" ON "sessions"("user_id", "device_id");

-- CreateTable: devices
CREATE TABLE "devices" (
    "id"          TEXT NOT NULL,
    "user_id"     TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "platform"    "Platform" NOT NULL,
    "push_token"  TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bound_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "devices_user_fingerprint_key" ON "devices"("user_id", "fingerprint");

-- CreateTable: books
CREATE TABLE "books" (
    "id"                TEXT NOT NULL,
    "title"             TEXT NOT NULL,
    "slug"              TEXT NOT NULL,
    "author_name"       TEXT NOT NULL,
    "description"       TEXT NOT NULL,
    "cover_url"         TEXT NOT NULL,
    "content_type"      "ContentType" NOT NULL,
    "language"          TEXT NOT NULL DEFAULT 'en',
    "total_chapters"    INTEGER NOT NULL,
    "estimated_minutes" INTEGER NOT NULL,
    "is_premium"        BOOLEAN NOT NULL DEFAULT true,
    "price"             DECIMAL(10,2),
    "is_published"      BOOLEAN NOT NULL DEFAULT false,
    "published_at"      TIMESTAMP(3),
    "encrypted_file_key" TEXT NOT NULL,
    "file_iv"           TEXT NOT NULL,
    "file_auth_tag"     TEXT NOT NULL,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "books_slug_key" ON "books"("slug");
CREATE INDEX "books_published_premium_idx" ON "books"("is_published", "is_premium");

-- CreateTable: chapters
CREATE TABLE "chapters" (
    "id"            TEXT NOT NULL,
    "book_id"       TEXT NOT NULL,
    "chapter_index" INTEGER NOT NULL,
    "title"         TEXT NOT NULL,
    "word_count"    INTEGER NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "iv"            TEXT NOT NULL,
    "auth_tag"      TEXT NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "chapters_book_idx_key" ON "chapters"("book_id", "chapter_index");

-- CreateTable: subscriptions
CREATE TABLE "subscriptions" (
    "id"                     TEXT NOT NULL,
    "user_id"                TEXT NOT NULL,
    "status"                 "SubscriptionStatus" NOT NULL,
    "platform"               "Platform" NOT NULL,
    "platform_product_id"    TEXT NOT NULL,
    "platform_transaction_id" TEXT NOT NULL,
    "original_transaction_id" TEXT NOT NULL,
    "current_period_start"   TIMESTAMP(3) NOT NULL,
    "current_period_end"     TIMESTAMP(3) NOT NULL,
    "trial_start"            TIMESTAMP(3),
    "trial_end"              TIMESTAMP(3),
    "cancelled_at"           TIMESTAMP(3),
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"             TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subscriptions_user_id_key"         ON "subscriptions"("user_id");
CREATE UNIQUE INDEX "subscriptions_transaction_id_key"  ON "subscriptions"("platform_transaction_id");

-- CreateTable: offline_keys
CREATE TABLE "offline_keys" (
    "id"                       TEXT NOT NULL,
    "user_id"                  TEXT NOT NULL,
    "device_id"                TEXT NOT NULL,
    "book_id"                  TEXT NOT NULL,
    "encrypted_decryption_key" TEXT NOT NULL,
    "valid_until"              TIMESTAMP(3) NOT NULL,
    "revoked_at"               TIMESTAMP(3),
    "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "offline_keys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "offline_keys_user_device_book_key" ON "offline_keys"("user_id", "device_id", "book_id");
CREATE INDEX "offline_keys_valid_until_idx" ON "offline_keys"("valid_until");

-- CreateTable: reading_progress
CREATE TABLE "reading_progress" (
    "id"               TEXT NOT NULL,
    "user_id"          TEXT NOT NULL,
    "book_id"          TEXT NOT NULL,
    "chapter_index"    INTEGER NOT NULL DEFAULT 0,
    "scroll_position"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percent_complete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_read_seconds" INTEGER NOT NULL DEFAULT 0,
    "last_read_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at"     TIMESTAMP(3),
    CONSTRAINT "reading_progress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reading_progress_user_book_key" ON "reading_progress"("user_id", "book_id");

-- CreateTable: highlights
CREATE TABLE "highlights" (
    "id"            TEXT NOT NULL,
    "user_id"       TEXT NOT NULL,
    "book_id"       TEXT NOT NULL,
    "chapter_index" INTEGER NOT NULL,
    "start_offset"  INTEGER NOT NULL,
    "end_offset"    INTEGER NOT NULL,
    "text"          TEXT NOT NULL,
    "color"         TEXT NOT NULL DEFAULT '#FFD700',
    "note"          TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable: comments
CREATE TABLE "comments" (
    "id"         TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "book_id"    TEXT NOT NULL,
    "parent_id"  TEXT,
    "body"       TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned"  BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "comments_book_parent_idx" ON "comments"("book_id", "parent_id");

-- CreateTable: analytics_events
CREATE TABLE "analytics_events" (
    "id"          TEXT NOT NULL,
    "user_id"     TEXT,
    "book_id"     TEXT,
    "event_type"  TEXT NOT NULL,
    "properties"  JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "analytics_events_type_time_idx"  ON "analytics_events"("event_type", "occurred_at");
CREATE INDEX "analytics_events_user_time_idx"  ON "analytics_events"("user_id",    "occurred_at");
CREATE INDEX "analytics_events_book_time_idx"  ON "analytics_events"("book_id",    "occurred_at");

-- Foreign keys
ALTER TABLE "sessions"         ADD CONSTRAINT "sessions_user_id_fkey"  FOREIGN KEY ("user_id")  REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "devices"          ADD CONSTRAINT "devices_user_id_fkey"   FOREIGN KEY ("user_id")  REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "chapters"         ADD CONSTRAINT "chapters_book_id_fkey"  FOREIGN KEY ("book_id")  REFERENCES "books"("id") ON DELETE CASCADE;
ALTER TABLE "subscriptions"    ADD CONSTRAINT "subs_user_id_fkey"      FOREIGN KEY ("user_id")  REFERENCES "users"("id");
ALTER TABLE "offline_keys"     ADD CONSTRAINT "offkey_user_id_fkey"    FOREIGN KEY ("user_id")  REFERENCES "users"("id");
ALTER TABLE "offline_keys"     ADD CONSTRAINT "offkey_device_id_fkey"  FOREIGN KEY ("device_id") REFERENCES "devices"("id");
ALTER TABLE "offline_keys"     ADD CONSTRAINT "offkey_book_id_fkey"    FOREIGN KEY ("book_id")  REFERENCES "books"("id");
ALTER TABLE "reading_progress" ADD CONSTRAINT "rp_user_id_fkey"        FOREIGN KEY ("user_id")  REFERENCES "users"("id");
ALTER TABLE "reading_progress" ADD CONSTRAINT "rp_book_id_fkey"        FOREIGN KEY ("book_id")  REFERENCES "books"("id");
ALTER TABLE "highlights"       ADD CONSTRAINT "hl_user_id_fkey"        FOREIGN KEY ("user_id")  REFERENCES "users"("id");
ALTER TABLE "highlights"       ADD CONSTRAINT "hl_book_id_fkey"        FOREIGN KEY ("book_id")  REFERENCES "books"("id");
ALTER TABLE "comments"         ADD CONSTRAINT "cm_user_id_fkey"        FOREIGN KEY ("user_id")  REFERENCES "users"("id");
ALTER TABLE "comments"         ADD CONSTRAINT "cm_book_id_fkey"        FOREIGN KEY ("book_id")  REFERENCES "books"("id");
ALTER TABLE "comments"         ADD CONSTRAINT "cm_parent_id_fkey"      FOREIGN KEY ("parent_id") REFERENCES "comments"("id");
```

---

## tests/load/k6-load-test.js — Load testing with k6

```javascript
// Run with: k6 run tests/load/k6-load-test.js
// Install: brew install k6

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate    = new Rate('error_rate');
const authLatency  = new Trend('auth_latency');
const booksLatency = new Trend('books_latency');

export const options = {
  stages: [
    { duration: '1m',  target: 50  },   // Ramp up to 50 users
    { duration: '3m',  target: 200 },   // Ramp up to 200 users
    { duration: '5m',  target: 200 },   // Stay at 200
    { duration: '2m',  target: 500 },   // Spike to 500
    { duration: '2m',  target: 200 },   // Scale back
    { duration: '1m',  target: 0   },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95) < 500'],  // 95% of requests < 500ms
    http_req_failed:   ['rate < 0.01'],  // < 1% error rate
    error_rate:        ['rate < 0.01'],
  },
};

const BASE_URL = __ENV.API_URL || 'https://api.zita.app/api/v1';

// Pre-generated test tokens (set up in test environment)
const TEST_TOKEN = __ENV.TEST_TOKEN || 'test-bearer-token';

export default function () {
  // Test 1: List books (public endpoint, heaviest traffic)
  const booksStart = Date.now();
  const booksRes = http.get(`${BASE_URL}/books?page=1&limit=20`);
  booksLatency.add(Date.now() - booksStart);

  check(booksRes, {
    'books status 200':        (r) => r.status === 200,
    'books has data':          (r) => JSON.parse(r.body).success === true,
    'books no-store header':   (r) => false, // Only for content endpoints
    'books response < 200ms':  (r) => r.timings.duration < 200,
  });
  errorRate.add(booksRes.status !== 200);

  sleep(0.5);

  // Test 2: Featured books
  const featuredRes = http.get(`${BASE_URL}/books/featured`);
  check(featuredRes, {
    'featured status 200': (r) => r.status === 200,
  });

  sleep(0.5);

  // Test 3: Get current user (authenticated)
  const meStart = Date.now();
  const meRes = http.get(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
  });
  authLatency.add(Date.now() - meStart);

  check(meRes, {
    'me status 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests/load/results.json': JSON.stringify(data),
    stdout: `
╔══════════════════════════════════════════╗
║           ZITA Load Test Results          ║
╠══════════════════════════════════════════╣
║ Requests:    ${data.metrics.http_reqs.values.count}
║ Error rate:  ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
║ P50 latency: ${data.metrics.http_req_duration.values['p(50)'].toFixed(0)}ms
║ P95 latency: ${data.metrics.http_req_duration.values['p(95)'].toFixed(0)}ms
║ P99 latency: ${data.metrics.http_req_duration.values['p(99)'].toFixed(0)}ms
╚══════════════════════════════════════════╝
    `,
  };
}
```

---

## .github/workflows/mobile.yml — Flutter CI

```yaml
name: Flutter Mobile CI

on:
  push:
    branches: [main, staging]
    paths: ['zita-app/**']
  pull_request:
    branches: [main]
    paths: ['zita-app/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.16.x'
          channel: 'stable'
          cache: true

      - name: Install dependencies
        working-directory: zita-app
        run: flutter pub get

      - name: Generate code (Riverpod, Freezed)
        working-directory: zita-app
        run: flutter pub run build_runner build --delete-conflicting-outputs

      - name: Analyze
        working-directory: zita-app
        run: flutter analyze

      - name: Run tests
        working-directory: zita-app
        run: flutter test --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: zita-app/coverage/lcov.info

  build-android:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.16.x'
          cache: true

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: Build Android App Bundle
        working-directory: zita-app
        env:
          KEY_STORE_PASSWORD: ${{ secrets.ANDROID_KEY_STORE_PASSWORD }}
          KEY_PASSWORD:       ${{ secrets.ANDROID_KEY_PASSWORD }}
          KEY_ALIAS:          ${{ secrets.ANDROID_KEY_ALIAS }}
          KEY_STORE_FILE:     ${{ secrets.ANDROID_KEY_STORE_FILE }}
        run: |
          flutter build appbundle --release \
            --dart-define=API_URL=https://api.zita.app

      - name: Upload to Play Store (internal track)
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT }}
          packageName:                  com.zita.app
          releaseFiles:                 zita-app/build/app/outputs/bundle/release/*.aab
          track:                        internal

  build-ios:
    needs: test
    runs-on: macos-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.16.x'
          cache: true

      - name: Install certificates
        uses: apple-actions/import-codesign-certs@v2
        with:
          p12-file-base64: ${{ secrets.IOS_P12_BASE64 }}
          p12-password:    ${{ secrets.IOS_P12_PASSWORD }}

      - name: Build iOS IPA
        working-directory: zita-app
        run: |
          flutter build ipa --release \
            --dart-define=API_URL=https://api.zita.app \
            --export-options-plist=ios/ExportOptions.plist

      - name: Upload to TestFlight
        uses: apple-actions/upload-testflight-build@v1
        with:
          app-path:       zita-app/build/ios/ipa/*.ipa
          issuer-id:      ${{ secrets.APPSTORE_ISSUER_ID }}
          api-key-id:     ${{ secrets.APPSTORE_API_KEY_ID }}
          api-private-key: ${{ secrets.APPSTORE_API_PRIVATE_KEY }}
```

---

## PERFORMANCE BENCHMARKS (Target vs Achieved)

```
Endpoint                          Target P95   Notes
─────────────────────────────────────────────────────────────────────
GET  /books (list)                < 80ms       Cached 5min in Redis
GET  /books/featured              < 50ms       Cached 5min in Redis
GET  /books/:slug                 < 100ms      30min book meta cache
GET  /auth/me                     < 30ms       JWT verify — no DB call
POST /auth/login                  < 250ms      bcrypt.compare 12 rounds
POST /auth/refresh                < 150ms      bcrypt session lookup
GET  /books/:slug/chapters/:i     < 200ms      KMS decrypt + AES decrypt
POST /analytics/events (batch)    < 50ms       Fire-and-forget createMany
GET  /analytics/dashboard         < 800ms      7 parallel DB queries
POST /subscriptions/verify        < 3000ms     Apple/Google network call
─────────────────────────────────────────────────────────────────────

THROUGHPUT TARGETS (single ECS task, 2 vCPU / 4GB RAM):
  Read endpoints:   2,000 req/s
  Write endpoints:  500 req/s
  Content decrypt:  200 req/s   (KMS-bound)

SCALING TRIGGERS:
  CPU    > 60% → add ECS task (1-2 min)
  Queue  > 50  → add worker task
  Redis  > 80% memory → scale cache tier
```

---

## FINAL SETUP CHECKLIST

```bash
# ─── Day 1: Infrastructure ────────────────────────────────────────

# 1. AWS setup
aws configure --profile zita
terraform -chdir=infrastructure/terraform init
terraform -chdir=infrastructure/terraform apply

# 2. Generate RSA keys
bash scripts/generate-keys.sh

# 3. Upload secrets to AWS
aws secretsmanager put-secret-value \
  --secret-id zita/jwt-private-key \
  --secret-string "$(cat keys/private.pem)"

aws secretsmanager put-secret-value \
  --secret-id zita/jwt-public-key \
  --secret-string "$(cat keys/public.pem)"

# ─── Day 2: Backend deployment ────────────────────────────────────

# 4. Run database migrations
DATABASE_URL="$(aws secretsmanager get-secret-value --secret-id zita/db-url --query SecretString --output text)" \
  npx prisma migrate deploy

# 5. Seed database
DATABASE_URL="..." npx ts-node scripts/seed.ts

# 6. Deploy API + workers
docker build -t zita-api     -f Dockerfile.api     .
docker build -t zita-workers -f Dockerfile.workers .
# Push to ECR, update ECS services

# ─── Day 3: Mobile app ────────────────────────────────────────────

# 7. Configure App Store Connect
# - Create app: com.zita.app
# - Add in-app purchase: com.zita.monthly (auto-renewable subscription)
# - Add in-app purchase: com.zita.annual  (auto-renewable subscription)
# - Enable 7-day free trial on both
# - Set up server notifications URL: https://api.zita.app/api/v1/subscriptions/webhooks/apple

# 8. Configure Google Play Console
# - Create app: com.zita.app
# - Add subscription: zita_monthly
# - Add subscription: zita_annual
# - Set up real-time notifications: https://api.zita.app/api/v1/subscriptions/webhooks/google

# 9. Build and submit
flutter build ipa --release
flutter build appbundle --release

# ─── Day 4: Admin panel + monitoring ──────────────────────────────

# 10. Deploy admin panel
cd zita-admin && npm run build
# Deploy to Vercel or ECS

# 11. Set up monitoring
# - CloudWatch dashboards
# - PagerDuty integration
# - Slack webhook for alerts

# 12. Run load test
k6 run tests/load/k6-load-test.js --env API_URL=https://api.zita.app

# 13. Health check
npx ts-node scripts/health-check.ts
```
