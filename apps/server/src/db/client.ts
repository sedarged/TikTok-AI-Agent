import { PrismaClient } from '@prisma/client';
import { env } from '../env.js';
import { logError, logWarn } from '../utils/logger.js';

// Detect database type from DATABASE_URL
function getDatabaseType(): 'sqlite' | 'postgresql' | 'unknown' {
  const url = env.DATABASE_URL.toLowerCase();
  if (url.startsWith('file:')) {
    return 'sqlite';
  }
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return 'postgresql';
  }
  return 'unknown';
}

const dbType = getDatabaseType();

// Warn if connection pooling is configured but database type is unknown
if (
  dbType === 'unknown' &&
  (process.env.DATABASE_CONNECTION_LIMIT || process.env.DATABASE_POOL_TIMEOUT)
) {
  logWarn(
    `DATABASE_CONNECTION_LIMIT or DATABASE_POOL_TIMEOUT is set, but database type could not be determined from DATABASE_URL: ${env.DATABASE_URL}. Connection pooling configuration will be ignored.`
  );
}

// Get connection pooling configuration from env
const CONNECTION_LIMIT = env.DATABASE_CONNECTION_LIMIT;
const POOL_TIMEOUT = env.DATABASE_POOL_TIMEOUT;

// Create Prisma client with logging and connection pooling configuration
export const prisma = new PrismaClient({
  log:
    env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : env.NODE_ENV === 'test'
        ? ['error']
        : ['error', 'warn'],
  // SQLite-specific connection configuration
  ...(dbType === 'sqlite' && {
    // SQLite connection_limit and pool_timeout are configured via URL params
    // See: https://www.prisma.io/docs/concepts/database-connectors/sqlite
    datasources: {
      db: {
        url: env.DATABASE_URL.includes('?')
          ? `${env.DATABASE_URL}&connection_limit=${CONNECTION_LIMIT}&pool_timeout=${POOL_TIMEOUT}`
          : `${env.DATABASE_URL}?connection_limit=${CONNECTION_LIMIT}&pool_timeout=${POOL_TIMEOUT}`,
      },
    },
  }),
  // PostgreSQL-specific connection configuration
  ...(dbType === 'postgresql' && {
    // PostgreSQL connection pooling is configured via URL params
    // See: https://www.prisma.io/docs/concepts/database-connectors/postgresql
    datasources: {
      db: {
        url: env.DATABASE_URL.includes('?')
          ? `${env.DATABASE_URL}&connection_limit=${CONNECTION_LIMIT}&pool_timeout=${POOL_TIMEOUT}`
          : `${env.DATABASE_URL}?connection_limit=${CONNECTION_LIMIT}&pool_timeout=${POOL_TIMEOUT}`,
      },
    },
  }),
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
