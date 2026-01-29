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
  // Wait for Plan Studio to load (UI recently moved actions into menus)
  await expect(page.getByRole('button', { name: 'Narzędzia' })).toBeVisible();

  await page.getByRole('button', { name: 'Outline' }).click();
  const outlineText = `E2E outline ${Date.now()}`;
  const outlineField = page.getByPlaceholder('Enter your video outline...');
  const putPromise = page.waitForResponse(
    (res) => res.url().includes('/api/plan/') && res.request().method() === 'PUT',
    { timeout: 5000 }
  );
  await outlineField.fill(outlineText);
  await putPromise;

  await page.reload();
  await page.waitForURL(/\/project\/.*\/plan/);
  await page.getByRole('button', { name: 'Outline' }).click();
  await expect(page.getByPlaceholder('Enter your video outline...')).toHaveValue(outlineText);

  // Validate + Autofit are under Tools menu
  await page.getByRole('button', { name: 'Narzędzia' }).click();
  await page.getByRole('button', { name: 'Validate' }).click();
  await page.getByRole('button', { name: 'Narzędzia' }).click();
  await page.getByRole('button', { name: 'Auto-fit Durations' }).click();

  await page.getByRole('button', { name: 'Scenes' }).click();
  // Per-scene actions (Lock/Regenerate) are inside a scene menu now
  const firstSceneCard = page
    .locator('.card')
    .filter({ has: page.getByLabel('Scene menu') })
    .first();
  await firstSceneCard.getByLabel('Scene menu').click();
  await firstSceneCard.getByRole('button', { name: 'Lock' }).click();
  await firstSceneCard.getByLabel('Scene menu').click();
  await expect(firstSceneCard.getByRole('button', { name: 'Unlock' })).toBeVisible();
  await expect(firstSceneCard.getByRole('button', { name: 'Regenerate' })).toBeDisabled();

  await page.getByRole('button', { name: 'Approve & Render' }).click();
  await page.waitForURL(/\/run\/.+/);
  await expect(page.getByText('Dry-run Render')).toBeVisible();
});
