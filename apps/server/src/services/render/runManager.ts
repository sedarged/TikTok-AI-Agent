import { EventEmitter } from "events";

type RunEvent =
  | { type: "progress"; progress: number; step?: string }
  | { type: "log"; message: string }
  | { type: "status"; status: string }
  | { type: "done" }
  | { type: "failed"; error: string };

const runEmitters = new Map<string, EventEmitter>();

export function getRunEmitter(runId: string) {
  if (!runEmitters.has(runId)) {
    runEmitters.set(runId, new EventEmitter());
  }
  return runEmitters.get(runId)!;
}

export function emitRunEvent(runId: string, event: RunEvent) {
  const emitter = getRunEmitter(runId);
  emitter.emit("event", event);
}

export type { RunEvent };
