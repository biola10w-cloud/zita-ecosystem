/**
 * Bootstrap or promote an admin account.
 *
 * Usage:
 *   npm run make-admin -- <email> <password> ["Display Name"]
 *
 * - If the email doesn't exist, creates a new user with role=ADMIN.
 * - If it already exists, promotes it to ADMIN (and updates the
 *   password if one is provided).
 *
 * This exists because the API's role-change endpoint
 * (PUT /api/v1/admin/users/:id/role) itself requires an existing admin —
 * so the very first admin has to be created directly against the DB.
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12; // Matches AuthService

async function main() {
  const [email, password, displayName] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: npm run make-admin -- <email> <password> ["Display Name"]');
    process.exitCode = 1;
    return;
  }

  const normalisedEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email: normalisedEmail },
    create: {
      email: normalisedEmail,
      passwordHash,
      displayName: displayName?.trim() || 'Admin',
      role: 'ADMIN',
    },
    update: {
      role: 'ADMIN',
      passwordHash,
    },
  });

  console.log(`✅ ${user.email} is now an ADMIN (id: ${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
