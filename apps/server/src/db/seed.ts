import { prisma } from './client.js';

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.cache.deleteMany();
  await prisma.scene.deleteMany();
  await prisma.run.deleteMany();
  await prisma.planVersion.deleteMany();
  await prisma.project.deleteMany();

  console.log('Database cleared.');
  console.log('Seed complete. Ready to create projects.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
