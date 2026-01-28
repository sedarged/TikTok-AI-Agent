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

async function waitForRunDone(runId: string, timeoutMs: number = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await prisma.run.findUnique({ where: { id: runId } });
    if (run?.status === 'done') {
      return run;
    }
    if (run?.status === 'failed') {
      throw new Error('Run failed during dry-run test');
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for dry-run completion');
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
    const createRes = await request(app).post('/api/project').send({
      topic: 'Dry-run render test',
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

    const renderRes = await request(app).post(`/api/plan/${planId}/render`);
    expect(renderRes.status).toBe(200);
    const runId = renderRes.body.id;

    const run = await waitForRunDone(runId);
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
});
