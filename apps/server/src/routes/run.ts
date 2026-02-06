import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { retryRun, cancelRun } from '../services/render/renderPipeline.js';
import { verifyArtifacts } from '../services/render/verifyArtifacts.js';
import { env, isTestMode } from '../env.js';
import path from 'path';
import fs from 'fs';
import { logError, logDebug } from '../utils/logger.js';

export const runRoutes = Router();

const runIdParamsSchema = z.object({ runId: z.uuid() });

const retryBodySchema = z
  .object({
    fromStep: z.string().max(64).optional(),
  })
  .strict();

const patchRunBodySchema = z
  .object({
    views: z.number().int().min(0).optional(),
    likes: z.number().int().min(0).optional(),
    retention: z.number().min(0).max(1).optional(),
    postedAt: z.union([z.string().datetime(), z.null()]).optional(),
    scheduledPublishAt: z.union([z.string().datetime(), z.null()]).optional(),
    publishedAt: z.union([z.string().datetime(), z.null()]).optional(),
  })
  .strict();

const upcomingQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const artifactQuerySchema = z
  .object({
    path: z.string().min(1).max(500),
  })
  .passthrough();

// Active SSE connections per runId (response objects)
const sseConnections = new Map<string, Set<import('express').Response>>();
const SSE_MAX_CONNECTIONS_PER_RUN = 100;
const SSE_HEARTBEAT_INTERVAL_MS = 25000;
const sseHeartbeatIntervals = new Map<string, ReturnType<typeof setInterval>>();

function startHeartbeat(runId: string): void {
  if (sseHeartbeatIntervals.has(runId)) return;
  const interval = setInterval(() => {
    const connections = sseConnections.get(runId);
    if (!connections || connections.size === 0) {
      clearInterval(interval);
      sseHeartbeatIntervals.delete(runId);
      return;
    }
    const message = ': heartbeat\n\n';
    for (const res of connections) {
      try {
        if (!res.writableEnded) res.write(message);
        else connections.delete(res);
      } catch {
        connections.delete(res);
      }
    }
    if (connections.size === 0) {
      clearInterval(interval);
      sseHeartbeatIntervals.delete(runId);
      sseConnections.delete(runId);
    }
  }, SSE_HEARTBEAT_INTERVAL_MS);
  sseHeartbeatIntervals.set(runId, interval);
}

// List runs (for Analytics)
runRoutes.get('/', async (_req, res) => {
  try {
    const runs = await prisma.run.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, topic: true, nichePackId: true, title: true } },
      },
    });
    res.json(runs);
  } catch (error) {
    logError('Error listing runs:', error);
    res.status(500).json({ error: 'Failed to list runs' });
  }
});

// Upcoming runs (Calendar: scheduledPublishAt in [from, to])
runRoutes.get('/upcoming', async (req, res) => {
  try {
    const parsed = upcomingQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    }
    const { from: fromStr, to: toStr } = parsed.data;
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const parseDate = (s: string, endOfDay: boolean): Date => {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(s)
        ? endOfDay
          ? new Date(s + 'T23:59:59.999')
          : new Date(s + 'T00:00:00.000')
        : new Date(s);
      return d;
    };
    const fromDate = fromStr ? parseDate(fromStr, false) : defaultFrom;
    const toDate = toStr ? parseDate(toStr, true) : defaultTo;
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ error: 'Invalid from/to dates' });
    }
    const runs = await prisma.run.findMany({
      where: {
        scheduledPublishAt: { not: null, gte: fromDate, lte: toDate },
      },
      orderBy: { scheduledPublishAt: 'asc' },
      include: {
        project: { select: { id: true, topic: true, nichePackId: true, title: true } },
      },
    });
    res.json(runs);
  } catch (error) {
    logError('Error listing upcoming runs:', error);
    res.status(500).json({ error: 'Failed to list upcoming runs' });
  }
});

// Get single run
runRoutes.get('/:runId', async (req, res) => {
  try {
    const parsed = runIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid run ID', details: parsed.error.flatten() });
    }
    const { runId } = parsed.data;
    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: {
        project: true,
        planVersion: {
          include: {
            scenes: { orderBy: { idx: 'asc' } },
          },
        },
      },
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    res.json(run);
  } catch (error) {
    logError('Error getting run:', error);
    res.status(500).json({ error: 'Failed to get run' });
  }
});

