# Production Release Runbook

Use separate production services for the backend API, backend worker, reader,
and admin app. Keep all secret values in the provider dashboards, never in Git.

## 1. Provision and Configure the Backend

1. Create managed PostgreSQL and Redis services. Use their TLS connection URLs
   for `DATABASE_URL` and `REDIS_URL`.
2. Create a private S3/R2 bucket, an AWS KMS symmetric key, and credentials
   limited to that bucket plus KMS encrypt/decrypt permissions.
3. Create API and Worker services from the `backend/` directory. Set their
   commands to `npm start` and `npm run workers:start` respectively.
4. Set every required value in `backend/.env.example` on both services. Set
   `NODE_ENV=production`, the public `API_BASE_URL`, production `CORS_ORIGINS`,
   and inline JWT PEM values or mounted key paths.
5. Add the Stripe webhook endpoint:
   `https://api.your-domain.com/api/v1/subscriptions/webhooks/stripe`.
6. Enable SendGrid, Sentry, CDN, translation, and native purchase credentials
   only when those integrations are being offered to clients.

## 2. Deploy Web Applications

1. Create two Vercel projects pointing to this repository, with root
   directories `client` and `admin`.
2. Set `API_BASE_URL=https://api.your-domain.com/api/v1` in each project for
   Production and Preview environments.
3. Assign distinct production domains, then add both exact origins to the
   backend `CORS_ORIGINS` value and redeploy the API.

## 3. Initialize the Database

For a new database, run `npm run db:migrate` from the backend service shell.
For a database created before migration history was introduced, back it up,
confirm its schema, then run the one-time baseline command in
`backend/DEPLOYMENT.md` before future `npm run db:migrate` deploys.

## 4. Go-Live Checks

1. Confirm API health and worker logs are both clean after deployment.
2. Publish one DOCX as an admin, then read it using a non-admin account.
3. Confirm the original document has no public or client download URL.
4. Run a password reset email and a Stripe test transaction before enabling
   live payment collection.
