import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithAlertProviders } from './test-utils';
import { AlertRuleFormDialog } from '../alert-rule-form-dialog';
import type { AlertRule } from '../../alerts.types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/alerts',
}));

vi.mock('../../alerts.api', () => ({
  createAlertRule: vi.fn(),
  updateAlertRule: vi.fn(),
}));

const mockRule: AlertRule = {
  id: 'alertRule_1',
  workspaceId: 'ws_1',
  name: 'Test rule',
  description: null,
  metric: 'recommendation_share',
  promptSetId: 'ps_1',
  scope: { brandId: 'brand_1' },
  condition: 'drops_below',
  threshold: '20.0000',
  direction: 'any',
  cooldownMinutes: 60,
  severity: 'warning',
  enabled: true,
  lastEvaluatedAt: null,
  lastTriggeredAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockBrands = [{ id: 'brand_1', name: 'Acme Corp' }];
const mockPromptSets = [{ id: 'ps_1', name: 'Market Analysis' }];

describe('AlertRuleFormDialog', () => {
  it('renders create mode with empty form', () => {
    renderWithAlertProviders(
      <AlertRuleFormDialog
        open={true}
        onOpenChange={() => {}}
        brandOptions={mockBrands}
        promptSetOptions={mockPromptSets}
      />
    );
    expect(screen.getByText('Create Alert Rule')).toBeDefined();
  });

  it('renders edit mode with pre-filled fields', () => {
    renderWithAlertProviders(
      <AlertRuleFormDialog
        rule={mockRule}
        open={true}
        onOpenChange={() => {}}
        brandOptions={mockBrands}
        promptSetOptions={mockPromptSets}
      />
    );
    expect(screen.getByText('Edit Alert Rule')).toBeDefined();
    expect(screen.getByDisplayValue('Test rule')).toBeDefined();
  });

  it('shows sentence preview with condition', () => {
    renderWithAlertProviders(
      <AlertRuleFormDialog
        rule={mockRule}
        open={true}
        onOpenChange={() => {}}
        brandOptions={mockBrands}
        promptSetOptions={mockPromptSets}
      />
    );
    // The sentence preview contains the full interpolated string
    const matches = screen.getAllByText(/Alert when.*drops below/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithAlertProviders(
      <AlertRuleFormDialog
        open={true}
        onOpenChange={() => {}}
        brandOptions={mockBrands}
        promptSetOptions={mockPromptSets}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
