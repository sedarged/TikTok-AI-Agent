import { describe, expect, it } from 'vitest';
import { prisma, ensureConnection } from '../src/db/client.js';

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
