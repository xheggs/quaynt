'use client';

import { useTranslations } from 'next-intl';
import { Circle, CircleDot } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PresenceMatrixRow } from '../benchmark.types';

interface PresenceMatrixProps {
  data: { rows: PresenceMatrixRow[]; total: number } | undefined;
  page: number;
  onPageChange: (page: number) => void;
  brandNames: string[];
}

const PAGE_SIZE = 25;

export function PresenceMatrix({ data, page, onPageChange, brandNames }: PresenceMatrixProps) {
  const t = useTranslations('benchmarks');
  const tUi = useTranslations('ui');

  if (!data || data.rows.length === 0) {
    return null;
  }

  const totalPages = Math.ceil(data.total / PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('presence.title')}</CardTitle>
        <CardDescription>{t('presence.description')}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0 pb-4">
        <table className="w-full text-sm" data-testid="presence-matrix">
          <thead>
            <tr className="border-b">
              <th
                scope="col"
                className="min-w-[200px] px-4 py-2 text-left font-medium text-muted-foreground"
              >
                {t('presence.prompt')}
              </th>
              {brandNames.map((name) => (
                <th
                  key={name}
                  scope="col"
                  className="px-3 py-2 text-center font-medium text-muted-foreground"
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.promptId} className="border-b last:border-b-0">
                <td className="max-w-[300px] px-4 py-2">
                  <span className="line-clamp-2" title={row.promptText}>
                    {row.promptText}
                  </span>
                </td>
                {brandNames.map((brandName) => {
                  const brandData = row.brands.find((b) => b.brandName === brandName);
                  if (!brandData) {
                    return (
                      <td key={brandName} className="px-3 py-2 text-center text-muted-foreground">
                        &mdash;
                      </td>
                    );
                  }
                  return (
                    <td
                      key={brandName}
                      className="px-3 py-2 text-center"
                      aria-label={
                        brandData.present
                          ? t('presence.ariaPresent', {
                              brand: brandName,
                              prompt: row.promptText,
                              count: brandData.citationCount,
                            })
                          : t('presence.ariaAbsent', {
                              brand: brandName,
                              prompt: row.promptText,
                            })
                      }
                    >
                      {brandData.present ? (
                        <div className="flex flex-col items-center">
                          <CircleDot className="size-4 text-success" aria-hidden="true" />
                          {brandData.citationCount > 0 && (
                            <span className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                              {brandData.citationCount}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Circle
                          className="mx-auto size-4 text-muted-foreground/40"
                          aria-hidden="true"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 pt-4">
            <p className="text-sm text-muted-foreground">
              {tUi('table.showing', {
                from: (page - 1) * PAGE_SIZE + 1,
                to: Math.min(page * PAGE_SIZE, data.total),
                total: data.total,
              })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                {tUi('table.previousPage')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                {tUi('table.nextPage')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
