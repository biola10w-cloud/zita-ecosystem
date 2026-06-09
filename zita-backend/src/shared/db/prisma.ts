import { PrismaClient } from '@prisma/client';
import { config } from '../../config';

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: config.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    errorFormat: 'minimal',
  });

if (config.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

process.on('beforeExit', async () => { await prisma.$disconnect(); });
