'use client';

import { ErrorState } from '@/components/error-state';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;
  return (
    <main className="flex min-h-screen items-center justify-center">
      <ErrorState variant="page" onRetry={reset} />
    </main>
  );
}
