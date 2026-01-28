import fs from 'fs';
import path from 'path';
import type { CaptionStyle } from '../nichePacks.js';

interface WordTiming {
  word: string;
  start: number;
  end: number;
}

interface CaptionSegment {
  text: string;
  start: number;
  end: number;
  words?: WordTiming[];
}

// Convert seconds to ASS timestamp format
function formatASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const cs = Math.floor((s % 1) * 100);
  const sInt = Math.floor(s);
  
  return `${h}:${m.toString().padStart(2, '0')}:${sInt.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

// Convert hex color to ASS format (BGR)
function hexToASS(hex: string): string {
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return `&H00${b}${g}${r}&`;
}

// Build ASS subtitle file
export function buildCaptionsASS(
  segments: CaptionSegment[],
  style: CaptionStyle,
  outputPath: string
): void {
  const primaryColor = hexToASS(style.primaryColor);
  const outlineColor = hexToASS(style.outlineColor);
  const highlightColor = hexToASS(style.highlightColor);
  
  // ASS header
  let content = `[Script Info]
Title: TikTok AI Captions
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontFamily},${style.fontSize},${primaryColor},${highlightColor},${outlineColor},&H80000000&,1,0,0,0,100,100,0,0,1,${style.outlineWidth},0,2,${style.marginHorizontal},${style.marginHorizontal},${style.marginBottom},1
Style: Highlight,${style.fontFamily},${style.fontSize},${highlightColor},${primaryColor},${outlineColor},&H80000000&,1,0,0,0,100,100,0,0,1,${style.outlineWidth},0,2,${style.marginHorizontal},${style.marginHorizontal},${style.marginBottom},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Add dialogue events
  for (const segment of segments) {
    if (segment.words && segment.words.length > 0) {
      // Word-by-word highlighting
      const wordEvents = createWordHighlightEvents(segment.words, style);
      content += wordEvents;
    } else {
      // Simple segment display
      const start = formatASSTime(segment.start);
      const end = formatASSTime(segment.end);
      const text = escapeASSText(segment.text);
      content += `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}\n`;
    }
  }

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, content);
}

// Create word-by-word highlight events
function createWordHighlightEvents(words: WordTiming[], style: CaptionStyle): string {
  let events = '';
  
  // Group words into chunks of 3-5 for readability
  const chunkSize = 4;
  const chunks: WordTiming[][] = [];
  
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize));
  }

  for (const chunk of chunks) {
    if (chunk.length === 0) continue;
    
    const chunkStart = chunk[0].start;
    const chunkEnd = chunk[chunk.length - 1].end;
    
    // Create events for each word in the chunk
    for (let i = 0; i < chunk.length; i++) {
      const word = chunk[i];
      const start = formatASSTime(word.start);
      const end = formatASSTime(word.end);
      
      // Build text with highlight on current word
      const textParts = chunk.map((w, j) => {
        if (j === i) {
          return `{\\c${hexToASS(style.highlightColor).replace('&', '').replace('&', '')}}${escapeASSText(w.word)}{\\c}`;
        }
        return escapeASSText(w.word);
      });
      
      const text = textParts.join(' ');
      events += `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}\n`;
    }
  }

  return events;
}

// Escape special ASS characters
function escapeASSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\N')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}');
}

// Build captions from word timings
export function buildCaptionsFromWords(
  words: WordTiming[],
  style: CaptionStyle,
  outputPath: string
): void {
  // Group words into segments (by pauses or count)
  const segments: CaptionSegment[] = [];
  let currentSegment: WordTiming[] = [];
  
  for (let i = 0; i < words.length; i++) {
    currentSegment.push(words[i]);
    
    // Check for natural break
    const isLongPause = i < words.length - 1 && 
      words[i + 1].start - words[i].end > 0.5;
    const isTooLong = currentSegment.length >= 6;
    const isEnd = i === words.length - 1;
    
    if (isLongPause || isTooLong || isEnd) {
      if (currentSegment.length > 0) {
        segments.push({
          text: currentSegment.map(w => w.word).join(' '),
          start: currentSegment[0].start,
          end: currentSegment[currentSegment.length - 1].end,
          words: currentSegment,
        });
        currentSegment = [];
      }
    }
  }

  buildCaptionsASS(segments, style, outputPath);
}

// Build captions from scene narrations (fallback when no word timings)
export function buildCaptionsFromScenes(
  scenes: Array<{ narrationText: string; startTimeSec: number; endTimeSec: number }>,
  style: CaptionStyle,
  outputPath: string
): void {
  const segments: CaptionSegment[] = scenes.map(scene => ({
    text: scene.narrationText,
    start: scene.startTimeSec,
    end: scene.endTimeSec,
  }));

  buildCaptionsASS(segments, style, outputPath);
}
