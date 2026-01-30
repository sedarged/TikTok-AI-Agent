import type { Project, Scene, PlanVersion } from '@prisma/client';
import { getNichePack, getScenePacing } from '../nichePacks.js';
import type { ValidationResult } from '../../utils/types.js';

interface PlanWithScenes extends PlanVersion {
  scenes: Scene[];
}

export function validatePlan(planVersion: PlanWithScenes, project: Project): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  const pack = getNichePack(project.nichePackId);
  if (!pack) {
    errors.push('Invalid niche pack');
    return { errors, warnings, suggestions };
  }

  const pacing = getScenePacing(pack, project.targetLengthSec);

  // Check hook
  if (!planVersion.hookSelected || planVersion.hookSelected.trim().length === 0) {
    errors.push('No hook selected');
  }

  // Check outline
  if (!planVersion.outline || planVersion.outline.trim().length === 0) {
    errors.push('Outline is empty');
  }

  // Check scenes
  if (planVersion.scenes.length === 0) {
    errors.push('No scenes defined');
  } else {
    // Check scene count
    if (planVersion.scenes.length < pacing.minScenes) {
      errors.push(`Too few scenes: ${planVersion.scenes.length} (minimum: ${pacing.minScenes})`);
    } else if (planVersion.scenes.length > pacing.maxScenes) {
      warnings.push(
        `Many scenes: ${planVersion.scenes.length} (recommended max: ${pacing.maxScenes})`
      );
    }

    // Check each scene
    for (const scene of planVersion.scenes) {
      if (!scene.narrationText || scene.narrationText.trim().length === 0) {
        errors.push(`Scene ${scene.idx + 1}: Narration text is empty`);
      }

      if (!scene.visualPrompt || scene.visualPrompt.trim().length === 0) {
        errors.push(`Scene ${scene.idx + 1}: Visual prompt is empty`);
      }

      if (scene.durationTargetSec < pacing.minDurationSec) {
        warnings.push(
          `Scene ${scene.idx + 1}: Duration (${scene.durationTargetSec}s) is below minimum (${pacing.minDurationSec}s)`
        );
      } else if (scene.durationTargetSec > pacing.maxDurationSec) {
        warnings.push(
          `Scene ${scene.idx + 1}: Duration (${scene.durationTargetSec}s) exceeds maximum (${pacing.maxDurationSec}s)`
        );
      }
    }

    // Hook 3s: first scene should be under 5s so the hook lands in the first 3 seconds
    const firstScene = planVersion.scenes[0];
    if (firstScene && firstScene.durationTargetSec > 4) {
      warnings.push('First scene should be under 5s so the hook lands in the first 3 seconds.');
    }

    // Check total duration
    const totalDuration = planVersion.scenes.reduce((sum, s) => sum + s.durationTargetSec, 0);
    const tolerance = project.targetLengthSec >= 180 ? 5 : 3;

    if (Math.abs(totalDuration - project.targetLengthSec) > tolerance) {
      if (totalDuration < project.targetLengthSec - tolerance) {
        warnings.push(
          `Total duration (${totalDuration.toFixed(1)}s) is below target (${project.targetLengthSec}s)`
        );
        suggestions.push('Use "Auto-fit durations" to adjust scene lengths');
      } else if (totalDuration > project.targetLengthSec + tolerance) {
        warnings.push(
          `Total duration (${totalDuration.toFixed(1)}s) exceeds target (${project.targetLengthSec}s)`
        );
        suggestions.push('Use "Auto-fit durations" or reduce scene durations manually');
      }
    }
  }

  // Check script
  if (!planVersion.scriptFull || planVersion.scriptFull.trim().length === 0) {
    warnings.push('Full script is empty - will be generated from scene narrations');
  }

  // Suggestions
  if (planVersion.scenes.length > 0 && planVersion.scenes.every((s) => !s.isLocked)) {
    suggestions.push("Consider locking scenes you're happy with before regenerating others");
  }

  return { errors, warnings, suggestions };
}

export function autofitDurations(scenes: Scene[], project: Project): Scene[] {
  const pack = getNichePack(project.nichePackId);
  if (!pack) return scenes;

  const pacing = getScenePacing(pack, project.targetLengthSec);
  const targetTotal = project.targetLengthSec;

  // Calculate current total of locked scenes
  const lockedScenes = scenes.filter((s) => s.isLocked);
  const unlockedScenes = scenes.filter((s) => !s.isLocked);

  const lockedTotal = lockedScenes.reduce((sum, s) => sum + s.durationTargetSec, 0);
  const remainingBudget = targetTotal - lockedTotal;

  if (unlockedScenes.length === 0) {
    // All scenes are locked, just update times
    return updateSceneTimes(scenes);
  }

  // Distribute remaining budget among unlocked scenes
  const avgDuration = remainingBudget / unlockedScenes.length;

  // Clamp to min/max
  const clampedDuration = Math.max(
    pacing.minDurationSec,
    Math.min(pacing.maxDurationSec, avgDuration)
  );

  // Update unlocked scenes
  const updatedScenes = scenes.map((scene) => {
    if (scene.isLocked) {
      return scene;
    }
    return {
      ...scene,
      durationTargetSec: clampedDuration,
    };
  });

  // Fine-tune to hit target exactly
  const currentTotal = updatedScenes.reduce((sum, s) => sum + s.durationTargetSec, 0);
  const diff = targetTotal - currentTotal;

  if (Math.abs(diff) > 0.1 && unlockedScenes.length > 0) {
    // Distribute difference across unlocked scenes
    const adjustmentPerScene = diff / unlockedScenes.length;

    for (const scene of updatedScenes) {
      if (!scene.isLocked) {
        const newDuration = scene.durationTargetSec + adjustmentPerScene;
        scene.durationTargetSec = Math.max(
          pacing.minDurationSec,
          Math.min(pacing.maxDurationSec, newDuration)
        );
      }
    }
  }

  return updateSceneTimes(updatedScenes);
}

function updateSceneTimes(scenes: Scene[]): Scene[] {
  let currentTime = 0;

  return scenes.map((scene) => {
    const startTime = currentTime;
    const endTime = currentTime + scene.durationTargetSec;
    currentTime = endTime;

    return {
      ...scene,
      startTimeSec: startTime,
      endTimeSec: endTime,
    };
  });
}
