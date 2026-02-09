import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { v4 as uuid } from 'uuid';
import { prisma } from '../src/db/client.js';

let app: Express;

async function resetDb() {
  await prisma.scene.deleteMany();
  await prisma.run.deleteMany();
  await prisma.planVersion.deleteMany();
  await prisma.project.deleteMany();
}

async function createTestProject(title: string, status: string = 'DRAFT_PLAN') {
  return prisma.project.create({
    data: {
      id: uuid(),
      title,
      topic: title,
      nichePackId: 'facts',
      language: 'en',
      targetLengthSec: 60,
      tempo: 'normal',
      voicePreset: 'alloy',
      status,
    },
  });
}

describe('Project List Pagination', () => {
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

  it('returns paginated projects with metadata', async () => {
    // Create 25 test projects
    const projectPromises = [];
    for (let i = 1; i <= 25; i++) {
      projectPromises.push(createTestProject(`Test Project ${i}`));
    }
    await Promise.all(projectPromises);

    // Get first page (default 20 per page)
    const page1Res = await request(app).get('/api/projects');
    expect(page1Res.status).toBe(200);
    expect(page1Res.body).toHaveProperty('projects');
    expect(page1Res.body).toHaveProperty('pagination');
    expect(page1Res.body.projects).toHaveLength(20);
    expect(page1Res.body.pagination).toEqual({
      total: 25,
      page: 1,
      perPage: 20,
      totalPages: 2,
    });

    // Get second page
    const page2Res = await request(app).get('/api/projects?page=2');
    expect(page2Res.status).toBe(200);
    expect(page2Res.body.projects).toHaveLength(5);
    expect(page2Res.body.pagination).toEqual({
      total: 25,
      page: 2,
      perPage: 20,
      totalPages: 2,
    });
  });

  it('supports custom perPage parameter', async () => {
    // Create 15 test projects
    const projectPromises = [];
    for (let i = 1; i <= 15; i++) {
      projectPromises.push(createTestProject(`Test Project ${i}`));
    }
    await Promise.all(projectPromises);

    const res = await request(app).get('/api/projects?perPage=5');
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(5);
    expect(res.body.pagination).toEqual({
      total: 15,
      page: 1,
      perPage: 5,
      totalPages: 3,
    });
  });

  it('validates perPage max limit (100)', async () => {
    const res = await request(app).get('/api/projects?perPage=200');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid query parameters');
  });

  it('validates page minimum (1)', async () => {
    const res = await request(app).get('/api/projects?page=0');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid query parameters');
  });

  it('supports sorting by different fields', async () => {
    // Create projects with different titles
    await createTestProject('Alpha Project');
    await createTestProject('Beta Project');
    await createTestProject('Gamma Project');

    // Sort by title ascending
    const ascRes = await request(app).get('/api/projects?sortBy=title&sortOrder=asc');
    expect(ascRes.status).toBe(200);
    expect(ascRes.body.projects[0].title).toBe('Alpha Project');
    expect(ascRes.body.projects[1].title).toBe('Beta Project');
    expect(ascRes.body.projects[2].title).toBe('Gamma Project');

    // Sort by title descending
    const descRes = await request(app).get('/api/projects?sortBy=title&sortOrder=desc');
    expect(descRes.status).toBe(200);
    expect(descRes.body.projects[0].title).toBe('Gamma Project');
    expect(descRes.body.projects[1].title).toBe('Beta Project');
    expect(descRes.body.projects[2].title).toBe('Alpha Project');
  });

  it('supports sorting by status', async () => {
    await createTestProject('Project 1', 'DONE');
    await createTestProject('Project 2', 'DRAFT_PLAN');
    await createTestProject('Project 3', 'APPROVED');

    const res = await request(app).get('/api/projects?sortBy=status&sortOrder=asc');
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(3);
    // Status should be sorted alphabetically: APPROVED, DONE, DRAFT_PLAN
    expect(res.body.projects[0].status).toBe('APPROVED');
    expect(res.body.projects[1].status).toBe('DONE');
    expect(res.body.projects[2].status).toBe('DRAFT_PLAN');
  });

  it('includes related data in paginated results', async () => {
    const project = await createTestProject('Test Project');

    // Create a plan version for the project
    const planVersion = await prisma.planVersion.create({
      data: {
        id: uuid(),
        projectId: project.id,
        hookOptionsJson: JSON.stringify(['Hook 1', 'Hook 2']),
        hookSelected: 'Hook 1',
        outline: 'Test outline',
        scriptFull: 'Test script',
      },
    });

    // Create a run for the project
    await prisma.run.create({
      data: {
        id: uuid(),
        projectId: project.id,
        planVersionId: planVersion.id,
        status: 'queued',
        progress: 0,
        currentStep: '',
        logsJson: JSON.stringify([]),
        artifactsJson: JSON.stringify({}),
        resumeStateJson: JSON.stringify({}),
      },
    });

    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].planVersions).toBeDefined();
    expect(res.body.projects[0].planVersions).toHaveLength(1);
    expect(res.body.projects[0].runs).toBeDefined();
    expect(res.body.projects[0].runs).toHaveLength(1);
  });

  it('returns empty results for page beyond total pages', async () => {
    await createTestProject('Test Project 1');

    const res = await request(app).get('/api/projects?page=5');
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(0);
    expect(res.body.pagination).toEqual({
      total: 1,
      page: 5,
      perPage: 20,
      totalPages: 1,
    });
  });

  it('rejects invalid sortBy values', async () => {
    const res = await request(app).get('/api/projects?sortBy=invalidField');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid query parameters');
  });

  it('rejects invalid sortOrder values', async () => {
    const res = await request(app).get('/api/projects?sortOrder=invalidOrder');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid query parameters');
  });

  it('handles empty project list', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(0);
    expect(res.body.pagination).toEqual({
      total: 0,
      page: 1,
      perPage: 20,
      totalPages: 0,
    });
  });
});
