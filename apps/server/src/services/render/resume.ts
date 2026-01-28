import { prisma } from '../../db/prisma.js';

export type ResumeState = {
  lastCompletedStep?: string;
  completedSceneIdxs?: number[];
};

export async function markStepCompleted(runId: string, step: string) {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) return;
  const state = parse(run.resumeStateJson);
  state.lastCompletedStep = step;
  await prisma.run.update({ where: { id: runId }, data: { resumeStateJson: JSON.stringify(state) } });
}

export async function markSceneCompleted(runId: string, sceneIdx: number) {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) return;
  const state = parse(run.resumeStateJson);
  const set = new Set<number>(state.completedSceneIdxs ?? []);
  set.add(sceneIdx);
  state.completedSceneIdxs = Array.from(set).sort((a, b) => a - b);
  await prisma.run.update({ where: { id: runId }, data: { resumeStateJson: JSON.stringify(state) } });
}

function parse(s: string): ResumeState {
  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
}

