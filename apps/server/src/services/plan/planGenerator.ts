import { prisma } from '../../db/client.js';
import { v4 as uuid } from 'uuid';
import { getNichePack, getScenePacing, type NichePack } from '../nichePacks.js';
import { getScriptTemplate } from './scriptTemplates.js';
import { isOpenAIConfigured, isTestMode } from '../../env.js';
import { callOpenAI } from '../providers/openai.js';
import type { Project, Scene, Prisma, PlanVersion } from '@prisma/client';
import type { EffectPreset, SceneData } from '../../utils/types.js';
import { EFFECT_PRESETS } from '../../utils/types.js';
import { logError } from '../../utils/logger.js';
import { safeJsonParse } from '../../utils/safeJsonParse.js';

interface OpenAISceneRaw {
  narrationText?: string;
  onScreenText?: string;
  visualPrompt?: string;
  effectPreset?: string;
  durationTargetSec?: number;
}

interface ScriptUpdateRaw {
  idx: number;
  narrationText: string;
}

const HOOK_FIRST_3_SECONDS =
  'The first scene must contain the hook within the first 3 seconds; first sentence = attention grabber.';

/**
 * Helper to unwrap an array from either raw array or {field: array} wrapper object.
 * Handles both legacy array format (tests) and OpenAI json_object format.
 */
function unwrapArrayField<T>(parsed: unknown, fieldName: string): T[] | null {
  if (Array.isArray(parsed)) {
    return parsed as T[];
  }
  if (typeof parsed === 'object' && parsed !== null && fieldName in parsed) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj[fieldName])) {
      return obj[fieldName] as T[];
    }
  }
  return null;
}

export interface GeneratePlanOptions {
  scriptTemplateId?: string;
  db?: Prisma.TransactionClient;
}

export interface PlanData {
  hookOptions: string[];
  hookSelected: string;
  outline: string;
  scriptFull: string;
  scriptTemplateId: string | null;
  estimatesJson: string;
  validationJson: string;
  scenesData: SceneData[];
}

/**
 * Generate plan content (hooks, outline, scenes) without DB writes.
 * Should be called OUTSIDE transactions to avoid holding database locks during external API calls.
 */
export async function generatePlanData(
  project: Project,
  scriptTemplateId?: string
): Promise<PlanData> {
  const pack = getNichePack(project.nichePackId);
  if (!pack) {
    throw new Error(`Niche pack not found: ${project.nichePackId}`);
  }

  const scriptTemplate = scriptTemplateId ? getScriptTemplate(scriptTemplateId) : undefined;

  const pacing = getScenePacing(pack, project.targetLengthSec);
  const baseSceneCount = Math.round((pacing.minScenes + pacing.maxScenes) / 2);
  const sceneCount = isTestMode() ? Math.min(8, Math.max(6, baseSceneCount)) : baseSceneCount;

  // Step 1: Generate hooks
  const hookOptions = await generateHooks(project, pack);

  // Step 2: Select first hook by default
  const hookSelected = hookOptions[0];

  // Step 3: Generate outline
  const outline = await generateOutline(project, hookSelected, pack, scriptTemplate?.description);

  // Step 4: Generate scenes
  const scenesData = await generateScenes(
    project,
    hookSelected,
    outline,
    pack,
    sceneCount,
    scriptTemplate?.description
  );

  // Step 5: Generate full script from scenes
  const scriptFull = scenesData.map((s) => s.narrationText).join('\n\n');

  // Calculate estimates
  const totalWords = scriptFull.split(/\s+/).filter((w) => w.length > 0).length;
  const wpm = project.tempo === 'slow' ? 120 : project.tempo === 'fast' ? 180 : 150;
  const estimatedLengthSec = Math.round((totalWords / wpm) * 60);

  return {
    hookOptions,
    hookSelected,
    outline,
    scriptFull,
    scriptTemplateId: scriptTemplate?.id ?? null,
    estimatesJson: JSON.stringify({
      wpm,
      estimatedLengthSec,
      targetLengthSec: project.targetLengthSec,
    }),
    validationJson: JSON.stringify({
      errors: [],
      warnings: [],
      suggestions: [],
    }),
    scenesData,
  };
}

/**
 * Save plan data to database. Can be called within a transaction.
 */
