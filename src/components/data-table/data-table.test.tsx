import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import type { ColumnDef } from '@tanstack/react-table';
import { renderWithProviders } from '@/test-utils';
import { DataTable } from './data-table';

interface TestRow {
  id: string;
  name: string;
  status: string;
}

const columns: ColumnDef<TestRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'status',
    header: 'Status',
  },
];

const testData: TestRow[] = [
  { id: '1', name: 'Brand A', status: 'Active' },
  { id: '2', name: 'Brand B', status: 'Inactive' },
];

describe('DataTable', () => {
  it('renders data without accessibility violations', async () => {
    const { container } = renderWithProviders(<DataTable columns={columns} data={testData} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders empty state when no data', () => {
    const { getByText } = renderWithProviders(<DataTable columns={columns} data={[]} />);
    expect(getByText('No results found')).toBeDefined();
  });

  it('renders custom empty state', () => {
    const { getByText } = renderWithProviders(
      <DataTable columns={columns} data={[]} emptyState={<div>Custom empty</div>} />
    );
    expect(getByText('Custom empty')).toBeDefined();
  });

  it('renders all row data', () => {
    const { container } = renderWithProviders(<DataTable columns={columns} data={testData} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Brand A');
    expect(text).toContain('Brand B');
    expect(text).toContain('Active');
    expect(text).toContain('Inactive');
  });

  it('renders toolbar when provided', () => {
    const { getByText } = renderWithProviders(
      <DataTable columns={columns} data={testData} toolbar={<div>Toolbar content</div>} />
    );
    expect(getByText('Toolbar content')).toBeDefined();
  });
});
