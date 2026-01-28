import { Router } from 'express';
import fs from 'node:fs';
import { prisma } from '../db/prisma.js';
import { runEvents } from '../services/render/runEvents.js';
import { renderEngine, type StepId } from '../services/render/engine.js';
import { getRunArtifacts } from '../services/render/artifacts.js';
import { verifyRunArtifacts } from '../services/render/verify.js';

export const runRouter = Router();

runRouter.get('/run/:runId', async (req, res) => {
  const runId = req.params.runId;
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    res.status(404).json({ error: 'Run not found.' });
    return;
  }
  res.json({ run });
});

runRouter.get('/run/:runId/stream', async (req, res) => {
  const runId = req.params.runId;
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    res.status(404).json({ error: 'Run not found.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const emitter = runEvents.get(runId);
  const onEvent = (ev: any) => {
    res.write(`event: ${ev.type}\n`);
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  };
  emitter.on('event', onEvent);

  // Initial state.
  res.write(`event: hello\n`);
  res.write(`data: ${JSON.stringify({ runId })}\n\n`);

  req.on('close', () => {
    emitter.off('event', onEvent);
  });
});

runRouter.post('/run/:runId/retry', async (req, res) => {
  const runId = req.params.runId;
  const { resumeFromStep } = (req.body ?? {}) as { resumeFromStep?: StepId };
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    res.status(404).json({ error: 'Run not found.' });
    return;
  }

  await prisma.run.update({
    where: { id: runId },
    data: { status: 'queued', progress: 0, currentStep: resumeFromStep ?? null }
  });

  // Start async.
  setTimeout(() => {
    renderEngine.start(runId, resumeFromStep ?? null).catch(() => {});
  }, 10);

  res.json({ ok: true, runId, resumeFromStep: resumeFromStep ?? null });
});

runRouter.post('/run/:runId/cancel', async (req, res) => {
  const runId = req.params.runId;
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    res.status(404).json({ error: 'Run not found.' });
    return;
  }
  // Cooperative cancel not implemented yet; mark canceled so UI can stop expecting progress.
  await prisma.run.update({ where: { id: runId }, data: { status: 'canceled' } });
  res.json({ ok: true });
});

runRouter.get('/run/:runId/download', async (req, res) => {
  const runId = req.params.runId;
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    res.status(404).json({ error: 'Run not found.' });
    return;
  }
  let artifacts: any = {};
  try {
    artifacts = JSON.parse(run.artifactsJson);
  } catch {}
  const mp4Path = artifacts.mp4Path as string | undefined;
  if (!mp4Path || !fs.existsSync(mp4Path)) {
    res.status(404).json({ error: 'MP4 not found for this run yet.' });
    return;
  }
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="tiktok-ai_${run.projectId}_${run.id}.mp4"`);
  fs.createReadStream(mp4Path).pipe(res);
});

runRouter.get('/run/:runId/verify', async (req, res) => {
  const runId = req.params.runId;
  const run = await prisma.run.findUnique({ where: { id: runId }, include: { project: true } });
  if (!run) {
    res.status(404).json({ error: 'Run not found.' });
    return;
  }
  const artifacts = getRunArtifacts(run.projectId, run.id);
  const report = await verifyRunArtifacts({
    expectedTargetLengthSec: run.project.targetLengthSec,
    voFullPath: artifacts.voFullPath,
    captionsAssPath: artifacts.captionsAssPath,
    mp4Path: artifacts.mp4Path,
    thumbPath: artifacts.thumbPath,
    exportJsonPath: artifacts.exportJsonPath,
    imagesDir: artifacts.imagesDir
  });
  res.json(report);
});