// PATCH run (analytics: views, likes, retention, postedAt)
runRoutes.patch('/:runId', async (req, res) => {
  try {
    const parsedParams = runIdParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res
        .status(400)
        .json({ error: 'Invalid run ID', details: parsedParams.error.flatten() });
    }
    const bodyParsed = patchRunBodySchema.safeParse(req.body ?? {});
    if (!bodyParsed.success) {
      return res.status(400).json({
        error: 'Invalid body',
        details: bodyParsed.error.flatten(),
      });
    }
    const { runId } = parsedParams.data;
    const data = bodyParsed.data;
    const update: {
      views?: number;
      likes?: number;
      retention?: number;
      postedAt?: Date | null;
      scheduledPublishAt?: Date | null;
      publishedAt?: Date | null;
    } = {};
    if (data.views !== undefined) update.views = data.views;
    if (data.likes !== undefined) update.likes = data.likes;
    if (data.retention !== undefined) update.retention = data.retention;
    if (data.postedAt !== undefined)
      update.postedAt = data.postedAt === null ? null : new Date(data.postedAt);
    if (data.scheduledPublishAt !== undefined)
      update.scheduledPublishAt =
        data.scheduledPublishAt === null ? null : new Date(data.scheduledPublishAt);
    if (data.publishedAt !== undefined)
      update.publishedAt = data.publishedAt === null ? null : new Date(data.publishedAt);

    const run = await prisma.run.update({
      where: { id: runId },
      data: update,
      include: {
        project: true,
        planVersion: { include: { scenes: { orderBy: { idx: 'asc' } } } },
      },
    });
    res.json(run);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2025') {
      return res.status(404).json({ error: 'Run not found' });
    }
    logError('Error patching run:', error);
    res.status(500).json({ error: 'Failed to update run' });
  }
});

