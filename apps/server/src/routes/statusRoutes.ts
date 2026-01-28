import { Router } from "express";
import { providerStatus } from "../env.js";
import { getFfmpegPath, getFfprobePath } from "../services/ffmpeg/ffmpegPath.js";
import { runCommand } from "../services/ffmpeg/exec.js";

export const statusRouter = Router();

statusRouter.get("/status", async (_req, res) => {
  const ffmpegPath = getFfmpegPath() ?? "ffmpeg";
  const ffprobePath = getFfprobePath() ?? "ffprobe";
  let ffmpegAvailable = false;
  let ffprobeAvailable = false;
  try {
    await runCommand(ffmpegPath, ["-version"], "ffmpeg check");
    ffmpegAvailable = true;
  } catch {
    ffmpegAvailable = false;
  }
  try {
    await runCommand(ffprobePath, ["-version"], "ffprobe check");
    ffprobeAvailable = true;
  } catch {
    ffprobeAvailable = false;
  }
  res.json({
    providers: providerStatus,
    ffmpeg: {
      ffmpegPath,
      ffprobePath,
      ffmpegAvailable,
      ffprobeAvailable
    }
  });
});
