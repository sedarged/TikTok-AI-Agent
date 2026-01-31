import { test, expect } from '@playwright/test';

/**
 * E2E test for topic suggestions feature in QuickCreate page.
 * Verifies that:
 * - "Suggest viral topics" button is visible
 * - Button is disabled when OpenAI is not configured (or in test mode)
 * - UI follows expected patterns
 */
test.describe('Topic Suggestions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show "Suggest viral topics" button in QuickCreate', async ({ page }) => {
    // Find the button with the expected text
    const suggestButton = page.getByRole('button', { name: /suggest viral topics/i });
    await expect(suggestButton).toBeVisible();
  });

  test('should have topic input field', async ({ page }) => {
    // Verify topic textarea is present
    const topicInput = page.getByPlaceholder(
      'e.g., 5 surprising facts about the deep ocean, The real story behind the Titanic...'
    );
    await expect(topicInput).toBeVisible();
  });

  test('button should be near the topic input', async ({ page }) => {
    // Verify the layout: button should be in the same section as topic label
    const topicLabel = page.getByText('Topic / Seed');
    const suggestButton = page.getByRole('button', { name: /suggest viral topics/i });

    await expect(topicLabel).toBeVisible();
    await expect(suggestButton).toBeVisible();

    // Both should be in the same parent container
    const labelParent = topicLabel.locator('..');
    const buttonInSameContainer = labelParent.getByRole('button', {
      name: /suggest viral topics/i,
    });
    await expect(buttonInSameContainer).toBeVisible();
  });

  test('should be disabled when OpenAI is not configured', async ({ page, request }) => {
    // Check the status endpoint to determine expected button state
    const statusRes = await request.get('/api/status');
    expect(statusRes.ok()).toBeTruthy();
    const status = await statusRes.json();

    const suggestButton = page.getByRole('button', { name: /suggest viral topics/i });

    // Button should be disabled if OpenAI is not configured
    if (!status.providers?.openai) {
      await expect(suggestButton).toBeDisabled();
    } else {
      // If OpenAI is configured, button should be enabled (not disabled)
      await expect(suggestButton).not.toBeDisabled();
    }
  });
});
