# Upgrade the legacy Railway database

The original `0_init` migration created lowercase tables (`users`, `books`, and
others). The current baseline `20260903140000_init` uses Prisma model names and
adds categories, password recovery, authors, translations, and audio tables.
Running the new baseline directly against the old database is not an upgrade.

`scripts/upgrade-legacy-database.cjs` upgrades that specific legacy schema. It:

1. Requires the successfully applied `0_init` history and exact expected tables.
2. Locks the source tables and checks that their server-side fingerprints still
   match the reviewed inspection.
3. Builds the current baseline in a separate schema and copies all records,
   verifying every mapped field and row count in both directions on the server.
4. Renames `Device.boundAt` to `createdAt` and `Purchase.purchasedAt` to `createdAt`
   in the copy; initializes translation `updatedAt` from its original `createdAt`.
   Legacy `WEB` subscriptions map to the current `STRIPE` platform.
5. Refuses to guess for passwordless accounts or legacy `REVIEWED` reports.
6. Keeps the complete old schema as `zita_legacy_20260910`, including fields no
   longer used by the app. No source table or record is deleted.
7. Switches the copied schema to `public`, records the exact current baseline
   checksum in a new migration ledger, and checks the generated Prisma models.
   The original `0_init` ledger remains in the archived schema.
8. Tests account, device, session, category, and book creation in a savepoint and
   rolls back those test records. All migration steps share one transaction.

The archive is a rollback aid in the same database, not an independent disaster
recovery backup. Railway's backup API denied access during this repair. A local
record export was rejected by automatic approval review and was not performed.
No account details, password hashes, or session values are exported by the tool;
only schema metadata, counts, and aggregate fingerprints leave PostgreSQL.

## Running the tool

Pass a JSON object containing `DATABASE_URL` via stdin. Keep the connection value
in memory; never paste it into shell arguments or commit it. `inspect` returns an
aggregate `fingerprint`. Pass that as `EXPECTED_FINGERPRINT` for both subsequent
steps:

```text
node scripts/upgrade-legacy-database.cjs inspect
node scripts/upgrade-legacy-database.cjs dry-run
node scripts/upgrade-legacy-database.cjs apply
```

The default is `dry-run`, which executes all checks then rolls back. `apply` is an
explicit commit. If the database changed since inspection, the operation stops;
repeat inspection and rehearsal. An existing archive or staging schema also
stops the operation instead of overwriting anything.

After applying, verify `prisma migrate status`, compare the live `public` schema
with `schema.prisma` using `prisma migrate diff`, and check the public catalogue
endpoints. Future migrations use the existing `npm run db:migrate` workflow.

## Rollback

Before restoring the archived schema, stop application writes and account for
any records created since the upgrade. In a transaction, rename the new `public`
schema to a separate unused name and rename `zita_legacy_20260910` back to `public`.
That schema requires the legacy backend; the current backend cannot use it.
Never drop either schema as part of rollback. Keep the archive until the upgrade
is accepted and its retention has been decided explicitly.
