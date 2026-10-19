import { prisma } from '../../shared/db/prisma';

// Explicit email allowlist only; an empty list never unlocks paid content.
export async function readingTestAccess(userId: string): Promise<boolean> {
  const emails = (process.env.READING_TEST_EMAILS ?? '').split(',')
    .map(email => email.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return !!user && emails.includes(user.email.trim().toLowerCase());
}
