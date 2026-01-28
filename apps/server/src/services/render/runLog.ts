import { prisma } from "../../db/client.js";
import { emitRunEvent } from "./runManager.js";

type LogEntry = { ts: string; message: string };

export async function appendRunLog(runId: string, message: string) {
  const entry: LogEntry = { ts: new Date().toISOString(), message };
  const run = await prisma.run.findUnique({ where: { id: runId } });
  const logs = (run?.logsJson as LogEntry[]) ?? [];
  logs.push(entry);
  await prisma.run.update({
    where: { id: runId },
    data: { logsJson: logs }
  });
  emitRunEvent(runId, { type: "log", message });
}

export async function updateRunProgress(
  runId: string,
  progress: number,
  step?: string
) {
  await prisma.run.update({
    where: { id: runId },
    data: { progress, currentStep: step }
  });
  emitRunEvent(runId, { type: "progress", progress, step });
}

export async function markRunStatus(runId: string, status: "done" | "failed" | "running" | "queued" | "canceled") {
  await prisma.run.update({
    where: { id: runId },
    data: { status }
  });
  emitRunEvent(runId, { type: "status", status });
}
