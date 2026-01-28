import path from "path";
import { runCommand } from "./exec.js";
import { getFfmpegPath } from "./ffmpegPath.js";
import { EffectPreset } from "../plan/nichePacks.js";

function framesForDuration(durationSec: number) {
  return Math.max(1, Math.round(durationSec * 30));
}

function buildFilter(effect: EffectPreset, durationSec: number): string {
  const frames = framesForDuration(durationSec);
  const base = "scale=1080:1920:force_original_aspect_ratio=cover,crop=1080:1920";
  const zoomIn = `zoompan=z='min(zoom+0.0015,1.2)':d=${frames}:s=1080x1920`;
  const zoomOut = `zoompan=z='if(eq(on,1),1.2,max(zoom-0.0015,1.0))':d=${frames}:s=1080x1920`;
  const panLeft = `zoompan=z='1.0':x='(in_w-out_w)*(1-on/${frames})':y='0':d=${frames}:s=1080x1920`;
  const panRight = `zoompan=z='1.0':x='(in_w-out_w)*(on/${frames})':y='0':d=${frames}:s=1080x1920`;
  const tiltUp = `zoompan=z='1.0':x='0':y='(in_h-out_h)*(1-on/${frames})':d=${frames}:s=1080x1920`;
  const tiltDown = `zoompan=z='1.0':x='0':y='(in_h-out_h)*(on/${frames})':d=${frames}:s=1080x1920`;
  const fade = `fade=t=in:st=0:d=0.25,fade=t=out:st=${Math.max(
    0,
    durationSec - 0.25
  )}:d=0.25`;
  const glitch = "noise=alls=20:allf=t+u";

  switch (effect) {
    case "slow_zoom_in":
      return `${base},${zoomIn}`;
    case "slow_zoom_out":
      return `${base},${zoomOut}`;
    case "pan_left":
      return `${base},${panLeft}`;
    case "pan_right":
      return `${base},${panRight}`;
    case "tilt_up":
      return `${base},${tiltUp}`;
    case "tilt_down":
      return `${base},${tiltDown}`;
    case "flash_cut":
      return `${base},${zoomIn},${fade}`;
    case "fade":
      return `${base},${zoomIn},${fade}`;
    case "glitch":
      return `${base},${zoomIn},${glitch}`;
    default:
      return `${base},${zoomIn}`;
  }
}

export async function createImageSegment(options: {
  imagePath: string;
  outputPath: string;
  durationSec: number;
  effect: EffectPreset;
}) {
  const ffmpegPath = getFfmpegPath() ?? "ffmpeg";
  const filter = buildFilter(options.effect, options.durationSec);
  await runCommand(
    ffmpegPath,
    [
      "-y",
      "-loop",
      "1",
      "-i",
      options.imagePath,
      "-t",
      options.durationSec.toFixed(2),
      "-vf",
      filter,
      "-r",
      "30",
      "-pix_fmt",
      "yuv420p",
      "-an",
      options.outputPath
    ],
    `ffmpeg segment ${path.basename(options.outputPath)}`
  );
}
