import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../src/db/client.js';
import { env } from '../src/env.js';

let app: Express;

async function resetDb() {
  await prisma.cache.deleteMany();
  await prisma.scene.deleteMany();
  await prisma.run.deleteMany();
  await prisma.planVersion.deleteMany();
  await prisma.project.deleteMany();
}

async function waitForRunStatus(
  runId: string,
  expectedStatus: 'done' | 'failed' | 'canceled',
  timeoutMs: number = 5000
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await prisma.run.findUnique({ where: { id: runId } });
    if (run?.status === expectedStatus) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for status ${expectedStatus}`);
}

async function createProjectWithPlan() {
  const createRes = await request(app)
    .post('/api/project')
    .send({
      topic: `Dry-run render test ${Date.now()}`,
      nichePackId: 'facts',
      targetLengthSec: 60,
    });
  expect(createRes.status).toBe(200);
  const projectId = createRes.body.id;

  const planRes = await request(app).post(`/api/project/${projectId}/plan`);
  expect(planRes.status).toBe(200);
  const planId = planRes.body.id;

  const approveRes = await request(app).post(`/api/plan/${planId}/approve`);
  expect(approveRes.status).toBe(200);

  return { projectId, planId };
}

async function startDryRun(planId: string) {
  const renderRes = await request(app).post(`/api/plan/${planId}/render`);
  expect(renderRes.status).toBe(200);
  return renderRes.body.id as string;
}

const describeIfDryRun = process.env.APP_RENDER_DRY_RUN === '1' ? describe : describe.skip;

describeIfDryRun('Render dry-run pipeline', () => {
  beforeAll(async () => {
    const module = await import('../src/index.js');
    app = module.createApp();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('runs render pipeline without providers or MP4', async () => {
    const { projectId, planId } = await createProjectWithPlan();
    const runId = await startDryRun(planId);

    const run = await waitForRunStatus(runId, 'done');
    expect(run.progress).toBe(100);
    const artifacts = JSON.parse(run.artifactsJson || '{}');
    expect(artifacts.dryRun).toBe(true);
    expect(artifacts.exportJsonPath).toBeTruthy();
    expect(artifacts.dryRunReportPath).toBeTruthy();

    const exportPath = path.join(env.ARTIFACTS_DIR, artifacts.exportJsonPath);
    expect(fs.existsSync(exportPath)).toBe(true);

    const reportPath = path.join(env.ARTIFACTS_DIR, artifacts.dryRunReportPath);
    expect(fs.existsSync(reportPath)).toBe(true);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    expect(project?.status).toBe('DONE');

    const verifyRes = await request(app).get(`/api/run/${runId}/verify`);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.passed).toBe(true);
  });

  it('fails when a dry-run step is injected', async () => {
    process.env.APP_DRY_RUN_FAIL_STEP = 'images_generate';

    const { planId } = await createProjectWithPlan();
    const runId = await startDryRun(planId);

    const failedRun = await waitForRunStatus(runId, 'failed');
    expect(failedRun.status).toBe('failed');

    process.env.APP_DRY_RUN_FAIL_STEP = '';
  });

  it('retries a failed dry-run and completes', async () => {
    process.env.APP_DRY_RUN_FAIL_STEP = 'captions_build';

    const { planId } = await createProjectWithPlan();
    const runId = await startDryRun(planId);
    await waitForRunStatus(runId, 'failed');

    process.env.APP_DRY_RUN_FAIL_STEP = '';

    const retryRes = await request(app).post(`/api/run/${runId}/retry`).send({});
    expect(retryRes.status).toBe(200);

    const doneRun = await waitForRunStatus(runId, 'done');
    expect(doneRun.status).toBe('done');
  });

  it('cancels a dry-run in progress', async () => {
    process.env.APP_DRY_RUN_STEP_DELAY_MS = '50';

    const { planId } = await createProjectWithPlan();
    const runId = await startDryRun(planId);

    const cancelRes = await request(app).post(`/api/run/${runId}/cancel`).send({});
    expect(cancelRes.status).toBe(200);

    const canceledRun = await waitForRunStatus(runId, 'canceled');
    expect(canceledRun.status).toBe('canceled');

    process.env.APP_DRY_RUN_STEP_DELAY_MS = '0';
  });
});
