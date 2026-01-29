import { env } from '../src/env.js';
import fetch from 'node-fetch';

type RunStatus = 'queued' | 'running' | 'done' | 'failed' | 'canceled';

interface ProjectResponse {
  id: string;
  topic: string;
}

interface PlanResponse {
  id: string;
}

interface RunResponse {
  id: string;
  status: RunStatus;
  artifactsJson: string;
}

const baseUrl = process.env.SMOKE_BASE_URL || `http://localhost:${env.PORT}`;
const allowReal = process.env.SMOKE_ALLOW_REAL === '1';
const shouldVerify = process.env.SMOKE_VERIFY === '1';

async function postJson<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

async function waitForRun(runId: string, timeoutMs: number = 10 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await getJson<RunResponse>(`/api/run/${runId}`);
    if (run.status === 'done' || run.status === 'failed' || run.status === 'canceled') {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for run ${runId}`);
}

async function main() {
  const status = await getJson<{ testMode?: boolean; renderDryRun?: boolean }>(`/api/status`);
  const renderDryRun = status.renderDryRun === true;
  const testMode = status.testMode === true;

  if (testMode) {
    throw new Error('APP_TEST_MODE is enabled. Disable it to run render smoke.');
  }

  if (!renderDryRun && !allowReal) {
    throw new Error('Real render is blocked. Set SMOKE_ALLOW_REAL=1 to proceed.');
  }

  const project = await postJson<ProjectResponse>('/api/project', {
    topic: `Render smoke ${Date.now()}`,
    nichePackId: 'facts',
    language: 'en',
    targetLengthSec: 60,
    tempo: 'normal',
    voicePreset: 'alloy',
  });

  const plan = await postJson<PlanResponse>(`/api/project/${project.id}/plan`);
  await postJson(`/api/plan/${plan.id}/approve`);
  const run = await postJson<RunResponse>(`/api/plan/${plan.id}/render`);

  const finished = await waitForRun(run.id);
  console.log(`Run ${finished.id} status: ${finished.status}`);
  console.log(`Artifacts: ${finished.artifactsJson}`);

  if (shouldVerify) {
    const verification = await getJson(`/api/run/${finished.id}/verify`);
    console.log('Verification:', verification);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
