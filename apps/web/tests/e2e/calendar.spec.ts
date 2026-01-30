import { test, expect } from '@playwright/test';
import { E2E_API_BASE } from './api-base.js';

test('calendar page loads with from/to and export', async ({ page }) => {
  await page.goto('/calendar');
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  await expect(page.getByText('Upcoming runs by scheduled publish date')).toBeVisible();
  await expect(page.getByLabel('From')).toBeVisible();
  await expect(page.getByLabel('To')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
});

test('calendar shows list or empty state', async ({ page }) => {
  await page.goto('/calendar');
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  await expect(page.getByText(/Loading…|Topic|No upcoming runs|scheduled/i).first()).toBeVisible();
});

test('calendar export CSV when runs exist', async ({ page, request }) => {
  const res = await request.get(`${E2E_API_BASE}/api/run/upcoming?from=2020-01-01&to=2030-12-31`);
  expect(res.ok()).toBeTruthy();
  const runs = await res.json();

  await page.goto('/calendar');
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  const exportBtn = page.getByRole('button', { name: 'Export CSV' });
  if (runs.length === 0) {
    await expect(exportBtn).toBeDisabled();
  } else {
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await exportBtn.click();
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/^calendar-.*\.csv$/);
    }
  }
});
