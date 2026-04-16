/**
 * WCAG 2.1 AA color contrast verification for design tokens.
 *
 * Parses globals.css to extract CSS custom property values and verifies
 * all foreground/background pairings meet minimum contrast requirements:
 * - 4.5:1 for normal text (WCAG 1.4.3)
 * - 3:1 for large text and UI components (WCAG 1.4.11)
 *
 * This test exists because vitest-axe cannot verify color contrast in jsdom.
 * It is complemented by Playwright page-level scans in e2e/a11y/.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// ── Color math ────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/** Linearize an sRGB channel value per WCAG 2.1 relative luminance spec. */
function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.1 relative luminance. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG contrast ratio between two colors (always >= 1). */
function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── Token extraction ──────────────────────────────────────────────

type TokenMap = Record<string, string>;

/**
 * Extract CSS custom property hex values from a CSS block.
 * Only matches 6-digit hex values — skips rgba() and other formats.
 */
function extractHexTokens(css: string): TokenMap {
  const tokens: TokenMap = {};
  const re = /--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g;
  let match;
  while ((match = re.exec(css)) !== null) {
    tokens[`--${match[1]}`] = match[2];
  }
  return tokens;
}

function loadTokens(): { light: TokenMap; dark: TokenMap } {
  const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf-8');

  // Split on the .dark selector to separate light/dark blocks
  const darkStart = css.indexOf('.dark {');
  if (darkStart === -1) {
    throw new Error('Could not find .dark { block in globals.css');
  }

  const lightSection = css.slice(0, darkStart);
  const darkSection = css.slice(darkStart);

  return {
    light: extractHexTokens(lightSection),
    dark: extractHexTokens(darkSection),
  };
}

// ── Test definitions ──────────────────────────────────────────────

interface ContrastCheck {
  fg: string;
  bg: string;
  minRatio: number;
  label: string;
}

function buildChecks(tokens: TokenMap, mode: string): ContrastCheck[] {
  const checks: ContrastCheck[] = [];

  function add(fgToken: string, bgToken: string, minRatio: number, label: string) {
    const fg = tokens[fgToken];
    const bg = tokens[bgToken];
    if (fg && bg) {
      checks.push({ fg, bg, minRatio, label: `${mode}: ${label} (${fgToken} on ${bgToken})` });
    }
  }

  // Normal text (4.5:1)
  add('--foreground', '--background', 4.5, 'foreground on background');
  add('--foreground', '--card', 4.5, 'foreground on card');
  add('--foreground', '--muted', 4.5, 'foreground on muted');
  add('--muted-foreground', '--background', 4.5, 'muted-foreground on background');
  add('--muted-foreground', '--card', 4.5, 'muted-foreground on card');
  add('--muted-foreground', '--muted', 4.5, 'muted-foreground on muted');
  // primary-foreground is used on buttons (14px bold = large text per WCAG) — 3:1 threshold
  add('--primary-foreground', '--primary', 3, 'primary-foreground on primary (large text)');

  // Semantic colors on card (used as text labels — 4.5:1)
  add('--destructive', '--card', 4.5, 'destructive on card');
  add('--success', '--card', 4.5, 'success on card');
  add('--warning', '--card', 4.5, 'warning on card');
  add('--info', '--card', 4.5, 'info on card');

  // Semantic colors on their background variants (used as text — 4.5:1)
  add('--destructive', '--destructive-bg', 4.5, 'destructive on destructive-bg');
  add('--success', '--success-bg', 4.5, 'success on success-bg');
  add('--warning', '--warning-bg', 4.5, 'warning on warning-bg');
  add('--info', '--info-bg', 4.5, 'info on info-bg');

  // Interactive elements (3:1 per WCAG 1.4.11)
  add('--primary', '--card', 3, 'primary on card (interactive)');

  // Chart colors on card (graphical objects — 3:1 per WCAG 1.4.11)
  for (let i = 1; i <= 8; i++) {
    add(`--chart-${i}`, '--card', 3, `chart-${i} on card (graphical)`);
  }

  return checks;
}

// ── Tests ─────────────────────────────────────────────────────────

describe('Design token color contrast (WCAG 2.1 AA)', () => {
  const { light, dark } = loadTokens();

  describe('Light mode', () => {
    const checks = buildChecks(light, 'light');

    it.each(checks)('$label', ({ fg, bg, minRatio }) => {
      const ratio = contrastRatio(fg, bg);
      expect(ratio, `${fg} on ${bg}: ${ratio.toFixed(2)}:1 < ${minRatio}:1`).toBeGreaterThanOrEqual(
        minRatio
      );
    });
  });

  describe('Dark mode', () => {
    const checks = buildChecks(dark, 'dark');

    it.each(checks)('$label', ({ fg, bg, minRatio }) => {
      const ratio = contrastRatio(fg, bg);
      expect(ratio, `${fg} on ${bg}: ${ratio.toFixed(2)}:1 < ${minRatio}:1`).toBeGreaterThanOrEqual(
        minRatio
      );
    });
  });
});
