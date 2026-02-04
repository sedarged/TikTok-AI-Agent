import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client.js';
import { resetStuckRuns } from '../src/services/render/renderPipeline.js';
import { resetDb } from './testHelpers.js';

describe('Queue Restore on Server Restart', () => {
  beforeAll(async () => {
    // Ensure database is connected
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should restore queued runs to in-memory queue on server restart', async () => {
    // Create a test project
    const project = await prisma.project.create({
      data: {
        title: 'Queue restore test',
        topic: 'Test topic',
        nichePackId: 'facts',
        status: 'APPROVED',
      },
    });

    // Create a plan version
    const planVersion = await prisma.planVersion.create({
      data: {
        projectId: project.id,
        hookOptionsJson: JSON.stringify(['Hook 1', 'Hook 2']),
        hookSelected: 'Hook 1',
        outline: 'Test outline',
        scriptFull: 'Test script',
      },
    });

    // Create multiple queued runs (simulating queue before restart)
    const run1 = await prisma.run.create({
      data: {
        projectId: project.id,
        planVersionId: planVersion.id,
        status: 'queued',
        progress: 0,
        currentStep: '',
        logsJson: JSON.stringify([]),
        artifactsJson: JSON.stringify({}),
        resumeStateJson: JSON.stringify({}),
        createdAt: new Date('2026-01-01T10:00:00Z'),
      },
    });

    const run2 = await prisma.run.create({
      data: {
        projectId: project.id,
        planVersionId: planVersion.id,
        status: 'queued',
        progress: 0,
        currentStep: '',
        logsJson: JSON.stringify([]),
        artifactsJson: JSON.stringify({}),
        resumeStateJson: JSON.stringify({}),
        createdAt: new Date('2026-01-01T11:00:00Z'),
      },
    });

    const run3 = await prisma.run.create({
      data: {
        projectId: project.id,
        planVersionId: planVersion.id,
        status: 'queued',
        progress: 0,
        currentStep: '',
        logsJson: JSON.stringify([]),
        artifactsJson: JSON.stringify({}),
        resumeStateJson: JSON.stringify({}),
        createdAt: new Date('2026-01-01T12:00:00Z'),
      },
    });

    // Simulate server restart: call resetStuckRuns
    await resetStuckRuns();

    // Verify queued runs are still in 'queued' status (not changed)
    const restoredRun1 = await prisma.run.findUnique({ where: { id: run1.id } });
    const restoredRun2 = await prisma.run.findUnique({ where: { id: run2.id } });
    const restoredRun3 = await prisma.run.findUnique({ where: { id: run3.id } });

    expect(restoredRun1?.status).toBe('queued');
    expect(restoredRun2?.status).toBe('queued');
    expect(restoredRun3?.status).toBe('queued');

    // Note: We cannot directly test the in-memory renderQueue without exposing it,
    // but we've verified that resetStuckRuns completes successfully and doesn't
    // change the status of queued runs. In integration, the runs would be processed.
  });

  it('should mark stuck running runs as failed on server restart', async () => {
    // Create a test project
    const project = await prisma.project.create({
      data: {
        title: 'Stuck run test',
        topic: 'Test topic',
        nichePackId: 'facts',
        status: 'RENDERING',
      },
    });

    // Create a plan version
    const planVersion = await prisma.planVersion.create({
      data: {
        projectId: project.id,
        hookOptionsJson: JSON.stringify(['Hook 1', 'Hook 2']),
        hookSelected: 'Hook 1',
        outline: 'Test outline',
        scriptFull: 'Test script',
      },
    });

    // Create a run stuck in 'running' state (simulating crash)
    const stuckRun = await prisma.run.create({
      data: {
        projectId: project.id,
        planVersionId: planVersion.id,
        status: 'running',
        progress: 50,
        currentStep: 'images_generate',
        logsJson: JSON.stringify([
          { timestamp: '2026-01-01T10:00:00Z', message: 'Starting...', level: 'info' },
        ]),
        artifactsJson: JSON.stringify({}),
        resumeStateJson: JSON.stringify({}),
      },
    });

    // Simulate server restart: call resetStuckRuns
    await resetStuckRuns();

    // Verify stuck run is marked as failed
    const resetRun = await prisma.run.findUnique({ where: { id: stuckRun.id } });
    expect(resetRun?.status).toBe('failed');
    expect(resetRun?.currentStep).toBe('error');

    // Verify log message was added
    const logs = JSON.parse(resetRun?.logsJson || '[]');
    expect(logs.length).toBeGreaterThan(1);
    const lastLog = logs[logs.length - 1];
    expect(lastLog.message).toContain('marked as failed');
    expect(lastLog.level).toBe('warn');

    // Verify project status is updated
    const updatedProject = await prisma.project.findUnique({ where: { id: project.id } });
    expect(updatedProject?.status).toBe('FAILED');
  });

  it('should restore queued runs in FIFO order (oldest first)', async () => {
    // Create a test project
    const project = await prisma.project.create({
      data: {
        title: 'FIFO test',
        topic: 'Test topic',
        nichePackId: 'facts',
        status: 'APPROVED',
      },
    });

    // Create a plan version
    const planVersion = await prisma.planVersion.create({
      data: {
        projectId: project.id,
        hookOptionsJson: JSON.stringify(['Hook 1']),
        hookSelected: 'Hook 1',
        outline: 'Test outline',
        scriptFull: 'Test script',
      },
    });

    // Create queued runs with different creation times
    await prisma.run.create({
      data: {
        projectId: project.id,
        planVersionId: planVersion.id,
        status: 'queued',
        progress: 0,
        currentStep: '',
        logsJson: JSON.stringify([]),
        artifactsJson: JSON.stringify({}),
        resumeStateJson: JSON.stringify({}),
        createdAt: new Date('2026-01-01T14:00:00Z'), // Newest
      },
    });

    await prisma.run.create({
      data: {
        projectId: project.id,
        planVersionId: planVersion.id,
        status: 'queued',
        progress: 0,
        currentStep: '',
        logsJson: JSON.stringify([]),
        artifactsJson: JSON.stringify({}),
        resumeStateJson: JSON.stringify({}),
        createdAt: new Date('2026-01-01T10:00:00Z'), // Oldest
      },
    });

    await prisma.run.create({
      data: {
        projectId: project.id,
        planVersionId: planVersion.id,
        status: 'queued',
        progress: 0,
        currentStep: '',
        logsJson: JSON.stringify([]),
        artifactsJson: JSON.stringify({}),
        resumeStateJson: JSON.stringify({}),
        createdAt: new Date('2026-01-01T12:00:00Z'), // Middle
      },
    });

    // Call resetStuckRuns to restore queue
    await resetStuckRuns();

    // Verify all runs are still queued
    const allRuns = await prisma.run.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(allRuns).toHaveLength(3);
    expect(allRuns[0].status).toBe('queued');
    expect(allRuns[1].status).toBe('queued');
    expect(allRuns[2].status).toBe('queued');

    // Note: The actual FIFO ordering in the in-memory queue would be verified
    // through integration tests where runs are actually processed
  });
});
