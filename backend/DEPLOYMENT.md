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
4. Run `npm run db:migrate` against the empty local database.

## Database Migration Rollout

New environments apply the checked-in migration history with:

```sh
npm run db:migrate
```

For an existing staging or production database that was previously initialized
with `prisma db push`, take a verified backup, confirm it matches the current
schema, then mark the baseline migration as applied once:

```sh
npx prisma migrate resolve --applied 20260903140000_init
```

Do not run this baseline command against a new database. All subsequent deploys
should use `npm run db:migrate` only.

Before opening the pilot, exercise an upload through publishing and read the
result with a non-admin test user.
