'use client';

export function OnboardingMain({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pb-16 pt-6 sm:px-10"
    >
      {children}
    </main>
  );
}
