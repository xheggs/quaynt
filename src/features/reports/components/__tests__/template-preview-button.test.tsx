import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithReportProviders } from './test-utils';
import { TemplatePreviewButton } from '../template-preview-button';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/reports',
}));

const mockFetchTemplatePreview = vi.fn();

vi.mock('../../reports.api', () => ({
  fetchTemplatePreview: (...args: unknown[]) => mockFetchTemplatePreview(...args),
}));

describe('TemplatePreviewButton', () => {
  it('renders preview button', () => {
    renderWithReportProviders(<TemplatePreviewButton templateId="tmpl-1" />);

    expect(screen.getByText('Preview')).toBeDefined();
  });

  it('opens preview in new tab on success', async () => {
    const mockBlob = new Blob(['pdf-content'], { type: 'application/pdf' });
    mockFetchTemplatePreview.mockResolvedValue(mockBlob);

    const originalOpen = window.open;
    window.open = vi.fn();

    const { container } = renderWithReportProviders(<TemplatePreviewButton templateId="tmpl-1" />);

    const button = container.querySelector('button')!;
    fireEvent.click(button);

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith(expect.any(String), '_blank');
    });

    window.open = originalOpen;
  });

  it('renders button as disabled when disabled prop is true', () => {
    const { container } = renderWithReportProviders(
      <TemplatePreviewButton templateId="tmpl-1" disabled />
    );

    const button = container.querySelector('button')!;
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithReportProviders(<TemplatePreviewButton templateId="tmpl-1" />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
