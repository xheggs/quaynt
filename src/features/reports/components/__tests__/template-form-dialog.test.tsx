import { describe, it, expect, vi, afterEach } from 'vitest';
import { axe } from 'vitest-axe';
import { screen, cleanup, within } from '@testing-library/react';
import { renderWithReportProviders } from './test-utils';
import { TemplateFormDialog } from '../template-form-dialog';
import type { ReportSection, ReportTemplate } from '../../reports.types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/reports',
}));

vi.mock('../../reports.api', () => ({
  createReportTemplate: vi.fn().mockResolvedValue({ id: 'tmpl-new' }),
  updateReportTemplate: vi.fn().mockResolvedValue({ id: 'tmpl-1' }),
  uploadTemplateLogo: vi.fn().mockResolvedValue({ uploadId: 'logo-1' }),
  deleteTemplateLogo: vi.fn().mockResolvedValue(undefined),
}));

const mockTemplate: ReportTemplate = {
  id: 'tmpl-1',
  workspaceId: 'ws-1',
  name: 'Existing Template',
  description: 'A test template',
  branding: {
    primaryColor: '#9B70BC',
    secondaryColor: '#1A1A1A',
    accentColor: '#2563EB',
    fontFamily: 'noto-sans' as const,
    footerText: 'Confidential',
  },
  sections: {
    cover: true,
    executiveSummary: true,
    recommendationShare: true,
    competitorBenchmarks: true,
    opportunities: true,
    citationSources: true,
    alertSummary: false,
    sectionOrder: [
      'cover',
      'executiveSummary',
      'recommendationShare',
      'competitorBenchmarks',
      'opportunities',
      'citationSources',
      'alertSummary',
    ] as ReportSection[],
  },
  coverOverrides: { title: 'Custom Title' },
  isDefault: false,
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z',
};

describe('TemplateFormDialog', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders create mode with dialog title', async () => {
    renderWithReportProviders(<TemplateFormDialog open onOpenChange={vi.fn()} />);

    const heading = await screen.findByRole('heading', { name: 'Create template' });
    expect(heading).toBeDefined();
  });

  it('renders create mode with empty name field', async () => {
    renderWithReportProviders(<TemplateFormDialog open onOpenChange={vi.fn()} />);

    await screen.findByRole('heading', { name: 'Create template' });
    const dialog = screen.getByRole('dialog');
    const nameInput = within(dialog).getByLabelText('Template name') as HTMLInputElement;
    expect(nameInput.value).toBe('');
  });

  it('renders edit mode with pre-filled data', async () => {
    renderWithReportProviders(
      <TemplateFormDialog template={mockTemplate} open onOpenChange={vi.fn()} />
    );

    const heading = await screen.findByRole('heading', { name: 'Edit template' });
    expect(heading).toBeDefined();
    const dialog = screen.getByRole('dialog');
    const nameInput = within(dialog).getByLabelText('Template name') as HTMLInputElement;
    expect(nameInput.value).toBe('Existing Template');
  });

  it('renders branding color inputs', async () => {
    renderWithReportProviders(<TemplateFormDialog open onOpenChange={vi.fn()} />);

    await screen.findByRole('heading', { name: 'Create template' });
    const dialog = screen.getByRole('dialog');
    const colorInputs = dialog.querySelectorAll('input[type="color"]');
    expect(colorInputs.length).toBe(3);
  });

  it('renders section checkboxes', async () => {
    renderWithReportProviders(<TemplateFormDialog open onOpenChange={vi.fn()} />);

    await screen.findByRole('heading', { name: 'Create template' });
    const dialog = screen.getByRole('dialog');
    const checkboxes = dialog.querySelectorAll('[id^="section-"]');
    expect(checkboxes.length).toBe(7);
  });

  it('renders without accessibility violations', async () => {
    renderWithReportProviders(<TemplateFormDialog open onOpenChange={vi.fn()} />);

    await screen.findByRole('heading', { name: 'Create template' });
    const dialog = screen.getByRole('dialog');
    const results = await axe(dialog);
    expect(results).toHaveNoViolations();
  });
});
