import { PrismaClient } from '@prisma/client';
import { env } from '../env.js';
import { logError } from '../utils/logger.js';

// Detect database type from DATABASE_URL
function getDatabaseType(): 'sqlite' | 'postgresql' | 'unknown' {
  const url = env.DATABASE_URL.toLowerCase();
  if (url.startsWith('file:') || url.includes('sqlite')) {
    return 'sqlite';
  }
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return 'postgresql';
  }
  return 'unknown';
}

const dbType = getDatabaseType();

// Get connection pooling configuration from env or use defaults
const CONNECTION_LIMIT = parseInt(process.env.DATABASE_CONNECTION_LIMIT || '10', 10);
const POOL_TIMEOUT = parseInt(process.env.DATABASE_POOL_TIMEOUT || '10', 10);

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
        url: (() => {
          const url = env.DATABASE_URL;
          const hasQueryString = url.includes('?');
          const params = [
            `connection_limit=${CONNECTION_LIMIT}`,
            `pool_timeout=${POOL_TIMEOUT}`,
          ].join('&');
          return hasQueryString ? `${url}&${params}` : `${url}?${params}`;
        })(),
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
