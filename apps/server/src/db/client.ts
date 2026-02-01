import { PrismaClient } from '@prisma/client';
import { env } from '../env.js';
import { logError } from '../utils/logger.js';

// Create Prisma client with logging configuration
// Connection URL and pooling are configured in prisma.config.ts for Prisma 7
export const prisma = new PrismaClient({
  log:
    env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : env.NODE_ENV === 'test'
        ? ['error']
        : ['error', 'warn'],
});

export async function ensureConnection() {
  try {
    await prisma.$connect();
    return true;
  } catch (error) {
    logError('Database connection failed', error);
    return false;
  }
}
