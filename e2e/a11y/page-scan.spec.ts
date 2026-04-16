import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
  { name: 'Brands', path: '/brands' },
  { name: 'Prompt Sets', path: '/prompt-sets' },
  { name: 'Model Runs', path: '/model-runs' },
  { name: 'Citations', path: '/citations' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Benchmarks', path: '/benchmarks' },
  { name: 'Opportunities', path: '/opportunities' },
  { name: 'Alerts', path: '/alerts' },
  { name: 'Reports', path: '/reports' },
  { name: 'Reports Templates', path: '/reports/templates' },
  { name: 'Settings Profile', path: '/settings/profile' },
  { name: 'Settings Integrations', path: '/settings/adapters' },
];

const themes = ['light', 'dark'] as const;

for (const page of pages) {
  for (const theme of themes) {
    test(`${page.name} (${theme} mode) has no WCAG 2.1 AA violations`, async ({ page: pwPage }) => {
      await pwPage.goto(page.path);
      await pwPage.waitForLoadState('networkidle');

      if (theme === 'dark') {
        await pwPage.evaluate(() => {
          document.documentElement.classList.add('dark');
        });
        // Allow styles to settle after theme change
        await pwPage.waitForTimeout(100);
      }

      const results = await new AxeBuilder({ page: pwPage })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(
        results.violations,
        `${page.name} (${theme}): ${results.violations.map((v) => `${v.id}: ${v.description} (${v.nodes.length} nodes)`).join('; ')}`
      ).toEqual([]);
    });
  }
}
