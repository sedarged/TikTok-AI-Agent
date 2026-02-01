import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { env } from '../env.js';
import { logError, logWarn } from '../utils/logger.js';

// Warn if connection pooling variables are set (no longer used with Prisma 7 adapter)
if (env.DATABASE_CONNECTION_LIMIT !== 10 || env.DATABASE_POOL_TIMEOUT !== 10) {
  logWarn(
    'DATABASE_CONNECTION_LIMIT and DATABASE_POOL_TIMEOUT are no longer used with Prisma 7 better-sqlite3 adapter. ' +
      'These settings are ignored. Consider removing them from your environment or configuring connection pooling via the better-sqlite3 adapter options if needed.'
  );
}

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
