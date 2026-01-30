export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
}

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'top5',
    name: 'Top 5 list',
    description:
      'Structure as a numbered top-5 list. Each scene is one item. Clear countdown and ranking. Strong hook: "Here are 5..."',
  },
  {
    id: 'myth_vs_fact',
    name: 'Myth vs fact',
    description:
      'Present a common myth or misconception, then debunk it with facts. Contrast structure: myth first, then "Here\'s the truth."',
  },
  {
    id: 'storytime',
    name: 'Storytime / narrative',
    description:
      'Tell a short story with a clear beginning, middle, and end. Emotional beat, twist or lesson. First-person or anecdote style.',
  },
];

export function getScriptTemplate(id: string): ScriptTemplate | undefined {
  return SCRIPT_TEMPLATES.find((t) => t.id === id);
}
