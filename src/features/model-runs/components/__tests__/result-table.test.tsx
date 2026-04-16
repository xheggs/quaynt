import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithRunProviders } from './test-utils';
import { ResultTable } from '../result-table';
import type { PaginatedResponse } from '@/lib/query/types';
import type { ModelRunResult } from '../../model-run.types';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/en/model-runs/run-1',
}));

vi.mock('../../model-run.api', () => ({
  fetchModelRunResults: vi.fn(),
}));

import { fetchModelRunResults } from '../../model-run.api';

const mockResults: ModelRunResult[] = [
  {
    id: 'result-1',
    modelRunId: 'run-1',
    promptId: 'prompt-1',
    adapterConfigId: 'ac-1',
    platformId: 'openai',
    interpolatedPrompt: 'What are the best alternatives to Acme Corp in the electronics market?',
    status: 'completed',
    textContent: 'Here are the top alternatives to Acme Corp...',
    responseMetadata: null,
    error: null,
    startedAt: '2026-01-15T00:00:00Z',
    completedAt: '2026-01-15T00:00:02Z',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:02Z',
  },
  {
    id: 'result-2',
    modelRunId: 'run-1',
    promptId: 'prompt-1',
    adapterConfigId: 'ac-2',
    platformId: 'perplexity',
    interpolatedPrompt: 'What are the best alternatives to Acme Corp in the electronics market?',
    status: 'failed',
    textContent: null,
    responseMetadata: null,
    error: 'Rate limit exceeded',
    startedAt: '2026-01-15T00:00:00Z',
    completedAt: '2026-01-15T00:00:01Z',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:01Z',
  },
];

const mockResponse: PaginatedResponse<ModelRunResult> = {
  data: mockResults,
  meta: { page: 1, limit: 25, total: 2 },
};

const emptyResponse: PaginatedResponse<ModelRunResult> = {
  data: [],
  meta: { page: 1, limit: 25, total: 0 },
};

describe('ResultTable', () => {
  it('renders results with platform badges', async () => {
    vi.mocked(fetchModelRunResults).mockResolvedValue(mockResponse);
    renderWithRunProviders(<ResultTable runId="run-1" />);
    expect(await screen.findByText('openai')).toBeDefined();
    expect(screen.getByText('perplexity')).toBeDefined();
  });

  it('renders prompt text in table', async () => {
    vi.mocked(fetchModelRunResults).mockResolvedValue(mockResponse);
    renderWithRunProviders(<ResultTable runId="run-1" />);
    await screen.findByText('openai');
    // Both results have the same prompt, so should find at least one
    const prompts = screen.getAllByText(
      'What are the best alternatives to Acme Corp in the electronics market?'
    );
    expect(prompts.length).toBeGreaterThan(0);
  });

  it('renders empty state when no results match', async () => {
    vi.mocked(fetchModelRunResults).mockResolvedValue(emptyResponse);
    renderWithRunProviders(<ResultTable runId="run-1" />);
    expect(await screen.findByText('No results match the current filters.')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    vi.mocked(fetchModelRunResults).mockResolvedValue(mockResponse);
    const { container } = renderWithRunProviders(<ResultTable runId="run-1" />);
    await screen.findAllByText('openai');
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