export async function savePlanData(
  project: Project,
  planData: PlanData,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<PlanVersion> {
  const planVersionId = uuid();
  const planVersion = await db.planVersion.create({
    data: {
      id: planVersionId,
      projectId: project.id,
      hookOptionsJson: JSON.stringify(planData.hookOptions),
      hookSelected: planData.hookSelected,
      outline: planData.outline,
      scriptFull: planData.scriptFull,
      scriptTemplateId: planData.scriptTemplateId,
      estimatesJson: planData.estimatesJson,
      validationJson: planData.validationJson,
    },
  });

  // Create scenes in DB
  let currentTime = 0;
  const sceneRows = planData.scenesData.map((sceneData) => {
    const startTimeSec = currentTime;
    const endTimeSec = currentTime + sceneData.durationTargetSec;
    currentTime = endTimeSec;
    return {
      id: sceneData.id,
      projectId: project.id,
      planVersionId: planVersionId,
      idx: sceneData.idx,
      narrationText: sceneData.narrationText,
      onScreenText: sceneData.onScreenText,
      visualPrompt: sceneData.visualPrompt,
      negativePrompt: sceneData.negativePrompt,
      effectPreset: sceneData.effectPreset,
      durationTargetSec: sceneData.durationTargetSec,
      startTimeSec,
      endTimeSec,
      isLocked: false,
    };
  });
  if (sceneRows.length > 0) {
    await db.scene.createMany({ data: sceneRows });
  }

  return planVersion;
}

// Generate complete plan for a project
export async function generatePlan(project: Project, options?: GeneratePlanOptions) {
  const db = options?.db ?? prisma;

  // Generate plan content (performs OpenAI calls)
  const planData = await generatePlanData(project, options?.scriptTemplateId);

  // Save to database
  return savePlanData(project, planData, db);
}

// Generate 5 hook options
async function generateHooks(project: Project, pack: NichePack): Promise<string[]> {
  if (!isOpenAIConfigured()) {
    // Template mode - generate deterministic hooks
    return generateTemplateHooks(project.topic, pack);
  }

  const prompt = `Generate exactly 5 different hook options for a TikTok video about: "${project.topic}"

Niche: ${pack.name}
Language: ${project.language}

Hook rules to follow:
${pack.hookRules.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}

Requirements:
- Each hook should be 1-2 sentences
- Hooks should grab attention immediately
- ${HOOK_FIRST_3_SECONDS}
- Use different approaches for each hook
- Avoid brands, copyrighted content
- Keep it appropriate for general audiences

Return ONLY a JSON object with a "hooks" array containing exactly 5 hook strings, no other text:
{"hooks": ["hook1", "hook2", "hook3", "hook4", "hook5"]}`;

  try {
    const { content: response } = await callOpenAI(prompt, 'json');

    const hooks = safeJsonParse<unknown>(response, null, { source: 'generateHooks' });
    if (!hooks) {
      return generateTemplateHooks(project.topic, pack);
    }

    // Handle both array (legacy/test) and object (OpenAI json_object) formats
    const hooksArray = unwrapArrayField<unknown>(hooks, 'hooks');
    if (hooksArray) {
      // Validate and normalize hooks to ensure they're valid strings
      const normalizedHooks = hooksArray
        .filter((value): value is string => typeof value === 'string')
        .map((hook) => hook.trim())
        .filter((hook) => hook.length > 0);

      if (normalizedHooks.length >= 5) {
        return normalizedHooks.slice(0, 5);
      }
    }

    return generateTemplateHooks(project.topic, pack);
  } catch (error) {
    logError('Error generating hooks with AI:', error);
    return generateTemplateHooks(project.topic, pack);
  }
}

// Generate outline
async function generateOutline(
  project: Project,
  hook: string,
  pack: NichePack,
  structureHint?: string
): Promise<string> {
  if (!isOpenAIConfigured()) {
    return generateTemplateOutline(project.topic, hook);
  }

  const structureLine = structureHint ? `\nUse this structure: ${structureHint}\n` : '';
  const seoKeywordsLine = project.seoKeywords?.trim()
    ? `\nInclude these keywords naturally: ${project.seoKeywords.trim()}.\n`
    : '';

  const prompt = `Create a video outline for a TikTok video.

Topic: "${project.topic}"
Hook: "${hook}"
Niche: ${pack.name}
Target length: ${project.targetLengthSec} seconds
Tempo: ${project.tempo}
${structureLine}${seoKeywordsLine}
Create a concise outline with:
- Opening hook moment (${HOOK_FIRST_3_SECONDS})
- 3-5 key points or story beats
- Strong ending/call to action

Keep it brief but clear. Return just the outline text, no JSON.`;

  try {
    const { content: response } = await callOpenAI(prompt, 'text');
    return response.trim();
  } catch (error) {
    logError('Error generating outline with AI:', error);
    return generateTemplateOutline(project.topic, hook);
  }
}

// Generate scenes
async function generateScenes(
  project: Project,
  hook: string,
  outline: string,
  pack: NichePack,
  sceneCount: number,
  structureHint?: string
): Promise<SceneData[]> {
  const pacing = getScenePacing(pack, project.targetLengthSec);
  const avgDuration = project.targetLengthSec / sceneCount;

  if (!isOpenAIConfigured()) {
    return generateTemplateScenes(project, hook, outline, pack, sceneCount, avgDuration);
  }

  const structureLine = structureHint ? `\nUse this structure: ${structureHint}\n` : '';
  const seoKeywordsLine = project.seoKeywords?.trim()
    ? `\nInclude these keywords naturally: ${project.seoKeywords.trim()}.\n`
    : '';

  const prompt = `Generate ${sceneCount} scenes for a TikTok video.

Topic: "${project.topic}"
Hook: "${hook}"
Outline: ${outline}
Niche: ${pack.name}
Style: ${pack.styleBiblePrompt}
Target total duration: ${project.targetLengthSec} seconds
Average scene duration: ${avgDuration.toFixed(1)} seconds (range: ${pacing.minDurationSec}-${pacing.maxDurationSec}s)
${structureLine}${seoKeywordsLine}
For each scene provide:
1. narrationText: What the narrator says (clear, engaging, match the tempo)
2. onScreenText: Short text shown on screen (2-5 words max, key point)
3. visualPrompt: Detailed image generation prompt describing the visual composition. Include:
   - Main subject and action
   - Specific composition (centered, rule of thirds, etc.)
   - Lighting and atmosphere
   - Color palette hints
   - Camera angle (eye-level, low angle, high angle, etc.)
   - Framing (close-up, medium shot, wide shot)
   Must work well in vertical 9:16 format for mobile viewing
4. durationTargetSec: Duration in seconds for this scene

Available effect presets: ${EFFECT_PRESETS.join(', ')}
Default effect: ${pack.effectsProfile.defaultEffect}

Return ONLY valid JSON object with a "scenes" array:
{
  "scenes": [
    {
      "idx": 0,
      "narrationText": "...",
      "onScreenText": "...",
      "visualPrompt": "...",
      "durationTargetSec": 8
    }
  ]
}

Requirements:
- No copyrighted/brand references
- Visual prompts should be detailed, specific, and match the niche style: ${pack.styleBiblePrompt}
- Each visual prompt must describe a clear, well-composed scene suitable for vertical mobile video
- Scene durations should sum to approximately ${project.targetLengthSec} seconds
- First scene: ${HOOK_FIRST_3_SECONDS} Keep first scene under 5 seconds.`;

  try {
    const { content: response } = await callOpenAI(prompt, 'json');

    const scenes = safeJsonParse<unknown>(response, null, { source: 'generateScenes' });
    if (!scenes) {
      throw new Error('Invalid JSON response for scenes');
    }

    // Handle both array (legacy/test) and object (OpenAI json_object) formats
    const scenesArray = unwrapArrayField<OpenAISceneRaw>(scenes, 'scenes');

    if (scenesArray && scenesArray.length > 0) {
      return scenesArray.map((s, i) => {
        const effectPreset: EffectPreset =
          s.effectPreset && EFFECT_PRESETS.includes(s.effectPreset as EffectPreset)
            ? (s.effectPreset as EffectPreset)
            : pack.effectsProfile.defaultEffect;
        return {
          id: uuid(),
          idx: i,
          narrationText: s.narrationText || '',
          onScreenText: s.onScreenText || '',
          visualPrompt: s.visualPrompt || '',
          negativePrompt: pack.globalNegativePrompt,
          effectPreset,
          durationTargetSec: s.durationTargetSec || avgDuration,
          isLocked: false as const,
        };
      });
    }

    return generateTemplateScenes(project, hook, outline, pack, sceneCount, avgDuration);
  } catch (error) {
    logError('Error generating scenes with AI:', error);
    return generateTemplateScenes(project, hook, outline, pack, sceneCount, avgDuration);
  }
}

// Regenerate just hooks
export async function regenerateHooks(project: Project): Promise<string[]> {
  const pack = getNichePack(project.nichePackId);
  if (!pack) throw new Error('Niche pack not found');
  return generateHooks(project, pack);
}

// Regenerate just outline
export async function regenerateOutline(project: Project, hook: string): Promise<string> {
  const pack = getNichePack(project.nichePackId);
  if (!pack) throw new Error('Niche pack not found');
  return generateOutline(project, hook, pack);
}

// Regenerate script from scenes
export async function regenerateScript(
  project: Project,
  hook: string,
  outline: string,
  scenes: Scene[]
): Promise<{ scriptFull: string; scenes: Scene[] }> {
  const pack = getNichePack(project.nichePackId);
  if (!pack) throw new Error('Niche pack not found');

  if (!isOpenAIConfigured()) {
    const scriptFull = scenes.map((s) => s.narrationText).join('\n\n');
    return { scriptFull, scenes };
  }

  const prompt = `Rewrite the narration for each scene to create a cohesive, engaging script.

Topic: "${project.topic}"
Hook: "${hook}"
Outline: ${outline}
Niche: ${pack.name}
Target length: ${project.targetLengthSec} seconds
Tempo: ${project.tempo}

Current scenes:
${scenes.map((s) => `Scene ${s.idx + 1}: "${s.narrationText}"`).join('\n')}

Return JSON object with an "updates" array containing updated narration for each scene:
{
  "updates": [
    {"idx": 0, "narrationText": "..."},
    {"idx": 1, "narrationText": "..."}
  ]
}

Keep scene count the same. Make the script flow naturally.`;

  try {
    const { content: response } = await callOpenAI(prompt, 'json');

    const updates = safeJsonParse<unknown>(response, null, { source: 'regenerateScript' });
    if (!updates) {
      throw new Error('Invalid JSON response for script updates');
    }

    // Handle both array (legacy/test) and object (OpenAI json_object) formats
    const updatesArray = unwrapArrayField<ScriptUpdateRaw>(updates, 'updates');

    if (updatesArray) {
      const updatedScenes = scenes.map((scene) => {
        const update = updatesArray.find((u) => u.idx === scene.idx);
        if (update && !scene.isLocked) {
          return { ...scene, narrationText: update.narrationText };
        }
        return scene;
      });

      const scriptFull = updatedScenes.map((s) => s.narrationText).join('\n\n');
      return { scriptFull, scenes: updatedScenes };
    }
  } catch (error) {
    logError('Error regenerating script:', error);
  }

  const scriptFull = scenes.map((s) => s.narrationText).join('\n\n');
  return { scriptFull, scenes };
}

// Regenerate single scene
export async function regenerateScene(
  scene: Scene,
  project: Project,
  allScenes: Scene[]
): Promise<Partial<Scene>> {
  const pack = getNichePack(project.nichePackId);
  if (!pack) throw new Error('Niche pack not found');

  if (!isOpenAIConfigured()) {
    return {
      narrationText: scene.narrationText,
      onScreenText: scene.onScreenText,
      visualPrompt: scene.visualPrompt,
      negativePrompt: scene.negativePrompt,
    };
  }

  const prevScene = allScenes.find((s) => s.idx === scene.idx - 1);
  const nextScene = allScenes.find((s) => s.idx === scene.idx + 1);

  const prompt = `Regenerate this single scene for a TikTok video.

Topic: "${project.topic}"
Niche: ${pack.name}
Style: ${pack.styleBiblePrompt}
Scene index: ${scene.idx + 1} of ${allScenes.length}
Duration: ${scene.durationTargetSec} seconds

${prevScene ? `Previous scene narration: "${prevScene.narrationText}"` : 'This is the first scene.'}
${nextScene ? `Next scene narration: "${nextScene.narrationText}"` : 'This is the last scene.'}

Generate a new version of this scene that:
- Fits naturally between the previous and next scenes
- Matches the niche style
- Has engaging narration and visuals

Return JSON:
{
  "narrationText": "...",
  "onScreenText": "...",
  "visualPrompt": "..."
}`;

  try {
    const { content: response } = await callOpenAI(prompt, 'json');

    const result = safeJsonParse<{
      narrationText?: string;
      onScreenText?: string;
      visualPrompt?: string;
    } | null>(response, null, { source: 'regenerateScene' });
    if (!result) {
      return {
        narrationText: scene.narrationText,
        onScreenText: scene.onScreenText,
        visualPrompt: scene.visualPrompt,
        negativePrompt: scene.negativePrompt,
      };
    }

    return {
      narrationText: result.narrationText || scene.narrationText,
      onScreenText: result.onScreenText || scene.onScreenText,
      visualPrompt: result.visualPrompt || scene.visualPrompt,
      negativePrompt: pack.globalNegativePrompt,
    };
  } catch (error) {
    logError('Error regenerating scene:', error);
    return {
      narrationText: scene.narrationText,
      onScreenText: scene.onScreenText,
      visualPrompt: scene.visualPrompt,
      negativePrompt: scene.negativePrompt,
    };
  }
}

// Template generators (fallback when no API key)
function generateTemplateHooks(topic: string, _pack: NichePack): string[] {
  return [
    `You won't believe what I discovered about ${topic}...`,
    `Here's something about ${topic} that nobody talks about.`,
    `Stop scrolling! This fact about ${topic} will blow your mind.`,
    `I need to tell you the truth about ${topic}.`,
    `What if everything you knew about ${topic} was wrong?`,
  ];
}

function generateTemplateOutline(topic: string, hook: string): string {
  return `1. Hook: ${hook}
2. Introduction to ${topic}
3. Key point #1 - The basics
4. Key point #2 - The surprising truth
5. Key point #3 - What this means for you
6. Conclusion and call to action`;
}

function generateTemplateScenes(
  project: Project,
  hook: string,
  outline: string,
  pack: {
    styleBiblePrompt: string;
    globalNegativePrompt: string;
    effectsProfile: { defaultEffect: string };
  },
  sceneCount: number,
  avgDuration: number
): SceneData[] {
  const scenes: SceneData[] = [];

  const points = [
    { narration: hook, onScreen: 'WAIT FOR IT', visual: 'Dramatic opening shot' },
    {
      narration: `Let me tell you about ${project.topic}.`,
      onScreen: project.topic.substring(0, 20).toUpperCase(),
      visual: 'Introduction scene',
    },
    {
      narration: `First, you need to understand the basics.`,
      onScreen: 'THE BASICS',
      visual: 'Educational scene showing fundamentals',
    },
    {
      narration: `But here's what makes this really interesting.`,
      onScreen: 'BUT WAIT',
      visual: 'Dramatic reveal moment',
    },
    {
      narration: `The truth is more surprising than you think.`,
      onScreen: 'THE TRUTH',
      visual: 'Mind-blowing revelation scene',
    },
    {
      narration: `Here's what this means for you.`,
      onScreen: 'FOR YOU',
      visual: 'Personal connection scene',
    },
    {
      narration: `And the most important thing to remember...`,
      onScreen: 'REMEMBER THIS',
      visual: 'Key takeaway visual',
    },
    {
      narration: `If you found this helpful, follow for more.`,
      onScreen: 'FOLLOW',
      visual: 'Call to action scene',
    },
  ];

  for (let i = 0; i < sceneCount; i++) {
    const point = points[i % points.length];
    scenes.push({
      id: uuid(),
      idx: i,
      narrationText: point.narration,
      onScreenText: point.onScreen,
      visualPrompt: `${pack.styleBiblePrompt}, ${point.visual}, related to ${project.topic}, vertical composition with centered subject`,
      negativePrompt: pack.globalNegativePrompt,
      effectPreset: pack.effectsProfile.defaultEffect as EffectPreset,
      durationTargetSec: avgDuration,
      isLocked: false,
    });
  }

  return scenes;
}
