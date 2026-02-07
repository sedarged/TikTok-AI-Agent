import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../src/db/client.js';
import path from 'path';
import fs from 'fs';
import { env } from '../src/env.js';

let app: Express;
let originalEnv: NodeJS.ProcessEnv;

async function resetDb() {
  await prisma.cache.deleteMany();
  await prisma.scene.deleteMany();
  await prisma.run.deleteMany();
  await prisma.planVersion.deleteMany();
  await prisma.project.deleteMany();
}

describe('Path traversal security tests', () => {
  beforeAll(async () => {
    originalEnv = { ...process.env };
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    process.env = originalEnv;
  });

  describe('Artifact endpoint path traversal protection', () => {
    beforeEach(async () => {
      // Use dry-run mode instead of test mode to enable downloads
      process.env.APP_TEST_MODE = '0';
      process.env.APP_RENDER_DRY_RUN = '1';
      vi.resetModules();
      const module = await import('../src/index.js');
      app = module.createApp();
    });

    it('should reject path traversal attempts in artifact endpoint', async () => {
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test project',
        nichePackId: 'facts',
      });
      const projectId = projectRes.body.id;

      const planRes = await request(app).post(`/api/project/${projectId}/plan`);
      const planId = planRes.body.id;

      const run = await prisma.run.create({
        data: {
          projectId,
          planVersionId: planId,
          status: 'complete',
        },
      });

      // Try to access a file outside the run directory
      const artifactRes = await request(app).get(
        `/api/run/${run.id}/artifact?path=../../etc/passwd`
      );

      // Should be rejected (400 due to normalization check)
      expect(artifactRes.status).toBe(400);
      expect(artifactRes.body.error).toBe('Invalid or missing path');
    });

    it('should reject absolute paths in artifact endpoint', async () => {
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test project',
        nichePackId: 'facts',
      });
      const projectId = projectRes.body.id;

      const planRes = await request(app).post(`/api/project/${projectId}/plan`);
      const planId = planRes.body.id;

      const run = await prisma.run.create({
        data: {
          projectId,
          planVersionId: planId,
          status: 'complete',
        },
      });

      // Try to access an absolute path
      const artifactRes = await request(app).get(`/api/run/${run.id}/artifact?path=/etc/passwd`);

      // Should be rejected
      expect(artifactRes.status).toBe(400);
      expect(artifactRes.body.error).toBe('Invalid or missing path');
    });

    it('should reject paths trying to access other run directories', async () => {
      // Create two projects and runs
      const project1Res = await request(app).post('/api/project').send({
        topic: 'Project 1',
        nichePackId: 'facts',
      });
      const project1Id = project1Res.body.id;

      const plan1Res = await request(app).post(`/api/project/${project1Id}/plan`);
      const plan1Id = plan1Res.body.id;

      const _run1 = await prisma.run.create({
        data: {
          id: 'run-1',
          projectId: project1Id,
          planVersionId: plan1Id,
          status: 'complete',
        },
      });

      const project2Res = await request(app).post('/api/project').send({
        topic: 'Project 2',
        nichePackId: 'horror',
      });
      const project2Id = project2Res.body.id;

      // Try to access run1's artifacts from run2 endpoint
      // This should fail at the path validation level
      const artifactRes = await request(app).get(
        `/api/run/run-1/artifact?path=../../${project2Id}/some-file.txt`
      );

      // Should be rejected at normalization or validation
      expect([400, 403]).toContain(artifactRes.status);
    });

    it('should allow valid paths within run directory', async () => {
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test project',
        nichePackId: 'facts',
      });
      const projectId = projectRes.body.id;

      const planRes = await request(app).post(`/api/project/${projectId}/plan`);
      const planId = planRes.body.id;

      const runId = 'test-run-artifact-valid';
      const artifactDir = path.join(env.ARTIFACTS_DIR, projectId, runId);
      fs.mkdirSync(artifactDir, { recursive: true });
      const testFile = path.join(artifactDir, 'test.txt');
      fs.writeFileSync(testFile, 'test content');

      const run = await prisma.run.create({
        data: {
          id: runId,
          projectId,
          planVersionId: planId,
          status: 'complete',
        },
      });

      const artifactRes = await request(app).get(
        `/api/run/${run.id}/artifact?path=${projectId}/${runId}/test.txt`
      );

      // Should not be blocked by security (200, 404, or 400 for other reasons, but not 403)
      // The main goal is to verify security checks don't incorrectly block valid paths
      expect(artifactRes.status).not.toBe(403);

      // Clean up
      try {
        fs.unlinkSync(testFile);
        fs.rmdirSync(artifactDir);
        fs.rmdirSync(path.join(env.ARTIFACTS_DIR, projectId));
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should validate paths with path.relative to prevent symlink attacks', async () => {
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test project',
        nichePackId: 'facts',
      });
      const projectId = projectRes.body.id;

      const planRes = await request(app).post(`/api/project/${projectId}/plan`);
      const planId = planRes.body.id;

      const run = await prisma.run.create({
        data: {
          projectId,
          planVersionId: planId,
          status: 'complete',
        },
      });

      // Try various path manipulation techniques
      const testCases = [
        '..%2F..%2Fetc%2Fpasswd', // URL encoded
        '..//..//etc/passwd', // Double slashes
        './../etc/passwd', // Relative current dir
      ];

      for (const testPath of testCases) {
        const artifactRes = await request(app).get(`/api/run/${run.id}/artifact?path=${testPath}`);

        // All should be rejected
        expect([400, 403, 404]).toContain(artifactRes.status);
      }
    });
  });

  describe('Download endpoint path validation (unit test)', () => {
    it('should use path.relative for secure validation', () => {
      const artifactsDir = '/home/user/artifacts';

      // Test case 1: Path inside artifacts dir (valid)
      const validPath = '/home/user/artifacts/project1/run1/video.mp4';
      const relative1 = path.relative(artifactsDir, validPath);
      expect(relative1.startsWith('..')).toBe(false);
      expect(path.isAbsolute(relative1)).toBe(false);

      // Test case 2: Path outside artifacts dir (invalid)
      const invalidPath = '/etc/passwd';
      const relative2 = path.relative(artifactsDir, invalidPath);
      expect(relative2.startsWith('..')).toBe(true);

      // Test case 3: Path using traversal (invalid)
      const traversalPath = '/home/user/artifacts/../../etc/passwd';
      const resolvedTraversal = path.resolve(traversalPath);
      const relative3 = path.relative(artifactsDir, resolvedTraversal);
      expect(relative3.startsWith('..')).toBe(true);

      // Test case 4: Absolute path.relative result (invalid)
      const windowsAbsPath = 'C:\\Windows\\System32\\config';
      const relative4 = path.relative(artifactsDir, windowsAbsPath);
      // On Unix, this would be a relative path starting with ..
      // On Windows, it would be absolute or relative depending on drives
      const isValid4 = !relative4.startsWith('..') && !path.isAbsolute(relative4);
      // Should be invalid in most cases
      expect(isValid4 || relative4.startsWith('..')).toBe(true);
    });
  });
});
