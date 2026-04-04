import { describe, it, expect, vi } from 'vitest';
import { routing, NAMESPACES } from './routing';
import commonMessages from '../../../locales/en/common.json';
import errorMessages from '../../../locales/en/errors.json';

// createNavigation depends on Next.js internals unavailable in vitest
vi.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    Link: () => null,
    redirect: () => null,
    usePathname: () => '/',
    useRouter: () => ({}),
    getPathname: () => '/',
  }),
}));

describe('i18n routing', () => {
  it('includes "en" in supported locales', () => {
    expect(routing.locales).toContain('en');
  });

  it('uses "en" as the default locale', () => {
    expect(routing.defaultLocale).toBe('en');
  });

  it('exports NAMESPACES with common and errors', () => {
    expect(NAMESPACES).toContain('common');
    expect(NAMESPACES).toContain('errors');
    expect(NAMESPACES.length).toBeGreaterThanOrEqual(2);
  });
});

describe('locale files', () => {
  it('common.json has the "common" namespace with expected keys', () => {
    expect(commonMessages).toHaveProperty('common');
    expect(commonMessages.common).toHaveProperty('appName');
    expect(commonMessages.common).toHaveProperty('appDescription');
  });

  it('errors.json has the "errors" namespace with api and validation', () => {
    expect(errorMessages).toHaveProperty('errors');
    expect(errorMessages.errors).toHaveProperty('api');
    expect(errorMessages.errors).toHaveProperty('validation');
  });

  it('uses ICU plural format in at least one key', () => {
    const errorsStr = JSON.stringify(errorMessages);
    expect(errorsStr).toContain('plural,');
  });

  it('common.json keys are sorted alphabetically', () => {
    const keys = Object.keys(commonMessages.common);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });

  it('errors.api keys are sorted alphabetically', () => {
    const keys = Object.keys(errorMessages.errors.api);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });

  it('errors.validation keys are sorted alphabetically', () => {
    const keys = Object.keys(errorMessages.errors.validation);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });

  it('merging namespace files produces expected top-level keys', () => {
    const merged = { ...commonMessages, ...errorMessages };
    expect(Object.keys(merged).sort()).toEqual(['common', 'errors']);
  });

  it('has no duplicate keys across namespace files', () => {
    const commonKeys = Object.keys(commonMessages);
    const errorKeys = Object.keys(errorMessages);
    const overlap = commonKeys.filter((k) => errorKeys.includes(k));
    expect(overlap).toEqual([]);
  });
});

describe('navigation exports', () => {
  it('exports Link, redirect, usePathname, useRouter, getPathname', async () => {
    // createNavigation depends on Next.js internals, so we verify the module
    // exports exist by importing the barrel which re-exports them
    const nav = await import('./navigation');
    expect(nav.Link).toBeDefined();
    expect(nav.redirect).toBeDefined();
    expect(nav.usePathname).toBeDefined();
    expect(nav.useRouter).toBeDefined();
    expect(nav.getPathname).toBeDefined();
  });
});
