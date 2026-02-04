import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../src/db/client.js';
import { PlanVersionSchema, ProjectSchema, SceneSchema } from '../src/utils/apiSchemas.js';

let app: Express;

async function resetDb() {
  await prisma.cache.deleteMany();
  await prisma.scene.deleteMany();
  await prisma.run.deleteMany();
  await prisma.planVersion.deleteMany();
  await prisma.project.deleteMany();
}

describe('IDOR vulnerability tests', () => {
  beforeEach(async () => {
    const module = await import('../src/index.js');
    app = module.createApp();
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Scene update endpoint', () => {
    it('should allow updating scene via /api/scene/:sceneId', async () => {
      // Create project and plan
      const project1Res = await request(app).post('/api/project').send({
        topic: 'Project 1',
        nichePackId: 'facts',
      });
      const project1 = ProjectSchema.parse(project1Res.body);

      const plan1Res = await request(app).post(`/api/project/${project1.id}/plan`);
      const plan1 = PlanVersionSchema.parse(plan1Res.body);
      const scene1 = plan1.scenes?.[0];
      expect(scene1).toBeDefined();
      if (!scene1) return;

      // Update the scene
      const updateRes1 = await request(app)
        .put(`/api/scene/${scene1.id}`)
        .send({ narrationText: 'Updated narration for scene 1' });

      expect(updateRes1.status).toBe(200);

      // Verify the scene was updated
      const verifyRes = await request(app).get(`/api/scene/${scene1.id}`);
      const verifiedScene = SceneSchema.parse(verifyRes.body);
      expect(verifiedScene.narrationText).toBe('Updated narration for scene 1');
    });

    it('should allow locking scene via /api/scene/:sceneId/lock', async () => {
      // Create project and plan
      const project1Res = await request(app).post('/api/project').send({
        topic: 'Project 1',
        nichePackId: 'facts',
      });
      const project1 = ProjectSchema.parse(project1Res.body);

      const plan1Res = await request(app).post(`/api/project/${project1.id}/plan`);
      const plan1 = PlanVersionSchema.parse(plan1Res.body);
      const scene1 = plan1.scenes?.[0];
      expect(scene1).toBeDefined();
      if (!scene1) return;

      // Lock the scene
      const lockRes = await request(app)
        .post(`/api/scene/${scene1.id}/lock`)
        .send({ locked: true });

      expect(lockRes.status).toBe(200);
    });

    it('should allow regenerating scene via /api/scene/:sceneId/regenerate', async () => {
      // Create project and plan
      const project1Res = await request(app).post('/api/project').send({
        topic: 'Project 1',
        nichePackId: 'facts',
      });
      const project1 = ProjectSchema.parse(project1Res.body);

      const plan1Res = await request(app).post(`/api/project/${project1.id}/plan`);
      const plan1 = PlanVersionSchema.parse(plan1Res.body);
      const scene1 = plan1.scenes?.[0];
      expect(scene1).toBeDefined();
      if (!scene1) return;

      // Regenerate the scene
      const regenRes = await request(app).post(`/api/scene/${scene1.id}/regenerate`);

      expect(regenRes.status).toBe(200);
    });
  });

  describe('Plan update endpoint with scene updates', () => {
    it('should prevent updating scenes from different plan via /api/plan/:planVersionId', async () => {
      // Create first project and plan
      const project1Res = await request(app).post('/api/project').send({
        topic: 'Project 1',
        nichePackId: 'facts',
      });
      const project1 = ProjectSchema.parse(project1Res.body);

      const plan1Res = await request(app).post(`/api/project/${project1.id}/plan`);
      const plan1 = PlanVersionSchema.parse(plan1Res.body);
      const scene1 = plan1.scenes?.[0];
      expect(scene1).toBeDefined();
      if (!scene1) return;

      // Create second project and plan
      const project2Res = await request(app).post('/api/project').send({
        topic: 'Project 2',
        nichePackId: 'horror',
      });
      const project2 = ProjectSchema.parse(project2Res.body);

      const plan2Res = await request(app).post(`/api/project/${project2.id}/plan`);
      const plan2 = PlanVersionSchema.parse(plan2Res.body);
      const scene2 = plan2.scenes?.[0];
      expect(scene2).toBeDefined();
      if (!scene2) return;

      // Try to update plan2 but include scene1 (from plan1) - this should fail or ignore the scene
      const updateRes = await request(app)
        .put(`/api/plan/${plan2.id}`)
        .send({
          outline: 'Updated outline',
          scenes: [
            { id: scene1.id, narrationText: 'Malicious update to scene from different plan' },
          ],
        });

      // The update should succeed for the plan itself but not modify scene1
      expect(updateRes.status).toBe(200);

      // Verify scene1 was NOT updated
      const verifyScene1 = await request(app).get(`/api/scene/${scene1.id}`);
      const verifiedScene1 = SceneSchema.parse(verifyScene1.body);
      expect(verifiedScene1.narrationText).not.toBe(
        'Malicious update to scene from different plan'
      );
      expect(verifiedScene1.narrationText).toBe(scene1.narrationText);

      // Verify plan2 was updated
      const verifyPlan2 = await request(app).get(`/api/plan/${plan2.id}`);
      const verifiedPlan2 = PlanVersionSchema.parse(verifyPlan2.body);
      expect(verifiedPlan2.outline).toBe('Updated outline');
    });

    it('should allow updating scenes that belong to the plan being updated', async () => {
      // Create project and plan
      const projectRes = await request(app).post('/api/project').send({
        topic: 'Test project',
        nichePackId: 'facts',
      });
      const project = ProjectSchema.parse(projectRes.body);

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      const plan = PlanVersionSchema.parse(planRes.body);
      const scene = plan.scenes?.[0];
      expect(scene).toBeDefined();
      if (!scene) return;

      // Update plan with its own scene - this should work
      const updateRes = await request(app)
        .put(`/api/plan/${plan.id}`)
        .send({
          outline: 'Updated outline',
          scenes: [{ id: scene.id, narrationText: 'Valid update to own scene' }],
        });

      expect(updateRes.status).toBe(200);

      // Verify scene was updated
      const verifyScene = await request(app).get(`/api/scene/${scene.id}`);
      const verifiedScene = SceneSchema.parse(verifyScene.body);
      expect(verifiedScene.narrationText).toBe('Valid update to own scene');
    });
  });
});
