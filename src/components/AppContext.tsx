import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, BOOTSTRAPPED_ADMIN_EMAIL, googleProvider } from '../lib/firebase';
import {
  checkIsAdmin,
  fetchCategories,
  fetchPlatformSettings,
  fetchTemplates,
  syncCreatorProfile,
} from '../lib/firestoreService';
import { DEFAULT_CATEGORIES, DEFAULT_PLATFORM_SETTINGS, DEFAULT_TEMPLATES } from '../lib/catalog';
import type { Category, PlatformSettings, Template, ThemeMode } from '../lib/types';

interface AppContextValue {
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  categories: Category[];
  templates: Template[];
  settings: PlatformSettings;
  refreshCatalog: () => Promise<void>;
  signInWithGoogle: () => Promise<User | null>;
  signInAsGuest: () => Promise<{ user: User | null; error?: string }>;
  logout: () => Promise<void>;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  authModalReason: string;
  promptAuth: (reason?: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('keepsake_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState('');

  const applyThemeClass = (mode: ThemeMode) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', mode === 'dark');
    }
  };

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem('keepsake_theme', mode);
    applyThemeClass(mode);
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const refreshCatalog = async () => {
    const [loadedSettings, loadedCats, loadedTemplates] = await Promise.all([
      fetchPlatformSettings(),
      fetchCategories(false),
      fetchTemplates(false),
    ]);
    setSettings(loadedSettings);
    setCategories(loadedCats);
    setTemplates(loadedTemplates);
    if (!localStorage.getItem('keepsake_theme') && loadedSettings.defaultTheme) {
      setThemeState(loadedSettings.defaultTheme);
    }
  };

  useEffect(() => {
    refreshCatalog();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const adminFlag = await checkIsAdmin(
          currentUser.uid,
          currentUser.email,
          currentUser.emailVerified
        );
        setIsAdmin(adminFlag);
        syncCreatorProfile().catch(() => {});
      } else {
        setIsAdmin(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = async (): Promise<User | null> => {
    const cred = await signInWithPopup(auth, googleProvider);
    setAuthModalOpen(false);
    return cred.user;
  };

  const signInAsGuest = async (): Promise<{ user: User | null; error?: string }> => {
    try {
      const cred = await signInAnonymously(auth);
      setAuthModalOpen(false);
      return { user: cred.user };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('operation-not-allowed') || msg.includes('admin-restricted-operation')) {
        return {
          user: null,
          error:
            'Guest anonymous sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method → Anonymous). Please use "Continue with Google" below.',
        };
      }
      return { user: null, error: msg };
    }
  };

  const logout = async () => {
    await signOut(auth);
    setIsAdmin(false);
  };

  const promptAuth = (reason = 'Sign in to save drafts, upload media, and generate your unique sharing link.') => {
    setAuthModalReason(reason);
    setAuthModalOpen(true);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        authReady,
        isAdmin,
        theme,
        setTheme,
        toggleTheme,
        categories,
        templates,
        settings,
        refreshCatalog,
        signInWithGoogle,
        signInAsGuest,
        logout,
        authModalOpen,
        setAuthModalOpen,
        authModalReason,
        promptAuth,
      }}
    >
      {children}
      {authModalOpen && (
        <AuthDialog
          reason={authModalReason}
          allowGuest={settings.allowGuestCreation}
          onClose={() => setAuthModalOpen(false)}
          onGoogle={signInWithGoogle}
          onGuest={signInAsGuest}
        />
      )}
    </AppContext.Provider>
  );
}

function AuthDialog({
  reason,
  allowGuest,
  onClose,
  onGoogle,
  onGuest,
}: {
  reason: string;
  allowGuest: boolean;
  onClose: () => void;
  onGoogle: () => Promise<User | null>;
  onGuest: () => Promise<{ user: User | null; error?: string }>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      await onGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    setError('');
    const res = await onGuest();
    if (res.error) setError(res.error);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#131924] border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Creator Session
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {reason}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
            aria-label="Close sign in dialog"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-200">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogle}
            className="w-full min-h-[48px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium text-sm px-4 py-3 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Continue with Google'}
          </button>

          {allowGuest && (
            <button
              type="button"
              disabled={loading}
              onClick={handleGuest}
              className="w-full min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium text-sm px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors disabled:opacity-50"
            >
              Continue as Guest Creator
            </button>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Your drafts remain private to your creator session. Authorized administrators ({BOOTSTRAPPED_ADMIN_EMAIL.split('@')[0]}…) sign in via Google.
        </p>
      </div>
    </div>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
