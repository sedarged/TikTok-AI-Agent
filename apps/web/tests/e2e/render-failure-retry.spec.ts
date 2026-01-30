import { test, expect, APIRequestContext } from '@playwright/test';
import { E2E_API_BASE } from './api-base.js';

async function setDryRunConfig(
  request: APIRequestContext,
  config: { failStep?: string; stepDelayMs?: number }
) {
  const res = await request.post(`${E2E_API_BASE}/api/test/dry-run-config`, { data: config });
  expect(res.ok()).toBeTruthy();
}

async function waitForRunStatus(request: APIRequestContext, runId: string, status: string) {
  const start = Date.now();
  while (Date.now() - start < 10000) {
    const res = await request.get(`${E2E_API_BASE}/api/run/${runId}`);
    expect(res.ok()).toBeTruthy();
    const run = await res.json();
    if (run.status === status) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for status ${status}`);
}

async function createProjectAndRun(request: APIRequestContext) {
  const projectRes = await request.post(`${E2E_API_BASE}/api/project`, {
    data: {
      topic: `Dry-run Failure ${Date.now()}`,
      nichePackId: 'facts',
      targetLengthSec: 60,
      tempo: 'normal',
      voicePreset: 'alloy',
    },
  });
  expect(projectRes.ok()).toBeTruthy();
  const project = await projectRes.json();

  const planRes = await request.post(`${E2E_API_BASE}/api/project/${project.id}/plan`);
  expect(planRes.ok()).toBeTruthy();
  const plan = await planRes.json();

  const approveRes = await request.post(`${E2E_API_BASE}/api/plan/${plan.id}/approve`);
  expect(approveRes.ok()).toBeTruthy();

  const renderRes = await request.post(`${E2E_API_BASE}/api/plan/${plan.id}/render`);
  expect(renderRes.ok()).toBeTruthy();
  const run = await renderRes.json();

  return { projectId: project.id, runId: run.id };
}

test.afterEach(async ({ request }) => {
  await setDryRunConfig(request, { failStep: '', stepDelayMs: 0 });
});

test('dry-run failure then retry completes', async ({ page, request }) => {
  await setDryRunConfig(request, { failStep: 'images_generate', stepDelayMs: 0 });

  const { projectId, runId } = await createProjectAndRun(request);
  await waitForRunStatus(request, runId, 'failed');

  await page.goto(`/project/${projectId}/runs`);
  await expect(page.getByText('failed', { exact: true })).toBeVisible();

  await setDryRunConfig(request, { failStep: '', stepDelayMs: 0 });
  await page.getByRole('button', { name: 'Retry' }).click();

  await waitForRunStatus(request, runId, 'done');
  await page.goto(`/run/${runId}`);
  await expect(page.getByText('Dry-run Render')).toBeVisible();
});
