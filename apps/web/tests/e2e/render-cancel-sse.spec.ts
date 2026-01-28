import { test, expect, APIRequestContext } from '@playwright/test';

async function setDryRunConfig(request: APIRequestContext, config: { failStep?: string; stepDelayMs?: number }) {
  const res = await request.post('/api/test/dry-run-config', { data: config });
  expect(res.ok()).toBeTruthy();
}

async function waitForRunStatus(request: APIRequestContext, runId: string, status: string) {
  const start = Date.now();
  while (Date.now() - start < 10000) {
    const res = await request.get(`/api/run/${runId}`);
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
  const projectRes = await request.post('/api/project', {
    data: {
      topic: `Dry-run Cancel ${Date.now()}`,
      nichePackId: 'facts',
      targetLengthSec: 60,
      tempo: 'normal',
      voicePreset: 'alloy',
    },
  });
  expect(projectRes.ok()).toBeTruthy();
  const project = await projectRes.json();

  const planRes = await request.post(`/api/project/${project.id}/plan`);
  expect(planRes.ok()).toBeTruthy();
  const plan = await planRes.json();

  const approveRes = await request.post(`/api/plan/${plan.id}/approve`);
  expect(approveRes.ok()).toBeTruthy();

  const renderRes = await request.post(`/api/plan/${plan.id}/render`);
  expect(renderRes.ok()).toBeTruthy();
  const run = await renderRes.json();

  return { projectId: project.id, runId: run.id };
}

test.afterEach(async ({ request }) => {
  await setDryRunConfig(request, { failStep: '', stepDelayMs: 0 });
});

test('dry-run cancel shows SSE log and canceled status', async ({ page, request }) => {
  await setDryRunConfig(request, { failStep: '', stepDelayMs: 300 });

  const { projectId, runId } = await createProjectAndRun(request);

  await page.goto(`/run/${runId}`);
  await expect(page.getByText('Rendering...')).toBeVisible();

  await expect(page.getByText('Generating voice-over audio...')).toBeVisible();

  await request.post(`/api/run/${runId}/cancel`);
  await waitForRunStatus(request, runId, 'canceled');

  await page.goto(`/project/${projectId}/runs`);
  await expect(page.getByText('canceled', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});
