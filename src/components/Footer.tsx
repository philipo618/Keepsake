import { Moon, Sun } from 'lucide-react';
import { useApp } from './AppContext';
import type { AppRoute } from './Navbar';

export function Footer({ navigate }: { navigate: (next: AppRoute) => void }) {
  const { theme, toggleTheme, settings, user, logout } = useApp();

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              {settings.siteName || 'Keepsake'}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-md">
              {settings.tagline || 'Interactive Digital Stationery & Gift Experiences'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => navigate({ page: 'create' })}
              className="hover:text-slate-900 dark:hover:text-white min-h-[40px] px-2"
            >
              Create a Gift
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'explore' })}
              className="hover:text-slate-900 dark:hover:text-white min-h-[40px] px-2"
            >
              Explore Templates
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'dashboard' })}
              className="hover:text-slate-900 dark:hover:text-white min-h-[40px] px-2"
            >
              My Studio
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'admin' })}
              className="hover:text-slate-900 dark:hover:text-white min-h-[40px] px-2"
            >
              Admin
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-xs font-medium"
              aria-label="Toggle light and dark theme"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark Theme</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light Theme</span>
                </>
              )}
            </button>

            {user && (
              <button
                type="button"
                onClick={logout}
                className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-700 dark:hover:text-rose-400"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>© {new Date().getFullYear()} {settings.siteName || 'Keepsake'}. All rights reserved.</span>
          <span>Powered by Firebase &amp; Static Web Architecture</span>
        </div>
      </div>
    </footer>
  );
}
