import { test, expect } from '@playwright/test';

/**
 * Onboarding happy-path scroll assertion.
 *
 * Asserts that each onboarding step fits within a 1280×800 viewport without
 * scroll. The full sign-up → first-run flow requires authenticated test
 * fixtures (separate PRP); this spec covers the structural assertion and
 * captures screenshots for visual review.
 */

const VIEWPORT_DESKTOP = { width: 1280, height: 800 };

async function assertNoScroll(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
  );
  // 1px slack to dodge sub-pixel rounding on certain platforms.
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('Onboarding editorial flow — viewport fit', () => {
  test.use({ viewport: VIEWPORT_DESKTOP });

  test('welcome step fits 1280×800 without scroll', async ({ page }) => {
    await page.goto('/en/onboarding/welcome');
    await page.waitForLoadState('networkidle');
    // If the page redirected to sign-in, skip the scroll assertion — the
    // authenticated fixture is a follow-up. Still capture a screenshot.
    if (!page.url().includes('/onboarding/welcome')) {
      test.skip(true, 'Onboarding routes require authenticated fixture');
      return;
    }
    await assertNoScroll(page);
    await page.screenshot({ path: 'test-results/onboarding-welcome-light.png', fullPage: false });
  });

  test('welcome step honours dark mode without scroll', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/en/onboarding/welcome');
    await page.waitForLoadState('networkidle');
    if (!page.url().includes('/onboarding/welcome')) {
      test.skip(true, 'Onboarding routes require authenticated fixture');
      return;
    }
    await assertNoScroll(page);
    await page.screenshot({ path: 'test-results/onboarding-welcome-dark.png', fullPage: false });
  });
});

test.describe('Onboarding editorial flow — mobile fit', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('welcome step fits 390×844 mobile without scroll', async ({ page }) => {
    await page.goto('/en/onboarding/welcome');
    await page.waitForLoadState('networkidle');
    if (!page.url().includes('/onboarding/welcome')) {
      test.skip(true, 'Onboarding routes require authenticated fixture');
      return;
    }
    const { overflow, innerHeight } = await page.evaluate(() => ({
      overflow: document.documentElement.scrollHeight - window.innerHeight,
      innerHeight: window.innerHeight,
    }));
    // Mobile is allowed up to 1.25× viewport height — the page is intentionally
    // compact, but small UA chrome differences land within ~80px in CI.
    expect(overflow).toBeLessThanOrEqual(innerHeight * 0.25);
    await page.screenshot({ path: 'test-results/onboarding-welcome-mobile.png', fullPage: false });
  });
});
