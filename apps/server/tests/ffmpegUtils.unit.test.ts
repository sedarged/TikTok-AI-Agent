import { describe, expect, it } from 'vitest';
import { escapeConcatPath, getMotionFilter } from '../src/services/ffmpeg/ffmpegUtils.js';

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
});
