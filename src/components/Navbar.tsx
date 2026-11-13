import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useApp } from './AppContext';

export type AppRoute =
  | { page: 'landing' }
  | { page: 'explore' }
  | { page: 'create'; editId?: string; templateId?: string; categoryId?: string }
  | { page: 'dashboard' }
  | { page: 'admin' }
  | { page: 'greeting'; id: string };

export function Navbar({
  route,
  navigate,
}: {
  route: AppRoute;
  navigate: (next: AppRoute) => void;
}) {
  const { settings } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkClass = (active: boolean) =>
    `whitespace-nowrap shrink-0 text-sm font-medium transition-colors pb-0.5 ${
      active
        ? 'text-rose-700 dark:text-rose-400 border-b border-rose-700 dark:border-rose-400'
        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-[#0B0F17]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single clean wordmark */}
        <button
          type="button"
          onClick={() => {
            navigate({ page: 'landing' });
            setMobileOpen(false);
          }}
          className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 min-h-[44px] flex items-center"
        >
          {settings.siteName || 'Keepsake'}
        </button>

        {/* Zone 2: Clean single-line text nav links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary Navigation">
          <button
            type="button"
            onClick={() => navigate({ page: 'explore' })}
            className={linkClass(route.page === 'explore')}
          >
            Explore Cards
          </button>
          <button
            type="button"
            onClick={() => navigate({ page: 'dashboard' })}
            className={linkClass(route.page === 'dashboard')}
          >
            My Studio
          </button>
          <button
            type="button"
            onClick={() => navigate({ page: 'admin' })}
            className={linkClass(route.page === 'admin')}
          >
            Admin Login
          </button>
        </nav>

        {/* Zone 3: Single primary action CTA + Mobile drawer toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              navigate({ page: 'create' });
              setMobileOpen(false);
            }}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            Create a Gift
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] px-4 py-3 space-y-1">
          <button
            type="button"
            onClick={() => {
              navigate({ page: 'explore' });
              setMobileOpen(false);
            }}
            className="w-full min-h-[44px] px-3 text-left text-sm font-medium text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Explore Cards
          </button>
          <button
            type="button"
            onClick={() => {
              navigate({ page: 'dashboard' });
              setMobileOpen(false);
            }}
            className="w-full min-h-[44px] px-3 text-left text-sm font-medium text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            My Studio
          </button>
          <button
            type="button"
            onClick={() => {
              navigate({ page: 'admin' });
              setMobileOpen(false);
            }}
            className="w-full min-h-[44px] px-3 text-left text-sm font-medium text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Admin Login
          </button>
        </div>
      )}
    </header>
  );
}
