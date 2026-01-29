import { test, expect } from '@playwright/test';

test('plan preview and dry-run render flow', async ({ page }) => {
  await page.goto('/create');
  await expect(page.getByText('Create TikTok Video')).toBeVisible();

  const topicField = page.getByPlaceholder(
    'e.g., 5 surprising facts about the deep ocean, The real story behind the Titanic...'
  );
  await topicField.fill(`Dry-run E2E topic ${Date.now()}`);

  await page.getByRole('button', { name: 'Generate Plan' }).click();
  await page.waitForURL(/\/project\/.*\/plan/);
  await expect(page.getByText('Select Hook')).toBeVisible();

  await page.getByRole('button', { name: 'Outline' }).click();
  const outlineText = `E2E outline ${Date.now()}`;
  await page.getByPlaceholder('Enter your video outline...').fill(outlineText);
  await page.waitForTimeout(800);

  await page.reload();
  await page.waitForURL(/\/project\/.*\/plan/);
  await page.getByRole('button', { name: 'Outline' }).click();
  await expect(page.getByPlaceholder('Enter your video outline...')).toHaveValue(outlineText);

  await page.getByRole('button', { name: 'Validate' }).click();
  await page.getByRole('button', { name: 'Auto-fit Durations' }).click();

  await page.getByRole('button', { name: 'Scenes' }).click();
  const firstSceneCard = page
    .locator('.card')
    .filter({ has: page.getByRole('button', { name: 'Regen' }) })
    .first();
  await firstSceneCard.getByRole('button', { name: 'Lock' }).click();
  await expect(firstSceneCard.getByRole('button', { name: 'Unlock' })).toBeVisible();
  await expect(firstSceneCard.getByRole('button', { name: 'Regen' })).toBeDisabled();

  await page.getByRole('button', { name: 'Approve & Render' }).click();
  await page.waitForURL(/\/run\/.+/);
  await expect(page.getByText('Dry-run Render')).toBeVisible();
});
