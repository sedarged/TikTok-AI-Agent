import { test, expect } from '@playwright/test';
import { E2E_API_BASE } from './api-base.js';

test('output page metrics editor - edit and save', async ({ page, request }) => {
  // Get a completed run
  const runsRes = await request.get(`${E2E_API_BASE}/api/run`);
  expect(runsRes.ok()).toBeTruthy();
  const runs = await runsRes.json();

  // Find a completed run
  const completedRun = runs.find((r: { status: string }) => r.status === 'done');
  if (!completedRun) {
    test.skip();
    return;
  }

  // Navigate to the output page
  await page.goto(`/run/${completedRun.id}`);
  await expect(page.getByRole('heading', { name: /Video Complete|Render Output/ })).toBeVisible();

  // Check that Metrics section is visible
  await expect(page.getByRole('heading', { name: 'Metrics', level: 3 })).toBeVisible();

  // Click Edit button
  const editButton = page
    .getByRole('button', { name: 'Edit' })
    .filter({ has: page.locator('text=Edit') })
    .first();
  await editButton.click();

  // Edit mode should show input fields
  await expect(page.getByLabel('Views')).toBeVisible();
  await expect(page.getByLabel('Likes')).toBeVisible();
  await expect(page.getByLabel('Retention (0-1)')).toBeVisible();

  // Fill in new values
  const viewsInput = page.getByLabel('Views');
  const likesInput = page.getByLabel('Likes');
  const retentionInput = page.getByLabel('Retention (0-1)');

  await viewsInput.fill('999');
  await likesInput.fill('88');
  await retentionInput.fill('0.88');

  // Click Save button
  const saveButton = page.getByRole('button', { name: 'Save' });
  await saveButton.click();

  // Wait for save to complete and return to view mode
  await expect(editButton).toBeVisible({ timeout: 8000 });

  // Verify the updated values are displayed
  await expect(page.getByText('999')).toBeVisible();
  await expect(page.getByText('88')).toBeVisible();
  await expect(page.getByText('88.0%')).toBeVisible();

  // Verify via API that values were persisted
  const runRes = await request.get(`${E2E_API_BASE}/api/run/${completedRun.id}`);
  expect(runRes.ok()).toBeTruthy();
  const updatedRun = await runRes.json();
  expect(updatedRun.views).toBe(999);
  expect(updatedRun.likes).toBe(88);
  expect(updatedRun.retention).toBe(0.88);
});

test('output page metrics editor - validation for retention', async ({ page, request }) => {
  // Get a completed run
  const runsRes = await request.get(`${E2E_API_BASE}/api/run`);
  expect(runsRes.ok()).toBeTruthy();
  const runs = await runsRes.json();

  const completedRun = runs.find((r: { status: string }) => r.status === 'done');
  if (!completedRun) {
    test.skip();
    return;
  }

  await page.goto(`/run/${completedRun.id}`);
  await expect(page.getByRole('heading', { name: /Video Complete|Render Output/ })).toBeVisible();

  // Click Edit button
  const editButton = page
    .getByRole('button', { name: 'Edit' })
    .filter({ has: page.locator('text=Edit') })
    .first();
  await editButton.click();

  // Try to enter invalid retention value (> 1)
  const retentionInput = page.getByLabel('Retention (0-1)');
  await retentionInput.fill('1.5');

  // Click Save button
  const saveButton = page.getByRole('button', { name: 'Save' });
  await saveButton.click();

  // Should show validation error
  await expect(page.getByText('Retention must be between 0 and 1')).toBeVisible();

  // Fix the value
  await retentionInput.fill('0.75');
  await saveButton.click();

  // Should save successfully
  await expect(editButton).toBeVisible({ timeout: 8000 });
});

test('output page metrics editor - cancel discards changes', async ({ page, request }) => {
  // Get a completed run
  const runsRes = await request.get(`${E2E_API_BASE}/api/run`);
  expect(runsRes.ok()).toBeTruthy();
  const runs = await runsRes.json();

  const completedRun = runs.find((r: { status: string }) => r.status === 'done');
  if (!completedRun) {
    test.skip();
    return;
  }

  await page.goto(`/run/${completedRun.id}`);
  await expect(page.getByRole('heading', { name: /Video Complete|Render Output/ })).toBeVisible();

  // Get original values from view mode
  const metricsSection = page.locator('.card:has(h3:text("Metrics"))');
  const originalContent = await metricsSection.textContent();

  // Click Edit button
  const editButton = page
    .getByRole('button', { name: 'Edit' })
    .filter({ has: page.locator('text=Edit') })
    .first();
  await editButton.click();

  // Change values
  const viewsInput = page.getByLabel('Views');
  await viewsInput.fill('12345');

  // Click Cancel button
  const cancelButton = page.getByRole('button', { name: 'Cancel' });
  await cancelButton.click();

  // Should return to view mode
  await expect(editButton).toBeVisible();

  // Original values should still be displayed (not changed)
  const newContent = await metricsSection.textContent();
  expect(newContent).toBe(originalContent);
});
