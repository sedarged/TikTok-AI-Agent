import { prisma } from '../../db/prisma.js';
import { runEvents } from './runEvents.js';

export type RunLogEntry = { ts: string; msg: string };

export async function appendRunLog(runId: string, msg: string) {
  const ts = new Date().toISOString();
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) return;
  let logs: RunLogEntry[] = [];
  try {
    logs = JSON.parse(run.logsJson);
  } catch {
    logs = [];
  }
  logs.push({ ts, msg });
  await prisma.run.update({ where: { id: runId }, data: { logsJson: JSON.stringify(logs) } });
  runEvents.emit(runId, { type: 'log', ts, msg });
}

export async function setRunProgress(runId: string, progress: number, currentStep?: string | null) {
  await prisma.run.update({
    where: { id: runId },
    data: { progress: Math.max(0, Math.min(100, Math.round(progress))), currentStep: currentStep ?? undefined }
  });
  runEvents.emit(runId, { type: 'progress', progress: Math.max(0, Math.min(100, Math.round(progress))), currentStep: currentStep ?? null });
}

export async function setRunStatus(runId: string, status: 'queued' | 'running' | 'done' | 'failed' | 'canceled') {
  await prisma.run.update({ where: { id: runId }, data: { status } });
  runEvents.emit(runId, { type: 'status', status });
}

