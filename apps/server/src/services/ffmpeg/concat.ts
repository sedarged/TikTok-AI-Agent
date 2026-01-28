import { runCommand } from "./exec.js";
import { getFfmpegPath } from "./ffmpegPath.js";

export async function concatWithTransitions(options: {
  segmentPaths: string[];
  durations: number[];
  outputPath: string;
  transitionSec?: number;
}) {
  const ffmpegPath = getFfmpegPath() ?? "ffmpeg";
  const transition = options.transitionSec ?? 0.3;
  const inputs = options.segmentPaths.flatMap((path) => ["-i", path]);

  let filter = "";
  let offset = options.durations[0] - transition;
  filter += `[0:v][1:v]xfade=transition=fade:duration=${transition}:offset=${Math.max(
    0,
    offset
  ).toFixed(2)}[v1];`;

  for (let i = 2; i < options.segmentPaths.length; i += 1) {
    offset += options.durations[i - 1] - transition;
    const prevLabel = i === 2 ? "v1" : `v${i - 1}`;
    const nextLabel = `v${i}`;
    filter += `[${prevLabel}][${i}:v]xfade=transition=fade:duration=${transition}:offset=${Math.max(
      0,
      offset
    ).toFixed(2)}[${nextLabel}];`;
  }

  const lastLabel = options.segmentPaths.length === 2 ? "v1" : `v${options.segmentPaths.length - 1}`;

  await runCommand(
    ffmpegPath,
    [
      "-y",
      ...inputs,
      "-filter_complex",
      filter,
      "-map",
      `[${lastLabel}]`,
      "-r",
      "30",
      "-pix_fmt",
      "yuv420p",
      options.outputPath
    ],
    "ffmpeg concat"
  );
}
