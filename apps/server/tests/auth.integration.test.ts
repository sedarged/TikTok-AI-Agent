import { beforeEach, afterEach, afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../src/db/client.js';

let app: Express;
let originalEnv: NodeJS.ProcessEnv;

describe('Authentication middleware', () => {
  beforeEach(async () => {
    // Save original env
    originalEnv = { ...process.env };

    // Clean up database
    await prisma.cache.deleteMany();
    await prisma.scene.deleteMany();
    await prisma.run.deleteMany();
    await prisma.planVersion.deleteMany();
    await prisma.project.deleteMany();
  });

  afterEach(async () => {
    // Restore original env
    process.env = originalEnv;

    // Clear module cache to reload env
    vi.resetModules();
  });

  describe('when API_KEY is not configured', () => {
    beforeEach(async () => {
      // Ensure API_KEY is not set
      delete process.env.API_KEY;

      // Reload modules to pick up env change
      vi.resetModules();
      const module = await import('../src/index.js');
      app = module.createApp();
    });

    it('allows POST requests without authentication', async () => {
      const res = await request(app).post('/api/project').send({
        topic: 'Test topic',
        nichePackId: 'facts',
      });

      expect(res.status).toBe(200);
    });

    it('allows GET requests without authentication', async () => {
      const res = await request(app).get('/api/project');
      expect(res.status).toBe(200);
    });
  });

  describe('when API_KEY is configured', () => {
    const testApiKey = 'test-api-key-12345';

    beforeEach(async () => {
      // Set API_KEY
      process.env.API_KEY = testApiKey;

      // Reload modules to pick up env change
      vi.resetModules();
      const module = await import('../src/index.js');
      app = module.createApp();
    });

    describe('POST requests (write operations)', () => {
      it('rejects requests without Authorization header', async () => {
        const res = await request(app).post('/api/project').send({
          topic: 'Test topic',
          nichePackId: 'facts',
        });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
        expect(res.body.message).toContain('Missing Authorization header');
      });

      it('rejects requests with invalid Authorization format', async () => {
        const res = await request(app)
          .post('/api/project')
          .set('Authorization', 'InvalidFormat')
          .send({
            topic: 'Test topic',
            nichePackId: 'facts',
          });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
        expect(res.body.message).toContain('Invalid Authorization header format');
      });

      it('rejects requests with wrong API key', async () => {
        const res = await request(app)
          .post('/api/project')
          .set('Authorization', 'Bearer wrong-api-key')
          .send({
            topic: 'Test topic',
            nichePackId: 'facts',
          });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
        expect(res.body.message).toContain('Invalid API key');
      });

      it('allows requests with correct API key', async () => {
        const res = await request(app)
          .post('/api/project')
          .set('Authorization', `Bearer ${testApiKey}`)
          .send({
            topic: 'Test topic',
            nichePackId: 'facts',
          });

        expect(res.status).toBe(200);
        expect(res.body.id).toBeDefined();
      });
    });

    describe('GET requests (read operations)', () => {
      it('allows GET requests without authentication', async () => {
        const res = await request(app).get('/api/project');
        expect(res.status).toBe(200);
      });

      it('allows GET requests with valid authentication', async () => {
        const res = await request(app)
          .get('/api/project')
          .set('Authorization', `Bearer ${testApiKey}`);

        expect(res.status).toBe(200);
      });
    });

    describe('DELETE requests (write operations)', () => {
      it('rejects DELETE without authentication', async () => {
        // Create a project first
        const createRes = await request(app)
          .post('/api/project')
          .set('Authorization', `Bearer ${testApiKey}`)
          .send({
            topic: 'Test topic',
            nichePackId: 'facts',
          });

        const projectId = createRes.body.id;

        // Try to delete without auth
        const deleteRes = await request(app).delete(`/api/project/${projectId}`);

        expect(deleteRes.status).toBe(401);
        expect(deleteRes.body.error).toBe('Unauthorized');
      });

      it('allows DELETE with valid authentication', async () => {
        // Create a project first
        const createRes = await request(app)
          .post('/api/project')
          .set('Authorization', `Bearer ${testApiKey}`)
          .send({
            topic: 'Test topic',
            nichePackId: 'facts',
          });

        const projectId = createRes.body.id;

        // Delete with auth
        const deleteRes = await request(app)
          .delete(`/api/project/${projectId}`)
          .set('Authorization', `Bearer ${testApiKey}`);

        expect(deleteRes.status).toBe(200);
      });
    });

    describe('Security properties', () => {
      it('should reject invalid keys of different lengths with 401', async () => {
        // Verify that keys of different lengths are all rejected
        // (The actual timing-safe comparison is tested by the fact we use crypto.timingSafeEqual)
        const shortKey = 'a';
        const longKey = 'a'.repeat(100);

        const res1 = await request(app)
          .post('/api/project')
          .set('Authorization', `Bearer ${shortKey}`)
          .send({ topic: 'Test', nichePackId: 'facts' });

        const res2 = await request(app)
          .post('/api/project')
          .set('Authorization', `Bearer ${longKey}`)
          .send({ topic: 'Test', nichePackId: 'facts' });

        // Both should return 401 (using timing-safe comparison internally)
        expect(res1.status).toBe(401);
        expect(res2.status).toBe(401);
        expect(res1.body.error).toBe('Unauthorized');
        expect(res2.body.error).toBe('Unauthorized');
      });
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
