import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import type { Project } from '@prisma/client';
import {
  generatePlan,
  regenerateHooks,
  regenerateOutline,
  regenerateScript,
  regenerateScene,
} from '../src/services/plan/planGenerator.js';
import { getNichePack, getScenePacing } from '../src/services/nichePacks.js';
import * as openaiModule from '../src/services/providers/openai.js';
import * as envModule from '../src/env.js';
import { prisma } from '../src/db/client.js';

// Helper to build test project data
function buildProjectData(
  overrides: Partial<Project> = {}
): Omit<Project, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: 'Test Project',
    topic: 'Testing deep ocean mysteries',
    nichePackId: 'facts',
    language: 'en',
    targetLengthSec: 60,
    tempo: 'normal',
    voicePreset: 'alloy',
    visualStylePreset: null,
    seoKeywords: null,
    status: 'DRAFT_PLAN',
    latestPlanVersionId: null,
    ...overrides,
  };
}

// Helper to create and save test project to DB
async function createTestProject(overrides: Partial<Project> = {}): Promise<Project> {
  return prisma.project.create({
    data: buildProjectData(overrides),
  });
}

// Clean up DB before/after tests
async function cleanDb() {
  await prisma.scene.deleteMany();
  await prisma.planVersion.deleteMany();
  await prisma.project.deleteMany();
}

