import { prisma } from '../../db/client.js';
import { v4 as uuid } from 'uuid';
import { getNichePack, getScenePacing, type NichePack } from '../nichePacks.js';
import { getScriptTemplate } from './scriptTemplates.js';
import { isOpenAIConfigured, isTestMode } from '../../env.js';
import { callOpenAI } from '../providers/openai.js';
import type { Project, Scene } from '@prisma/client';
import type { EffectPreset, SceneData } from '../../utils/types.js';
import { EFFECT_PRESETS } from '../../utils/types.js';
import { logError } from '../../utils/logger.js';

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

export interface GeneratePlanOptions {
  scriptTemplateId?: string;
}

// Generate complete plan for a project
export async function generatePlan(project: Project, options?: GeneratePlanOptions) {
  const pack = getNichePack(project.nichePackId);
  if (!pack) {
    throw new Error(`Niche pack not found: ${project.nichePackId}`);
  }

  const scriptTemplate = options?.scriptTemplateId
    ? getScriptTemplate(options.scriptTemplateId)
    : undefined;

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

  // Create plan version in DB (always UUID for API param validation)
  const planVersionId = uuid();
  const planVersion = await prisma.planVersion.create({
    data: {
      id: planVersionId,
      projectId: project.id,
      hookOptionsJson: JSON.stringify(hookOptions),
      hookSelected,
      outline,
      scriptFull,
      // Only persist a template ID if it resolved to a known scriptTemplate
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
    },
  });

  // Create scenes in DB
  let currentTime = 0;
  for (const sceneData of scenesData) {
    const sceneId = sceneData.id;
    await prisma.scene.create({
      data: {
        id: sceneId,
        projectId: project.id,
        planVersionId: planVersionId,
        idx: sceneData.idx,
        narrationText: sceneData.narrationText,
        onScreenText: sceneData.onScreenText,
        visualPrompt: sceneData.visualPrompt,
        negativePrompt: sceneData.negativePrompt,
        effectPreset: sceneData.effectPreset,
        durationTargetSec: sceneData.durationTargetSec,
        startTimeSec: currentTime,
        endTimeSec: currentTime + sceneData.durationTargetSec,
        isLocked: false,
      },
    });
    currentTime += sceneData.durationTargetSec;
  }

  return planVersion;
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
    const response = await callOpenAI(prompt, 'json');

    let hooks: unknown;
    try {
      hooks = JSON.parse(response);
    } catch (error) {
      logError('Failed to parse hooks JSON:', error);
      return generateTemplateHooks(project.topic, pack);
    }

    // Handle both array (legacy/test) and object (OpenAI json_object) formats
    let hooksArray: unknown;
    if (Array.isArray(hooks)) {
      hooksArray = hooks;
    } else if (typeof hooks === 'object' && hooks !== null && 'hooks' in hooks) {
      const obj = hooks as { hooks?: unknown };
      hooksArray = obj.hooks;
    } else {
      return generateTemplateHooks(project.topic, pack);
    }

    if (Array.isArray(hooksArray) && hooksArray.length >= 5) {
      return hooksArray.slice(0, 5);
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
    const response = await callOpenAI(prompt, 'text');
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
    const response = await callOpenAI(prompt, 'json');

    let scenes: unknown;
    try {
      scenes = JSON.parse(response);
    } catch (error) {
      logError('Failed to parse scenes JSON:', error);
      throw new Error('Invalid JSON response for scenes');
    }

    // Handle both array (legacy/test) and object (OpenAI json_object) formats
    let scenesArray: unknown;
    if (Array.isArray(scenes)) {
      scenesArray = scenes;
    } else if (typeof scenes === 'object' && scenes !== null && 'scenes' in scenes) {
      const obj = scenes as { scenes?: unknown };
      scenesArray = obj.scenes;
    } else {
      return generateTemplateScenes(project, hook, outline, pack, sceneCount, avgDuration);
    }

    if (Array.isArray(scenesArray) && scenesArray.length > 0) {
      return (scenesArray as OpenAISceneRaw[]).map((s, i) => {
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
    const response = await callOpenAI(prompt, 'json');

    let updates: unknown;
    try {
      updates = JSON.parse(response);
    } catch (error) {
      logError('Failed to parse script updates JSON:', error);
      throw new Error('Invalid JSON response for script updates');
    }

    // Handle both array (legacy/test) and object (OpenAI json_object) formats
    let updatesArray: unknown;
    if (Array.isArray(updates)) {
      updatesArray = updates;
    } else if (typeof updates === 'object' && updates !== null && 'updates' in updates) {
      const obj = updates as { updates?: unknown };
      updatesArray = obj.updates;
    } else {
      throw new Error('Invalid JSON response for script updates');
    }

    if (Array.isArray(updatesArray)) {
      const raw = updatesArray as ScriptUpdateRaw[];
      const updatedScenes = scenes.map((scene) => {
        const update = raw.find((u) => u.idx === scene.idx);
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
    const response = await callOpenAI(prompt, 'json');

    let result: { narrationText?: string; onScreenText?: string; visualPrompt?: string };
    try {
      result = JSON.parse(response) as {
        narrationText?: string;
        onScreenText?: string;
        visualPrompt?: string;
      };
    } catch (error) {
      logError('Failed to parse scene regeneration JSON:', error);
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
