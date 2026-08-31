# ZITA Backend - Complete Testing & CI/CD Guide

## 📋 Overview

This guide covers the complete testing infrastructure for the ZITA backend, including:
- **Unit Tests**: Service layer testing (Auth, Books, Reader, Community, Subscriptions, Encryption)
- **Integration Tests**: Full API endpoint testing
- **CI/CD Pipelines**: GitHub Actions & GitLab CI setup
- **Deployment Strategies**: Staging & Production environments

---

## 🧪 Testing Infrastructure

### Test Files Structure

```
backend/
├── src/
│   ├── shared/
│   │   └── encryption/
│   │       └── bookCrypto.test.ts              (22 tests - 100% passing)
│   ├── modules/
│   │   ├── auth/
│   │   │   └── auth.service.test.ts            (16 tests - 100% passing)
│   │   ├── books/
│   │   │   └── books.service.test.ts           (15 tests - 100% passing)
│   │   ├── reader/
│   │   │   └── reader.service.test.ts          (18 tests - NEW)
│   │   ├── community/
│   │   │   └── community.service.test.ts       (26 tests - NEW)
│   │   └── subscriptions/
│   │       └── subscriptions.service.test.ts   (27 tests - NEW)
│   └── integration.test.ts                      (45 tests - NEW)
├── vitest.config.ts
└── package.json
```

### Test Coverage Summary

| Module | Tests | Status | Coverage |
|--------|-------|--------|----------|
| Encryption (BookCrypto) | 22 | ✅ 100% | 22/22 |
| Authentication | 16 | ✅ 100% | 16/16 |
| Books | 15 | ✅ 100% | 15/15 |
| **Reader (NEW)** | **18** | **NEW** | - |
| **Community (NEW)** | **26** | **NEW** | - |
| **Subscriptions (NEW)** | **27** | **NEW** | - |
| **API Integration (NEW)** | **45** | **NEW** | - |
| **TOTAL** | **169** | **NEW** | **- |

---

## 🚀 Running Tests Locally

### Prerequisites

```bash
# Install Node.js 24.19.0 or later
node --version

# Install npm dependencies
cd backend
npm install

# Ensure Docker containers are running
docker-compose up -d

# Generate JWT test keys
mkdir -p keys
openssl genrsa -out keys/test-jwt-secret.key 2048
openssl rsa -in keys/test-jwt-secret.key -pubout -out keys/test-jwt-public.key
```

### Environment Setup

Create `.env` file in `backend/` directory:

```env
NODE_ENV=test
DATABASE_URL=postgresql://test:testpass@localhost:5432/zita_test
REDIS_URL=redis://localhost:6379
JWT_SECRET_KEY_PATH=./keys/test-jwt-secret.key
JWT_PUBLIC_KEY_PATH=./keys/test-jwt-public.key
KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789012:key/test-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=zita-test-bucket
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

### Running Tests

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- src/modules/auth/auth.service.test.ts

# Run tests matching pattern
npm run test -- --grep "Reading Progress"

# Watch mode (re-run on file changes)
npm run test -- --watch

# Run tests with UI
npm run test -- --ui
```

### Test Commands

```bash
# In backend/package.json
"scripts": {
  "test": "vitest run",
  "test:coverage": "vitest run --coverage",
  "test:watch": "vitest",
  "test:ui": "vitest --ui"
}
```

---

## 📊 Test Suite Details

### 1. **Reader Module Tests** (18 tests)

Tests reading progress tracking and highlighting functionality.

**Test Groups:**
- **Reading Progress** (6 tests)
  - Save progress tracking
  - Update on subsequent saves
  - Mark book as completed
  - Percent complete calculation
  - Retrieve progress
  - Handle missing progress

- **Highlights** (9 tests)
  - Save with valid data
  - Save with optional note
  - Default color assignment
  - List highlights
  - Empty list handling
  - Text length validation (max 2000)
  - Note length validation (max 500)
  - Multiple highlights per chapter
  - Preserve offset positions

- **Access Control** (2 tests)
  - Allow access to free books
  - Validate chapter bounds
  - Verify book existence

- **Analytics** (2 tests)
  - Track last read timestamp
  - Update timestamps on subsequent reads

### 2. **Community Module Tests** (26 tests)

Tests comment threads, likes, and reporting.

**Test Groups:**
- **Comments CRUD** (7 tests)
  - Create top-level comments
  - Create replies
  - Prevent deep nesting
  - Validate body length
  - Update by author
  - Authorization checks
  - Soft delete functionality

- **Comment Likes** (4 tests)
  - Like a comment
  - Unlike a comment
  - Idempotent behavior
  - Track like counts

