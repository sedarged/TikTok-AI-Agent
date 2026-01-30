import { PrismaClient } from '@prisma/client';
import { env } from '../env.js';

// Create Prisma client with logging configuration
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
    // Using console.error here since logger may not be available during bootstrap
    console.error('Database connection failed:', error);
    return false;
  }
}
