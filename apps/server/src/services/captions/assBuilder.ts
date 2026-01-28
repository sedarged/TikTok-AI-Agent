import fs from "fs/promises";
import { CaptionStyle } from "../plan/nichePacks.js";

type Word = { start: number; end: number; word: string };
type Segment = { start: number; end: number; text: string; words?: Word[] };

function formatTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  const cs = Math.floor((total - Math.floor(total)) * 100);
  return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(
    cs
  ).padStart(2, "0")}`;
}

function chunkWords(words: Word[], maxWords = 8): Word[][] {
  const chunks: Word[][] = [];
  let current: Word[] = [];
  for (const word of words) {
    current.push(word);
    if (current.length >= maxWords) {
      chunks.push(current);
      current = [];
    }
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function assHeader(style: CaptionStyle, width = 1080, height = 1920) {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.font},${style.size},&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,${style.outline},0,2,${style.safeMargins.left},${style.safeMargins.right},${style.safeMargins.bottom},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

function buildKaraokeLine(words: Word[]) {
  const parts = words.map((word) => {
    const dur = Math.max(0.05, word.end - word.start);
    const cs = Math.round(dur * 100);
    const cleanWord = word.word.replace(/\s+/g, "");
    return `{\\k${cs}}${cleanWord}`;
  });
  return parts.join(" ");
}

export async function buildAssCaptions(options: {
  transcription: { segments?: Segment[] };
  style: CaptionStyle;
  outputPath: string;
}) {
  const segments = options.transcription.segments ?? [];
  let content = assHeader(options.style);

  for (const segment of segments) {
    const words = segment.words ?? [];
    if (words.length && options.style.highlightMode === "word") {
      const chunks = chunkWords(words, 7);
      for (const chunk of chunks) {
        const start = chunk[0].start;
        const end = chunk[chunk.length - 1].end;
        content += `Dialogue: 0,${formatTime(start)},${formatTime(
          end
        )},Default,,0,0,0,,${buildKaraokeLine(chunk)}\n`;
      }
    } else {
      const text = segment.text.trim();
      if (!text) continue;
      content += `Dialogue: 0,${formatTime(segment.start)},${formatTime(
        segment.end
      )},Default,,0,0,0,,${text.replace(/\n/g, " ")}\n`;
    }
  }

  await fs.writeFile(options.outputPath, content, "utf8");
}