- **Comment Listing** (5 tests)
  - Pagination support
  - Sort by recent
  - Sort by popular (likes)
  - Exclude deleted comments
  - Include user information
  - Include first 3 replies inline

- **Comment Reporting** (6 tests)
  - Report comments
  - Prevent duplicate reports
  - Allow different users to report
  - Validate report reasons
  - Accept report details
  - Validate details length

- **Comment Replies** (3 tests)
  - Paginated replies
  - Order by creation time
  - Handle no replies

### 3. **Subscriptions Module Tests** (27 tests)

Tests IAP verification for Apple and Google platforms.

**Test Groups:**
- **Apple IAP Verification** (4 tests)
  - Verify receipt and create subscription
  - Handle trial subscriptions
  - Handle cancelled subscriptions
  - Update existing subscriptions (idempotent)

- **Google IAP Verification** (4 tests)
  - Verify purchase token
  - Handle trial subscriptions
  - Handle payment pending
  - Handle auto-renewing cancellation

- **Subscription Retrieval** (3 tests)
  - Get active subscription
  - Return null for no subscription
  - Return regardless of status

- **Apple Notifications** (4 tests)
  - Handle DID_RENEW
  - Handle CANCEL
  - Handle DID_FAIL_TO_RENEW

- **Google Notifications** (2 tests)
  - Handle renewal notifications
  - Handle cancellation notifications

- **Subscription Status Transitions** (2 tests)
  - TRIALING → ACTIVE
  - ACTIVE → PAST_DUE on billing failure

- **Additional Coverage** (8 tests)
  - Various edge cases and state transitions

### 4. **Integration Tests** (45 tests)

Tests complete API endpoints end-to-end.

**Test Groups:**
- **Auth Endpoints** (3 tests)
  - GET /auth/me
  - Authentication requirement
  - POST /auth/logout

- **Books Endpoints** (7 tests)
  - GET /books (list with pagination)
  - GET /books/:slug
  - 404 handling
  - Featured books
  - Trending books
  - Filtering (language, type)

- **Reading Progress** (4 tests)
  - POST /books/:slug/progress
  - GET /books/:slug/progress
  - Null handling
  - Authentication requirement

- **Highlights** (3 tests)
  - POST /books/:slug/highlights
  - GET /books/:slug/highlights
  - Authentication requirement

- **Comments** (7 tests)
  - POST /books/:slug/comments
  - GET /books/:slug/comments
  - Replies
  - POST /comments/:id/like
  - DELETE /comments/:id/like
  - POST /comments/:id/report

- **Subscriptions** (3 tests)
  - GET /subscriptions/plans
  - GET /subscriptions/me
  - Authentication requirement

- **Book Likes** (3 tests)
  - POST /books/:slug/like
  - DELETE /books/:slug/like
  - Authentication requirement

- **Health Check** (1 test)
  - GET /health

- **Error Handling** (3 tests)
  - Bad request format
  - 404 for non-existent
  - Rate limiting

- **CORS & Security** (1 test)
  - Security headers

- **Pagination** (2 tests)
  - Pagination parameters
  - Validation

- **Request Validation** (2 tests)
  - Invalid JSON rejection
  - Oversized payload rejection

---

## 🔄 CI/CD Pipeline Setup

### GitHub Actions Pipeline

**File**: `.github/workflows/backend-cicd.yml`

**Stages:**

1. **🔍 Lint** (Always runs)
   - ESLint checks
   - TypeScript type checking
   - Format validation

2. **🧪 Test** (Requires: Lint)
   - Run on PostgreSQL + Redis services
   - Generate coverage reports
   - Upload to Codecov

3. **🔨 Build** (Requires: Test)
   - Docker build & push
   - Only pushes on main branch
   - Tags: branch, semver, sha, latest

4. **🔐 Security** (Parallel)
   - npm audit vulnerability scan
   - SNYK security scanning
   - Continues on failure

5. **📊 Quality Gate** (Requires: Test, Lint)
   - SonarQube code quality scan
   - Coverage thresholds
   - Continues on failure

6. **🚀 Deploy to Staging** (Requires: All above)
   - Only runs on `develop` branch
   - Uses SSH deployment
   - Runs Prisma migrations

7. **🚀 Deploy to Production** (Requires: All above)
   - Only runs on `main` branch
   - Environment protection rules
   - Slack notification
   - Runs Prisma migrations

### GitLab CI Pipeline

**File**: `backend/.gitlab-ci.yml`

**Stages:**

1. **lint**: ESLint & TypeScript check
2. **test**: Vitest with PostgreSQL/Redis services
3. **build**: Docker image build & registry push
4. **security**: SAST, dependency scanning, npm audit
5. **deploy-staging**: Manual trigger deployment to staging
6. **deploy-production**: Manual trigger deployment to production

