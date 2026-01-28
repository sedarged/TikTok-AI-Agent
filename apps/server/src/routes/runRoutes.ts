import { Router } from "express";
import { prisma } from "../db/client.js";
import { getRunEmitter } from "../services/render/runManager.js";
import { runPipeline, verifyRunArtifacts } from "../services/render/pipeline.js";
import { appendRunLog, markRunStatus } from "../services/render/runLog.js";
import fs from "fs/promises";

export const runRouter = Router();

runRouter.get("/run/:runId", async (req, res) => {
  const run = await prisma.run.findUnique({ where: { id: req.params.runId } });
  if (!run) {
    res.status(404).json({ error: "Run not found." });
    return;
  }
  res.json({ run });
});

runRouter.get("/run/:runId/stream", async (req, res) => {
  const run = await prisma.run.findUnique({ where: { id: req.params.runId } });
  if (!run) {
    res.status(404).json({ error: "Run not found." });
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(`event: status\n`);
  res.write(`data: ${JSON.stringify({ type: "status", status: run.status })}\n\n`);
  res.write(`event: progress\n`);
  res.write(
    `data: ${JSON.stringify({ type: "progress", progress: run.progress, step: run.currentStep })}\n\n`
  );

  const emitter = getRunEmitter(run.id);
  const listener = (event: any) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  emitter.on("event", listener);
  req.on("close", () => {
    emitter.off("event", listener);
  });
});

runRouter.post("/run/:runId/retry", async (req, res) => {
  const run = await prisma.run.findUnique({ where: { id: req.params.runId } });
  if (!run) {
    res.status(404).json({ error: "Run not found." });
    return;
  }
  const fromStep = req.body?.fromStep as string | undefined;
  await prisma.run.update({
    where: { id: run.id },
    data: { status: "queued", progress: 0, currentStep: "queued" }
  });
  await appendRunLog(run.id, `Retry requested${fromStep ? ` from ${fromStep}` : ""}.`);
  runPipeline(run.id, fromStep)
    .then(async () => {
      await prisma.project.update({
        where: { id: run.projectId },
        data: { status: "DONE" }
      });
    })
    .catch(async (error) => {
      await markRunStatus(run.id, "failed");
      await appendRunLog(run.id, `Retry failed: ${(error as Error).message}`);
      await prisma.project.update({
        where: { id: run.projectId },
        data: { status: "FAILED" }
      });
    });
  res.json({ status: "retrying", runId: run.id });
});

runRouter.post("/run/:runId/cancel", async (req, res) => {
  const run = await prisma.run.findUnique({ where: { id: req.params.runId } });
  if (!run) {
    res.status(404).json({ error: "Run not found." });
    return;
  }
  await prisma.run.update({
    where: { id: run.id },
    data: { status: "canceled" }
  });
  await appendRunLog(run.id, "Run canceled.");
  res.json({ status: "canceled" });
});

runRouter.get("/run/:runId/download", async (req, res) => {
  const run = await prisma.run.findUnique({ where: { id: req.params.runId } });
  if (!run) {
    res.status(404).json({ error: "Run not found." });
    return;
  }
  const artifacts = run.artifactsJson as { mp4Path?: string };
  if (!artifacts?.mp4Path) {
    res.status(404).json({ error: "MP4 not available." });
    return;
  }
  try {
    await fs.access(artifacts.mp4Path);
    res.download(artifacts.mp4Path, `tiktok-ai-${run.id}.mp4`);
  } catch {
    res.status(404).json({ error: "MP4 file missing." });
  }
});

runRouter.get("/run/:runId/thumb", async (req, res) => {
  const run = await prisma.run.findUnique({ where: { id: req.params.runId } });
  if (!run) {
    res.status(404).json({ error: "Run not found." });
    return;
  }
  const artifacts = run.artifactsJson as { thumbPath?: string };
  if (!artifacts?.thumbPath) {
    res.status(404).json({ error: "Thumbnail not available." });
    return;
  }
  try {
    await fs.access(artifacts.thumbPath);
    res.sendFile(artifacts.thumbPath);
  } catch {
    res.status(404).json({ error: "Thumbnail file missing." });
  }
});

runRouter.get("/run/:runId/export", async (req, res) => {
  const run = await prisma.run.findUnique({ where: { id: req.params.runId } });
  if (!run) {
    res.status(404).json({ error: "Run not found." });
    return;
  }
  const artifacts = run.artifactsJson as { exportJsonPath?: string };
  if (!artifacts?.exportJsonPath) {
    res.status(404).json({ error: "Export JSON not available." });
    return;
  }
  try {
    await fs.access(artifacts.exportJsonPath);
    res.download(artifacts.exportJsonPath, `tiktok-ai-${run.id}-export.json`);
  } catch {
    res.status(404).json({ error: "Export JSON missing." });
  }
});

runRouter.get("/run/:runId/verify", async (req, res) => {
  try {
    const report = await verifyRunArtifacts(req.params.runId);
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});
