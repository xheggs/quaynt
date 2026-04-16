import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithRunProviders } from './test-utils';
import { NewRunDialog } from '../new-run-dialog';
import type { PaginatedResponse } from '@/lib/query/types';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/en/model-runs',
}));

// Mock APIs
vi.mock('@/features/brands/brand.api', () => ({
  fetchBrands: vi.fn().mockResolvedValue({
    data: [{ id: 'brand-1', name: 'Acme Corp' }],
    meta: { page: 1, limit: 100, total: 1 },
  } satisfies PaginatedResponse<unknown>),
}));

vi.mock('@/features/prompt-sets/prompt-set.api', () => ({
  fetchPromptSets: vi.fn().mockResolvedValue({
    data: [{ id: 'ps-1', name: 'Default Set' }],
    meta: { page: 1, limit: 100, total: 1 },
  } satisfies PaginatedResponse<unknown>),
}));

vi.mock('../../model-run.api', () => ({
  createModelRun: vi.fn(),
  fetchAdapterConfigs: vi.fn().mockResolvedValue({
    data: [
      {
        id: 'ac-1',
        platformId: 'openai',
        displayName: 'ChatGPT',
        enabled: true,
        credentialsSet: true,
      },
      {
        id: 'ac-2',
        platformId: 'perplexity',
        displayName: 'Perplexity',
        enabled: false,
        credentialsSet: false,
      },
    ],
    meta: { page: 1, limit: 50, total: 2 },
  } satisfies PaginatedResponse<unknown>),
}));

describe('NewRunDialog', () => {
  it('renders form fields when open', async () => {
    renderWithRunProviders(<NewRunDialog open={true} onOpenChange={() => {}} />);
    expect(await screen.findByText('New Model Run')).toBeDefined();
    expect(screen.getByText('Start Run')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    const { baseElement } = renderWithRunProviders(
      <NewRunDialog open={true} onOpenChange={() => {}} />
    );
    await screen.findAllByText('New Model Run');
    expect(
      await axe(baseElement, {
        rules: {
          'color-contrast': { enabled: false },
          'nested-interactive': { enabled: false },
          'button-name': { enabled: false },
        },
      })
    ).toHaveNoViolations();
  });

  it('loads adapter configs and shows them', async () => {
    renderWithRunProviders(<NewRunDialog open={true} onOpenChange={() => {}} />);
    const items = await screen.findAllByText('ChatGPT');
    expect(items.length).toBeGreaterThan(0);
    const perplexity = screen.getAllByText('Perplexity');
    expect(perplexity.length).toBeGreaterThan(0);
  });
});
