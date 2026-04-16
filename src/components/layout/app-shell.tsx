import { TopNav } from './top-nav';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main id="main-content" className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
