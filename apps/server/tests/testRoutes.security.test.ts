import { beforeEach, afterEach, afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../src/db/client.js';

let app: Express;
let originalEnv: NodeJS.ProcessEnv;

describe('Test routes security', () => {
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

  describe('when in production mode', () => {
    beforeEach(async () => {
      // Set production mode
      process.env.NODE_ENV = 'production';
      process.env.APP_RENDER_DRY_RUN = '1'; // Even with dry run enabled
      process.env.API_KEY = 'test-key-for-prod'; // Required in production

      // Reload modules to pick up env change
      vi.resetModules();
      const module = await import('../src/index.js');
      app = module.createApp();
    });

    it('should not register test routes in production', async () => {
      const getRes = await request(app)
        .get('/api/test/dry-run-config')
        .set('Authorization', 'Bearer test-key-for-prod');
      const postRes = await request(app)
        .post('/api/test/dry-run-config')
        .set('Authorization', 'Bearer test-key-for-prod')
        .send({});

      // Should return 404 since routes are not registered in production
      expect(getRes.status).toBe(404);
      expect(postRes.status).toBe(404);
    });
  });

  describe('when in development with dry-run enabled', () => {
    const testApiKey = 'test-api-key-12345';

    beforeEach(async () => {
      // Set development mode with dry run and API key
      process.env.NODE_ENV = 'development';
      process.env.APP_RENDER_DRY_RUN = '1';
      process.env.API_KEY = testApiKey;

      // Reload modules
      vi.resetModules();
      const module = await import('../src/index.js');
      app = module.createApp();
    });

    it('should reject GET /dry-run-config without authentication', async () => {
      const res = await request(app).get('/api/test/dry-run-config');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('should reject POST /dry-run-config without authentication', async () => {
      const res = await request(app).post('/api/test/dry-run-config').send({
        stepDelayMs: 100,
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('should allow GET /dry-run-config with valid authentication', async () => {
      const res = await request(app)
        .get('/api/test/dry-run-config')
        .set('Authorization', `Bearer ${testApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('failStep');
      expect(res.body).toHaveProperty('stepDelayMs');
    });

    it('should allow POST /dry-run-config with valid authentication', async () => {
      const res = await request(app)
        .post('/api/test/dry-run-config')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          stepDelayMs: 100,
          failStep: '',
        });

      expect(res.status).toBe(200);
      expect(res.body.stepDelayMs).toBe(100);
    });

    it('should reject with invalid API key', async () => {
      const res = await request(app)
        .get('/api/test/dry-run-config')
        .set('Authorization', 'Bearer wrong-key');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });
  });

  describe('when in test mode without API_KEY', () => {
    beforeEach(async () => {
      // Set test mode without API key
      process.env.NODE_ENV = 'test';
      process.env.APP_TEST_MODE = '1';
      delete process.env.API_KEY;

      // Reload modules
      vi.resetModules();
      const module = await import('../src/index.js');
      app = module.createApp();
    });

    it('should allow access without authentication when API_KEY is not configured', async () => {
      const getRes = await request(app).get('/api/test/dry-run-config');
      const postRes = await request(app).post('/api/test/dry-run-config').send({
        stepDelayMs: 50,
      });

      // Should succeed without auth when API_KEY is not set
      expect(getRes.status).toBe(200);
      expect(postRes.status).toBe(200);
    });
  });

  describe('when dry-run is disabled', () => {
    beforeEach(async () => {
      // Set development mode without dry run
      process.env.NODE_ENV = 'development';
      process.env.APP_RENDER_DRY_RUN = '0';
      process.env.APP_TEST_MODE = '0';
      delete process.env.API_KEY;

      // Reload modules
      vi.resetModules();
      const module = await import('../src/index.js');
      app = module.createApp();
    });

    it('should return 404 when test routes are disabled', async () => {
      const getRes = await request(app).get('/api/test/dry-run-config');
      const postRes = await request(app).post('/api/test/dry-run-config').send({});

      // Should return 404 since test routes are not registered
      expect(getRes.status).toBe(404);
      expect(postRes.status).toBe(404);
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
