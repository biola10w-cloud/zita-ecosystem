// Read only: print admin login emails, never password hashes or session data.
const { PrismaClient } = require('@prisma/client');
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', async () => {
  const variables = JSON.parse(input);
  const db = new PrismaClient({ datasources: { db: { url: variables.DATABASE_PUBLIC_URL } } });
  try {
    const admins = await db.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } });
    console.log(JSON.stringify({ admins }));
  } catch (error) {
    console.log(JSON.stringify({ error: error.name }));
    process.exitCode = 1;
  } finally { await db.$disconnect(); }
});
