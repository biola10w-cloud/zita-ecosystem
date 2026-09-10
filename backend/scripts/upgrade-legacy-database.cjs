// One-time, data-preserving upgrade of the legacy 0_init database.
// Credentials arrive only on stdin. Default mode is a transaction rolled back.
const { PrismaClient, Prisma } = require('@prisma/client');
const { createHash, randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const mode = process.argv[2] || 'dry-run';
const archive = 'zita_legacy_20260910';
const staging = 'zita_upgrade_20260910';
const baselineName = '20260903140000_init';
const baseline = fs.readFileSync(path.join(__dirname, '../prisma/migrations', baselineName, 'migration.sql'));
const mappings = [
  ['users', 'User'], ['devices', 'Device'], ['sessions', 'Session'],
  ['books', 'Book'], ['chapters', 'Chapter'], ['tags', 'Tag'], ['book_tags', 'BookTag'],
  ['book_translations', 'BookTranslation'], ['reading_progress', 'ReadingProgress'],
  ['highlights', 'Highlight'], ['book_likes', 'BookLike'], ['comments', 'Comment'],
  ['comment_likes', 'CommentLike'], ['reports', 'Report'], ['subscriptions', 'Subscription'],
  ['purchases', 'Purchase'], ['offline_keys', 'OfflineKey'], ['analytics_events', 'AnalyticsEvent'],
];
const q = name => '"' + name.replaceAll('"', '""') + '"';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function snapshot(tx) {
  const columns = await tx.$queryRaw`SELECT table_name, column_name, is_nullable, udt_name, column_default FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`;
  const constraints = await tx.$queryRaw`SELECT c.relname AS table_name, con.conname AS name, pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' ORDER BY c.relname, con.conname`;
  const indexes = await tx.$queryRaw`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname`;
  const enums = await tx.$queryRaw`SELECT t.typname AS name, e.enumlabel AS value FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder`;
  const tables = {};
  for (const name of [...new Set(columns.map(c => c.table_name))]) {
    // Compare data entirely in PostgreSQL. No account/session records leave the server.
    const [check] = await tx.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY to_jsonb(t)::text), '')) AS fingerprint FROM public.${q(name)} t`);
    tables[name] = check;
  }
  const migrations = await tx.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY started_at`;
  const [exceptions] = await tx.$queryRaw`SELECT (SELECT count(*)::int FROM public.users WHERE "passwordHash" IS NULL) AS missing_passwords, (SELECT count(*)::int FROM public.reports WHERE status::text = 'REVIEWED') AS reviewed_reports`;
  return { columns, constraints, indexes, enums, tables, migrations, exceptions };
}

