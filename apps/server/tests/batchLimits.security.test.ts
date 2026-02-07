import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../src/db/client.js';

let app: Express;
let originalEnv: NodeJS.ProcessEnv;

async function resetDb() {
  await prisma.cache.deleteMany();
  await prisma.scene.deleteMany();
  await prisma.run.deleteMany();
  await prisma.planVersion.deleteMany();
  await prisma.project.deleteMany();
}

describe('Batch endpoint security tests', () => {
  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(async () => {
    await resetDb();
    // Use dry-run mode instead of test mode to enable batch endpoint
    process.env.APP_TEST_MODE = '0';
    process.env.APP_RENDER_DRY_RUN = '1';
    process.env.NODE_ENV = 'test';
    vi.resetModules();
    const module = await import('../src/index.js');
    app = module.createApp();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    process.env = originalEnv;
  });

  describe('Topic count limits', () => {
    it('should reject batches with more than 10 topics', async () => {
      const topics = Array.from({ length: 11 }, (_, i) => `Topic ${i + 1}`);

      const res = await request(app).post('/api/batch').send({
        topics,
        nichePackId: 'facts',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid payload');
      // Zod validation error for exceeding max array length
      expect(JSON.stringify(res.body.details)).toContain('topics');
    });

    it('should accept batches with 1 topic', async () => {
      const res = await request(app)
        .post('/api/batch')
        .send({
          topics: ['Single topic'],
          nichePackId: 'facts',
        });

      // Should process successfully
      expect(res.status).toBe(200);
    });

    it('should reject empty topic arrays', async () => {
      const res = await request(app).post('/api/batch').send({
        topics: [],
        nichePackId: 'facts',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid payload');
    });
  });

  describe('Queue size protection', () => {
    it('should reject batch when queue is full', async () => {
      // Create many queued runs to fill up the queue
      // First, create a project and plan
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test project',
        nichePackId: 'facts',
      });
      const projectId = projectRes.body.id;

      const planRes = await request(app).post(`/api/project/${projectId}/plan`);
      const planId = planRes.body.id;

      // Create 100 queued runs (MAX_QUEUE_SIZE)
      const runPromises = [];
      for (let i = 0; i < 100; i++) {
        runPromises.push(
          prisma.run.create({
            data: {
              projectId,
              planVersionId: planId,
              status: 'queued',
            },
          })
        );
      }
      await Promise.all(runPromises);

      // Try to submit a batch - should be rejected
      const batchRes = await request(app)
        .post('/api/batch')
        .send({
          topics: ['New topic'],
          nichePackId: 'facts',
        });

      expect(batchRes.status).toBe(503);
      expect(batchRes.body.error).toBe('Queue is full');
      expect(batchRes.body.code).toBe('QUEUE_FULL');
      expect(batchRes.body.queueSize).toBe(100);
    });

    it('should reject batch that would exceed queue capacity', async () => {
      // Create a project and plan
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test project',
        nichePackId: 'facts',
      });
      const projectId = projectRes.body.id;

      const planRes = await request(app).post(`/api/project/${projectId}/plan`);
      const planId = planRes.body.id;

      // Create 95 queued runs (close to MAX_QUEUE_SIZE of 100)
      const runPromises = [];
      for (let i = 0; i < 95; i++) {
        runPromises.push(
          prisma.run.create({
            data: {
              projectId,
              planVersionId: planId,
              status: 'queued',
            },
          })
        );
      }
      await Promise.all(runPromises);

      // Try to submit a batch with 10 topics (would bring total to 105)
      const batchRes = await request(app)
        .post('/api/batch')
        .send({
          topics: Array.from({ length: 10 }, (_, i) => `Topic ${i + 1}`),
          nichePackId: 'facts',
        });

      expect(batchRes.status).toBe(503);
      expect(batchRes.body.error).toBe('Batch would exceed queue capacity');
      expect(batchRes.body.code).toBe('BATCH_EXCEEDS_QUEUE_LIMIT');
      expect(batchRes.body.currentQueueSize).toBe(95);
      expect(batchRes.body.requestedBatchSize).toBe(10);
      expect(batchRes.body.maxQueueSize).toBe(100);
    });

    it('should accept batch when queue has space', async () => {
      // Don't fill queue - should accept batch
      const batchRes = await request(app)
        .post('/api/batch')
        .send({
          topics: ['Topic 1', 'Topic 2'],
          nichePackId: 'facts',
        });

      // Should succeed (not 503)
      expect(batchRes.status).not.toBe(503);
    });
  });

  describe('Cost estimation', () => {
    it('should process batch successfully with valid topics', async () => {
      const batchRes = await request(app)
        .post('/api/batch')
        .send({
          topics: ['Interesting fact 1', 'Interesting fact 2'],
          nichePackId: 'facts',
        });

      // In test mode, should succeed
      expect(batchRes.status).toBe(200);
      expect(batchRes.body).toHaveProperty('runIds');
      expect(Array.isArray(batchRes.body.runIds)).toBe(true);
      expect(batchRes.body.runIds.length).toBe(2);
    });
  });

  describe('Authentication', () => {
    it('should allow batch requests without auth when API_KEY not configured', async () => {
      // In test environment, API_KEY is typically not set
      const res = await request(app)
        .post('/api/batch')
        .send({
          topics: ['Test topic'],
          nichePackId: 'facts',
        });

      // Should not return 401
      expect(res.status).not.toBe(401);
    });
  });

  describe('Input validation', () => {
    it('should validate nichePackId', async () => {
      const res = await request(app)
        .post('/api/batch')
        .send({
          topics: ['Test topic'],
          nichePackId: 'invalid-pack',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid niche pack');
    });

    it('should validate topics are non-empty strings', async () => {
      const res = await request(app)
        .post('/api/batch')
        .send({
          topics: ['Valid topic', '', 'Another valid'],
          nichePackId: 'facts',
        });

      expect(res.status).toBe(400);
      // Empty string fails Zod validation (z.string().min(1))
      expect(res.body.error).toContain('payload');
    });

    it('should validate topic length', async () => {
      const longTopic = 'a'.repeat(501);
      const res = await request(app)
        .post('/api/batch')
        .send({
          topics: [longTopic],
          nichePackId: 'facts',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid payload');
    });
  });
});
