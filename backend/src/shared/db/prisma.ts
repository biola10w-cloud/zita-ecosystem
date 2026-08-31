import { PrismaClient } from '@prisma/client';
import { config } from '../../config';

// Singleton pattern â€” critical for serverless/long-running processes
// to avoid connection pool exhaustion.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: config.NODE_ENV === 'development'
      ? ['query', 'warn', 'error']
      : ['warn', 'error'],
    errorFormat: 'minimal',
  });

if (config.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
