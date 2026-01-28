import { runCmd } from './run.js';

export async function ffprobeJson(args: { ffprobePath: string; inputPath: string }) {
  const { stdout } = await runCmd(args.ffprobePath, [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    args.inputPath
  ]);
  return JSON.parse(stdout);
}

