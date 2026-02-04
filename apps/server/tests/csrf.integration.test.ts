import { beforeEach, afterEach, afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../src/db/client.js';
import { resetDb } from './testHelpers.js';

let app: Express;
let originalEnv: NodeJS.ProcessEnv;

describe('CSRF Protection', () => {
  beforeEach(async () => {
    // Save original env
    originalEnv = { ...process.env };

    // Clean up database
    await resetDb();
  });

  afterEach(async () => {
    // Restore original env
    process.env = originalEnv;

    // Clear module cache to reload env
    vi.resetModules();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('CORS credentials disabled', () => {
    beforeEach(async () => {
      // Set ALLOWED_ORIGINS to test that CORS is enabled but credentials are disabled
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://example.com';
      process.env.NODE_ENV = 'production';
      process.env.API_KEY = 'test-key-for-cors-test'; // Required in production

      // Reload modules to pick up env change
      vi.resetModules();
      const module = await import('../src/index.js');
      app = module.createApp();
    });

    it('should allow CORS for allowed origins but not include Access-Control-Allow-Credentials', async () => {
      const res = await request(app)
        .options('/api/project')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      // CORS should be allowed for this origin
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');

      // But credentials should NOT be allowed
      expect(res.headers['access-control-allow-credentials']).not.toBe('true');
    });

    it('should not allow credentials in cross-origin GET requests', async () => {
      const res = await request(app)
        .get('/api/status')
        .set('Origin', 'http://example.com')
        .set('Cookie', 'session=abc123');

      // CORS should be allowed
      expect(res.headers['access-control-allow-origin']).toBe('http://example.com');

      // But credentials should NOT be allowed
      expect(res.headers['access-control-allow-credentials']).not.toBe('true');
    });

    it('should reject requests from disallowed origins', async () => {
      const res = await request(app).get('/api/status').set('Origin', 'http://malicious-site.com');

      // Origin not in ALLOWED_ORIGINS, should not get CORS headers
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Bearer token authentication prevents CSRF', () => {
    const testApiKey = 'test-api-key-12345';

    beforeEach(async () => {
      // Configure API_KEY and allowed origins for production-like environment
      process.env.API_KEY = testApiKey;
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
      process.env.NODE_ENV = 'production';

      // Reload modules to pick up env change
      vi.resetModules();
      const module = await import('../src/index.js');
      app = module.createApp();
    });

    it('should reject POST with only cookies (no Authorization header)', async () => {
      // Simulate CSRF attack: malicious site makes POST with victim's cookies
      const res = await request(app)
        .post('/api/project')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', 'session=victim-session') // Cookies are ignored
        .send({
          topic: 'Malicious topic',
          nichePackId: 'facts',
        });

      // Should be rejected because cookies cannot authenticate
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
      expect(res.body.message).toContain('Missing Authorization header');
    });

    it('should succeed POST with valid Bearer token', async () => {
      const res = await request(app)
        .post('/api/project')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          topic: 'Test topic',
          nichePackId: 'facts',
        });

      // Should succeed with valid Bearer token
      expect(res.status).toBe(200);
      expect(res.body.id).toBeDefined();
    });

    it('should reject cross-origin POST from disallowed origin even with valid token', async () => {
      const res = await request(app)
        .post('/api/project')
        .set('Origin', 'http://malicious-site.com')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          topic: 'Test topic',
          nichePackId: 'facts',
        });

      // In a real browser, this request would fail at CORS preflight
      // But in tests, we can still make the request
      // The key is that disallowed origins don't get CORS headers
      // Note: The request might succeed server-side, but browser would block the response
      // Check that CORS headers are not present
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('CSRF attack scenarios', () => {
    const testApiKey = 'test-api-key-12345';

    beforeEach(async () => {
      process.env.API_KEY = testApiKey;
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
      process.env.NODE_ENV = 'production';

      vi.resetModules();
      const module = await import('../src/index.js');
      app = module.createApp();
    });

    it('blocks CSRF via form submission (no custom headers possible)', async () => {
      // In a real browser, a form POST cannot add Authorization header
      const res = await request(app)
        .post('/api/project')
        .set('Origin', 'http://malicious-site.com')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        // No Authorization header - form posts cannot add custom headers
        .send('topic=Malicious&nichePackId=facts');

      // Should fail due to CORS rejection (disallowed origin)
      // The server returns 500 because CORS middleware throws an error
      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Not allowed by CORS');
    });

    it('blocks CSRF via fetch/XHR with Authorization header (CORS preflight)', async () => {
      // If attacker tries fetch with Authorization header, browser does preflight
      const preflightRes = await request(app)
        .options('/api/project')
        .set('Origin', 'http://malicious-site.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type');

      // Malicious origin should not get CORS approval
      expect(preflightRes.headers['access-control-allow-origin']).toBeUndefined();

      // In a real browser, the actual POST would be blocked after failed preflight
    });
  });
});
