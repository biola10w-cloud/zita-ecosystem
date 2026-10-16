// Schema and aggregate diagnostics only. Connection JSON is read from stdin.
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', async () => {
  const config = JSON.parse(input);
  const db = new PrismaClient({ datasources: { db: { url: config.DATABASE_URL } } });
  try {
    const columns = await db.$queryRaw`SELECT table_name, column_name, is_nullable, data_type, udt_name, column_default FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`;
    const enums = await db.$queryRaw`SELECT t.typname AS name, e.enumlabel AS value FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder`;
    const constraints = await db.$queryRaw`SELECT c.relname AS table_name, con.conname AS name, pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' ORDER BY c.relname, con.conname`;
    const indexes = await db.$queryRaw`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname`;
    const counts = [];
    for (const table of [...new Set(columns.map(c => c.table_name))]) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new Error('Unexpected table name');
      const [result] = await db.$queryRawUnsafe(`SELECT count(*)::int AS count FROM public."${table}"`);
      counts.push({ table, count: result.count });
    }
    const migrations = await db.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY started_at`;
    const report = { columns, enums, constraints, indexes, counts, migrations };
    if (config.OUTPUT_FILE) fs.writeFileSync(config.OUTPUT_FILE, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ counts, migrations, metadataSaved: !!config.OUTPUT_FILE }));
  } catch (error) {
    console.error(JSON.stringify({ error: error.name, code: error.code })); process.exitCode = 1;
  } finally { await db.$disconnect(); }
});
