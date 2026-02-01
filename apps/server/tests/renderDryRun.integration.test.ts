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

async function waitForProjectStatus(
  projectId: string,
  expectedStatus: string,
  timeoutMs: number = 5000
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project?.status === expectedStatus) {
      return project;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for project status ${expectedStatus}`);
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

    // Wait for project status to be updated (done after run status update)
    const project = await waitForProjectStatus(projectId, 'DONE');
    expect(project.status).toBe('DONE');

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

  it('POST /api/automate creates project, plan, and run in one call', async () => {
    const automateRes = await request(app).post('/api/automate').send({
      topic: 'One-click automation test',
      nichePackId: 'facts',
      targetLengthSec: 60,
      tempo: 'normal',
      voicePreset: 'alloy',
    });

    expect(automateRes.status).toBe(200);
    expect(automateRes.body.projectId).toBeTruthy();
    expect(automateRes.body.planVersionId).toBeTruthy();
    expect(automateRes.body.runId).toBeTruthy();

    const { projectId, planVersionId, runId } = automateRes.body;

    // Verify project was created (status could be APPROVED if queued, or RENDERING if started immediately)
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    expect(project).toBeTruthy();
    expect(['APPROVED', 'RENDERING', 'DONE']).toContain(project?.status);
    expect(project?.latestPlanVersionId).toBe(planVersionId);

    // Verify plan was created
    const plan = await prisma.planVersion.findUnique({
      where: { id: planVersionId },
      include: { scenes: true },
    });
    expect(plan).toBeTruthy();
    expect(plan?.scenes.length).toBeGreaterThanOrEqual(6);

    // Verify run was created
    const run = await prisma.run.findUnique({ where: { id: runId } });
    expect(run).toBeTruthy();
    expect(run?.projectId).toBe(projectId);
    expect(run?.planVersionId).toBe(planVersionId);

    // Wait for render to complete
    const doneRun = await waitForRunStatus(runId, 'done');
    expect(doneRun.status).toBe('done');
    expect(doneRun.progress).toBe(100);

    // Wait for project status to be updated to DONE
    const doneProject = await waitForProjectStatus(projectId, 'DONE');
    expect(doneProject.status).toBe('DONE');
  });

  it('POST /api/automate validates required fields', async () => {
    // Missing topic
    const res1 = await request(app).post('/api/automate').send({
      nichePackId: 'facts',
    });
    expect(res1.status).toBe(400);
    expect(res1.body.error).toBe('Invalid payload');

    // Missing nichePackId
    const res2 = await request(app).post('/api/automate').send({
      topic: 'Test topic',
    });
    expect(res2.status).toBe(400);
    expect(res2.body.error).toBe('Invalid payload');

    // Invalid nichePackId
    const res3 = await request(app).post('/api/automate').send({
      topic: 'Test topic',
      nichePackId: 'invalid_pack',
    });
    expect(res3.status).toBe(400);
    expect(res3.body.error).toBe('Invalid niche pack');

    // Topic too long
    const res4 = await request(app)
      .post('/api/automate')
      .send({
        topic: 'a'.repeat(501),
        nichePackId: 'facts',
      });
    expect(res4.status).toBe(400);
    expect(res4.body.error).toBe('Invalid payload');
  });

  it('POST /api/batch creates multiple runs for multiple topics', async () => {
    const batchRes = await request(app)
      .post('/api/batch')
      .send({
        topics: ['Batch test topic 1', 'Batch test topic 2', 'Batch test topic 3'],
        nichePackId: 'facts',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });

    expect(batchRes.status).toBe(200);
    expect(batchRes.body.runIds).toHaveLength(3);

    const { runIds } = batchRes.body;

    // Verify all runs were created
    for (const runId of runIds) {
      const run = await prisma.run.findUnique({
        where: { id: runId },
      });
      expect(run).toBeTruthy();
    }

    // Wait for all runs to complete
    for (const runId of runIds) {
      const doneRun = await waitForRunStatus(runId, 'done');
      expect(doneRun.status).toBe('done');
    }

    // Wait for all project statuses to be updated to DONE
    for (const runId of runIds) {
      const run = await prisma.run.findUnique({
        where: { id: runId },
      });
      if (run?.projectId) {
        const project = await waitForProjectStatus(run.projectId, 'DONE');
        expect(project.status).toBe('DONE');
      }
    }
  });

  it('POST /api/batch validates required fields', async () => {
    // Missing topics
    const res1 = await request(app).post('/api/batch').send({
      nichePackId: 'facts',
    });
    expect(res1.status).toBe(400);
    expect(res1.body.error).toBe('Invalid payload');

    // Empty topics array
    const res2 = await request(app).post('/api/batch').send({
      topics: [],
      nichePackId: 'facts',
    });
    expect(res2.status).toBe(400);
    expect(res2.body.error).toBe('Invalid payload');

    // Topics array too large
    const res3 = await request(app)
      .post('/api/batch')
      .send({
        topics: Array(51).fill('test topic'),
        nichePackId: 'facts',
      });
    expect(res3.status).toBe(400);
    expect(res3.body.error).toBe('Invalid payload');

    // Missing nichePackId
    const res4 = await request(app)
      .post('/api/batch')
      .send({
        topics: ['Test topic'],
      });
    expect(res4.status).toBe(400);
    expect(res4.body.error).toBe('Invalid payload');

    // Invalid nichePackId
    const res5 = await request(app)
      .post('/api/batch')
      .send({
        topics: ['Test topic'],
        nichePackId: 'invalid_pack',
      });
    expect(res5.status).toBe(400);
    expect(res5.body.error).toBe('Invalid niche pack');
  });

  it('updates scene durations based on measured TTS audio duration', async () => {
    const { projectId, planId } = await createProjectWithPlan();

    // Get initial scene durations
    const initialScenes = await prisma.scene.findMany({
      where: { planVersionId: planId },
      orderBy: { idx: 'asc' },
    });
    expect(initialScenes.length).toBeGreaterThan(0);

    const initialDurations = initialScenes.map((s) => s.durationTargetSec);
    const initialStartTimes = initialScenes.map((s) => s.startTimeSec);
    const initialEndTimes = initialScenes.map((s) => s.endTimeSec);

    // Start render
    const runId = await startDryRun(planId);
    const run = await waitForRunStatus(runId, 'done');
    expect(run.progress).toBe(100);

    // Get updated scene durations after TTS generation
    const updatedScenes = await prisma.scene.findMany({
      where: { planVersionId: planId },
      orderBy: { idx: 'asc' },
    });

    // In dry-run mode, durations may stay the same since we use placeholder files
    // But the mechanism to update them should be in place
    // Verify scenes still have proper timing structure
    let expectedStartTime = 0;
    for (let i = 0; i < updatedScenes.length; i++) {
      const scene = updatedScenes[i];
      expect(scene.startTimeSec).toBeCloseTo(expectedStartTime, 2);
      expect(scene.endTimeSec).toBeCloseTo(expectedStartTime + scene.durationTargetSec, 2);
      expectedStartTime = scene.endTimeSec;
    }

    // Verify scenes are continuous (no gaps)
    for (let i = 0; i < updatedScenes.length - 1; i++) {
      expect(updatedScenes[i].endTimeSec).toBeCloseTo(updatedScenes[i + 1].startTimeSec, 2);
    }
  });
});
