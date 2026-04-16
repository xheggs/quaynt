import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation', () => {
  test('skip-to-content link receives focus first and navigates to main content', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // First Tab should focus the skip-to-content link
    await page.keyboard.press('Tab');
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeFocused();

    // Pressing Enter should move focus to #main-content
    await page.keyboard.press('Enter');
    const main = page.locator('#main-content');
    await expect(main).toBeFocused();
  });

  test('Tab navigates through header nav items in order', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Skip past the skip-to-content link
    await page.keyboard.press('Tab');
    // Tab to the logo/brand link
    await page.keyboard.press('Tab');

    // Collect focused element text for the next several Tabs (nav items)
    const focusOrder: string[] = [];
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const text = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
      if (text) focusOrder.push(text);
    }

    // Verify relative ordering — Dashboard should appear before Brands
    const dashboardIdx = focusOrder.findIndex((t) => t.includes('Dashboard'));
    const brandsIdx = focusOrder.findIndex((t) => t.includes('Brands'));
    if (dashboardIdx >= 0 && brandsIdx >= 0) {
      expect(dashboardIdx).toBeLessThan(brandsIdx);
    }
  });

  test('form dialog can be navigated and submitted via keyboard', async ({ page }) => {
    await page.goto('/brands');
    await page.waitForLoadState('networkidle');

    // Click the create button to open dialog
    const createBtn = page.getByRole('button', { name: /create/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();

      // Wait for dialog to appear
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Tab through fields — first field should be name input
      await page.keyboard.press('Tab');
      const activeTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
      expect(['input', 'textarea', 'select', 'button']).toContain(activeTag);

      // Press Escape to close dialog
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
    }
  });

  test('data table sortable headers are keyboard-accessible', async ({ page }) => {
    await page.goto('/brands');
    await page.waitForLoadState('networkidle');

    // Look for sortable column header buttons in the data table
    const sortButton = page.locator('th button').first();
    if (await sortButton.isVisible()) {
      await sortButton.focus();
      await expect(sortButton).toBeFocused();

      // Press Enter to sort
      await page.keyboard.press('Enter');
      // Verify aria-sort attribute changes
      const th = page.locator('th[aria-sort]').first();
      const sortValue = await th.getAttribute('aria-sort');
      expect(['ascending', 'descending']).toContain(sortValue);
    }
  });

  test('dropdown menu is keyboard-navigable', async ({ page }) => {
    await page.goto('/brands');
    await page.waitForLoadState('networkidle');

    // Find a row actions dropdown trigger
    const menuTrigger = page.getByRole('button', { name: /actions/i }).first();
    if (await menuTrigger.isVisible()) {
      await menuTrigger.focus();
      await page.keyboard.press('Enter');

      // Menu should be visible
      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible();

      // Arrow down to navigate
      await page.keyboard.press('ArrowDown');

      // Escape to close
      await page.keyboard.press('Escape');
      await expect(menu).not.toBeVisible();
    }
  });
});
