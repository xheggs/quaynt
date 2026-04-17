import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Real-browser smoke test for the attribution snippet (PRP 6.2a validation gate #26).
 *
 * Runs in Chromium, Firefox, and WebKit. Intercepts the snippet src and the collector
 * POST to verify end-to-end behavior without needing the full backend stack.
 */

const SNIPPET_PATH = path.resolve(
  __dirname,
  '..',
  'public',
  'snippet',
  'v1',
  'quaynt-attribution.js'
);
const SNIPPET_SOURCE = readFileSync(SNIPPET_PATH, 'utf-8');

const SITE_KEY = 'tsk_' + 'a'.repeat(32);

const FIXTURE_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <title>Test page</title>
  </head>
  <body>
    <h1>Hello</h1>
    <script async
            src="/snippet/v1/quaynt-attribution.js"
            data-site-key="${SITE_KEY}"
            data-collector="http://example-collector.invalid"></script>
  </body>
</html>
`.trim();

async function setupFixture(page: import('@playwright/test').Page) {
  // Serve the snippet via route interception.
  await page.route('**/snippet/v1/quaynt-attribution.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: SNIPPET_SOURCE,
    });
  });

  // Serve the fixture HTML with a faked chatgpt.com referrer.
  await page.route('https://example-fixture.invalid/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      headers: { referer: 'https://chatgpt.com/' },
      body: FIXTURE_HTML,
    });
  });
}

test.describe('attribution snippet — real browser', () => {
  test('POSTs to the collector when visit comes from an AI source', async ({ page }) => {
    await setupFixture(page);

    const collectorPromise = page.waitForRequest(
      (req) => req.url().includes('/api/v1/traffic/collect/') && req.method() === 'POST',
      { timeout: 5000 }
    );

    // Intercept the collector endpoint to return 204.
    await page.route('**/api/v1/traffic/collect/**', async (route) => {
      await route.fulfill({ status: 204 });
    });

    // Use a data: URL as the *previous* page so the browser sends a Referer. We can't
    // forge a real cross-origin referrer in Playwright without navigating there first,
    // so we instead drive the snippet via the utm_source fallback path.
    await page.goto('https://example-fixture.invalid/page?utm_source=chatgpt.com', {
      waitUntil: 'domcontentloaded',
    });

    const request = await collectorPromise;
    const body = request.postDataJSON();
    expect(body).toMatchObject({
      landingPath: expect.stringContaining('/page'),
      userAgentFamily: expect.stringMatching(/^(Chrome|Safari|Firefox|Edge|Other)$/),
    });
  });

  test('falls back to fetch when sendBeacon is undefined', async ({ page }) => {
    await setupFixture(page);

    // Stub sendBeacon BEFORE the snippet runs.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
    });

    const collectorPromise = page.waitForRequest(
      (req) => req.url().includes('/api/v1/traffic/collect/') && req.method() === 'POST',
      { timeout: 5000 }
    );

    await page.route('**/api/v1/traffic/collect/**', async (route) => {
      await route.fulfill({ status: 204 });
    });

    await page.goto('https://example-fixture.invalid/page?utm_source=chatgpt.com', {
      waitUntil: 'domcontentloaded',
    });

    const request = await collectorPromise;
    expect(request.method()).toBe('POST');
  });

  test('does NOT post when referrer/utm are not AI sources', async ({ page }) => {
    await setupFixture(page);

    let posted = false;
    await page.route('**/api/v1/traffic/collect/**', async (route) => {
      posted = true;
      await route.fulfill({ status: 204 });
    });

    await page.goto('https://example-fixture.invalid/page?utm_source=google', {
      waitUntil: 'domcontentloaded',
    });
    // Give the snippet a moment to run.
    await page.waitForTimeout(300);

    expect(posted).toBe(false);
  });

  test('does NOT touch document.cookie on the fixture page', async ({ page }) => {
    await setupFixture(page);

    await page.route('**/api/v1/traffic/collect/**', async (route) => {
      await route.fulfill({ status: 204 });
    });

    await page.goto('https://example-fixture.invalid/page?utm_source=chatgpt.com', {
      waitUntil: 'domcontentloaded',
    });

    const cookies = await page.context().cookies();
    expect(cookies).toEqual([]);

    const documentCookie = await page.evaluate(() => document.cookie);
    expect(documentCookie).toBe('');
  });

  test('honors Sec-GPC by not posting when globalPrivacyControl is set', async ({ page }) => {
    await setupFixture(page);

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
    });

    let posted = false;
    await page.route('**/api/v1/traffic/collect/**', async (route) => {
      posted = true;
      await route.fulfill({ status: 204 });
    });

    await page.goto('https://example-fixture.invalid/page?utm_source=chatgpt.com', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(300);
    expect(posted).toBe(false);
  });
});
