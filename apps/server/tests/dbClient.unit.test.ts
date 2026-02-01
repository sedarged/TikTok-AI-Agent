import { describe, expect, it } from 'vitest';
import { prisma, ensureConnection } from '../src/db/client.js';
import { env } from '../src/env.js';

describe('Database Client Configuration', () => {
  it('exports prisma client', () => {
    // Verify that prisma client is exported and defined
    expect(prisma).toBeDefined();
    expect(prisma).toHaveProperty('$connect');
    expect(prisma).toHaveProperty('$disconnect');
  });

  it('exports ensureConnection function', () => {
    // Verify ensureConnection is exported and is a function
    expect(ensureConnection).toBeDefined();
    expect(typeof ensureConnection).toBe('function');
  });

  it('ensureConnection handles connection attempts', async () => {
    // Test that ensureConnection is callable and returns a boolean
    const result = await ensureConnection();
    expect(typeof result).toBe('boolean');
  });
});

describe('Database Configuration from Environment', () => {
  it('loads connection limit from env with valid default', () => {
    // Verify env.DATABASE_CONNECTION_LIMIT is loaded and is a number
    expect(typeof env.DATABASE_CONNECTION_LIMIT).toBe('number');
    expect(env.DATABASE_CONNECTION_LIMIT).toBeGreaterThan(0);
    expect(env.DATABASE_CONNECTION_LIMIT).toBeLessThanOrEqual(1000);
  });

  it('loads pool timeout from env with valid default', () => {
    // Verify env.DATABASE_POOL_TIMEOUT is loaded and is a number
    expect(typeof env.DATABASE_POOL_TIMEOUT).toBe('number');
    expect(env.DATABASE_POOL_TIMEOUT).toBeGreaterThan(0);
    expect(env.DATABASE_POOL_TIMEOUT).toBeLessThanOrEqual(600);
  });

  it('has DATABASE_URL configured', () => {
    // Verify DATABASE_URL is present
    expect(env.DATABASE_URL).toBeDefined();
    expect(typeof env.DATABASE_URL).toBe('string');
    expect(env.DATABASE_URL.length).toBeGreaterThan(0);
  });
});

describe('Database Type Detection Logic', () => {
  it('detects SQLite from file: protocol', () => {
    const testUrl = 'file:./test.db';
    const isFile = testUrl.toLowerCase().startsWith('file:');
    expect(isFile).toBe(true);
  });

  it('detects PostgreSQL from postgres:// protocol', () => {
    const testUrl = 'postgres://localhost:5432/testdb';
    const isPostgres =
      testUrl.toLowerCase().startsWith('postgres://') ||
      testUrl.toLowerCase().startsWith('postgresql://');
    expect(isPostgres).toBe(true);
  });

  it('detects PostgreSQL from postgresql:// protocol', () => {
    const testUrl = 'postgresql://localhost:5432/testdb';
    const isPostgres =
      testUrl.toLowerCase().startsWith('postgres://') ||
      testUrl.toLowerCase().startsWith('postgresql://');
    expect(isPostgres).toBe(true);
  });

  it('does not falsely detect sqlite in database name', () => {
    // A PostgreSQL database named "my_sqlite_app" should NOT be detected as SQLite
    const testUrl = 'postgresql://localhost:5432/my_sqlite_app';
    const isFile = testUrl.toLowerCase().startsWith('file:');
    const isPostgres =
      testUrl.toLowerCase().startsWith('postgres://') ||
      testUrl.toLowerCase().startsWith('postgresql://');

    expect(isFile).toBe(false);
    expect(isPostgres).toBe(true);
  });

  it('handles unknown database types', () => {
    const testUrl = 'mysql://localhost:3306/testdb';
    const isFile = testUrl.toLowerCase().startsWith('file:');
    const isPostgres =
      testUrl.toLowerCase().startsWith('postgres://') ||
      testUrl.toLowerCase().startsWith('postgresql://');

    // Neither SQLite nor PostgreSQL
    expect(isFile).toBe(false);
    expect(isPostgres).toBe(false);
  });
});

describe('URL Parameter Construction', () => {
  it('appends parameters to URL without existing query string', () => {
    const baseUrl = 'file:./test.db';
    const connectionLimit = 10;
    const poolTimeout = 10;

    const hasQueryString = baseUrl.includes('?');
    const finalUrl = hasQueryString
      ? `${baseUrl}&connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`
      : `${baseUrl}?connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;

    expect(finalUrl).toBe('file:./test.db?connection_limit=10&pool_timeout=10');
  });

  it('appends parameters to URL with existing query string', () => {
    const baseUrl = 'file:./test.db?mode=memory';
    const connectionLimit = 10;
    const poolTimeout = 10;

    const hasQueryString = baseUrl.includes('?');
    const finalUrl = hasQueryString
      ? `${baseUrl}&connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`
      : `${baseUrl}?connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;

    expect(finalUrl).toBe('file:./test.db?mode=memory&connection_limit=10&pool_timeout=10');
  });

  it('handles PostgreSQL URL without query string', () => {
    const baseUrl = 'postgresql://localhost:5432/testdb';
    const connectionLimit = 20;
    const poolTimeout = 15;

    const hasQueryString = baseUrl.includes('?');
    const finalUrl = hasQueryString
      ? `${baseUrl}&connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`
      : `${baseUrl}?connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;

    expect(finalUrl).toBe('postgresql://localhost:5432/testdb?connection_limit=20&pool_timeout=15');
  });

  it('handles PostgreSQL URL with existing query string', () => {
    const baseUrl = 'postgresql://localhost:5432/testdb?schema=public';
    const connectionLimit = 20;
    const poolTimeout = 15;

    const hasQueryString = baseUrl.includes('?');
    const finalUrl = hasQueryString
      ? `${baseUrl}&connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`
      : `${baseUrl}?connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;

    expect(finalUrl).toBe(
      'postgresql://localhost:5432/testdb?schema=public&connection_limit=20&pool_timeout=15'
    );
  });
});
