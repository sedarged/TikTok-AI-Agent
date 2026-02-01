import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { env } from '../env.js';
import { logError } from '../utils/logger.js';

// Create database adapter for Prisma 7
// The adapter is required because Prisma 7 separates connection config
// from the schema file to prisma.config.ts (for migrations) and runtime (here)
// Pass the database URL directly to the adapter
const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL });

// Create Prisma client with adapter and logging configuration
export const prisma = new PrismaClient({
  adapter,
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
