import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../src/db/client.js';
import { ProjectSchema, PlanVersionSchema } from '../src/utils/apiSchemas.js';
import { resetDb } from './testHelpers.js';

let app: Express;

describe('Scene update validation', () => {
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

  it('rejects scene updates with invalid UUID', async () => {
    // Create project and plan
    const createRes = await request(app).post('/api/project').send({
      topic: 'UUID validation test',
      nichePackId: 'facts',
      targetLengthSec: 60,
      tempo: 'normal',
      voicePreset: 'alloy',
    });
    expect(createRes.status).toBe(200);
    const project = ProjectSchema.parse(createRes.body);

    const planRes = await request(app).post(`/api/project/${project.id}/plan`);
    expect(planRes.status).toBe(200);
    const plan = PlanVersionSchema.parse(planRes.body);

    // Try to update with non-UUID ID
    const updateRes = await request(app)
      .put(`/api/plan/${plan.id}`)
      .send({
        scenes: [{ id: 'not-a-valid-uuid', narrationText: 'Test' }],
      });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.error).toBe('Invalid plan update payload');
    expect(updateRes.body.details).toBeDefined();
  });

  it('rejects scene updates with negative duration', async () => {
    // Create project and plan
    const createRes = await request(app).post('/api/project').send({
      topic: 'Duration validation test',
      nichePackId: 'facts',
      targetLengthSec: 60,
      tempo: 'normal',
      voicePreset: 'alloy',
    });
    expect(createRes.status).toBe(200);
    const project = ProjectSchema.parse(createRes.body);

    const planRes = await request(app).post(`/api/project/${project.id}/plan`);
    expect(planRes.status).toBe(200);
    const plan = PlanVersionSchema.parse(planRes.body);
    const firstScene = plan.scenes?.[0];
    expect(firstScene).toBeDefined();
    if (!firstScene) return;

    // Try to update with negative duration
    const updateRes = await request(app)
      .put(`/api/plan/${plan.id}`)
      .send({
        scenes: [{ id: firstScene.id, durationTargetSec: -5 }],
      });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.error).toBe('Invalid plan update payload');
    expect(updateRes.body.details).toBeDefined();
  });

  it('rejects scene updates with zero duration', async () => {
    // Create project and plan
    const createRes = await request(app).post('/api/project').send({
      topic: 'Zero duration validation test',
      nichePackId: 'facts',
      targetLengthSec: 60,
      tempo: 'normal',
      voicePreset: 'alloy',
    });
    expect(createRes.status).toBe(200);
    const project = ProjectSchema.parse(createRes.body);

    const planRes = await request(app).post(`/api/project/${project.id}/plan`);
    expect(planRes.status).toBe(200);
    const plan = PlanVersionSchema.parse(planRes.body);
    const firstScene = plan.scenes?.[0];
    expect(firstScene).toBeDefined();
    if (!firstScene) return;

    // Try to update with zero duration
    const updateRes = await request(app)
      .put(`/api/plan/${plan.id}`)
      .send({
        scenes: [{ id: firstScene.id, durationTargetSec: 0 }],
      });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.error).toBe('Invalid plan update payload');
    expect(updateRes.body.details).toBeDefined();
  });

  it('accepts scene updates with valid UUID and positive duration', async () => {
    // Create project and plan
    const createRes = await request(app).post('/api/project').send({
      topic: 'Valid update test',
      nichePackId: 'facts',
      targetLengthSec: 60,
      tempo: 'normal',
      voicePreset: 'alloy',
    });
    expect(createRes.status).toBe(200);
    const project = ProjectSchema.parse(createRes.body);

    const planRes = await request(app).post(`/api/project/${project.id}/plan`);
    expect(planRes.status).toBe(200);
    const plan = PlanVersionSchema.parse(planRes.body);
    const firstScene = plan.scenes?.[0];
    expect(firstScene).toBeDefined();
    if (!firstScene) return;

    // Try to update with valid UUID and positive duration
    const updateRes = await request(app)
      .put(`/api/plan/${plan.id}`)
      .send({
        scenes: [
          {
            id: firstScene.id,
            durationTargetSec: 10.5,
            narrationText: 'Valid narration text',
          },
        ],
      });

    expect(updateRes.status).toBe(200);
    const updatedPlan = PlanVersionSchema.parse(updateRes.body);
    expect(updatedPlan.scenes?.[0].durationTargetSec).toBe(10.5);
    expect(updatedPlan.scenes?.[0].narrationText).toBe('Valid narration text');
  });

  it('rejects mixed valid and invalid scene IDs', async () => {
    // Create project and plan
    const createRes = await request(app).post('/api/project').send({
      topic: 'Mixed validation test',
      nichePackId: 'facts',
      targetLengthSec: 60,
      tempo: 'normal',
      voicePreset: 'alloy',
    });
    expect(createRes.status).toBe(200);
    const project = ProjectSchema.parse(createRes.body);

    const planRes = await request(app).post(`/api/project/${project.id}/plan`);
    expect(planRes.status).toBe(200);
    const plan = PlanVersionSchema.parse(planRes.body);
    const firstScene = plan.scenes?.[0];
    expect(firstScene).toBeDefined();
    if (!firstScene) return;

    // Try to update with one valid and one invalid ID
    const updateRes = await request(app)
      .put(`/api/plan/${plan.id}`)
      .send({
        scenes: [
          { id: firstScene.id, narrationText: 'Valid' },
          { id: 'invalid-uuid', narrationText: 'Invalid' },
        ],
      });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.error).toBe('Invalid plan update payload');
  });
});
