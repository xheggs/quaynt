'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DataTablePaginationProps {
  /** Current page (1-indexed, matching API) */
  page: number;
  /** Rows per page */
  limit: number;
  /** Total record count */
  total: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback when page size changes */
  onLimitChange?: (limit: number) => void;
  /** Available page sizes */
  limitOptions?: number[];
}

export function DataTablePagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 25, 50, 100],
}: DataTablePaginationProps) {
  const t = useTranslations('ui');

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  // Build page numbers with ellipsis
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div
      data-slot="data-table-pagination"
      className="flex flex-wrap items-center justify-between gap-4 px-2 py-4"
    >
      {/* Showing summary */}
      <p className="text-xs text-muted-foreground">{t('table.showing', { from, to, total })}</p>

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(1)}
          disabled={isFirstPage}
          aria-label={t('table.firstPage')}
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(page - 1)}
          disabled={isFirstPage}
          aria-label={t('table.previousPage')}
        >
          <ChevronLeft className="size-4" />
        </Button>

        {pageNumbers.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">
              ...
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'outline' : 'ghost'}
              size="icon"
              onClick={() => onPageChange(p)}
              aria-label={t('table.page', { page: p, totalPages })}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </Button>
          )
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(page + 1)}
          disabled={isLastPage}
          aria-label={t('table.nextPage')}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(totalPages)}
          disabled={isLastPage}
          aria-label={t('table.lastPage')}
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>

      {/* Rows per page */}
      {onLimitChange && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('table.rowsPerPage')}</span>
          <Select value={String(limit)} onValueChange={(value) => onLimitChange(Number(value))}>
            <SelectTrigger className="h-7 w-16" aria-label={t('table.rowsPerPage')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {limitOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

/**
 * Generate page numbers with ellipsis for large ranges.
 * Shows first, last, and 2 pages around current.
 */
function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];
  const rangeStart = Math.max(2, current - 1);
  const rangeEnd = Math.min(total - 1, current + 1);

  pages.push(1);

  if (rangeStart > 2) {
    pages.push('ellipsis');
  }

  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  if (rangeEnd < total - 1) {
    pages.push('ellipsis');
  }

  pages.push(total);

  return pages;
}
