import { prisma } from './client.js';
import { logInfo, logError } from '../utils/logger.js';

async function main() {
  logInfo('Seeding database...');

  // Clear existing data
  await prisma.cache.deleteMany();
  await prisma.scene.deleteMany();
  await prisma.run.deleteMany();
  await prisma.planVersion.deleteMany();
  await prisma.project.deleteMany();

  logInfo('Database cleared.');
  logInfo('Seed complete. Ready to create projects.');
}

main()
  .catch((e) => {
    logError('Seeding failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
