import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe } from 'vitest-axe';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithReportProviders } from './test-utils';
import { ReportsView } from '../reports-view';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/reports',
}));

vi.mock('../../reports.api', () => ({
  fetchReportJobs: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 25, total: 0 } }),
  fetchReportSchedules: vi
    .fn()
    .mockResolvedValue({ data: [], meta: { page: 1, limit: 25, total: 0 } }),
  fetchScheduleDeliveries: vi
    .fn()
    .mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0 } }),
  fetchReportTemplates: vi
    .fn()
    .mockResolvedValue({ data: [], meta: { page: 1, limit: 25, total: 0 } }),
  generatePdfReport: vi.fn(),
  fetchReportJob: vi.fn(),
  buildReportDownloadUrl: vi.fn((id: string) => `/api/v1/reports/pdf/${id}/download`),
  buildExportUrl: vi.fn(() => '/api/v1/exports?type=report&format=csv'),
  createReportSchedule: vi.fn(),
  updateReportSchedule: vi.fn(),
  deleteReportSchedule: vi.fn(),
  triggerReportSchedule: vi.fn(),
  createReportTemplate: vi.fn(),
  updateReportTemplate: vi.fn(),
  deleteReportTemplate: vi.fn(),
  duplicateReportTemplate: vi.fn(),
  uploadTemplateLogo: vi.fn(),
  deleteTemplateLogo: vi.fn(),
  fetchTemplatePreview: vi.fn(),
}));

vi.mock('@/features/dashboard', () => ({
  usePromptSetOptions: () => ({
    options: [{ value: 'ps-1', label: 'SaaS Tools' }],
    isLoading: false,
  }),
}));

vi.mock('@/features/brands/brand.api', () => ({
  fetchBrands: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0 } }),
}));

vi.mock('@/features/prompt-sets/prompt-set.api', () => ({
  fetchPromptSets: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0 } }),
}));

import * as editionModule from '@/lib/edition';

vi.mock('@/lib/edition', () => ({
  isCommercial: vi.fn(() => false),
  getEdition: vi.fn(() => 'community'),
}));

describe('ReportsView', () => {
  beforeEach(() => {
    vi.mocked(editionModule.isCommercial).mockReturnValue(false);
  });

  it('renders page title', async () => {
    renderWithReportProviders(<ReportsView />);
    const headings = await screen.findAllByRole('heading', { level: 1 });
    expect(headings[0].textContent).toBe('Reports');
  });

  it('renders all three tab buttons', () => {
    renderWithReportProviders(<ReportsView />);
    const tablists = screen.getAllByRole('tablist');
    const navTablist = tablists[0];
    const tabs = navTablist.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(3);
    const tabTexts = Array.from(tabs).map((t) => t.textContent);
    expect(tabTexts).toContain('Generate');
    expect(tabTexts).toContain('Downloads');
    expect(tabTexts).toContain('Schedules');
  });

  it('defaults to generate tab selected', () => {
    renderWithReportProviders(<ReportsView />);
    const tablists = screen.getAllByRole('tablist');
    const navTablist = tablists[0];
    const tabs = navTablist.querySelectorAll('[role="tab"]');
    const generateTab = Array.from(tabs).find((t) => t.textContent === 'Generate');
    expect(generateTab?.getAttribute('aria-selected')).toBe('true');
  });

  it('switches tabs on click', () => {
    renderWithReportProviders(<ReportsView />);
    const tablists = screen.getAllByRole('tablist');
    const navTablist = tablists[0];
    const tabs = navTablist.querySelectorAll('[role="tab"]');
    const downloadsTab = Array.from(tabs).find((t) => t.textContent === 'Downloads')!;
    fireEvent.click(downloadsTab);
    expect(downloadsTab.getAttribute('aria-selected')).toBe('true');
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithReportProviders(<ReportsView />);
    await screen.findAllByRole('heading', { level: 1 });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('hides Templates tab in Community edition', () => {
    vi.mocked(editionModule.isCommercial).mockReturnValue(false);
    renderWithReportProviders(<ReportsView />);
    const tablists = screen.getAllByRole('tablist');
    const navTablist = tablists[0];
    const tabs = navTablist.querySelectorAll('[role="tab"]');
    const tabTexts = Array.from(tabs).map((t) => t.textContent);
    expect(tabTexts).not.toContain('Templates');
  });

  it('shows Templates tab in Commercial edition', async () => {
    vi.mocked(editionModule.isCommercial).mockReturnValue(true);
    const { container } = renderWithReportProviders(<ReportsView />);
    // Wait for the component to fully render
    await screen.findAllByRole('heading', { level: 1 });
    const tablists = container.querySelectorAll('[role="tablist"]');
    const navTablist = tablists[0];
    const tabs = navTablist.querySelectorAll('[role="tab"]');
    const tabTexts = Array.from(tabs).map((t) => t.textContent);
    expect(tabTexts).toContain('Templates');
  });
});
