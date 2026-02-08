import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { v4 as uuid } from 'uuid';
import { prisma } from '../src/db/client.js';
import { PlanVersionSchema, ProjectSchema } from '../src/utils/apiSchemas.js';

let app: Express;

async function resetDb() {
  await prisma.cache.deleteMany();
  await prisma.scene.deleteMany();
  await prisma.run.deleteMany();
  await prisma.planVersion.deleteMany();
  await prisma.project.deleteMany();
}

describe('Data Integrity & API Validation', () => {
  beforeAll(async () => {
    // Ensure hermetic test environment: no API_KEY required
    delete process.env.API_KEY;
    vi.resetModules();
    const module = await import('../src/index.js');
    app = module.createApp();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Issue 8: Locked Scene Protection', () => {
    it('should reject updates to locked scenes', async () => {
      // Create a project and plan
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test locked scenes',
        nichePackId: 'facts',
        language: 'en',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      expect(projectRes.status).toBe(200);
      const project = ProjectSchema.parse(projectRes.body);

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      expect(planRes.status).toBe(200);
      const plan = PlanVersionSchema.parse(planRes.body);
      expect(plan.scenes).toBeDefined();
      expect(plan.scenes!.length).toBeGreaterThan(0);

      const firstScene = plan.scenes![0];

      // Lock the first scene
      const lockRes = await request(app)
        .put(`/api/plan/${plan.id}`)
        .send({
          scenes: [{ id: firstScene.id, isLocked: true }],
        });
      expect(lockRes.status).toBe(200);

      // Try to update the locked scene (should fail)
      const updateRes = await request(app)
        .put(`/api/plan/${plan.id}`)
        .send({
          scenes: [{ id: firstScene.id, narrationText: 'Trying to modify locked scene' }],
        });

      expect(updateRes.status).toBe(400);
      expect(updateRes.body.error).toContain('locked');
      expect(updateRes.body.lockedSceneIds).toContain(firstScene.id);
    });

    it('should allow unlocking a locked scene', async () => {
      // Create a project and plan
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test unlocking scenes',
        nichePackId: 'facts',
        language: 'en',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      expect(projectRes.status).toBe(200);
      const project = ProjectSchema.parse(projectRes.body);

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      expect(planRes.status).toBe(200);
      const plan = PlanVersionSchema.parse(planRes.body);

      const firstScene = plan.scenes![0];

      // Lock the scene
      const lockRes = await request(app)
        .put(`/api/plan/${plan.id}`)
        .send({
          scenes: [{ id: firstScene.id, isLocked: true }],
        });
      expect(lockRes.status).toBe(200);

      // Unlock the scene (should succeed)
      const unlockRes = await request(app)
        .put(`/api/plan/${plan.id}`)
        .send({
          scenes: [{ id: firstScene.id, isLocked: false }],
        });
      expect(unlockRes.status).toBe(200);
    });

    it('should allow updating unlocked scenes', async () => {
      // Create a project and plan
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test unlocked scenes',
        nichePackId: 'facts',
        language: 'en',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      expect(projectRes.status).toBe(200);
      const project = ProjectSchema.parse(projectRes.body);

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      expect(planRes.status).toBe(200);
      const plan = PlanVersionSchema.parse(planRes.body);

      const firstScene = plan.scenes![0];

      // Update unlocked scene (should succeed)
      const updateRes = await request(app)
        .put(`/api/plan/${plan.id}`)
        .send({
          scenes: [{ id: firstScene.id, narrationText: 'Updated unlocked scene' }],
        });
      expect(updateRes.status).toBe(200);
    });

    it('should allow no-op updates for locked scenes', async () => {
      // Create a project and plan
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test no-op locked scenes',
        nichePackId: 'facts',
        language: 'en',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      expect(projectRes.status).toBe(200);
      const project = ProjectSchema.parse(projectRes.body);

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      expect(planRes.status).toBe(200);
      const plan = PlanVersionSchema.parse(planRes.body);

      const firstScene = plan.scenes![0];

      // Lock the scene
      const lockRes = await request(app)
        .put(`/api/plan/${plan.id}`)
        .send({
          scenes: [{ id: firstScene.id, isLocked: true }],
        });
      expect(lockRes.status).toBe(200);

      // No-op update (only id field) should succeed
      const noopRes = await request(app)
        .put(`/api/plan/${plan.id}`)
        .send({
          scenes: [{ id: firstScene.id }],
        });
      expect(noopRes.status).toBe(200);
    });
  });

  describe('Issue 9: Project Duplication Validation', () => {
    it('should reject duplication of non-existent project', async () => {
      const fakeId = uuid();
      const res = await request(app).post(`/api/project/${fakeId}/duplicate`);
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('should reject duplication of project without plan', async () => {
      // Create a project without generating a plan
      const project = await prisma.project.create({
        data: {
          id: uuid(),
          title: 'No plan project',
          topic: 'Test topic',
          nichePackId: 'facts',
          language: 'en',
          targetLengthSec: 60,
          tempo: 'normal',
          voicePreset: 'alloy',
          status: 'DRAFT_PLAN',
        },
      });

      const res = await request(app).post(`/api/project/${project.id}/duplicate`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('without a plan');
    });

    it('should reject duplication of project with plan but no scenes', async () => {
      // Create a project with a plan but no scenes
      const projectId = uuid();
      const planId = uuid();

      await prisma.project.create({
        data: {
          id: projectId,
          title: 'Empty plan project',
          topic: 'Test topic',
          nichePackId: 'facts',
          language: 'en',
          targetLengthSec: 60,
          tempo: 'normal',
          voicePreset: 'alloy',
          status: 'PLAN_READY',
          latestPlanVersionId: planId,
        },
      });

      await prisma.planVersion.create({
        data: {
          id: planId,
          projectId: projectId,
          hookOptionsJson: JSON.stringify(['Hook 1']),
          hookSelected: 'Hook 1',
          outline: 'Outline',
          scriptFull: 'Script',
        },
      });

      const res = await request(app).post(`/api/project/${projectId}/duplicate`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('empty plan');
    });

    it('should successfully duplicate project with valid plan and scenes', async () => {
      // Create a project with plan
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test duplication',
        nichePackId: 'facts',
        language: 'en',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      expect(projectRes.status).toBe(200);
      const project = ProjectSchema.parse(projectRes.body);

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      expect(planRes.status).toBe(200);

      // Duplicate the project
      const dupRes = await request(app).post(`/api/project/${project.id}/duplicate`);
      expect(dupRes.status).toBe(200);
      const duplicated = ProjectSchema.parse(dupRes.body);
      expect(duplicated.id).not.toBe(project.id);
      expect(duplicated.title).toContain('Copy');
    });
  });

  describe('Issue 10: Analytics Bounds Validation', () => {
    it('should reject negative view counts', async () => {
      // Create a project and run
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test analytics',
        nichePackId: 'facts',
        language: 'en',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      const project = ProjectSchema.parse(projectRes.body);

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      const plan = PlanVersionSchema.parse(planRes.body);

      // Create a run directly in the database (since rendering is disabled in test mode)
      const run = await prisma.run.create({
        data: {
          projectId: project.id,
          planVersionId: plan.id,
          status: 'done',
          progress: 100,
        },
      });

      // Try to update with negative views
      const updateRes = await request(app).patch(`/api/run/${run.id}`).send({ views: -100 });

      expect(updateRes.status).toBe(400);
      expect(updateRes.body.error).toContain('Invalid');
    });

    it('should reject excessively large view counts', async () => {
      // Create a project and run
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test analytics',
        nichePackId: 'facts',
        language: 'en',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      const project = ProjectSchema.parse(projectRes.body);

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      const plan = PlanVersionSchema.parse(planRes.body);

      // Create a run directly in the database
      const run = await prisma.run.create({
        data: {
          projectId: project.id,
          planVersionId: plan.id,
          status: 'done',
          progress: 100,
        },
      });

      // Try to update with views over 1 billion
      const updateRes = await request(app)
        .patch(`/api/run/${run.id}`)
        .send({ views: 2_000_000_000 });

      expect(updateRes.status).toBe(400);
      expect(updateRes.body.error).toContain('Invalid');
    });

    it('should accept valid analytics values', async () => {
      // Create a project and run
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test analytics',
        nichePackId: 'facts',
        language: 'en',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      const project = ProjectSchema.parse(projectRes.body);

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      const plan = PlanVersionSchema.parse(planRes.body);

      // Create a run directly in the database
      const run = await prisma.run.create({
        data: {
          projectId: project.id,
          planVersionId: plan.id,
          status: 'done',
          progress: 100,
        },
      });

      // Update with valid values
      const updateRes = await request(app)
        .patch(`/api/run/${run.id}`)
        .send({ views: 10000, likes: 500, retention: 0.75 });

      expect(updateRes.status).toBe(200);
    });
  });

  describe('Issue 11: Autofit Content Validation', () => {
    it('should reject autofit for scenes with empty narration', async () => {
      // Create a project and plan
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test autofit',
        nichePackId: 'facts',
        language: 'en',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      const project = ProjectSchema.parse(projectRes.body);

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      const plan = PlanVersionSchema.parse(planRes.body);

      // Clear narration from first scene
      const firstScene = plan.scenes![0];
      await request(app)
        .put(`/api/plan/${plan.id}`)
        .send({
          scenes: [{ id: firstScene.id, narrationText: '' }],
        });

      // Try to autofit (should fail)
      const autofitRes = await request(app).post(`/api/plan/${plan.id}/autofit`);

      expect(autofitRes.status).toBe(400);
      expect(autofitRes.body.error).toContain('empty narration');
      expect(autofitRes.body.emptyScenes).toBeDefined();
    });

    it('should successfully autofit scenes with valid narration', async () => {
      // Create a project and plan
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test autofit valid',
        nichePackId: 'facts',
        language: 'en',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      const project = ProjectSchema.parse(projectRes.body);

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      const plan = PlanVersionSchema.parse(planRes.body);

      // Autofit should succeed
      const autofitRes = await request(app).post(`/api/plan/${plan.id}/autofit`);
      expect(autofitRes.status).toBe(200);
    });
  });

  describe('Issue 14: DateTime Validation', () => {
    it('should reject invalid date format for scheduledPublishAt', async () => {
      // Create a project and run
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test date validation',
        nichePackId: 'facts',
        language: 'en',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      const project = ProjectSchema.parse(projectRes.body);

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      const plan = PlanVersionSchema.parse(planRes.body);

      // Create a run directly in the database
      const run = await prisma.run.create({
        data: {
          projectId: project.id,
          planVersionId: plan.id,
          status: 'done',
          progress: 100,
        },
      });

      // Try to update with invalid date
      const updateRes = await request(app)
        .patch(`/api/run/${run.id}`)
        .send({ scheduledPublishAt: 'not-a-date' });

      expect(updateRes.status).toBe(400);
      expect(updateRes.body.error).toContain('Invalid');
    });

    it('should reject past dates for scheduledPublishAt', async () => {
      // Create a project and run
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test past date',
        nichePackId: 'facts',
        language: 'en',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      const project = ProjectSchema.parse(projectRes.body);

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      const plan = PlanVersionSchema.parse(planRes.body);

      // Create a run directly in the database
      const run = await prisma.run.create({
        data: {
          projectId: project.id,
          planVersionId: plan.id,
          status: 'done',
          progress: 100,
        },
      });

      // Try to update with past date
      const pastDate = new Date('2020-01-01T00:00:00Z').toISOString();
      const updateRes = await request(app)
        .patch(`/api/run/${run.id}`)
        .send({ scheduledPublishAt: pastDate });

      expect(updateRes.status).toBe(400);
      expect(updateRes.body.error).toContain('Invalid');
    });

    it('should accept future dates for scheduledPublishAt', async () => {
      // Create a project and run
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test future date',
        nichePackId: 'facts',
        language: 'en',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      const project = ProjectSchema.parse(projectRes.body);

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      const plan = PlanVersionSchema.parse(planRes.body);

      // Create a run directly in the database
      const run = await prisma.run.create({
        data: {
          projectId: project.id,
          planVersionId: plan.id,
          status: 'done',
          progress: 100,
        },
      });

      // Update with future date
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const updateRes = await request(app)
        .patch(`/api/run/${run.id}`)
        .send({ scheduledPublishAt: futureDate });

      expect(updateRes.status).toBe(200);
    });

    it('should accept null for scheduledPublishAt', async () => {
      // Create a project and run
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test null date',
        nichePackId: 'facts',
        language: 'en',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      const project = ProjectSchema.parse(projectRes.body);

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      const plan = PlanVersionSchema.parse(planRes.body);

      // Create a run directly in the database
      const run = await prisma.run.create({
        data: {
          projectId: project.id,
          planVersionId: plan.id,
          status: 'done',
          progress: 100,
        },
      });

      // Update with null
      const updateRes = await request(app)
        .patch(`/api/run/${run.id}`)
        .send({ scheduledPublishAt: null });

      expect(updateRes.status).toBe(200);
    });
  });
});
