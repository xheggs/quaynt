'use client';

import { Card, CardContent } from '@/components/ui/card';

export function DualScoreSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-6 md:grid-cols-2 py-8">
          <div className="bg-muted/50 mx-auto size-[180px] animate-pulse rounded-full" />
          <div className="bg-muted/50 mx-auto size-[180px] animate-pulse rounded-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 py-6">
          <div className="bg-muted/50 h-6 w-40 animate-pulse rounded" />
          <div className="bg-muted/50 h-4 w-64 animate-pulse rounded" />
        </CardContent>
      </Card>
    </div>
  );
}
