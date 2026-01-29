import { Router } from 'express';
import { prisma } from '../db/client.js';
import { retryRun, cancelRun } from '../services/render/renderPipeline.js';
import { verifyArtifacts } from '../services/render/verifyArtifacts.js';
import { env, isTestMode } from '../env.js';
import path from 'path';
import fs from 'fs';

export const runRoutes = Router();

// Active SSE connections
const sseConnections = new Map<string, Set<any>>();

// Get single run
runRoutes.get('/:runId', async (req, res) => {
  try {
    const run = await prisma.run.findUnique({
      where: { id: req.params.runId },
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
    console.error('Error getting run:', error);
    res.status(500).json({ error: 'Failed to get run' });
  }
});

// SSE stream for run progress
runRoutes.get('/:runId/stream', async (req, res) => {
  const runId = req.params.runId;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Add to connections
  if (!sseConnections.has(runId)) {
    sseConnections.set(runId, new Set());
  }
  sseConnections.get(runId)!.add(res);

  // Send initial state
  const run = await prisma.run.findUnique({
    where: { id: runId },
  });

  if (run) {
    let logs = [];
    try {
      logs = JSON.parse(run.logsJson);
    } catch (error) {
      console.error('Failed to parse run logs JSON:', error);
      logs = [];
    }
    
    res.write(`data: ${JSON.stringify({
      type: 'state',
      status: run.status,
      progress: run.progress,
      currentStep: run.currentStep,
      logs,
    })}\n\n`);
  }

  // Cleanup on close
  req.on('close', () => {
    sseConnections.get(runId)?.delete(res);
    if (sseConnections.get(runId)?.size === 0) {
      sseConnections.delete(runId);
    }
  });
});

// Broadcast update to all SSE connections for a run
export function broadcastRunUpdate(runId: string, data: any) {
  const connections = sseConnections.get(runId);
  if (connections) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of connections) {
      try {
        res.write(message);
      } catch (e) {
        // Connection closed
        connections.delete(res);
      }
    }
  }
}

// Retry run
runRoutes.post('/:runId/retry', async (req, res) => {
  try {
    if (isTestMode()) {
      return res.status(403).json({
        error: 'Rendering is disabled in APP_TEST_MODE',
        code: 'RENDER_DISABLED_TEST_MODE',
      });
    }

    const { fromStep } = req.body;
    
    const run = await prisma.run.findUnique({
      where: { id: req.params.runId },
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    if (run.status === 'running') {
      return res.status(400).json({ error: 'Run is already in progress' });
    }

    const retriedRun = await retryRun(run.id, fromStep);
    res.json(retriedRun);
  } catch (error) {
    console.error('Error retrying run:', error);
    res.status(500).json({ error: 'Failed to retry run' });
  }
});

// Cancel run
runRoutes.post('/:runId/cancel', async (req, res) => {
  try {
    const run = await prisma.run.findUnique({
      where: { id: req.params.runId },
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
    console.error('Error canceling run:', error);
    res.status(500).json({ error: 'Failed to cancel run' });
  }
});

// Verify artifacts
runRoutes.get('/:runId/verify', async (req, res) => {
  try {
    if (isTestMode()) {
      return res.status(403).json({
        error: 'Artifact verification disabled in APP_TEST_MODE',
        code: 'VERIFY_DISABLED_TEST_MODE',
      });
    }

    const run = await prisma.run.findUnique({
      where: { id: req.params.runId },
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
    console.error('Error verifying artifacts:', error);
    res.status(500).json({ error: 'Failed to verify artifacts' });
  }
});

// Download final video
runRoutes.get('/:runId/download', async (req, res) => {
  try {
    if (isTestMode()) {
      return res.status(403).json({
        error: 'Downloads disabled in APP_TEST_MODE',
        code: 'DOWNLOAD_DISABLED_TEST_MODE',
      });
    }

    const run = await prisma.run.findUnique({
      where: { id: req.params.runId },
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    let artifacts;
    try {
      artifacts = JSON.parse(run.artifactsJson);
    } catch (error) {
      console.error('Failed to parse artifacts JSON:', error);
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
    if (!resolvedPath.startsWith(resolvedArtifactsDir + path.sep) && resolvedPath !== resolvedArtifactsDir) {
      console.error('Path traversal attempt detected:', artifacts.mp4Path);
      return res.status(403).json({ error: 'Invalid file path' });
    }
    
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Video file not found on disk' });
    }

    res.download(resolvedPath, 'final.mp4');
  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({ error: 'Failed to download video' });
  }
});

// Get export JSON
runRoutes.get('/:runId/export', async (req, res) => {
  try {
    const run = await prisma.run.findUnique({
      where: { id: req.params.runId },
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
      console.error('Failed to parse artifacts JSON:', error);
      return res.status(500).json({ error: 'Invalid artifacts data' });
    }
    
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
        scenes: run.planVersion.scenes.map(s => ({
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
    };

    res.json(exportData);
  } catch (error) {
    console.error('Error exporting:', error);
    res.status(500).json({ error: 'Failed to export' });
  }
});
