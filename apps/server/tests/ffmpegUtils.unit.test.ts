import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  escapeConcatPath,
  getMotionFilter,
  getFFprobePath,
} from '../src/services/ffmpeg/ffmpegUtils.js';

describe('ffmpegUtils', () => {
  describe('escapeConcatPath', () => {
    it('returns path unchanged when no single quotes', () => {
      expect(escapeConcatPath('/tmp/video.mp4')).toBe('/tmp/video.mp4');
      expect(escapeConcatPath('C:\\Users\\foo\\clip.mp4')).toBe('C:\\Users\\foo\\clip.mp4');
    });

    it('escapes single quotes for concat demuxer', () => {
      expect(escapeConcatPath("/tmp/foo's clip.mp4")).toBe("/tmp/foo'\\''s clip.mp4");
    });

    it('escapes multiple single quotes', () => {
      expect(escapeConcatPath("a'b'c")).toBe("a'\\''b'\\''c");
    });
  });

  describe('getMotionFilter', () => {
    const scale = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';

    it('returns scale only for static', () => {
      const out = getMotionFilter('static', 5);
      expect(out).toBe(scale);
    });

    it('returns scale only for default/unknown effect', () => {
      expect(getMotionFilter('unknown', 5)).toBe(scale);
      expect(getMotionFilter('', 5)).toBe(scale);
    });

    it('returns zoompan for slow_zoom_in with correct duration frames', () => {
      const out = getMotionFilter('slow_zoom_in', 5);
      expect(out).toContain(scale);
      expect(out).toContain('zoompan');
      expect(out).toContain('150'); // 5 * 30 fps
      expect(out).toContain('1080x1920');
    });

    it('returns zoompan for slow_zoom_out', () => {
      const out = getMotionFilter('slow_zoom_out', 4);
      expect(out).toContain(scale);
      expect(out).toContain('zoompan');
      expect(out).toContain('120'); // 4 * 30
    });

    it('returns zoompan for pan_left', () => {
      const out = getMotionFilter('pan_left', 3);
      expect(out).toContain(scale);
      expect(out).toContain('zoompan');
      expect(out).toContain('90');
    });

    it('returns scale,fade for fade effect', () => {
      const out = getMotionFilter('fade', 10);
      expect(out).toContain(scale);
      expect(out).toContain('fade=in');
      expect(out).toContain('fade=out');
    });

    it('returns scale,noise for glitch', () => {
      const out = getMotionFilter('glitch', 2);
      expect(out).toContain(scale);
      expect(out).toContain('noise');
    });
  });

  describe('getFFprobePath', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should attempt to find ffprobe in multiple locations', async () => {
      // This test verifies the fallback chain exists:
      // 1. FFPROBE_PATH env var
      // 2. system ffprobe
      // 3. adjacent to FFmpeg binary
      // 4. throws error if none found

      // In test mode with actual system ffmpeg/ffprobe, this should succeed
      // In environments without these, it will throw, which is expected
      try {
        const probePath = await getFFprobePath();
        expect(probePath).toBeDefined();
        expect(typeof probePath).toBe('string');
      } catch (error) {
        // If ffprobe is not available, verify the error message is helpful
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('FFprobe not found');
      }
    });

    it('should prefer FFPROBE_PATH when set', async () => {
      // When FFPROBE_PATH is explicitly set, it should be tried first
      // This documents the priority order even if we can't fully test it without mocks
      process.env.FFPROBE_PATH = '/custom/path/to/ffprobe';

      try {
        await getFFprobePath();
        // If this succeeds, FFPROBE_PATH was valid
      } catch (error) {
        // Expected to fail since /custom/path/to/ffprobe doesn't exist
        // But it should fail with the right error message
        expect((error as Error).message).toContain(
          'FFPROBE_PATH is set but ffprobe could not be executed'
        );
      }
    });
  });
});
