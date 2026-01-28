import fs from 'node:fs';

type CaptionStyle = {
  font: string;
  size: number;
  outline: number;
  highlightMode: 'word' | 'segment';
  safeMarginPct: number;
};

type WhisperVerbose = {
  segments?: Array<{ start: number; end: number; text: string; words?: Array<{ start: number; end: number; word: string }> }>;
  words?: Array<{ start: number; end: number; word: string }>;
};

export function buildAssCaptions(args: {
  timestampsJsonPath: string;
  outAssPath: string;
  style: CaptionStyle;
  videoWidth: number;
  videoHeight: number;
}) {
  const raw = fs.readFileSync(args.timestampsJsonPath, 'utf-8');
  const data = JSON.parse(raw) as WhisperVerbose;

  const marginV = Math.round((args.videoHeight * args.style.safeMarginPct) / 100);
  const marginL = Math.round((args.videoWidth * args.style.safeMarginPct) / 100);
  const marginR = marginL;

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${args.style.font},${args.style.size},&H00FFFFFF,&H0000FFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,${args.style.outline},0,2,${marginL},${marginR},${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ].join('\n');

  const events: string[] = [];

  const segments = data.segments ?? [];
  for (const seg of segments) {
    const start = fmtAssTime(seg.start);
    const end = fmtAssTime(seg.end);

    if (args.style.highlightMode === 'word' && seg.words?.length) {
      const text = karaokeText(seg.words);
      events.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`);
    } else {
      const cleaned = cleanText(seg.text);
      if (!cleaned) continue;
      events.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${escapeAss(cleaned)}`);
    }
  }

  fs.writeFileSync(args.outAssPath, `${header}\n${events.join('\n')}\n`);
}

function karaokeText(words: Array<{ start: number; end: number; word: string }>) {
  return words
    .map((w) => {
      const durCs = Math.max(1, Math.round((w.end - w.start) * 100));
      const txt = escapeAss(cleanText(w.word));
      if (!txt) return '';
      return `{\\k${durCs}}${txt}`;
    })
    .filter(Boolean)
    .join(' ');
}

function cleanText(s: string) {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/♪/g, '')
    .trim();
}

function fmtAssTime(sec: number) {
  const s = Math.max(0, sec);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const cs = Math.floor((s - Math.floor(s)) * 100);
  return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function escapeAss(s: string) {
  return s.replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\n/g, ' ');
}

