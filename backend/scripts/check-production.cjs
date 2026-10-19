// Read-only diagnostics. Supply Railway variables as JSON on stdin; never log them.
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { KMSClient, DescribeKeyCommand } = require('@aws-sdk/client-kms');
const { PrismaClient } = require('@prisma/client');
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', async () => {
  const vars = JSON.parse(input);
  const settings = {
    region: vars.AWS_REGION || 'us-east-1', maxAttempts: 1,
    credentials: { accessKeyId: vars.AWS_ACCESS_KEY_ID, secretAccessKey: vars.AWS_SECRET_ACCESS_KEY },
  };
  for (const [name, client, command] of (vars.DATABASE_ONLY ? [] : [
    ['S3 bucket', new S3Client({ ...settings, ...(vars.S3_ENDPOINT ? { endpoint: vars.S3_ENDPOINT } : {}) }), new HeadBucketCommand({ Bucket: vars.S3_BUCKET_NAME })],
    ['KMS key', new KMSClient(settings), new DescribeKeyCommand({ KeyId: vars.KMS_KEY_ARN })],
  ])) {
    try {
      const result = await client.send(command, { abortSignal: AbortSignal.timeout(20000) });
      console.log(JSON.stringify({ check: name, ok: true, ...(result.KeyMetadata ? {
        enabled: result.KeyMetadata.Enabled, keyUsage: result.KeyMetadata.KeyUsage, keySpec: result.KeyMetadata.KeySpec,
      } : {}) }));
    } catch (error) {
      console.log(JSON.stringify({ check: name, ok: false, error: error.name, status: error.$metadata?.httpStatusCode }));
    } finally { client.destroy(); }
  }
  if (vars.DIAGNOSTIC_DATABASE_URL) {
    const prisma = new PrismaClient({ datasources: { db: { url: vars.DIAGNOSTIC_DATABASE_URL } } });
    try {
      const tables = await prisma.$queryRaw`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name`;
      console.log(JSON.stringify({ check: 'Database tables', tables }));
      if (tables.some(table => table.table_name === '_prisma_migrations')) {
        const migrations = await prisma.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY started_at`;
        console.log(JSON.stringify({ check: 'Migration history', migrations }));
      }
    } catch (error) {
      console.log(JSON.stringify({ check: 'Database tables', ok: false, error: error.name, code: error.code }));
    } finally { await prisma.$disconnect(); }
  }
});
