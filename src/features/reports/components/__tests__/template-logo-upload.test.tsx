import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithReportProviders } from './test-utils';
import { TemplateLogoUpload } from '../template-logo-upload';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/reports',
}));

vi.mock('../../reports.api', () => ({
  uploadTemplateLogo: vi.fn().mockResolvedValue({ uploadId: 'upload-123' }),
}));

vi.mock('../../reports.validation', () => ({
  logoUploadSchema: {
    safeParse: () => ({ success: true }),
  },
}));

describe('TemplateLogoUpload', () => {
  it('renders drop zone when no logo', () => {
    renderWithReportProviders(
      <TemplateLogoUpload onLogoUploaded={vi.fn()} onLogoRemoved={vi.fn()} />
    );

    expect(screen.getByText('Upload logo')).toBeDefined();
    expect(screen.getByRole('button')).toBeDefined();
  });

  it('renders preview when logo URL provided', () => {
    const { container } = renderWithReportProviders(
      <TemplateLogoUpload
        currentLogoUrl="https://example.com/logo.png"
        onLogoUploaded={vi.fn()}
        onLogoRemoved={vi.fn()}
      />
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
  });

  it('renders file input for upload', () => {
    renderWithReportProviders(
      <TemplateLogoUpload onLogoUploaded={vi.fn()} onLogoRemoved={vi.fn()} />
    );

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput?.getAttribute('accept')).toBe('.png,.jpg,.jpeg');
  });

  it('calls onLogoRemoved when remove button clicked', () => {
    const onRemoved = vi.fn();

    const { container } = renderWithReportProviders(
      <TemplateLogoUpload
        currentLogoUrl="https://example.com/logo.png"
        onLogoUploaded={vi.fn()}
        onLogoRemoved={onRemoved}
      />
    );

    const removeBtn = container.querySelector('button[aria-label="Remove logo"]')!;
    fireEvent.click(removeBtn);

    expect(onRemoved).toHaveBeenCalled();
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithReportProviders(
      <TemplateLogoUpload onLogoUploaded={vi.fn()} onLogoRemoved={vi.fn()} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
