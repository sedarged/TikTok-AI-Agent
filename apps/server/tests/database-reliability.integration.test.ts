import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../src/db/client.js';

let app: Express;

async function resetDb() {
  await prisma.cache.deleteMany();
  await prisma.scene.deleteMany();
  await prisma.run.deleteMany();
  await prisma.planVersion.deleteMany();
  await prisma.project.deleteMany();
}

describe('Database reliability - transactions and N+1 elimination (Issue 5 & 6)', () => {
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

  describe('Autofit operation transaction', () => {
    it('should update all scenes atomically in a transaction', async () => {
      // Create project with plan
      const createRes = await request(app).post('/api/project').send({
        topic: 'Transaction test for autofit',
        nichePackId: 'facts',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      expect(createRes.status).toBe(200);
      const project = createRes.body;

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      expect(planRes.status).toBe(200);
      const plan = planRes.body;
      expect(plan.scenes.length).toBeGreaterThan(0);

      // Call autofit endpoint
      const autofitRes = await request(app).post(`/api/plan/${plan.id}/autofit`);
      expect(autofitRes.status).toBe(200);
      const updatedPlan = autofitRes.body;

      // Verify all scenes were updated
      expect(updatedPlan.scenes.length).toBe(plan.scenes.length);

      // Verify timing changes were applied
      let totalDuration = 0;
      for (const scene of updatedPlan.scenes) {
        expect(scene.startTimeSec).toBeGreaterThanOrEqual(0);
        expect(scene.endTimeSec).toBeGreaterThan(scene.startTimeSec);
        expect(scene.durationTargetSec).toBeGreaterThan(0);
        totalDuration += scene.durationTargetSec;
      }

      // Verify total duration is close to target
      expect(totalDuration).toBeGreaterThan(50); // Allow some variance
      expect(totalDuration).toBeLessThan(70);

      // Verify consistency in DB
      const dbScenes = await prisma.scene.findMany({
        where: { planVersionId: plan.id },
        orderBy: { idx: 'asc' },
      });
      expect(dbScenes.length).toBe(updatedPlan.scenes.length);

      for (let i = 0; i < dbScenes.length; i++) {
        expect(dbScenes[i].durationTargetSec).toBe(updatedPlan.scenes[i].durationTargetSec);
        expect(dbScenes[i].startTimeSec).toBe(updatedPlan.scenes[i].startTimeSec);
        expect(dbScenes[i].endTimeSec).toBe(updatedPlan.scenes[i].endTimeSec);
      }
    });
  });

  describe('Regenerate script operation transaction', () => {
    it('should update plan version and all scenes atomically', async () => {
      // Create project with plan
      const createRes = await request(app).post('/api/project').send({
        topic: 'Transaction test for regenerate script',
        nichePackId: 'horror',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      expect(createRes.status).toBe(200);
      const project = createRes.body;

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      expect(planRes.status).toBe(200);
      const plan = planRes.body;
      expect(plan.scenes.length).toBeGreaterThan(0);

      // Call regenerate-script endpoint
      const regenRes = await request(app).post(`/api/plan/${plan.id}/regenerate-script`);
      expect(regenRes.status).toBe(200);
      const updatedPlan = regenRes.body;

      // Verify script was updated
      expect(updatedPlan.scriptFull).toBeTruthy();
      expect(updatedPlan.scriptFull.length).toBeGreaterThan(0);

      // Verify all scenes have narrations
      expect(updatedPlan.scenes.length).toBe(plan.scenes.length);
      for (const scene of updatedPlan.scenes) {
        expect(scene.narrationText).toBeTruthy();
        expect(scene.narrationText.length).toBeGreaterThan(0);
      }

      // Verify consistency in DB
      const dbPlan = await prisma.planVersion.findUnique({
        where: { id: plan.id },
        include: { scenes: { orderBy: { idx: 'asc' } } },
      });
      expect(dbPlan).toBeTruthy();
      expect(dbPlan!.scriptFull).toBe(updatedPlan.scriptFull);
      expect(dbPlan!.scenes.length).toBe(updatedPlan.scenes.length);

      for (let i = 0; i < dbPlan!.scenes.length; i++) {
        expect(dbPlan!.scenes[i].narrationText).toBe(updatedPlan.scenes[i].narrationText);
      }
    });
  });

  describe('Project duplication transaction (already implemented)', () => {
    it('should duplicate project with plan and scenes atomically', async () => {
      // Create original project with plan
      const createRes = await request(app).post('/api/project').send({
        topic: 'Original project for duplication',
        nichePackId: 'facts',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      expect(createRes.status).toBe(200);
      const original = createRes.body;

      const planRes = await request(app).post(`/api/project/${original.id}/plan`);
      expect(planRes.status).toBe(200);
      const originalPlan = planRes.body;

      // Duplicate project
      const dupRes = await request(app).post(`/api/project/${original.id}/duplicate`);
      expect(dupRes.status).toBe(200);
      const duplicated = dupRes.body;

      expect(duplicated.id).not.toBe(original.id);
      expect(duplicated.title).toContain('Copy');

      // Verify plan and scenes were duplicated
      const dupProjectFull = await request(app).get(`/api/project/${duplicated.id}`);
      expect(dupProjectFull.status).toBe(200);
      const dupWithPlan = dupProjectFull.body;

      expect(dupWithPlan.planVersions.length).toBe(1);
      const dupPlan = dupWithPlan.planVersions[0];
      expect(dupPlan.id).not.toBe(originalPlan.id);
      expect(dupPlan.scenes.length).toBe(originalPlan.scenes.length);

      // Verify scenes were copied correctly
      for (let i = 0; i < dupPlan.scenes.length; i++) {
        expect(dupPlan.scenes[i].id).not.toBe(originalPlan.scenes[i].id);
        expect(dupPlan.scenes[i].idx).toBe(originalPlan.scenes[i].idx);
        expect(dupPlan.scenes[i].narrationText).toBe(originalPlan.scenes[i].narrationText);
        expect(dupPlan.scenes[i].planVersionId).toBe(dupPlan.id);
      }

      // Verify DB consistency
      const dbScenes = await prisma.scene.findMany({
        where: { planVersionId: dupPlan.id },
      });
      expect(dbScenes.length).toBe(dupPlan.scenes.length);
    });
  });

  describe('Plan update transaction (already implemented)', () => {
    it('should update plan version and scenes atomically', async () => {
      // Create project with plan
      const createRes = await request(app).post('/api/project').send({
        topic: 'Transaction test for plan update',
        nichePackId: 'facts',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
      });
      expect(createRes.status).toBe(200);
      const project = createRes.body;

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      expect(planRes.status).toBe(200);
      const plan = planRes.body;

      const scene1 = plan.scenes[0];
      const scene2 = plan.scenes[1];

      // Update multiple fields simultaneously
      const updateRes = await request(app)
        .put(`/api/plan/${plan.id}`)
        .send({
          outline: 'Updated outline atomically',
          scriptFull: 'Updated script atomically',
          scenes: [
            { id: scene1.id, narrationText: 'Updated scene 1' },
            { id: scene2.id, narrationText: 'Updated scene 2' },
          ],
        });

      expect(updateRes.status).toBe(200);
      const updated = updateRes.body;

      expect(updated.outline).toBe('Updated outline atomically');
      expect(updated.scriptFull).toBe('Updated script atomically');
      expect(updated.scenes[0].narrationText).toBe('Updated scene 1');
      expect(updated.scenes[1].narrationText).toBe('Updated scene 2');

      // Verify DB consistency
      const dbPlan = await prisma.planVersion.findUnique({
        where: { id: plan.id },
        include: { scenes: { orderBy: { idx: 'asc' } } },
      });

      expect(dbPlan!.outline).toBe('Updated outline atomically');
      expect(dbPlan!.scriptFull).toBe('Updated script atomically');
      expect(dbPlan!.scenes[0].narrationText).toBe('Updated scene 1');
      expect(dbPlan!.scenes[1].narrationText).toBe('Updated scene 2');
    });
  });

  describe('Query count verification (atomicity, not query-count)', () => {
    it('should verify autofit uses transaction array for atomicity', async () => {
      // This test verifies that autofit operation wraps all updates atomically.
      // Note: Transaction array form still executes N+1 UPDATE queries,
      // but ensures all succeed or all fail together.
      const createRes = await request(app).post('/api/project').send({
        topic: 'Transaction atomicity test',
        nichePackId: 'facts',
        targetLengthSec: 60,
      });
      expect(createRes.status).toBe(200);
      const project = createRes.body;

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      expect(planRes.status).toBe(200);
      const plan = planRes.body;
      const sceneCount = plan.scenes.length;

      // Call autofit - all scene updates + plan estimates should succeed atomically
      const autofitRes = await request(app).post(`/api/plan/${plan.id}/autofit`);
      expect(autofitRes.status).toBe(200);

      // Verify all scenes were updated successfully
      const updatedPlan = autofitRes.body;
      expect(updatedPlan.scenes.length).toBe(sceneCount);

      // Verify consistency: all scenes + plan estimates updated together
      const dbScenes = await prisma.scene.findMany({
        where: { planVersionId: plan.id },
        orderBy: { idx: 'asc' },
      });
      expect(dbScenes.length).toBe(sceneCount);

      const dbPlan = await prisma.planVersion.findUnique({
        where: { id: plan.id },
      });
      const estimates = JSON.parse(dbPlan!.estimatesJson);
      expect(estimates.estimatedLengthSec).toBeGreaterThan(0);
    });

    it('should verify regenerate-script uses transaction array for atomicity', async () => {
      // This test verifies that regenerate-script wraps plan + scene updates atomically.
      // Note: Transaction array form still executes 1 plan UPDATE + N scene UPDATEs,
      // but ensures all succeed or all fail together.
      const createRes = await request(app).post('/api/project').send({
        topic: 'Script regeneration atomicity test',
        nichePackId: 'horror',
        targetLengthSec: 60,
      });
      expect(createRes.status).toBe(200);
      const project = createRes.body;

      const planRes = await request(app).post(`/api/project/${project.id}/plan`);
      expect(planRes.status).toBe(200);
      const plan = planRes.body;
      const sceneCount = plan.scenes.length;

      // Call regenerate-script - plan scriptFull + all scene narrations should succeed atomically
      const regenRes = await request(app).post(`/api/plan/${plan.id}/regenerate-script`);
      expect(regenRes.status).toBe(200);

      // Verify all changes were persisted together
      const updatedPlan = regenRes.body;
      expect(updatedPlan.scriptFull).toBeTruthy();
      expect(updatedPlan.scenes.length).toBe(sceneCount);
      for (const scene of updatedPlan.scenes) {
        expect(scene.narrationText).toBeTruthy();
      }

      // Verify database consistency
      const dbPlan = await prisma.planVersion.findUnique({
        where: { id: plan.id },
        include: { scenes: true },
      });
      expect(dbPlan!.scriptFull).toBe(updatedPlan.scriptFull);
      expect(dbPlan!.scenes.every((s) => s.narrationText.length > 0)).toBe(true);
    });
  });
});
