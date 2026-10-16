// Explicitly requested admin reset. Connection and generated password stay in memory.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', async () => {
  const vars = JSON.parse(input);
  const db = new PrismaClient({ datasources: { db: { url: vars.DATABASE_PUBLIC_URL } } });
  const email = 'admin@zita.app';
  const password = `Zita!${crypto.randomBytes(18).toString('base64url')}7a`;
  let reset = false;
  try {
    const user = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true } });
    if (user.role !== 'ADMIN') throw new Error('Expected admin account');
    const passwordHash = await bcrypt.hash(password, 12);
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash } }),
      db.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      db.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    ]);
    reset = true;
    const response = await fetch('https://zita-admin-production.up.railway.app/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    const verified = response.status === 200 && body.data?.user?.role === 'ADMIN';
    // Revoke the verification refresh session; no authentication cookies are output.
    await db.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    console.log(JSON.stringify({ reset: true, loginVerified: verified, status: response.status, email, password }));
  } catch (error) {
    console.log(JSON.stringify({ reset, loginVerified: false, error: error.name, ...(reset ? { email, password } : {}) }));
    process.exitCode = 1;
  } finally { await db.$disconnect(); }
});
