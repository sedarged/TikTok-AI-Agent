import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

export function getFfmpegPath(): string | null {
  if (ffmpegStatic) return ffmpegStatic;
  return null;
}

export function getFfprobePath(): string | null {
  if (ffprobeStatic?.path) return ffprobeStatic.path;
  return null;
}
