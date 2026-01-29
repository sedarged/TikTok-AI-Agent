import { test, expect, APIRequestContext } from '@playwright/test';

async function waitForRunDone(request: APIRequestContext, runId: string) {
  const start = Date.now();
  while (Date.now() - start < 15000) {
    const res = await request.get(`/api/run/${runId}`);
    expect(res.ok()).toBeTruthy();
    const run = await res.json();
    if (run.status === 'done') {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for dry-run completion');
}

async function createProjectAndRun(request: APIRequestContext) {
  const projectRes = await request.post('/api/project', {
    data: {
      topic: `Dry-run Queue ${Date.now()}`,
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

  await waitForRunDone(request, run.id);
  return { projectId: project.id, runId: run.id };
}

test('render queue + verify/export in dry-run', async ({ page, request }) => {
  const configRes = await request.post('/api/test/dry-run-config', {
    data: { failStep: '', stepDelayMs: 0 },
  });
  expect(configRes.ok()).toBeTruthy();

  const { projectId, runId } = await createProjectAndRun(request);

  await page.goto(`/project/${projectId}/runs`);
  await expect(page.getByText('Render Queue')).toBeVisible();
  await expect(page.getByText('done', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Output' })).toBeVisible();

  await page.goto(`/run/${runId}`);
  await expect(page.getByText('Dry-run Render')).toBeVisible();

  // Verify/Export actions live under the More menu
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Verify Artifacts' }).click();
  await expect(page.getByText('Verification Results')).toBeVisible();
  await expect(page.getByText('PASS', { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(runId);
});
