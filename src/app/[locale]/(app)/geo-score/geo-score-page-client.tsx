'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { queryKeys } from '@/lib/query/keys';
import { fetchBrands } from '@/features/brands';
import { GeoScoreView } from '@/features/geo-score';

interface GeoScorePageClientProps {
  brandId?: string;
}

export function GeoScorePageClient({ brandId }: GeoScorePageClientProps) {
  const t = useTranslations('geoScore');
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [explicitSelected, setExplicitSelected] = useState<string | undefined>(brandId);

  const brandsQuery = useQuery({
    queryKey: queryKeys.brands.list({ limit: 100 }),
    queryFn: () => fetchBrands({ page: 1, limit: 100 }),
    staleTime: 60 * 1000,
  });

  const brands = brandsQuery.data?.data ?? [];
  const selected = explicitSelected ?? brands[0]?.id;

  function onBrandChange(next: string) {
    setExplicitSelected(next);
    const params = new URLSearchParams(search?.toString() ?? '');
    params.set('brandId', next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 p-4 lg:p-8">
      {brands.length > 0 ? (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">{t('headline.label')}:</span>
          <Select value={selected} onValueChange={onBrandChange}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-6 text-center text-sm">
            {t('errors.brandRequired')}
          </CardContent>
        </Card>
      )}

      <GeoScoreView brandId={selected} />
    </div>
  );
}
