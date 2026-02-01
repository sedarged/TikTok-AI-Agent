import { prisma } from '../src/db/client.js';

/**
 * Reset database by deleting all records in the correct order
 * to respect foreign key constraints.
 */
export async function resetDb() {
  await prisma.cache.deleteMany();
  await prisma.scene.deleteMany();
  await prisma.run.deleteMany();
  await prisma.planVersion.deleteMany();
  await prisma.project.deleteMany();
}

/**
 * Wait for a run to reach a specific status.
 * @param runId - The ID of the run to wait for
 * @param expectedStatus - The status to wait for
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 10000)
 * @returns The run record once it reaches the expected status
 * @throws Error if timeout is reached before status is achieved
 */
export async function waitForRunStatus(
  runId: string,
  expectedStatus: 'done' | 'failed' | 'canceled',
  timeoutMs: number = 10000
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await prisma.run.findUnique({ where: { id: runId } });
    if (run?.status === expectedStatus) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for status ${expectedStatus}`);
}

/**
 * Wait for a project to reach a specific status.
 * @param projectId - The ID of the project to wait for
 * @param expectedStatus - The status to wait for
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 10000)
 * @returns The project record once it reaches the expected status
 * @throws Error if timeout is reached before status is achieved
 */
export async function waitForProjectStatus(
  projectId: string,
  expectedStatus: string,
  timeoutMs: number = 10000
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project?.status === expectedStatus) {
      return project;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for project status ${expectedStatus}`);
}
