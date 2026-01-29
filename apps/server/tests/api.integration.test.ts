import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../src/db/client.js';
import {
  PlanVersionSchema,
  ProjectSchema,
  ProjectWithRelationsSchema,
  SceneSchema,
  RunSchema,
} from '../src/utils/apiSchemas.js';
import { getNichePack, getScenePacing } from '../src/services/nichePacks.js';

let app: Express;

async function resetDb() {
  await prisma.cache.deleteMany();
  await prisma.scene.deleteMany();
  await prisma.run.deleteMany();
  await prisma.planVersion.deleteMany();
  await prisma.project.deleteMany();
}

describe('Plan and preview workflow (test mode)', () => {
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

  it('creates project, generates plan, and persists updates', async () => {
    const createRes = await request(app).post('/api/project').send({
      topic: 'Testing the deep ocean',
      nichePackId: 'facts',
      language: 'en',
      targetLengthSec: 60,
      tempo: 'normal',
      voicePreset: 'alloy',
    });

    expect(createRes.status).toBe(200);
    const project = ProjectSchema.parse(createRes.body);
    expect(project.status).toBe('DRAFT_PLAN');

    const planRes = await request(app).post(`/api/project/${project.id}/plan`);
    expect(planRes.status).toBe(200);
    const plan = PlanVersionSchema.parse(planRes.body);
    expect(plan.projectId).toBe(project.id);
    expect(plan.scenes?.length).toBeGreaterThanOrEqual(6);
    expect(plan.scenes?.length).toBeLessThanOrEqual(8);

    const hookOptions = JSON.parse(plan.hookOptionsJson) as string[];
    expect(hookOptions.length).toBe(5);
    expect(plan.scriptFull.length).toBeGreaterThan(0);

    const firstScene = plan.scenes?.[0];
    expect(firstScene).toBeDefined();
    if (!firstScene) return;

    const updateRes = await request(app)
      .put(`/api/plan/${plan.id}`)
      .send({
        outline: 'Updated outline for testing.',
        scenes: [{ id: firstScene.id, narrationText: 'Updated narration' }],
      });

    expect(updateRes.status).toBe(200);
    const updatedPlan = PlanVersionSchema.parse(updateRes.body);
    expect(updatedPlan.outline).toBe('Updated outline for testing.');

    const fetchedPlan = await request(app).get(`/api/plan/${plan.id}`);
    expect(fetchedPlan.status).toBe(200);
    const fetchedPlanParsed = PlanVersionSchema.parse(fetchedPlan.body);
    expect(fetchedPlanParsed.scenes?.[0].narrationText).toBe('Updated narration');

    const projectRes = await request(app).get(`/api/project/${project.id}`);
    expect(projectRes.status).toBe(200);
    const projectWithPlan = ProjectWithRelationsSchema.parse(projectRes.body);
    expect(projectWithPlan.status).toBe('PLAN_READY');
    expect(projectWithPlan.latestPlanVersionId).toBe(plan.id);
  });

  it('validates missing fields and duration mismatch warnings', async () => {
    const createRes = await request(app).post('/api/project').send({
      topic: 'Validation test',
      nichePackId: 'facts',
      targetLengthSec: 60,
      tempo: 'normal',
      voicePreset: 'alloy',
    });
    const project = ProjectSchema.parse(createRes.body);

    const planRes = await request(app).post(`/api/project/${project.id}/plan`);
    const plan = PlanVersionSchema.parse(planRes.body);

    await request(app)
      .put(`/api/plan/${plan.id}`)
      .send({ hookSelected: '', outline: '' });

    const validateRes = await request(app).post(`/api/plan/${plan.id}/validate`);
    expect(validateRes.status).toBe(200);
    expect(validateRes.body.errors).toEqual(
      expect.arrayContaining(['No hook selected', 'Outline is empty'])
    );
  });

  it('auto-fits durations within pacing and respects locks', async () => {
    const createRes = await request(app).post('/api/project').send({
      topic: 'Auto-fit test',
      nichePackId: 'facts',
      targetLengthSec: 60,
      tempo: 'normal',
      voicePreset: 'alloy',
    });
    const project = ProjectSchema.parse(createRes.body);

    const planRes = await request(app).post(`/api/project/${project.id}/plan`);
    const plan = PlanVersionSchema.parse(planRes.body);
    const scenes = plan.scenes || [];
    const lockedScene = scenes[0];
    expect(lockedScene).toBeDefined();

    await request(app)
      .put(`/api/scene/${lockedScene.id}`)
      .send({ durationTargetSec: 14, isLocked: true });

    const autofitRes = await request(app).post(`/api/plan/${plan.id}/autofit`);
    expect(autofitRes.status).toBe(200);
    const autofitPlan = PlanVersionSchema.parse(autofitRes.body);
    const autofitScenes = (autofitPlan.scenes || []).map((s) => SceneSchema.parse(s));

    const pack = getNichePack(project.nichePackId);
    expect(pack).toBeDefined();
    if (!pack) return;
    const pacing = getScenePacing(pack, project.targetLengthSec);

    const lockedAfter = autofitScenes.find((s) => s.id === lockedScene.id);
    expect(lockedAfter?.durationTargetSec).toBe(14);

    const totalDuration = autofitScenes.reduce((sum, s) => sum + s.durationTargetSec, 0);
    expect(Math.abs(totalDuration - project.targetLengthSec)).toBeLessThanOrEqual(1);

    for (const scene of autofitScenes) {
      expect(scene.durationTargetSec).toBeGreaterThanOrEqual(pacing.minDurationSec);
      expect(scene.durationTargetSec).toBeLessThanOrEqual(pacing.maxDurationSec);
    }
  });

  it('locks scenes and blocks regeneration, approve moves to APPROVED', async () => {
    const createRes = await request(app).post('/api/project').send({
      topic: 'Lock test',
      nichePackId: 'facts',
      targetLengthSec: 60,
    });
    const project = ProjectSchema.parse(createRes.body);

    const planRes = await request(app).post(`/api/project/${project.id}/plan`);
    const plan = PlanVersionSchema.parse(planRes.body);
    const scenes = plan.scenes || [];
    const targetScene = scenes[0];
    expect(targetScene).toBeDefined();
    const originalNarration = targetScene.narrationText;

    const lockRes = await request(app)
      .post(`/api/scene/${targetScene.id}/lock`)
      .send({ locked: true });
    expect(lockRes.status).toBe(200);

    await request(app)
      .put(`/api/plan/${plan.id}`)
      .send({ scenes: [{ id: targetScene.id, narrationText: 'Should not change' }] });

    const planAfterUpdate = await request(app).get(`/api/plan/${plan.id}`);
    expect(planAfterUpdate.status).toBe(200);
    expect(planAfterUpdate.body.scenes[0].narrationText).toBe(originalNarration);

    const regenRes = await request(app).post(`/api/scene/${targetScene.id}/regenerate`);
    expect(regenRes.status).toBe(400);

    const approveRes = await request(app).post(`/api/plan/${plan.id}/approve`);
    expect(approveRes.status).toBe(200);

    const projectRes = await request(app).get(`/api/project/${project.id}`);
    const updatedProject = ProjectWithRelationsSchema.parse(projectRes.body);
    expect(updatedProject.status).toBe('APPROVED');

    const renderRes = await request(app).post(`/api/plan/${plan.id}/render`);
    expect(renderRes.status).toBe(403);
  });

  it('returns clear errors for invalid payloads', async () => {
    const badProjectRes = await request(app).post('/api/project').send({
      nichePackId: 'facts',
    });
    expect(badProjectRes.status).toBe(400);

    const createRes = await request(app).post('/api/project').send({
      topic: 'Bad payload test',
      nichePackId: 'facts',
    });
    const project = ProjectSchema.parse(createRes.body);

    const planRes = await request(app).post(`/api/project/${project.id}/plan`);
    const plan = PlanVersionSchema.parse(planRes.body);

    const badPlanUpdate = await request(app)
      .put(`/api/plan/${plan.id}`)
      .send({ scenes: { id: 'not-an-array' } });
    expect(badPlanUpdate.status).toBe(400);
  });

  it('serves run records without triggering render', async () => {
    const createRes = await request(app).post('/api/project').send({
      topic: 'Run record test',
      nichePackId: 'facts',
    });
    const project = ProjectSchema.parse(createRes.body);

    const planRes = await request(app).post(`/api/project/${project.id}/plan`);
    const plan = PlanVersionSchema.parse(planRes.body);

    const run = await prisma.run.create({
      data: {
        id: `test-run-${project.id}`,
        projectId: project.id,
        planVersionId: plan.id,
        status: 'queued',
        progress: 0,
        currentStep: '',
        logsJson: JSON.stringify([]),
        artifactsJson: JSON.stringify({}),
        resumeStateJson: JSON.stringify({}),
      },
    });

    const runRes = await request(app).get(`/api/run/${run.id}`);
    expect(runRes.status).toBe(200);
    RunSchema.parse(runRes.body);
  });
});