async function upgrade(tx, expectedFingerprint) {
  await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
  await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '60s'");
  const existingSchemas = await tx.$queryRaw`SELECT schema_name FROM information_schema.schemata WHERE schema_name IN (${archive}, ${staging})`;
  if (existingSchemas.length) throw new Error('Upgrade/archive schema already exists; refusing to overwrite it.');
  // Lock the source so record verification and the switch share one consistent state.
  await tx.$executeRawUnsafe(`LOCK TABLE ${['_prisma_migrations', ...mappings.map(m => m[0])].map(t => 'public.' + q(t)).join(', ')} IN ACCESS EXCLUSIVE MODE`);
  const before = await snapshot(tx);
  if (digest(before) !== expectedFingerprint) throw new Error('Database changed since inspection. Inspect and rehearse again before upgrading.');
  const history = before.migrations;
  if (history.length !== 1 || history[0].migration_name !== '0_init' || !history[0].finished_at || history[0].rolled_back_at) {
    throw new Error('Expected exactly the successfully applied legacy 0_init migration.');
  }
  const expectedTables = ['_prisma_migrations', ...mappings.map(m => m[0])].sort();
  if (JSON.stringify(Object.keys(before.tables).sort()) !== JSON.stringify(expectedTables)) {
    throw new Error('Unexpected source tables; inspect the schema before upgrading.');
  }
  if (before.exceptions.missing_passwords) throw new Error('A legacy account has no password hash; account recovery must be planned first.');
  if (before.exceptions.reviewed_reports) throw new Error('Legacy REVIEWED reports need an explicit status mapping first.');
  await tx.$executeRawUnsafe(`CREATE SCHEMA ${q(staging)}`);
  await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${q(staging)}`);
  // This is the reviewed, generated baseline: no procedural blocks or embedded semicolons.
  for (const statement of baseline.toString('utf8').split(';').map(s => s.trim()).filter(Boolean)) {
    await tx.$executeRawUnsafe(statement);
  }
  const targetColumns = await tx.$queryRaw`SELECT table_name, column_name, udt_name, data_type FROM information_schema.columns WHERE table_schema = ${staging} ORDER BY table_name, ordinal_position`;
  const results = [];
  for (const [source, target] of mappings) {
    const oldColumns = before.columns.filter(c => c.table_name === source).map(c => c.column_name);
    const fields = [];
    const expressions = [];
    for (const column of targetColumns.filter(c => c.table_name === target)) {
      let original = column.column_name;
      if (target === 'Device' && original === 'createdAt') original = 'boundAt';
      if (target === 'Purchase' && original === 'createdAt') original = 'purchasedAt';
      if (target === 'BookTranslation' && original === 'updatedAt') original = 'createdAt';
      if (!oldColumns.includes(original)) continue; // New nullable/defaulted columns.
      let expression = q(original);
      if (column.data_type === 'USER-DEFINED') {
        if (target === 'Subscription' && original === 'platform') {
          expression = `CASE WHEN ${q(original)}::text = 'WEB' THEN 'STRIPE' ELSE ${q(original)}::text END`;
        }
        expression = `(${expression})::text::${q(staging)}.${q(column.udt_name)}`;
      }
      fields.push(q(column.column_name)); expressions.push(expression);
    }
    const select = `SELECT ${expressions.join(', ')} FROM public.${q(source)}`;
    const targetSelect = `SELECT ${fields.join(', ')} FROM ${q(staging)}.${q(target)}`;
    await tx.$executeRawUnsafe(`INSERT INTO ${q(staging)}.${q(target)} (${fields.join(', ')}) ${select}`);
    const [difference] = await tx.$queryRawUnsafe(`SELECT count(*)::int AS count FROM ((${select} EXCEPT ALL ${targetSelect}) UNION ALL (${targetSelect} EXCEPT ALL ${select})) difference`);
    const [count] = await tx.$queryRawUnsafe(`SELECT count(*)::int AS count FROM ${q(staging)}.${q(target)}`);
    if (difference.count !== 0 || count.count !== before.tables[source].count) throw new Error(`Record verification failed for ${target}`);
    results.push({ table: target, preserved: count.count });
  }
  // Keep the complete original schema, including extra legacy columns and its history.
  await tx.$executeRawUnsafe(`ALTER SCHEMA public RENAME TO ${q(archive)}`);
  await tx.$executeRawUnsafe(`ALTER SCHEMA ${q(staging)} RENAME TO public`);
  await tx.$executeRawUnsafe('SET LOCAL search_path TO public');
  // Record the exact baseline checksum atomically with the verified schema switch.
  await tx.$executeRawUnsafe(`CREATE TABLE public._prisma_migrations (LIKE ${q(archive)}._prisma_migrations INCLUDING ALL)`);
  await tx.$executeRaw`INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES (${randomUUID()}, ${createHash('sha256').update(baseline).digest('hex')}, now(), ${baselineName}, now(), 0)`;
  for (const model of Prisma.dmmf.datamodel.models) {
    // Read only a non-sensitive field through each generated delegate.
    const key = model.fields.find(f => f.isId) || model.fields.find(f => f.kind === 'scalar');
    await tx[model.name[0].toLowerCase() + model.name.slice(1)].findMany({ take: 1, select: { [key.name]: true } });
  }
  // Prove auth and catalogue writes satisfy defaults, enums, and new foreign keys.
  await tx.$executeRawUnsafe('SAVEPOINT application_write_probe');
  const user = await tx.user.create({ data: { email: `schema-probe-${randomUUID()}@example.invalid`, passwordHash: 'non-login-probe', displayName: 'Schema probe' } });
  const device = await tx.device.create({ data: { userId: user.id, fingerprint: randomUUID(), platform: 'IOS' } });
  await tx.session.create({ data: { userId: user.id, deviceId: device.id, refreshToken: randomUUID(), expiresAt: new Date(Date.now() + 60000) } });
  const category = await tx.category.create({ data: { name: 'Schema probe', slug: randomUUID() } });
  await tx.book.create({ data: { title: 'Schema probe', slug: randomUUID(), authorName: 'Schema probe', categoryId: category.id } });
  await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT application_write_probe');
  return { preserved: results, modelsVerified: Prisma.dmmf.datamodel.models.length, writeProbeRolledBack: true, archiveSchema: archive };
}

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', async () => {
  let db;
  try {
    const config = JSON.parse(input);
    db = new PrismaClient({ datasources: { db: { url: config.DATABASE_URL } } });
    if (mode === 'inspect') {
      const data = await db.$transaction(snapshot, { isolationLevel: 'RepeatableRead', timeout: 120000 });
      process.stdout.write(JSON.stringify({ fingerprint: digest(data), tables: data.tables, exceptions: data.exceptions }));
      return;
    }
    if (!['dry-run', 'apply'].includes(mode) || !config.EXPECTED_FINGERPRINT) throw new Error('Use dry-run/apply with the inspected database fingerprint.');
    let report;
    try {
      await db.$transaction(async tx => {
        report = await upgrade(tx, config.EXPECTED_FINGERPRINT);
        if (mode === 'dry-run') throw new Error('VERIFIED_ROLLBACK');
      }, { timeout: 240000, maxWait: 10000 });
    } catch (error) { if (error.message !== 'VERIFIED_ROLLBACK') throw error; }
    console.log(JSON.stringify({ mode, ...report, committed: mode === 'apply' }));
  } catch (error) {
    console.error(JSON.stringify({ error: error.name, code: error.code, message: error.code ? 'Database operation failed; transaction rolled back.' : error.message }));
    process.exitCode = 1;
  } finally { if (db) await db.$disconnect(); }
});
