import { test, expect } from '@playwright/test';
import { E2E_API_BASE } from './api-base.js';

test('analytics page loads and shows list', async ({ page }) => {
  await page.goto('/analytics');
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(
    page.getByText(/Edit views, likes, retention|Total views|No runs yet/).first()
  ).toBeVisible();
});

test('analytics shows Total views when runs exist', async ({ page, request }) => {
  const runsRes = await request.get(`${E2E_API_BASE}/api/run`);
  expect(runsRes.ok()).toBeTruthy();
  const runs = await runsRes.json();

  await page.goto('/analytics');
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();

  if (runs.length > 0) {
    await expect(page.getByText('Total views:')).toBeVisible();
  } else {
    await expect(page.getByText('No runs yet.')).toBeVisible();
  }
});

test('analytics edit and save when run exists', async ({ page, request }) => {
  const runsRes = await request.get(`${E2E_API_BASE}/api/run`);
  expect(runsRes.ok()).toBeTruthy();
  const runs = await runsRes.json();
  if (runs.length === 0) {
    test.skip();
    return;
  }

  await page.goto('/analytics');
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(page.getByText('Total views:')).toBeVisible();

  const firstSave = page.getByRole('button', { name: 'Save' }).first();
  await expect(firstSave).toBeVisible();
  const firstViewsInput = page.locator('input[type="number"]').first();
  await firstViewsInput.fill('42');
  await firstSave.click();
  await expect(firstSave).toBeVisible({ timeout: 8000 });
});
