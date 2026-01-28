import { prisma } from '../../db/client.js';
import { v4 as uuid } from 'uuid';
import { getNichePack, getScenePacing } from '../nichePacks.js';
import { isOpenAIConfigured, isTestMode } from '../../env.js';
import { callOpenAI } from '../providers/openai.js';
import type { Project, Scene } from '@prisma/client';
import type { EffectPreset, SceneData } from '../../utils/types.js';
import { EFFECT_PRESETS } from '../../utils/types.js';

// Generate complete plan for a project
export async function generatePlan(project: Project) {
  const pack = getNichePack(project.nichePackId);
  if (!pack) {
    throw new Error(`Niche pack not found: ${project.nichePackId}`);
  }

  const pacing = getScenePacing(pack, project.targetLengthSec);
  const baseSceneCount = Math.round((pacing.minScenes + pacing.maxScenes) / 2);
  const sceneCount = isTestMode()
    ? Math.min(8, Math.max(6, baseSceneCount))
    : baseSceneCount;

  // Step 1: Generate hooks
  const hookOptions = await generateHooks(project, pack);

  // Step 2: Select first hook by default
  const hookSelected = hookOptions[0];

  // Step 3: Generate outline
  const outline = await generateOutline(project, hookSelected, pack);

  // Step 4: Generate scenes
  const scenesData = await generateScenes(project, hookSelected, outline, pack, sceneCount);

  // Step 5: Generate full script from scenes
  const scriptFull = scenesData.map(s => s.narrationText).join('\n\n');

  // Calculate estimates
  const totalWords = scriptFull.split(/\s+/).filter(w => w.length > 0).length;
  const wpm = project.tempo === 'slow' ? 120 : project.tempo === 'fast' ? 180 : 150;
  const estimatedLengthSec = Math.round((totalWords / wpm) * 60);

  // Create plan version in DB
  const planSequence = isTestMode()
    ? (await prisma.planVersion.count({ where: { projectId: project.id } })) + 1
    : 0;
  const planVersionId = isTestMode()
    ? `test-${project.id}-plan-${planSequence}`
    : uuid();
  const planVersion = await prisma.planVersion.create({
    data: {
      id: planVersionId,
      projectId: project.id,
      hookOptionsJson: JSON.stringify(hookOptions),
      hookSelected,
      outline,
      scriptFull,
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
    const sceneId = isTestMode()
      ? `test-${project.id}-plan-${planSequence}-scene-${sceneData.idx}`
      : sceneData.id;
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
async function generateHooks(project: Project, pack: any): Promise<string[]> {
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
- Use different approaches for each hook
- Avoid brands, copyrighted content
- Keep it appropriate for general audiences

Return ONLY a JSON array with exactly 5 hook strings, no other text:
["hook1", "hook2", "hook3", "hook4", "hook5"]`;

  try {
    const response = await callOpenAI(prompt, 'json');
    const hooks = JSON.parse(response);
    if (Array.isArray(hooks) && hooks.length >= 5) {
      return hooks.slice(0, 5);
    }
    return generateTemplateHooks(project.topic, pack);
  } catch (error) {
    console.error('Error generating hooks with AI:', error);
    return generateTemplateHooks(project.topic, pack);
  }
}

// Generate outline
async function generateOutline(project: Project, hook: string, pack: any): Promise<string> {
  if (!isOpenAIConfigured()) {
    return generateTemplateOutline(project.topic, hook);
  }

  const prompt = `Create a video outline for a TikTok video.

Topic: "${project.topic}"
Hook: "${hook}"
Niche: ${pack.name}
Target length: ${project.targetLengthSec} seconds
Tempo: ${project.tempo}

Create a concise outline with:
- Opening hook moment
- 3-5 key points or story beats
- Strong ending/call to action

Keep it brief but clear. Return just the outline text, no JSON.`;

  try {
    const response = await callOpenAI(prompt, 'text');
    return response.trim();
  } catch (error) {
    console.error('Error generating outline with AI:', error);
    return generateTemplateOutline(project.topic, hook);
  }
}

// Generate scenes
async function generateScenes(
  project: Project,
  hook: string,
  outline: string,
  pack: any,
  sceneCount: number
): Promise<SceneData[]> {
  const pacing = getScenePacing(pack, project.targetLengthSec);
  const avgDuration = project.targetLengthSec / sceneCount;

  if (!isOpenAIConfigured()) {
    return generateTemplateScenes(project, hook, outline, pack, sceneCount, avgDuration);
  }

  const prompt = `Generate ${sceneCount} scenes for a TikTok video.

Topic: "${project.topic}"
Hook: "${hook}"
Outline: ${outline}
Niche: ${pack.name}
Style: ${pack.styleBiblePrompt}
Target total duration: ${project.targetLengthSec} seconds
Average scene duration: ${avgDuration.toFixed(1)} seconds (range: ${pacing.minDurationSec}-${pacing.maxDurationSec}s)

For each scene provide:
1. narrationText: What the narrator says (clear, engaging, match the tempo)
2. onScreenText: Short text shown on screen (2-5 words max, key point)
3. visualPrompt: Detailed image generation prompt describing the visual
4. durationTargetSec: Duration in seconds for this scene

Available effect presets: ${EFFECT_PRESETS.join(', ')}
Default effect: ${pack.effectsProfile.defaultEffect}

Return ONLY valid JSON array:
[
  {
    "idx": 0,
    "narrationText": "...",
    "onScreenText": "...",
    "visualPrompt": "...",
    "durationTargetSec": 8
  }
]

Requirements:
- No copyrighted/brand references
- Visual prompts should be detailed and match the niche style
- Scene durations should sum to approximately ${project.targetLengthSec} seconds
- First scene should deliver the hook`;

  try {
    const response = await callOpenAI(prompt, 'json');
    const scenes = JSON.parse(response);
    
    if (Array.isArray(scenes) && scenes.length > 0) {
      return scenes.map((s: any, i: number) => ({
        id: uuid(),
        idx: i,
        narrationText: s.narrationText || '',
        onScreenText: s.onScreenText || '',
        visualPrompt: s.visualPrompt || '',
        negativePrompt: pack.globalNegativePrompt,
        effectPreset: (s.effectPreset && EFFECT_PRESETS.includes(s.effectPreset)) 
          ? s.effectPreset 
          : pack.effectsProfile.defaultEffect,
        durationTargetSec: s.durationTargetSec || avgDuration,
        isLocked: false,
      }));
    }
    
    return generateTemplateScenes(project, hook, outline, pack, sceneCount, avgDuration);
  } catch (error) {
    console.error('Error generating scenes with AI:', error);
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
    const scriptFull = scenes.map(s => s.narrationText).join('\n\n');
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
${scenes.map(s => `Scene ${s.idx + 1}: "${s.narrationText}"`).join('\n')}

Return JSON array with updated narration for each scene:
[
  {"idx": 0, "narrationText": "..."},
  {"idx": 1, "narrationText": "..."}
]

Keep scene count the same. Make the script flow naturally.`;

  try {
    const response = await callOpenAI(prompt, 'json');
    const updates = JSON.parse(response);
    
    if (Array.isArray(updates)) {
      const updatedScenes = scenes.map(scene => {
        const update = updates.find((u: any) => u.idx === scene.idx);
        if (update && !scene.isLocked) {
          return { ...scene, narrationText: update.narrationText };
        }
        return scene;
      });
      
      const scriptFull = updatedScenes.map(s => s.narrationText).join('\n\n');
      return { scriptFull, scenes: updatedScenes };
    }
  } catch (error) {
    console.error('Error regenerating script:', error);
  }

  const scriptFull = scenes.map(s => s.narrationText).join('\n\n');
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

  const prevScene = allScenes.find(s => s.idx === scene.idx - 1);
  const nextScene = allScenes.find(s => s.idx === scene.idx + 1);

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
    const result = JSON.parse(response);
    
    return {
      narrationText: result.narrationText || scene.narrationText,
      onScreenText: result.onScreenText || scene.onScreenText,
      visualPrompt: result.visualPrompt || scene.visualPrompt,
      negativePrompt: pack.globalNegativePrompt,
    };
  } catch (error) {
    console.error('Error regenerating scene:', error);
    return {
      narrationText: scene.narrationText,
      onScreenText: scene.onScreenText,
      visualPrompt: scene.visualPrompt,
      negativePrompt: scene.negativePrompt,
    };
  }
}

// Template generators (fallback when no API key)
function generateTemplateHooks(topic: string, pack: any): string[] {
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
  pack: any,
  sceneCount: number,
  avgDuration: number
): SceneData[] {
  const scenes: SceneData[] = [];
  
  const points = [
    { narration: hook, onScreen: 'WAIT FOR IT', visual: 'Dramatic opening shot' },
    { narration: `Let me tell you about ${project.topic}.`, onScreen: project.topic.substring(0, 20).toUpperCase(), visual: 'Introduction scene' },
    { narration: `First, you need to understand the basics.`, onScreen: 'THE BASICS', visual: 'Educational scene showing fundamentals' },
    { narration: `But here's what makes this really interesting.`, onScreen: 'BUT WAIT', visual: 'Dramatic reveal moment' },
    { narration: `The truth is more surprising than you think.`, onScreen: 'THE TRUTH', visual: 'Mind-blowing revelation scene' },
    { narration: `Here's what this means for you.`, onScreen: 'FOR YOU', visual: 'Personal connection scene' },
    { narration: `And the most important thing to remember...`, onScreen: 'REMEMBER THIS', visual: 'Key takeaway visual' },
    { narration: `If you found this helpful, follow for more.`, onScreen: 'FOLLOW', visual: 'Call to action scene' },
  ];

  for (let i = 0; i < sceneCount; i++) {
    const point = points[i % points.length];
    scenes.push({
      id: uuid(),
      idx: i,
      narrationText: point.narration,
      onScreenText: point.onScreen,
      visualPrompt: `${pack.styleBiblePrompt}, ${point.visual}, related to ${project.topic}`,
      negativePrompt: pack.globalNegativePrompt,
      effectPreset: pack.effectsProfile.defaultEffect as EffectPreset,
      durationTargetSec: avgDuration,
      isLocked: false,
    });
  }

  return scenes;
}