describe('planGenerator - Template Mode (no OpenAI)', () => {
  beforeEach(async () => {
    await cleanDb();
    // Ensure test mode is enabled (no OpenAI calls)
    vi.spyOn(envModule, 'isOpenAIConfigured').mockReturnValue(false);
    vi.spyOn(envModule, 'isTestMode').mockReturnValue(true);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  describe('generatePlan', () => {
    it('generates a complete plan with 5 hooks, outline, scenes', async () => {
      const project = await createTestProject({ nichePackId: 'facts', targetLengthSec: 60 });

      const plan = await generatePlan(project);

      expect(plan).toBeDefined();
      expect(plan.projectId).toBe(project.id);
      expect(plan.hookSelected).toBeTruthy();
      expect(plan.outline).toBeTruthy();
      expect(plan.scriptFull).toBeTruthy();

      // Check hook options
      const hookOptions = JSON.parse(plan.hookOptionsJson) as string[];
      expect(hookOptions).toHaveLength(5);
      expect(hookOptions[0]).toContain(project.topic);

      // Check scenes were created in DB
      const scenes = await prisma.scene.findMany({
        where: { planVersionId: plan.id },
        orderBy: { idx: 'asc' },
      });

      expect(scenes.length).toBeGreaterThanOrEqual(6);
      expect(scenes.length).toBeLessThanOrEqual(8);

      // Verify scene structure
      const firstScene = scenes[0];
      expect(firstScene.idx).toBe(0);
      expect(firstScene.narrationText).toBeTruthy();
      expect(firstScene.onScreenText).toBeTruthy();
      expect(firstScene.visualPrompt).toBeTruthy();
      expect(firstScene.negativePrompt).toBeTruthy();
      expect(firstScene.effectPreset).toBeTruthy();
      expect(firstScene.durationTargetSec).toBeGreaterThan(0);
      expect(firstScene.startTimeSec).toBe(0);
      expect(firstScene.endTimeSec).toBe(firstScene.durationTargetSec);
    });

    it('calculates scene count based on niche pack pacing', async () => {
      const pack = getNichePack('facts');
      expect(pack).toBeDefined();

      const pacing60 = getScenePacing(pack!, 60);
      expect(pacing60.minScenes).toBe(5);
      expect(pacing60.maxScenes).toBe(7);

      const project = await createTestProject({ nichePackId: 'facts', targetLengthSec: 60 });
      const plan = await generatePlan(project);

      const scenes = await prisma.scene.findMany({ where: { planVersionId: plan.id } });
      const sceneCount = scenes.length;

      // Scene count should be within or close to pacing range (test mode caps at 8)
      expect(sceneCount).toBeGreaterThanOrEqual(pacing60.minScenes);
      expect(sceneCount).toBeLessThanOrEqual(Math.min(8, pacing60.maxScenes));
    });

    it('respects different target lengths for scene count', async () => {
      const pack = getNichePack('facts');
      expect(pack).toBeDefined();

      // 60s should have fewer scenes than 120s
      const project60 = await createTestProject({ targetLengthSec: 60 });
      const plan60 = await generatePlan(project60);
      const scenes60 = await prisma.scene.findMany({ where: { planVersionId: plan60.id } });

      await cleanDb();

      const project120 = await createTestProject({ targetLengthSec: 120 });
      const plan120 = await generatePlan(project120);
      const scenes120 = await prisma.scene.findMany({ where: { planVersionId: plan120.id } });

      expect(scenes120.length).toBeGreaterThanOrEqual(scenes60.length);
    });

    it('calculates duration estimates based on WPM and tempo', async () => {
      const projectNormal = await createTestProject({ tempo: 'normal', targetLengthSec: 60 });
      const planNormal = await generatePlan(projectNormal);
      const estimatesNormal = JSON.parse(planNormal.estimatesJson) as {
        wpm: number;
        estimatedLengthSec: number;
      };

      expect(estimatesNormal.wpm).toBe(150); // normal tempo

      await cleanDb();

      const projectSlow = await createTestProject({ tempo: 'slow', targetLengthSec: 60 });
      const planSlow = await generatePlan(projectSlow);
      const estimatesSlow = JSON.parse(planSlow.estimatesJson) as {
        wpm: number;
        estimatedLengthSec: number;
      };

      expect(estimatesSlow.wpm).toBe(120); // slow tempo

      await cleanDb();

      const projectFast = await createTestProject({ tempo: 'fast', targetLengthSec: 60 });
      const planFast = await generatePlan(projectFast);
      const estimatesFast = JSON.parse(planFast.estimatesJson) as {
        wpm: number;
        estimatedLengthSec: number;
      };

      expect(estimatesFast.wpm).toBe(180); // fast tempo
    });

    it('generates scenes with sequential timing', async () => {
      const project = await createTestProject({ targetLengthSec: 60 });
      const plan = await generatePlan(project);

      const scenes = await prisma.scene.findMany({
        where: { planVersionId: plan.id },
        orderBy: { idx: 'asc' },
      });

      // Verify timing is sequential
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        expect(scene.idx).toBe(i);

        if (i === 0) {
          expect(scene.startTimeSec).toBe(0);
        } else {
          const prevScene = scenes[i - 1];
          expect(scene.startTimeSec).toBe(prevScene.endTimeSec);
        }

        expect(scene.endTimeSec).toBe(scene.startTimeSec + scene.durationTargetSec);
      }
    });

    it('uses niche pack style and negative prompt', async () => {
      const pack = getNichePack('horror');
      expect(pack).toBeDefined();

      const project = await createTestProject({ nichePackId: 'horror', targetLengthSec: 60 });
      const plan = await generatePlan(project);

      const scenes = await prisma.scene.findMany({ where: { planVersionId: plan.id } });

      scenes.forEach((scene) => {
        expect(scene.visualPrompt).toContain('Dark, eerie, cinematic horror style');
        expect(scene.negativePrompt).toContain('blurry');
        expect(scene.negativePrompt).toContain('happy, bright colors, cartoon, anime');
        expect(scene.effectPreset).toBe('slow_zoom_in'); // horror default
      });
    });

    it('generates 5 template hooks when OpenAI not configured', async () => {
      const project = await createTestProject({ topic: 'artificial intelligence' });
      const hooks = await regenerateHooks(project);

      expect(hooks).toHaveLength(5);
      hooks.forEach((hook) => {
        expect(hook).toContain('artificial intelligence');
        expect(hook.length).toBeGreaterThan(10);
      });
    });

    it('generates template outline with hook and topic', async () => {
      const project = await createTestProject({ topic: 'space exploration' });
      const hook = 'Did you know about space exploration?';

      const outline = await regenerateOutline(project, hook);

      expect(outline).toContain(hook);
      expect(outline).toContain('space exploration');
      expect(outline).toContain('1.');
      expect(outline).toContain('2.');
    });

    it('distributes scenes evenly across target duration', async () => {
      const project = await createTestProject({ targetLengthSec: 60 });
      const plan = await generatePlan(project);

      const scenes = await prisma.scene.findMany({
        where: { planVersionId: plan.id },
        orderBy: { idx: 'asc' },
      });

      const totalDuration = scenes.reduce((sum, s) => sum + s.durationTargetSec, 0);

      // Total should approximately match target (within reasonable range)
      expect(totalDuration).toBeGreaterThanOrEqual(50);
      expect(totalDuration).toBeLessThanOrEqual(70);

      // Average duration should be reasonable
      const avgDuration = totalDuration / scenes.length;
      expect(avgDuration).toBeGreaterThan(5);
      expect(avgDuration).toBeLessThan(15);
    });

    it('creates different scenes for different niche packs', async () => {
      const projectFacts = await createTestProject({ nichePackId: 'facts', targetLengthSec: 60 });
      const planFacts = await generatePlan(projectFacts);
      const scenesFacts = await prisma.scene.findMany({ where: { planVersionId: planFacts.id } });

      await cleanDb();

      const projectHorror = await createTestProject({ nichePackId: 'horror', targetLengthSec: 60 });
      const planHorror = await generatePlan(projectHorror);
      const scenesHorror = await prisma.scene.findMany({
        where: { planVersionId: planHorror.id },
      });

      // Different niche packs should use different styles
      const factsStyle = scenesFacts[0].visualPrompt;
      const horrorStyle = scenesHorror[0].visualPrompt;

      expect(factsStyle).not.toBe(horrorStyle);
      expect(factsStyle).toContain('Clean, modern, educational style');
      expect(horrorStyle).toContain('Dark, eerie, cinematic horror style');
    });
  });

  describe('regenerateScript', () => {
    it('keeps scenes unchanged in template mode', async () => {
      const project = await createTestProject();
      const plan = await generatePlan(project);

      const scenes = await prisma.scene.findMany({
        where: { planVersionId: plan.id },
        orderBy: { idx: 'asc' },
      });

      const hook = 'Test hook';
      const outline = 'Test outline';

      const result = await regenerateScript(project, hook, outline, scenes);

      expect(result.scenes.length).toBe(scenes.length);
      result.scenes.forEach((scene, i) => {
        expect(scene.narrationText).toBe(scenes[i].narrationText);
      });

      expect(result.scriptFull).toBe(scenes.map((s) => s.narrationText).join('\n\n'));
    });
  });

  describe('regenerateScene', () => {
    it('returns scene unchanged in template mode', async () => {
      const project = await createTestProject();
      const plan = await generatePlan(project);

      const scenes = await prisma.scene.findMany({
        where: { planVersionId: plan.id },
        orderBy: { idx: 'asc' },
      });

      const scene = scenes[0];
      const result = await regenerateScene(scene, project, scenes);

      expect(result.narrationText).toBe(scene.narrationText);
      expect(result.onScreenText).toBe(scene.onScreenText);
      expect(result.visualPrompt).toBe(scene.visualPrompt);
    });
  });

  describe('Error handling', () => {
    it('throws error for invalid niche pack', async () => {
      const project = await createTestProject({ nichePackId: 'invalid-pack' });

      await expect(generatePlan(project)).rejects.toThrow('Niche pack not found');
    });

    it('throws error when regenerating hooks with invalid niche pack', async () => {
      const project = await createTestProject({ nichePackId: 'invalid-pack' });

      await expect(regenerateHooks(project)).rejects.toThrow('Niche pack not found');
    });
  });
});

describe('planGenerator - AI Mode (with OpenAI mocked)', () => {
  let callOpenAISpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await cleanDb();
    // Enable AI mode
    vi.spyOn(envModule, 'isOpenAIConfigured').mockReturnValue(true);
    vi.spyOn(envModule, 'isTestMode').mockReturnValue(false);

    // Mock callOpenAI
    callOpenAISpy = vi.spyOn(openaiModule, 'callOpenAI');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  describe('generatePlan with mocked OpenAI', () => {
    it('generates plan using AI responses', async () => {
      // Mock hooks response
      callOpenAISpy.mockResolvedValueOnce(
        JSON.stringify([
          'AI hook 1 about testing',
          'AI hook 2 about testing',
          'AI hook 3 about testing',
          'AI hook 4 about testing',
          'AI hook 5 about testing',
        ])
      );

      // Mock outline response
      callOpenAISpy.mockResolvedValueOnce('AI generated outline\n1. Point one\n2. Point two');

      // Mock scenes response
      const mockScenes = Array.from({ length: 6 }, (_, i) => ({
        idx: i,
        narrationText: `AI narration ${i}`,
        onScreenText: `TEXT ${i}`,
        visualPrompt: `AI visual prompt ${i}`,
        durationTargetSec: 10,
      }));
      callOpenAISpy.mockResolvedValueOnce(JSON.stringify(mockScenes));

      const project = await createTestProject({ targetLengthSec: 60 });
      const plan = await generatePlan(project);

      expect(plan).toBeDefined();
      expect(callOpenAISpy).toHaveBeenCalledTimes(3); // hooks, outline, scenes

      const hookOptions = JSON.parse(plan.hookOptionsJson) as string[];
      expect(hookOptions).toHaveLength(5);
      expect(hookOptions[0]).toBe('AI hook 1 about testing');

      expect(plan.outline).toContain('AI generated outline');

      const scenes = await prisma.scene.findMany({
        where: { planVersionId: plan.id },
        orderBy: { idx: 'asc' },
      });

      expect(scenes).toHaveLength(6);
      expect(scenes[0].narrationText).toBe('AI narration 0');
    });

    it('falls back to template when AI returns invalid JSON', async () => {
      // Mock invalid JSON response for hooks
      callOpenAISpy.mockResolvedValueOnce('Invalid JSON response');

      const project = await createTestProject();
      const hooks = await regenerateHooks(project);

      // Should fall back to template hooks
      expect(hooks).toHaveLength(5);
      expect(hooks[0]).toContain(project.topic);
    });

    it('falls back to template when AI returns wrong number of hooks', async () => {
      // Mock response with only 3 hooks instead of 5
      callOpenAISpy.mockResolvedValueOnce(JSON.stringify(['hook 1', 'hook 2', 'hook 3']));

      const project = await createTestProject();
      const hooks = await regenerateHooks(project);

      // Should fall back to template hooks
      expect(hooks).toHaveLength(5);
    });

    it('falls back to template when AI call throws error', async () => {
      // Mock error
      callOpenAISpy.mockRejectedValueOnce(new Error('API error'));

      const project = await createTestProject();
      const hooks = await regenerateHooks(project);

      // Should fall back to template hooks
      expect(hooks).toHaveLength(5);
      expect(hooks[0]).toContain(project.topic);
    });

    it('regenerateScript updates narration with AI response', async () => {
      const project = await createTestProject();

      // First generate a plan with template
      vi.spyOn(envModule, 'isOpenAIConfigured').mockReturnValue(false);
      const plan = await generatePlan(project);
      const scenes = await prisma.scene.findMany({
        where: { planVersionId: plan.id },
        orderBy: { idx: 'asc' },
      });

      // Now enable AI mode
      vi.spyOn(envModule, 'isOpenAIConfigured').mockReturnValue(true);

      // Mock AI response
      const updates = scenes.map((s, i) => ({
        idx: i,
        narrationText: `Updated AI narration ${i}`,
      }));
      callOpenAISpy.mockResolvedValueOnce(JSON.stringify(updates));

      const hook = 'Test hook';
      const outline = 'Test outline';

      const result = await regenerateScript(project, hook, outline, scenes);

      expect(callOpenAISpy).toHaveBeenCalled();
      expect(result.scenes.length).toBe(scenes.length);
      expect(result.scenes[0].narrationText).toBe('Updated AI narration 0');
      expect(result.scriptFull).toContain('Updated AI narration 0');
    });

    it('regenerateScript preserves locked scenes', async () => {
      const project = await createTestProject();

      vi.spyOn(envModule, 'isOpenAIConfigured').mockReturnValue(false);
      const plan = await generatePlan(project);
      const scenes = await prisma.scene.findMany({
        where: { planVersionId: plan.id },
        orderBy: { idx: 'asc' },
      });

      // Lock first scene
      scenes[0].isLocked = true;

      vi.spyOn(envModule, 'isOpenAIConfigured').mockReturnValue(true);

      const updates = scenes.map((s, i) => ({
        idx: i,
        narrationText: `Updated AI narration ${i}`,
      }));
      callOpenAISpy.mockResolvedValueOnce(JSON.stringify(updates));

      const result = await regenerateScript(project, 'hook', 'outline', scenes);

      // Locked scene should not be updated
      expect(result.scenes[0].narrationText).toBe(scenes[0].narrationText);
      // Unlocked scenes should be updated
      expect(result.scenes[1].narrationText).toBe('Updated AI narration 1');
    });

    it('regenerateScene calls AI with context', async () => {
      const project = await createTestProject();

      vi.spyOn(envModule, 'isOpenAIConfigured').mockReturnValue(false);
      const plan = await generatePlan(project);
      const scenes = await prisma.scene.findMany({
        where: { planVersionId: plan.id },
        orderBy: { idx: 'asc' },
      });

      vi.spyOn(envModule, 'isOpenAIConfigured').mockReturnValue(true);

      callOpenAISpy.mockResolvedValueOnce(
        JSON.stringify({
          narrationText: 'New AI narration',
          onScreenText: 'NEW TEXT',
          visualPrompt: 'New AI visual',
        })
      );

      const scene = scenes[1]; // Middle scene
      const result = await regenerateScene(scene, project, scenes);

      expect(callOpenAISpy).toHaveBeenCalled();
      const callArgs = callOpenAISpy.mock.calls[0][0] as string;

      // Should include context from previous and next scenes
      expect(callArgs).toContain('Scene index: 2'); // idx + 1
      expect(callArgs).toContain('Previous scene narration');
      expect(callArgs).toContain('Next scene narration');

      expect(result.narrationText).toBe('New AI narration');
      expect(result.onScreenText).toBe('NEW TEXT');
      expect(result.visualPrompt).toBe('New AI visual');
    });

    it('regenerateScene handles first scene without previous', async () => {
      const project = await createTestProject();

      vi.spyOn(envModule, 'isOpenAIConfigured').mockReturnValue(false);
      const plan = await generatePlan(project);
      const scenes = await prisma.scene.findMany({
        where: { planVersionId: plan.id },
        orderBy: { idx: 'asc' },
      });

      vi.spyOn(envModule, 'isOpenAIConfigured').mockReturnValue(true);

      callOpenAISpy.mockResolvedValueOnce(
        JSON.stringify({
          narrationText: 'New first scene',
          onScreenText: 'FIRST',
          visualPrompt: 'First visual',
        })
      );

      const scene = scenes[0];
      await regenerateScene(scene, project, scenes);

      const callArgs = callOpenAISpy.mock.calls[0][0] as string;
      expect(callArgs).toContain('This is the first scene');
    });

    it('regenerateScene handles last scene without next', async () => {
      const project = await createTestProject();

      vi.spyOn(envModule, 'isOpenAIConfigured').mockReturnValue(false);
      const plan = await generatePlan(project);
      const scenes = await prisma.scene.findMany({
        where: { planVersionId: plan.id },
        orderBy: { idx: 'asc' },
      });

      vi.spyOn(envModule, 'isOpenAIConfigured').mockReturnValue(true);

      callOpenAISpy.mockResolvedValueOnce(
        JSON.stringify({
          narrationText: 'New last scene',
          onScreenText: 'LAST',
          visualPrompt: 'Last visual',
        })
      );

      const lastScene = scenes[scenes.length - 1];
      await regenerateScene(lastScene, project, scenes);

      const callArgs = callOpenAISpy.mock.calls[0][0] as string;
      expect(callArgs).toContain('This is the last scene');
    });
  });
});

describe('planGenerator - Scene Pacing Logic', () => {
  beforeEach(async () => {
    await cleanDb();
    vi.spyOn(envModule, 'isOpenAIConfigured').mockReturnValue(false);
    vi.spyOn(envModule, 'isTestMode').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses correct pacing for 60s target', () => {
    const pack = getNichePack('facts');
    const pacing = getScenePacing(pack!, 60);

    expect(pacing.minScenes).toBe(5);
    expect(pacing.maxScenes).toBe(7);
    expect(pacing.minDurationSec).toBe(6);
    expect(pacing.maxDurationSec).toBe(14);
  });

  it('uses correct pacing for 90s target', () => {
    const pack = getNichePack('facts');
    const pacing = getScenePacing(pack!, 90);

    expect(pacing.minScenes).toBe(7);
    expect(pacing.maxScenes).toBe(9);
    expect(pacing.minDurationSec).toBe(7);
    expect(pacing.maxDurationSec).toBe(15);
  });

  it('uses correct pacing for 120s target', () => {
    const pack = getNichePack('facts');
    const pacing = getScenePacing(pack!, 120);

    expect(pacing.minScenes).toBe(9);
    expect(pacing.maxScenes).toBe(11);
    expect(pacing.minDurationSec).toBe(8);
    expect(pacing.maxDurationSec).toBe(16);
  });

  it('uses correct pacing for 180s target', () => {
    const pack = getNichePack('facts');
    const pacing = getScenePacing(pack!, 180);

    expect(pacing.minScenes).toBe(11);
    expect(pacing.maxScenes).toBe(14);
    expect(pacing.minDurationSec).toBe(9);
    expect(pacing.maxDurationSec).toBe(18);
  });

  it('uses 180s pacing for values above 180', () => {
    const pack = getNichePack('facts');
    const pacing = getScenePacing(pack!, 300);

    // Should use 180s pacing as max
    expect(pacing.minScenes).toBe(11);
    expect(pacing.maxScenes).toBe(14);
  });
});
