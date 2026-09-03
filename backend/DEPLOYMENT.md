# Backend Deployment

The API and workers are separate processes. Deploy both from the same backend
image and give each process the same production environment variables.

## Railway

Create two services from `backend/`:

| Service | Start command |
| --- | --- |
| API | `npm start` |
| Worker | `npm run workers:start` |

The worker requires the same `DATABASE_URL`, `REDIS_URL`, AWS/R2, KMS, and JWT
configuration as the API. Set `KMS_ENCRYPTION_ALGORITHM=SYMMETRIC_DEFAULT`
unless an RSA KMS key was intentionally provisioned.

## Local Verification

1. Copy `.env.example` to `.env` and set real development-safe integration
   values.
2. Ensure development JWT PEM files exist in `keys/`.
3. Run `docker compose up --build`.
4. Run `npm run db:push:prod` only against an empty local database. Use checked
   migrations, not `db push`, for staging or production.

Before opening the pilot, exercise an upload through publishing and read the
result with a non-admin test user.