---

## 🔑 Required GitHub Secrets

Set these secrets in repository settings (`Settings → Secrets and variables`):

```
SNYK_TOKEN                  # Snyk security scanning token
SONAR_TOKEN                 # SonarQube token
CODECOV_TOKEN              # Codecov.io token
STAGING_DEPLOY_KEY         # SSH private key for staging server
STAGING_HOST               # Staging server hostname/IP
STAGING_USER               # SSH user for staging
PROD_DEPLOY_KEY            # SSH private key for production
PROD_HOST                  # Production server hostname/IP
PROD_USER                  # SSH user for production
SLACK_WEBHOOK              # Slack webhook URL for notifications
```

---

## 🔑 Required GitLab CI Variables

Set these in GitLab repository settings (`Settings → CI/CD → Variables`):

```
SNYK_TOKEN                 # Snyk security token
STAGING_DEPLOY_KEY         # SSH private key
STAGING_HOST               # Staging hostname
STAGING_USER               # SSH user
PROD_DEPLOY_KEY            # SSH private key
PROD_HOST                  # Production hostname
PROD_USER                  # SSH user
SLACK_WEBHOOK              # Slack webhook URL
```

---

## 📈 Monitoring & Reporting

### Coverage Reports

Coverage reports are generated and uploaded to Codecov:

```bash
# Local coverage
npm run test:coverage

# Reports generated in:
coverage/coverage-final.json    # Cobertura format
coverage/index.html             # HTML report
```

### GitHub Actions Reports

- **Pull Requests**: Inline comments with test results
- **Workflow Runs**: Detailed logs in Actions tab
- **Codecov**: Coverage trends and badges
- **SonarQube**: Code quality metrics dashboard

### GitLab CI Reports

- **Merge Requests**: Test results & coverage % in UI
- **Pipelines**: Job logs and artifacts
- **Pages**: Coverage report published to GitLab Pages
- **Security**: SAST & dependency scanning reports

---

## 🛠️ Troubleshooting

### Tests Failing in CI but Passing Locally

**Cause**: Database state, environment variables, or timing issues

**Solutions:**
1. Check DATABASE_URL matches test configuration
2. Ensure PostgreSQL & Redis services are healthy
3. Review test isolation (beforeEach/afterAll cleanup)
4. Check for race conditions with async operations

### Docker Build Failures

**Cause**: Missing dependencies or build arguments

**Solutions:**
1. Ensure all npm dependencies installed: `npm ci`
2. Check Node version matches: 24.19.0
3. Verify .env file exists with required variables
4. Check Dockerfile references correct files

### Deployment Failures

**Cause**: SSH keys, server connectivity, or Prisma migrations

**Solutions:**
1. Verify SSH keys are valid and loaded
2. Test SSH connection manually: `ssh -i key user@host`
3. Check Prisma migrations have no pending changes
4. Verify disk space and memory on target server
5. Review application logs: `pm2 logs zita-backend`

### Rate Limiting Issues

**Cause**: Too many API requests in tests

**Solutions:**
1. Add delays between requests if needed
2. Use test-specific rate limit keys
3. Mock external APIs that trigger rate limits
4. Parallelize tests carefully to avoid thundering herd

---

## 📚 Additional Resources

### Test Documentation
- [Vitest Documentation](https://vitest.dev)
- [Testing Library Best Practices](https://testing-library.com)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing/testing-databases)

### CI/CD Documentation
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [GitLab CI/CD Docs](https://docs.gitlab.com/ee/ci/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

### Security & Quality
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [SonarQube Quality Standards](https://docs.sonarqube.org)
- [SNYK Security Scanning](https://snyk.io/docs/)

---

## ✅ Deployment Checklist

Before deploying to production:

- [ ] All tests passing (169/169)
- [ ] Code coverage above 80%
- [ ] No critical security vulnerabilities
- [ ] SonarQube quality gate passed
- [ ] Staging deployment successful
- [ ] Database migrations tested
- [ ] Secrets configured in target environment
- [ ] Rollback plan documented
- [ ] Monitoring & alerts configured
- [ ] Team notified of deployment

---

## 📞 Support

For issues or questions:
1. Check test logs: `npm run test -- --reporter=verbose`
2. Review CI/CD workflow output in GitHub/GitLab
3. Consult documentation links above
4. Contact development team with error details

---

**Last Updated**: 2026-08-31
**Test Framework**: Vitest v1.6.1
**Node.js Version**: 24.19.0
**Total Test Count**: 169
