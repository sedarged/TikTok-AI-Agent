import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function ensureConnection() {
  try {
    await prisma.$connect();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
