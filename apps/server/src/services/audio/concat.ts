import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ensureDir } from '../cache/cache.js';

export async function concatWavWithFfmpeg(args: { ffmpegPath: string; inputs: string[]; outPath: string }) {
  ensureDir(path.dirname(args.outPath));

  const listPath = path.join(path.dirname(args.outPath), `concat_${Date.now()}.txt`);
  const lines = args.inputs.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listPath, lines);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      args.ffmpegPath,
      ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', args.outPath],
      {
      stdio: ['ignore', 'ignore', 'pipe']
      }
    );
    let err = '';
    proc.stderr.on('data', (d) => (err += d.toString()));
    proc.on('close', (code) => {
      try {
        fs.unlinkSync(listPath);
      } catch {}
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg concat failed (code ${code}): ${err.slice(-2000)}`));
    });
  });
}

