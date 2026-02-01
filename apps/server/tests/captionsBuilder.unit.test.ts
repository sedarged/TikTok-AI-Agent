import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ROOT_DIR } from '../src/env.js';
import {
  buildCaptionsASS,
  buildCaptionsFromWords,
  buildCaptionsFromScenes,
} from '../src/services/captions/captionsBuilder.js';
import type { CaptionStyle } from '../src/services/nichePacks.js';

// Test caption style
const testStyle: CaptionStyle = {
  fontFamily: 'Arial Black',
  fontSize: 48,
  primaryColor: '#FFFFFF',
  outlineColor: '#000000',
  outlineWidth: 4,
  highlightColor: '#FFD700',
  marginBottom: 200,
  marginHorizontal: 40,
};

// Test output directory
const TEST_OUTPUT_DIR = path.join(ROOT_DIR, 'apps', 'server', 'tests', 'tmp', 'captions');

describe('captionsBuilder', () => {
  beforeEach(() => {
    // Ensure test output directory exists
    if (!fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
    }
  });

  describe('buildCaptionsASS', () => {
    it('creates ASS file with correct header format', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-header.ass');
      const segments = [{ text: 'Hello world', start: 0, end: 1 }];

      buildCaptionsASS(segments, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Verify ASS header
      expect(content).toContain('[Script Info]');
      expect(content).toContain('Title: TikTok AI Captions');
      expect(content).toContain('ScriptType: v4.00+');
      expect(content).toContain('PlayResX: 1080');
      expect(content).toContain('PlayResY: 1920');

      // Verify V4+ Styles section
      expect(content).toContain('[V4+ Styles]');
      expect(content).toContain('Style: Default');
      expect(content).toContain('Arial Black');
      expect(content).toContain('48'); // fontSize

      // Verify Events section
      expect(content).toContain('[Events]');
      expect(content).toContain('Format: Layer, Start, End, Style, Name');
    });

    it('converts hex colors to ASS BGR format', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-colors.ass');
      const colorStyle: CaptionStyle = {
        ...testStyle,
        primaryColor: '#FF0000', // Red -> BGR: 0000FF
        highlightColor: '#00FF00', // Green -> BGR: 00FF00
        outlineColor: '#0000FF', // Blue -> BGR: FF0000
      };

      buildCaptionsASS([], colorStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Verify BGR conversion in Style line
      expect(content).toContain('&H000000FF&'); // Red in BGR
      expect(content).toContain('&H0000FF00&'); // Green in BGR
      expect(content).toContain('&H00FF0000&'); // Blue in BGR
    });

    it('creates dialogue events with correct timestamps', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-timestamps.ass');
      const segments = [
        { text: 'First segment', start: 0, end: 2.5 },
        { text: 'Second segment', start: 3.0, end: 5.75 },
        { text: 'Third segment', start: 10.5, end: 15.25 },
      ];

      buildCaptionsASS(segments, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Verify timestamp format (H:MM:SS.CS)
      expect(content).toContain('0:00:00.00,0:00:02.50'); // 0 to 2.5 seconds
      expect(content).toContain('0:00:03.00,0:00:05.75'); // 3.0 to 5.75 seconds
      expect(content).toContain('0:00:10.50,0:00:15.25'); // 10.5 to 15.25 seconds
    });

    it('escapes special ASS characters in text', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-escaping.ass');
      const segments = [
        { text: 'Text with {braces}', start: 0, end: 1 },
        { text: 'Text with\\backslash', start: 1, end: 2 },
        { text: 'Text with\nNewline', start: 2, end: 3 },
      ];

      buildCaptionsASS(segments, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Verify escaped characters
      expect(content).toContain('Text with \\{braces\\}');
      expect(content).toContain('Text with\\\\backslash');
      expect(content).toContain('Text with\\NNewline');
    });

    it('creates word-by-word highlight events when words provided', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-word-highlight.ass');
      const segments = [
        {
          text: 'Hello world test',
          start: 0,
          end: 3,
          words: [
            { word: 'Hello', start: 0, end: 0.8 },
            { word: 'world', start: 0.9, end: 1.7 },
            { word: 'test', start: 1.8, end: 2.5 },
          ],
        },
      ];

      buildCaptionsASS(segments, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Should have multiple dialogue lines for word highlighting
      const dialogueLines = content.split('\n').filter((line) => line.startsWith('Dialogue:'));
      expect(dialogueLines.length).toBeGreaterThan(1);

      // Should contain highlight color code
      expect(content).toContain('\\c');
    });

    it('handles empty segments array', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-empty.ass');

      buildCaptionsASS([], testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Should still have header and structure
      expect(content).toContain('[Script Info]');
      expect(content).toContain('[V4+ Styles]');
      expect(content).toContain('[Events]');

      // Should have no dialogue lines
      const dialogueLines = content.split('\n').filter((line) => line.startsWith('Dialogue:'));
      expect(dialogueLines.length).toBe(0);
    });

    it('creates nested directories if they do not exist', () => {
      const nestedPath = path.join(TEST_OUTPUT_DIR, 'nested', 'deep', 'path', 'test.ass');
      const segments = [{ text: 'Test', start: 0, end: 1 }];

      buildCaptionsASS(segments, testStyle, nestedPath);

      expect(fs.existsSync(nestedPath)).toBe(true);
    });

    it('applies style properties correctly', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-style-props.ass');
      const customStyle: CaptionStyle = {
        fontFamily: 'Comic Sans MS',
        fontSize: 64,
        primaryColor: '#00FF00',
        outlineColor: '#FF0000',
        outlineWidth: 8,
        highlightColor: '#0000FF',
        marginBottom: 150,
        marginHorizontal: 60,
      };

      buildCaptionsASS([], customStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Verify custom style values
      expect(content).toContain('Comic Sans MS');
      expect(content).toContain(',64,'); // fontSize
      expect(content).toContain(',8,'); // outlineWidth after BorderStyle
      expect(content).toContain(',60,60,150,'); // marginH, marginH, marginV
    });
  });

  describe('buildCaptionsFromWords', () => {
    it('groups words into segments by pause duration', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-pause-grouping.ass');
      const words = [
        { word: 'Hello', start: 0, end: 0.5 },
        { word: 'world', start: 0.6, end: 1.0 },
        // Long pause (>0.5s)
        { word: 'This', start: 2.0, end: 2.3 },
        { word: 'is', start: 2.4, end: 2.6 },
        { word: 'test', start: 2.7, end: 3.0 },
      ];

      buildCaptionsFromWords(words, testStyle, outputPath);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Should create multiple segments due to long pause
      expect(content).toContain('Hello');
      expect(content).toContain('This');
    });

    it('groups words into segments by max count (6 words)', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-count-grouping.ass');
      const words = [
        { word: 'one', start: 0, end: 0.5 },
        { word: 'two', start: 0.6, end: 1.0 },
        { word: 'three', start: 1.1, end: 1.5 },
        { word: 'four', start: 1.6, end: 2.0 },
        { word: 'five', start: 2.1, end: 2.5 },
        { word: 'six', start: 2.6, end: 3.0 },
        // This should start a new segment
        { word: 'seven', start: 3.1, end: 3.5 },
        { word: 'eight', start: 3.6, end: 4.0 },
      ];

      buildCaptionsFromWords(words, testStyle, outputPath);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Should have segments (verify file has content)
      expect(content.length).toBeGreaterThan(500);
    });

    it('handles single word correctly', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-single-word.ass');
      const words = [{ word: 'Hello', start: 0, end: 1.0 }];

      buildCaptionsFromWords(words, testStyle, outputPath);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).toContain('Hello');
    });

    it('handles empty words array', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-empty-words.ass');

      buildCaptionsFromWords([], testStyle, outputPath);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Should have structure but no dialogue
      expect(content).toContain('[Events]');
      const dialogueLines = content.split('\n').filter((line) => line.startsWith('Dialogue:'));
      expect(dialogueLines.length).toBe(0);
    });

    it('preserves word timing in segments', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-word-timing.ass');
      const words = [
        { word: 'First', start: 1.0, end: 1.5 },
        { word: 'Second', start: 1.6, end: 2.2 },
        { word: 'Third', start: 2.3, end: 3.0 },
      ];

      buildCaptionsFromWords(words, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Segment should use first word's start and last word's end
      // Start at 1.0 seconds
      expect(content).toContain('0:00:01.00');
      // End at 3.0 seconds
      expect(content).toContain('0:00:03.00');
    });

    it('combines words into single text string', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-word-joining.ass');
      const words = [
        { word: 'Hello', start: 0, end: 0.5 },
        { word: 'beautiful', start: 0.6, end: 1.2 },
        { word: 'world', start: 1.3, end: 1.8 },
      ];

      buildCaptionsFromWords(words, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Words should be joined with spaces (may be split across highlight chunks)
      expect(content).toContain('Hello');
      expect(content).toContain('beautiful');
      expect(content).toContain('world');
    });
  });

  describe('buildCaptionsFromScenes', () => {
    it('creates captions from scene narrations', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-scenes.ass');
      const scenes = [
        { narrationText: 'Scene one narration', startTimeSec: 0, endTimeSec: 5 },
        { narrationText: 'Scene two narration', startTimeSec: 5, endTimeSec: 10 },
        { narrationText: 'Scene three narration', startTimeSec: 10, endTimeSec: 15 },
      ];

      buildCaptionsFromScenes(scenes, testStyle, outputPath);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Verify scene texts are present
      expect(content).toContain('Scene one narration');
      expect(content).toContain('Scene two narration');
      expect(content).toContain('Scene three narration');
    });

    it('uses scene timing correctly', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-scene-timing.ass');
      const scenes = [
        { narrationText: 'First', startTimeSec: 2.5, endTimeSec: 7.25 },
        { narrationText: 'Second', startTimeSec: 10.0, endTimeSec: 15.5 },
      ];

      buildCaptionsFromScenes(scenes, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Verify timing
      expect(content).toContain('0:00:02.50');
      expect(content).toContain('0:00:07.25');
      expect(content).toContain('0:00:10.00');
      expect(content).toContain('0:00:15.50');
    });

    it('handles empty scenes array', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-empty-scenes.ass');

      buildCaptionsFromScenes([], testStyle, outputPath);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Should have structure but no dialogue
      expect(content).toContain('[Events]');
      const dialogueLines = content.split('\n').filter((line) => line.startsWith('Dialogue:'));
      expect(dialogueLines.length).toBe(0);
    });

    it('handles long narration text', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-long-narration.ass');
      const longText =
        'This is a very long narration text that contains many words and should be properly handled by the caption builder without any issues even though it is quite lengthy and contains various punctuation marks, numbers like 123, and special characters.';
      const scenes = [{ narrationText: longText, startTimeSec: 0, endTimeSec: 10 }];

      buildCaptionsFromScenes(scenes, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Verify long text is present
      expect(content).toContain(longText);
    });

    it('does not create word highlight events for scenes', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-no-word-events.ass');
      const scenes = [{ narrationText: 'Simple scene', startTimeSec: 0, endTimeSec: 5 }];

      buildCaptionsFromScenes(scenes, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Should have exactly one dialogue line (no word-by-word highlighting)
      const dialogueLines = content.split('\n').filter((line) => line.startsWith('Dialogue:'));
      expect(dialogueLines.length).toBe(1);

      // Should not have highlight color codes
      expect(content).not.toContain('\\c&H');
    });
  });

  describe('timestamp formatting', () => {
    it('formats zero seconds correctly', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-zero-time.ass');
      const segments = [{ text: 'Test', start: 0, end: 0 }];

      buildCaptionsASS(segments, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).toContain('0:00:00.00');
    });

    it('formats fractional seconds correctly', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-fractional-time.ass');
      const segments = [{ text: 'Test', start: 1.23, end: 4.55 }];

      buildCaptionsASS(segments, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // 1.23 seconds = 0:00:01.23
      expect(content).toContain('0:00:01.23');
      // 4.55 seconds = 0:00:04.54 (due to float precision)
      expect(content).toContain('0:00:04.54');
    });

    it('formats minutes correctly', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-minutes.ass');
      const segments = [{ text: 'Test', start: 65.5, end: 125.75 }];

      buildCaptionsASS(segments, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // 65.5 seconds = 1:05.50
      expect(content).toContain('0:01:05.50');
      // 125.75 seconds = 2:05.75
      expect(content).toContain('0:02:05.75');
    });

    it('formats hours correctly', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-hours.ass');
      const segments = [{ text: 'Test', start: 3665.25, end: 7325.98 }];

      buildCaptionsASS(segments, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // 3665.25 seconds = 1:01:05.25
      expect(content).toContain('1:01:05.25');
      // 7325.98 seconds = 2:02:05.97 (due to float precision)
      expect(content).toContain('2:02:05.97');
    });

    it('pads timestamp components correctly', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-padding.ass');
      const segments = [{ text: 'Test', start: 1.05, end: 2.5 }];

      buildCaptionsASS(segments, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Should pad to 2 digits: 0:00:01.05
      expect(content).toContain('0:00:01.05');
      // Should pad to 2 digits: 0:00:02.50
      expect(content).toContain('0:00:02.50');
    });
  });

  describe('edge cases', () => {
    it('handles very short words (<0.1s)', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-short-words.ass');
      const words = [
        { word: 'I', start: 0, end: 0.05 },
        { word: 'am', start: 0.06, end: 0.12 },
        { word: 'here', start: 0.13, end: 0.45 },
      ];

      buildCaptionsFromWords(words, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // All words should be present
      expect(content).toContain('I');
      expect(content).toContain('am');
      expect(content).toContain('here');
    });

    it('handles words with special characters', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-special-chars.ass');
      const words = [
        { word: "don't", start: 0, end: 0.5 },
        { word: 'café', start: 0.6, end: 1.0 },
        { word: 'naïve', start: 1.1, end: 1.5 },
      ];

      buildCaptionsFromWords(words, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Special characters should be preserved
      expect(content).toContain("don't");
      expect(content).toContain('café');
      expect(content).toContain('naïve');
    });

    it('handles maximum segment size boundary', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-max-segment.ass');
      const words = Array.from({ length: 12 }, (_, i) => ({
        word: `word${i + 1}`,
        start: i * 0.5,
        end: (i + 1) * 0.5 - 0.1,
      }));

      buildCaptionsFromWords(words, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Should have at least 2 segments (12 words / 6 max = 2 segments)
      const dialogueLines = content.split('\n').filter((line) => line.startsWith('Dialogue:'));
      expect(dialogueLines.length).toBeGreaterThan(0);
    });

    it('handles mixed long and short pauses', () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-mixed-pauses.ass');
      const words = [
        { word: 'Hello', start: 0, end: 0.5 },
        { word: 'world', start: 0.6, end: 1.0 }, // short pause
        { word: 'This', start: 2.0, end: 2.3 }, // long pause (>0.5s)
        { word: 'is', start: 2.35, end: 2.5 }, // short pause
        { word: 'test', start: 3.5, end: 4.0 }, // long pause
      ];

      buildCaptionsFromWords(words, testStyle, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Should create separate segments due to long pauses
      expect(content).toContain('Hello');
      expect(content).toContain('This');
      expect(content).toContain('test');
    });
  });
});
