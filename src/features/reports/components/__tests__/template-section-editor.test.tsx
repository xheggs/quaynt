import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithReportProviders } from './test-utils';
import { TemplateSectionEditor } from '../template-section-editor';
import type { TemplateSections } from '../../reports.types';
import { REPORT_SECTIONS } from '../../reports.types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/reports',
}));

function buildAllEnabledSections(): TemplateSections {
  const sections = {} as TemplateSections;
  for (const s of REPORT_SECTIONS) {
    sections[s] = true;
  }
  sections.sectionOrder = [...REPORT_SECTIONS];
  return sections;
}

describe('TemplateSectionEditor', () => {
  it('renders all 7 sections with labels', () => {
    const sections = buildAllEnabledSections();
    renderWithReportProviders(<TemplateSectionEditor sections={sections} onChange={vi.fn()} />);

    expect(screen.getByText('Cover page')).toBeDefined();
    expect(screen.getByText('Executive summary')).toBeDefined();
    expect(screen.getByText('Recommendation share')).toBeDefined();
    expect(screen.getByText('Competitor benchmarks')).toBeDefined();
    expect(screen.getByText('Opportunities')).toBeDefined();
    expect(screen.getByText('Citation sources')).toBeDefined();
    expect(screen.getByText('Alert summary')).toBeDefined();
  });

  it('calls onChange when section is toggled off', () => {
    const sections = buildAllEnabledSections();
    const onChange = vi.fn();
    const { container } = renderWithReportProviders(
      <TemplateSectionEditor sections={sections} onChange={onChange} />
    );

    // The Radix Checkbox wraps the native element - find the clickable button
    const items = container.querySelectorAll('li');
    const firstItem = items[0];
    const checkboxButton = within(firstItem as HTMLElement).getByRole('checkbox');
    fireEvent.click(checkboxButton);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ cover: false }));
  });

  it('prevents disabling the last enabled section', () => {
    const sections = buildAllEnabledSections();
    for (const s of REPORT_SECTIONS) {
      if (s !== 'cover') sections[s] = false;
    }
    const onChange = vi.fn();

    const { container } = renderWithReportProviders(
      <TemplateSectionEditor sections={sections} onChange={onChange} />
    );

    const items = container.querySelectorAll('li');
    const firstItem = items[0];
    const checkboxButton = within(firstItem as HTMLElement).getByRole('checkbox');
    fireEvent.click(checkboxButton);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange when section is moved down', () => {
    const sections = buildAllEnabledSections();
    const onChange = vi.fn();
    const { container } = renderWithReportProviders(
      <TemplateSectionEditor sections={sections} onChange={onChange} />
    );

    const items = container.querySelectorAll('li');
    const firstItem = items[0];
    const moveDownBtn = within(firstItem as HTMLElement).getByRole('button', {
      name: /down/i,
    });
    fireEvent.click(moveDownBtn);

    expect(onChange).toHaveBeenCalled();
    const newSections = onChange.mock.calls[0][0];
    expect(newSections.sectionOrder[0]).toBe('executiveSummary');
    expect(newSections.sectionOrder[1]).toBe('cover');
  });

  it('disables move up button for first item', () => {
    const sections = buildAllEnabledSections();
    const { container } = renderWithReportProviders(
      <TemplateSectionEditor sections={sections} onChange={vi.fn()} />
    );

    const items = container.querySelectorAll('li');
    const firstItem = items[0];
    const moveUpBtn = within(firstItem as HTMLElement).getByRole('button', {
      name: /up/i,
    });
    expect(moveUpBtn.hasAttribute('disabled')).toBe(true);
  });

  it('disables move down button for last item', () => {
    const sections = buildAllEnabledSections();
    const { container } = renderWithReportProviders(
      <TemplateSectionEditor sections={sections} onChange={vi.fn()} />
    );

    const items = container.querySelectorAll('li');
    const lastItem = items[items.length - 1];
    const moveDownBtn = within(lastItem as HTMLElement).getByRole('button', {
      name: /down/i,
    });
    expect(moveDownBtn.hasAttribute('disabled')).toBe(true);
  });

  it('renders without accessibility violations', async () => {
    const sections = buildAllEnabledSections();
    const { container } = renderWithReportProviders(
      <TemplateSectionEditor sections={sections} onChange={vi.fn()} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