// SSE stream for run progress (CORS handled by app-level middleware)
runRoutes.get('/:runId/stream', async (req, res) => {
  const parsed = runIdParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid run ID', details: parsed.error.flatten() });
  }
  const { runId } = parsed.data;

  let connections = sseConnections.get(runId);
  if (!connections) {
    connections = new Set();
    sseConnections.set(runId, connections);
  }
  if (connections.size >= SSE_MAX_CONNECTIONS_PER_RUN) {
    res.status(503).json({ error: 'Too many SSE subscribers for this run' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  connections.add(res);
  startHeartbeat(runId);

  const run = await prisma.run.findUnique({
    where: { id: runId },
  });

  if (run) {
    let logs: unknown[] = [];
    try {
      logs = JSON.parse(run.logsJson) as unknown[];
    } catch (error) {
      logError('Failed to parse run logs JSON:', error);
    }
    try {
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({
            type: 'state',
            status: run.status,
            progress: run.progress,
            currentStep: run.currentStep,
            logs,
          })}\n\n`
        );
      }
    } catch (error) {
      logDebug('Failed to write initial SSE state', { error, runId });
      connections.delete(res);
    }
  }

  req.on('close', () => {
    connections.delete(res);
    if (connections.size === 0) {
      sseConnections.delete(runId);
      const interval = sseHeartbeatIntervals.get(runId);
      if (interval) {
        clearInterval(interval);
        sseHeartbeatIntervals.delete(runId);
      }
    }
  });
});

// Broadcast update to all SSE connections for a run
export function broadcastRunUpdate(runId: string, data: unknown) {
  const connections = sseConnections.get(runId);
  if (!connections) return;
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of connections) {
    try {
      if (!res.writableEnded) res.write(message);
      else connections.delete(res);
    } catch (error) {
      logDebug('Failed to broadcast SSE message', { error, runId });
      connections.delete(res);
    }
  }
}

// Retry run
runRoutes.post('/:runId/retry', async (req, res) => {
  try {
    const parsedParams = runIdParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res
        .status(400)
        .json({ error: 'Invalid run ID', details: parsedParams.error.flatten() });
    }
    const { runId } = parsedParams.data;
    if (isTestMode()) {
      return res.status(403).json({
        error: 'Rendering is disabled in APP_TEST_MODE',
        code: 'RENDER_DISABLED_TEST_MODE',
      });
    }

    const parsedBody = retryBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: parsedBody.error.flatten(),
      });
    }
    const { fromStep } = parsedBody.data;

    const run = await prisma.run.findUnique({
      where: { id: runId },
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    if (run.status === 'running' || run.status === 'queued') {
      return res.status(400).json({ error: 'Run is already in progress' });
    }
    if (!['failed', 'canceled', 'qa_failed'].includes(run.status)) {
      return res.status(400).json({ error: 'Run is not retryable from current state' });
    }

    const retriedRun = await retryRun(run.id, fromStep);
    res.json(retriedRun);
  } catch (error) {
    logError('Error retrying run:', error);
    res.status(500).json({ error: 'Failed to retry run' });
  }
});

// Cancel run
runRoutes.post('/:runId/cancel', async (req, res) => {
  try {
    const parsed = runIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid run ID', details: parsed.error.flatten() });
    }
    const { runId } = parsed.data;
    const run = await prisma.run.findUnique({
      where: { id: runId },
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    if (run.status !== 'running' && run.status !== 'queued') {
      return res.status(400).json({ error: 'Run is not in progress' });
    }

    await cancelRun(run.id);
    res.json({ success: true });
  } catch (error) {
    logError('Error canceling run:', error);
    res.status(500).json({ error: 'Failed to cancel run' });
  }
});

// Verify artifacts
runRoutes.get('/:runId/verify', async (req, res) => {
  try {
    const parsed = runIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid run ID', details: parsed.error.flatten() });
    }
    const { runId } = parsed.data;
    if (isTestMode()) {
      return res.status(403).json({
        error: 'Artifact verification disabled in APP_TEST_MODE',
        code: 'VERIFY_DISABLED_TEST_MODE',
      });
    }

    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: {
        project: true,
        planVersion: {
          include: {
            scenes: { orderBy: { idx: 'asc' } },
          },
        },
      },
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const verification = await verifyArtifacts(run);
    res.json(verification);
  } catch (error) {
    logError('Error verifying artifacts:', error);
    res.status(500).json({ error: 'Failed to verify artifacts' });
  }
});

// Download final video
runRoutes.get('/:runId/download', async (req, res) => {
  try {
    const parsed = runIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid run ID', details: parsed.error.flatten() });
    }
    const { runId } = parsed.data;
    if (isTestMode()) {
      return res.status(403).json({
        error: 'Downloads disabled in APP_TEST_MODE',
        code: 'DOWNLOAD_DISABLED_TEST_MODE',
      });
    }

    const run = await prisma.run.findUnique({
      where: { id: runId },
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    let artifacts;
    try {
      artifacts = JSON.parse(run.artifactsJson);
    } catch (error) {
      logError('Failed to parse artifacts JSON:', error);
      return res.status(500).json({ error: 'Invalid artifacts data' });
    }

    if (artifacts.dryRun === true) {
      return res.status(409).json({
        error: 'No MP4 available for dry-run renders',
        code: 'DRY_RUN_NO_MP4',
      });
    }

    if (!artifacts.mp4Path) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Prevent path traversal attacks - ensure file is within ARTIFACTS_DIR
    const videoPath = path.join(env.ARTIFACTS_DIR, artifacts.mp4Path);
    const resolvedPath = path.resolve(videoPath);
    const resolvedArtifactsDir = path.resolve(env.ARTIFACTS_DIR);

    // Ensure the resolved path is within artifacts directory (including path separator check)
    if (
      !resolvedPath.startsWith(resolvedArtifactsDir + path.sep) &&
      resolvedPath !== resolvedArtifactsDir
    ) {
      logError('Path traversal attempt detected:', artifacts.mp4Path);
      return res.status(403).json({ error: 'Invalid file path' });
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Video file not found on disk' });
    }

    res.download(resolvedPath, 'final.mp4');
  } catch (error) {
    logError('Error downloading video:', error);
    res.status(500).json({ error: 'Failed to download video' });
  }
});

// Serve a single artifact file (used when /artifacts static is disabled, e.g. production)
runRoutes.get('/:runId/artifact', async (req, res) => {
  try {
    const parsed = runIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid run ID', details: parsed.error.flatten() });
    }
    const { runId } = parsed.data;
    const parsedQuery = artifactQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Invalid or missing path' });
    }
    const relativePath = parsedQuery.data.path;
    const normalizedPath = path.posix.normalize(relativePath.replace(/\\/g, '/'));
    if (
      path.posix.isAbsolute(normalizedPath) ||
      normalizedPath === '..' ||
      normalizedPath.startsWith('../') ||
      normalizedPath.split('/').includes('..')
    ) {
      return res.status(400).json({ error: 'Invalid or missing path' });
    }

    const run = await prisma.run.findUnique({
      where: { id: runId },
      select: { projectId: true },
    });
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const fullPath = path.join(env.ARTIFACTS_DIR, normalizedPath);
    const resolvedPath = path.resolve(fullPath);
    const resolvedArtifactsDir = path.resolve(env.ARTIFACTS_DIR);
    const runPrefix = path.join(resolvedArtifactsDir, run.projectId, runId);

    if (
      !resolvedPath.startsWith(resolvedArtifactsDir + path.sep) &&
      resolvedPath !== resolvedArtifactsDir
    ) {
      return res.status(403).json({ error: 'Invalid file path' });
    }
    if (!resolvedPath.startsWith(runPrefix + path.sep) && resolvedPath !== runPrefix) {
      return res.status(403).json({ error: 'Path not allowed for this run' });
    }
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(resolvedPath);
  } catch (error) {
    logError('Error serving artifact:', error);
    res.status(500).json({ error: 'Failed to serve artifact' });
  }
});

// Get export JSON
runRoutes.get('/:runId/export', async (req, res) => {
  try {
    const parsed = runIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid run ID', details: parsed.error.flatten() });
    }
    const { runId } = parsed.data;
    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: {
        project: true,
        planVersion: {
          include: {
            scenes: { orderBy: { idx: 'asc' } },
          },
        },
      },
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    let artifacts;
    try {
      artifacts = JSON.parse(run.artifactsJson);
    } catch (error) {
      logError('Failed to parse artifacts JSON:', error);
      return res.status(500).json({ error: 'Invalid artifacts data' });
    }

    const tiktokCaption = artifacts.tiktokCaption as string | undefined;
    const tiktokHashtags = Array.isArray(artifacts.tiktokHashtags)
      ? (artifacts.tiktokHashtags as string[])
      : [];
    const tiktokTitle = artifacts.tiktokTitle as string | undefined;

    const exportData = {
      project: {
        id: run.project.id,
        title: run.project.title,
        topic: run.project.topic,
        nichePackId: run.project.nichePackId,
        language: run.project.language,
        targetLengthSec: run.project.targetLengthSec,
        tempo: run.project.tempo,
        voicePreset: run.project.voicePreset,
        visualStylePreset: run.project.visualStylePreset,
      },
      plan: {
        hookSelected: run.planVersion.hookSelected,
        outline: run.planVersion.outline,
        scriptFull: run.planVersion.scriptFull,
        scenes: run.planVersion.scenes.map((s) => ({
          idx: s.idx,
          narrationText: s.narrationText,
          onScreenText: s.onScreenText,
          visualPrompt: s.visualPrompt,
          durationTargetSec: s.durationTargetSec,
          effectPreset: s.effectPreset,
        })),
      },
      run: {
        id: run.id,
        status: run.status,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      },
      artifacts,
      ...(tiktokCaption !== undefined || tiktokTitle !== undefined
        ? {
            tiktok: {
              caption: tiktokCaption ?? '',
              hashtags: tiktokHashtags,
              title: tiktokTitle ?? '',
            },
          }
        : {}),
    };

    res.json(exportData);
  } catch (error) {
    logError('Error exporting:', error);
    res.status(500).json({ error: 'Failed to export' });
  }
});
