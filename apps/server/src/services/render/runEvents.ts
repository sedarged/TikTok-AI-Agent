import { EventEmitter } from 'node:events';

type RunEvent =
  | { type: 'log'; ts: string; msg: string }
  | { type: 'progress'; progress: number; currentStep: string | null }
  | { type: 'status'; status: string }
  | { type: 'done' }
  | { type: 'failed'; error: string };

class RunEvents {
  private emitters = new Map<string, EventEmitter>();

  get(runId: string) {
    let e = this.emitters.get(runId);
    if (!e) {
      e = new EventEmitter();
      this.emitters.set(runId, e);
    }
    return e;
  }

  emit(runId: string, ev: RunEvent) {
    this.get(runId).emit('event', ev);
  }
}

export const runEvents = new RunEvents();
export type { RunEvent };

