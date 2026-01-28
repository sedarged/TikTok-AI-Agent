import fs from "fs/promises";
import path from "path";
import { config } from "../../env.js";
import { runCommand } from "../ffmpeg/exec.js";
import { getFfmpegPath } from "../ffmpeg/ffmpegPath.js";

export async function pickMusicTrack(): Promise<string | null> {
  try {
    const entries = await fs.readdir(config.musicLibraryDir);
    const audioFiles = entries.filter((file) =>
      [".mp3", ".wav", ".m4a"].includes(path.extname(file).toLowerCase())
    );
    if (!audioFiles.length) return null;
    return path.join(config.musicLibraryDir, audioFiles[0]);
  } catch {
    return null;
  }
}

export async function mixVoiceWithMusic(options: {
  voicePath: string;
  musicPath: string;
  outputPath: string;
}) {
  const ffmpegPath = getFfmpegPath() ?? "ffmpeg";
  await runCommand(
    ffmpegPath,
    [
      "-y",
      "-i",
      options.voicePath,
      "-i",
      options.musicPath,
      "-filter_complex",
      "[1:a]volume=0.18[a1];[0:a][a1]amix=inputs=2:duration=first:dropout_transition=2",
      "-c:a",
      "aac",
      options.outputPath
    ],
    "ffmpeg mix music"
  );
}
