import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Get connection pooling configuration from env
const CONNECTION_LIMIT = process.env.DATABASE_CONNECTION_LIMIT || '10';
const POOL_TIMEOUT = process.env.DATABASE_POOL_TIMEOUT || '10';

// Detect database type from DATABASE_URL
function getDatabaseType(): 'sqlite' | 'postgresql' | 'unknown' {
  const url = (process.env.DATABASE_URL || '').toLowerCase();
  if (url.startsWith('file:')) {
    return 'sqlite';
  }
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return 'postgresql';
  }
  return 'unknown';
}

const dbType = getDatabaseType();

// Build database URL with connection pooling parameters
function buildDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL || 'file:./dev.db';

  // For SQLite and PostgreSQL, add connection pooling parameters to the URL
  if (dbType === 'sqlite' || dbType === 'postgresql') {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}connection_limit=${CONNECTION_LIMIT}&pool_timeout=${POOL_TIMEOUT}`;
  }

  return baseUrl;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: buildDatabaseUrl(),
  },
});
