import { spawn } from 'node:child_process';

export async function runCmd(cmd: string, args: string[], opts?: { cwd?: string }) {
  return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd: opts?.cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} failed (code ${code}). stderr:\n${stderr.slice(-4000)}`));
    });
  });
}

