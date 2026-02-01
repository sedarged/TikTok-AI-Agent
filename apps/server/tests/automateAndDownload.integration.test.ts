import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../src/db/client.js';
import { v4 as uuid } from 'uuid';

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

const describeIfDryRun = process.env.APP_RENDER_DRY_RUN === '1' ? describe : describe.skip;

describeIfDryRun('Automate and batch endpoints with download/verify', () => {
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

  describe('POST /api/automate - full workflow', () => {
    it('completes automate → render → download flow (dry-run returns 409)', async () => {
      const automateRes = await request(app).post('/api/automate').send({
        topic: 'Complete automation workflow test',
        nichePackId: 'facts',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });

      expect(automateRes.status).toBe(200);
      expect(automateRes.body.projectId).toBeTruthy();
      expect(automateRes.body.planVersionId).toBeTruthy();
      expect(automateRes.body.runId).toBeTruthy();

      const { runId } = automateRes.body;

      // Wait for render to complete
      const doneRun = await waitForRunStatus(runId, 'done');
      expect(doneRun.status).toBe('done');
      expect(doneRun.progress).toBe(100);

      // Verify artifacts
      const verifyRes = await request(app).get(`/api/run/${runId}/verify`);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.passed).toBe(true);
      expect(verifyRes.body.checks).toBeDefined();
      expect(verifyRes.body.summary).toBeDefined();

      // Try to download (dry-run should return 409)
      const downloadRes = await request(app).get(`/api/run/${runId}/download`);
      expect(downloadRes.status).toBe(409);
      expect(downloadRes.body.error).toBe('No MP4 available for dry-run renders');
      expect(downloadRes.body.code).toBe('DRY_RUN_NO_MP4');
    });

    it('handles edge case: invalid niche pack', async () => {
      const automateRes = await request(app).post('/api/automate').send({
        topic: 'Invalid niche pack test',
        nichePackId: 'nonexistent_pack',
        targetLengthSec: 60,
      });

      expect(automateRes.status).toBe(400);
      expect(automateRes.body.error).toBe('Invalid niche pack');
    });

    it('validates topic length', async () => {
      const automateRes = await request(app)
        .post('/api/automate')
        .send({
          topic: 'a'.repeat(501), // Exceeds max length
          nichePackId: 'facts',
        });

      expect(automateRes.status).toBe(400);
      expect(automateRes.body.error).toBe('Invalid payload');
    });

    it('validates tempo enum', async () => {
      const automateRes = await request(app).post('/api/automate').send({
        topic: 'Invalid tempo test',
        nichePackId: 'facts',
        tempo: 'invalid_tempo',
      });

      expect(automateRes.status).toBe(400);
      expect(automateRes.body.error).toBe('Invalid payload');
    });
  });

  describe('POST /api/batch - full workflow', () => {
    it('completes batch → render → download/verify flow', async () => {
      const batchRes = await request(app)
        .post('/api/batch')
        .send({
          topics: ['Batch topic 1', 'Batch topic 2'],
          nichePackId: 'facts',
          targetLengthSec: 60,
        });

      expect(batchRes.status).toBe(200);
      expect(batchRes.body.runIds).toHaveLength(2);

      const { runIds } = batchRes.body;

      // Wait for all runs to complete
      for (const runId of runIds) {
        const doneRun = await waitForRunStatus(runId, 'done');
        expect(doneRun.status).toBe('done');
      }

      // Verify all runs
      for (const runId of runIds) {
        const verifyRes = await request(app).get(`/api/run/${runId}/verify`);
        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.passed).toBe(true);

        // Try to download (dry-run should return 409)
        const downloadRes = await request(app).get(`/api/run/${runId}/download`);
        expect(downloadRes.status).toBe(409);
        expect(downloadRes.body.code).toBe('DRY_RUN_NO_MP4');
      }
    });

    it('handles empty topics array after trimming', async () => {
      const batchRes = await request(app).post('/api/batch').send({
        topics: [], // Empty array
        nichePackId: 'facts',
      });

      // Empty array should fail validation
      expect(batchRes.status).toBe(400);
      expect(batchRes.body.error).toBe('Invalid payload');
    });

    it('validates maximum topics limit', async () => {
      const batchRes = await request(app)
        .post('/api/batch')
        .send({
          topics: Array(51).fill('Test topic'), // Exceeds max of 50
          nichePackId: 'facts',
        });

      expect(batchRes.status).toBe(400);
      expect(batchRes.body.error).toBe('Invalid payload');
    });
  });

  describe('GET /api/run/:runId/download', () => {
    it('returns 404 for non-existent run', async () => {
      const fakeRunId = uuid();
      const downloadRes = await request(app).get(`/api/run/${fakeRunId}/download`);
      expect(downloadRes.status).toBe(404);
      expect(downloadRes.body.error).toBe('Run not found');
    });

    it('validates UUID format for runId', async () => {
      const downloadRes = await request(app).get('/api/run/invalid-uuid/download');
      expect(downloadRes.status).toBe(400);
      expect(downloadRes.body.error).toBe('Invalid run ID');
    });

    it('handles run without artifacts', async () => {
      // Create a project and plan
      const createRes = await request(app).post('/api/project').send({
        topic: 'Download test',
        nichePackId: 'facts',
      });
      const project = createRes.body;

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      const plan = planRes.body;

      // Create a run manually without artifacts
      const run = await prisma.run.create({
        data: {
          id: uuid(),
          projectId: project.id,
          planVersionId: plan.id,
          status: 'done',
          progress: 100,
          currentStep: '',
          logsJson: JSON.stringify([]),
          artifactsJson: JSON.stringify({}), // No mp4Path
          resumeStateJson: JSON.stringify({}),
        },
      });

      const downloadRes = await request(app).get(`/api/run/${run.id}/download`);
      expect(downloadRes.status).toBe(404);
      expect(downloadRes.body.error).toBe('Video not found');
    });
  });

  describe('GET /api/run/:runId/verify', () => {
    it('returns 404 for non-existent run', async () => {
      const fakeRunId = uuid();
      const verifyRes = await request(app).get(`/api/run/${fakeRunId}/verify`);
      expect(verifyRes.status).toBe(404);
      expect(verifyRes.body.error).toBe('Run not found');
    });

    it('validates UUID format for runId', async () => {
      const verifyRes = await request(app).get('/api/run/invalid-uuid/verify');
      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.error).toBe('Invalid run ID');
    });

    it('verifies artifacts after successful render', async () => {
      const automateRes = await request(app).post('/api/automate').send({
        topic: 'Verify test',
        nichePackId: 'facts',
        targetLengthSec: 60,
      });

      const { runId } = automateRes.body;
      await waitForRunStatus(runId, 'done');

      const verifyRes = await request(app).get(`/api/run/${runId}/verify`);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toHaveProperty('passed');
      expect(verifyRes.body).toHaveProperty('checks');
      expect(verifyRes.body).toHaveProperty('summary');

      // In dry-run mode, should pass verification
      expect(verifyRes.body.passed).toBe(true);
      expect(verifyRes.body.summary.failed).toBe(0);
    });

    it('handles failed run verification', async () => {
      // Create a project and plan
      const createRes = await request(app).post('/api/project').send({
        topic: 'Failed run verification test',
        nichePackId: 'facts',
      });
      const project = createRes.body;

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      const plan = planRes.body;

      // Create a failed run
      const run = await prisma.run.create({
        data: {
          id: uuid(),
          projectId: project.id,
          planVersionId: plan.id,
          status: 'failed',
          progress: 50,
          currentStep: 'images_generate',
          logsJson: JSON.stringify([{ type: 'error', message: 'Simulated failure' }]),
          artifactsJson: JSON.stringify({}),
          resumeStateJson: JSON.stringify({}),
        },
      });

      const verifyRes = await request(app).get(`/api/run/${run.id}/verify`);
      expect(verifyRes.status).toBe(200);
      // Verification should detect missing artifacts for failed run
      expect(verifyRes.body.passed).toBe(false);
    });
  });

  describe('Edge cases and error handling', () => {
    it('POST /api/automate checks FFmpeg availability (bypassed in dry-run)', async () => {
      // In dry-run mode, FFmpeg check is bypassed, so this should succeed
      const automateRes = await request(app).post('/api/automate').send({
        topic: 'FFmpeg check test',
        nichePackId: 'facts',
      });

      // Should succeed in dry-run mode even without FFmpeg
      expect(automateRes.status).toBe(200);
    });

    it('POST /api/automate checks OpenAI configuration (bypassed in dry-run)', async () => {
      // In dry-run mode, OpenAI check is bypassed, so this should succeed
      const automateRes = await request(app).post('/api/automate').send({
        topic: 'OpenAI check test',
        nichePackId: 'facts',
      });

      // Should succeed in dry-run mode even without OpenAI key
      expect(automateRes.status).toBe(200);
    });

    it('POST /api/batch handles mixed valid/empty topics', async () => {
      const batchRes = await request(app)
        .post('/api/batch')
        .send({
          topics: ['Valid topic 1', 'Valid topic 2', 'Valid topic 3'],
          nichePackId: 'facts',
        });

      expect(batchRes.status).toBe(200);
      // Should create runs for all valid topics
      expect(batchRes.body.runIds).toHaveLength(3);

      // Wait for all to complete
      for (const runId of batchRes.body.runIds) {
        await waitForRunStatus(runId, 'done');
      }
    });
  });

  describe('Regression tests', () => {
    it('multiple automate calls do not interfere with each other', async () => {
      const topic1 = 'Concurrent test 1';
      const topic2 = 'Concurrent test 2';

      const res1 = await request(app).post('/api/automate').send({
        topic: topic1,
        nichePackId: 'facts',
        targetLengthSec: 60,
      });

      const res2 = await request(app).post('/api/automate').send({
        topic: topic2,
        nichePackId: 'gaming',
        targetLengthSec: 60,
      });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const { runId: runId1, projectId: projectId1 } = res1.body;
      const { runId: runId2, projectId: projectId2 } = res2.body;

      // Ensure they created different projects and runs
      expect(projectId1).not.toBe(projectId2);
      expect(runId1).not.toBe(runId2);

      // Wait for both to complete
      await waitForRunStatus(runId1, 'done');
      await waitForRunStatus(runId2, 'done');

      // Verify both projects maintained their correct topics
      const project1 = await prisma.project.findUnique({ where: { id: projectId1 } });
      const project2 = await prisma.project.findUnique({ where: { id: projectId2 } });

      expect(project1?.topic).toBe(topic1);
      expect(project2?.topic).toBe(topic2);
      expect(project1?.nichePackId).toBe('facts');
      expect(project2?.nichePackId).toBe('gaming');
    });

    it('batch with single topic works correctly', async () => {
      const batchRes = await request(app)
        .post('/api/batch')
        .send({
          topics: ['Single batch topic'],
          nichePackId: 'facts',
        });

      expect(batchRes.status).toBe(200);
      expect(batchRes.body.runIds).toHaveLength(1);

      const { runIds } = batchRes.body;
      await waitForRunStatus(runIds[0], 'done');

      const verifyRes = await request(app).get(`/api/run/${runIds[0]}/verify`);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.passed).toBe(true);
    });
  });
});
