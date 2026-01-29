import { describe, expect, it } from 'vitest';
import { validatePlan, autofitDurations } from '../src/services/plan/planValidator.js';
import type { Project, Scene, PlanVersion } from '@prisma/client';

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    title: 'Test',
    topic: 'Unit test topic',
    nichePackId: 'facts',
    language: 'en',
    targetLengthSec: 60,
    tempo: 'normal',
    voicePreset: 'alloy',
    visualStylePreset: null,
    status: 'DRAFT_PLAN',
    latestPlanVersionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildScene(idx: number, overrides: Partial<Scene> = {}): Scene {
  return {
    id: `scene-${idx}`,
    projectId: 'project-1',
    planVersionId: 'plan-1',
    idx,
    narrationText: `Narration ${idx}`,
    onScreenText: `Text ${idx}`,
    visualPrompt: `Prompt ${idx}`,
    negativePrompt: '',
    effectPreset: 'slow_zoom_in',
    durationTargetSec: 10,
    startTimeSec: idx * 10,
    endTimeSec: (idx + 1) * 10,
    isLocked: false,
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildPlanVersion(scenes: Scene[], overrides: Partial<PlanVersion> = {}): PlanVersion {
  return {
    id: 'plan-1',
    projectId: 'project-1',
    createdAt: new Date(),
    hookOptionsJson: '[]',
    hookSelected: 'Test hook',
    outline: 'Test outline',
    scriptFull: scenes.map((s) => s.narrationText).join('\n\n'),
    estimatesJson: '{}',
    validationJson: '{}',
    ...overrides,
  };
}

describe('planValidator', () => {
  it('returns errors for missing hook and outline', () => {
    const project = buildProject();
    const scenes = [buildScene(0)];
    const plan = buildPlanVersion(scenes, { hookSelected: '', outline: '' });

    const result = validatePlan({ ...plan, scenes }, project);
    expect(result.errors).toContain('No hook selected');
    expect(result.errors).toContain('Outline is empty');
  });

  it('auto-fits durations within pacing and keeps locks', () => {
    const project = buildProject({ targetLengthSec: 60 });
    const scenes = [
      buildScene(0, { durationTargetSec: 14, isLocked: true }),
      buildScene(1, { durationTargetSec: 4 }),
      buildScene(2, { durationTargetSec: 4 }),
      buildScene(3, { durationTargetSec: 4 }),
      buildScene(4, { durationTargetSec: 4 }),
      buildScene(5, { durationTargetSec: 4 }),
    ];

    const updated = autofitDurations(scenes, project);
    const lockedScene = updated.find((s) => s.id === 'scene-0');
    expect(lockedScene?.durationTargetSec).toBe(14);

    const total = updated.reduce((sum, s) => sum + s.durationTargetSec, 0);
    expect(Math.abs(total - project.targetLengthSec)).toBeLessThanOrEqual(1);
  });
});
