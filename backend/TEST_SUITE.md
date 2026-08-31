# ZITA Backend Test Suite

## Overview
Comprehensive test suites have been created for the core ZITA backend modules. The tests are built with **Vitest** and follow best practices for integration testing with a real PostgreSQL database.

---

## Test Files Created

### 1. **Auth Service Tests** 
📁 Location: `src/modules/auth/auth.service.test.ts`

**Tests Implemented:**
- ✅ Registration
  - Successful user registration
  - Email normalization to lowercase
  - Password hashing with bcrypt
  - Device record creation
  - Duplicate email rejection
  
- ✅ Login
  - Successful login with correct credentials
  - Invalid password rejection
  - Non-existent email rejection
  - Device lastSeenAt update
  - Email normalization
  
- ✅ Token Refresh
  - Token refresh with valid token
  - Invalid token rejection
  - Session revocation on refresh
  - Single-use refresh token enforcement
  
- ✅ Logout
  - Successful logout
  - Multiple session revocation per device

**Coverage:** 16 test cases

---

### 2. **Books Service Tests**
📁 Location: `src/modules/books/books.service.test.ts`

**Tests Implemented:**
- ✅ List Books
  - Book listing with pagination
  - Filtering by type (BOOK, STORY, SUMMARY)
  - Filtering by language
  - Pagination correctness
  - Total count accuracy
  - Publish date ordering (descending)
  
- ✅ Featured Books
  - Featured book retrieval
  - Published-only filtering
  
- ✅ Trending Books
  - Trending book retrieval based on activity
  - Engagement metrics
  
- ✅ Book Formatting
  - Proper book data formatting
  
- ✅ Get Book by Slug
  - Slug-based book retrieval
  - Non-existent slug handling
  
- ✅ Get Book by ID
  - ID-based book retrieval
  - Non-existent ID handling

**Coverage:** 13 test cases

---

### 3. **Book Encryption Tests**
📁 Location: `src/shared/encryption/bookCrypto.test.ts`

**Tests Implemented:**
- ✅ Key Generation
  - Valid key generation
  - Unique key generation
  - Proper hex encoding
  
- ✅ Encryption
  - String encryption
  - Buffer encryption
  - Unique IV per encryption
  - Different ciphertexts for same plaintext
  - Proper IV/auth tag formatting
  - Large content encryption
  - Empty string handling
  
- ✅ Decryption
  - Successful decryption
  - Buffer content decryption
  - Wrong key rejection
  - Tampered auth tag detection
  - Tampered ciphertext detection
  - Tampered IV detection
  - Large content decryption
  
- ✅ Round-trip Testing
  - Data integrity after encrypt/decrypt
  - Consistent decryption results
  
- ✅ Security Properties
  - AES-256-GCM algorithm verification
  - 96-bit nonce size validation
  - IV randomization/nonce reuse prevention

**Coverage:** 25 test cases

---

## Running the Tests

### Prerequisites
- Docker Desktop (for PostgreSQL & Redis)
- Node.js 20+
- npm or yarn

### Setup Instructions

1. **Start Database Services:**
```bash
cd backend
docker-compose up -d
```

2. **Install Dependencies:**
```bash
npm install
```

3. **Generate Prisma Client:**
```bash
npm run db:generate
```

4. **Run Database Migrations (optional):**
```bash
npm run db:migrate
```

### Run Tests

**Run all tests:**
```bash
npm run test
```

**Run tests in watch mode:**
```bash
npm run test:watch
```

**Run specific test file:**
```bash
npm run test -- auth.service.test.ts
```

**Run with coverage:**
```bash
npm run test -- --coverage
```

---

## Test Statistics

| Module | Test File | Test Cases | Status |
|--------|-----------|-----------|--------|
| Auth | auth.service.test.ts | 16 | ✅ Ready |
| Books | books.service.test.ts | 13 | ✅ Ready |
| Encryption | bookCrypto.test.ts | 25 | ✅ Ready |
| **Total** | - | **54** | **✅ Ready** |

---

## Key Testing Patterns

### 1. **Database Transaction Tests**
All tests use `beforeEach` and `afterAll` hooks to ensure clean database state.

```typescript
beforeEach(async () => {
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### 2. **Error Handling**
Tests verify both success and failure paths:
- Invalid credentials
- Duplicate entries
- Tampered data
- Missing resources

### 3. **Security Testing**
Encryption tests specifically verify:
- Authentication tag validation (tampering detection)
- Key isolation (wrong key rejection)
- Nonce randomization (replay attack prevention)
- Algorithm correctness (AES-256-GCM)

### 4. **Integration Testing**
Tests interact with real Prisma models and database, not mocks, ensuring:
- Database constraints are validated
- Transactions work correctly
- Relationships are preserved

---

## Next Steps

### Recommended Additional Tests

1. **Reader Module Tests**
   - Reading progress tracking
   - Bookmark management
   - Highlight creation/deletion

2. **Community Module Tests**
   - Comment creation/moderation
   - User following
   - Social interactions

3. **Subscription Module Tests**
   - Apple IAP verification
   - Google IAP verification
   - Subscription state transitions

4. **Middleware Tests**
   - JWT authentication
   - Rate limiting
   - Error handling

5. **Integration Tests**
   - Full API endpoint testing
   - Authentication flow
   - Book purchase and access flow

---

## Notes

- **Environment Variables:** All tests use the `.env` file configuration. Ensure your `.env` has valid database credentials.
- **Database State:** Tests clean up after themselves, but if interrupted, may leave test data in the database.
- **Performance:** Full test suite should complete in < 30 seconds with a local PostgreSQL instance.
- **Coverage:** Current tests focus on happy paths and critical error cases. Additional edge case testing can be added as needed.

---

## Troubleshooting

### Tests Won't Start
1. Verify Docker containers are running: `docker ps`
2. Check database connection: `psql postgresql://zita:zita_dev_password@localhost:5432/zita_db`
3. Ensure `.env` file exists in the `backend` directory

### Test Timeouts
1. Increase Vitest timeout in `vitest.config.ts`
2. Check if PostgreSQL/Redis are responding
3. Look for long-running queries in the database

### Database Constraints Violated
1. Manual cleanup may be needed: `docker-compose down -v && docker-compose up -d`
2. Ensure previous test run completed fully
3. Check for unique constraint issues in logs

---

Generated: 2024 | ZITA Backend Test Suite
