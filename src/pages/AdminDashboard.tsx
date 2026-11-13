import { useEffect, useState } from 'react';
import {
  Database,
  Lock,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useApp } from '../components/AppContext';
import {
  adminAddModerator,
  adminDeleteCategory,
  adminDeleteMediaAsset,
  adminDeleteTemplate,
  adminFetchActivityLogs,
  adminFetchAdmins,
  adminFetchAllGreetings,
  adminFetchUsers,
  adminRemoveModerator,
  adminSaveCategory,
  adminSaveMediaAsset,
  adminSavePlatformSettings,
  adminSaveTemplate,
  adminUpdateGreeting,
  deleteGreetingDraft,
  fetchCategories,
  fetchMediaLibrary,
  fetchPlatformSettings,
  fetchTemplates,
  seedDefaultCatalogToFirestore,
} from '../lib/firestoreService';
import { ANIMATION_LIBRARY } from '../lib/catalog';
import type { AppRoute } from '../components/Navbar';
import type {
  ActivityLog,
  AdminUser,
  Category,
  CreatorUser,
  Greeting,
  MediaAsset,
  PlatformSettings,
  Template,
} from '../lib/types';

type AdminTab =
  | 'overview'
  | 'greetings'
  | 'categories'
  | 'templates'
  | 'media'
  | 'settings'
  | 'security';

export function AdminDashboard({ navigate }: { navigate: (next: AppRoute) => void }) {
  const { user, authReady, isAdmin, signInWithGoogle, logout, refreshCatalog } = useApp();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [greetings, setGreetings] = useState<Greeting[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [users, setUsers] = useState<CreatorUser[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  const [greetingSearch, setGreetingSearch] = useState('');

  // Form states for Category / Template / Media / Admin
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editingMedia, setEditingMedia] = useState<MediaAsset | null>(null);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'moderator' | 'super_admin'>('moderator');

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const [g, c, t, m, s, u, a, l] = await Promise.all([
        adminFetchAllGreetings(),
        fetchCategories(true),
        fetchTemplates(true),
        fetchMediaLibrary(true),
        fetchPlatformSettings(),
        adminFetchUsers(),
        adminFetchAdmins(),
        adminFetchActivityLogs(),
      ]);
      setGreetings(g);
      setCategories(c);
      setTemplates(t);
      setMediaAssets(m);
      setPlatformSettings(s);
      setUsers(u);
      setAdmins(a);
      setLogs(l);
    } catch (err) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to load admin records.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authReady && user && isAdmin) {
      loadAllAdminData();
    }
  }, [authReady, user, isAdmin]);

  if (!authReady) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4 text-sm text-slate-500">
        Verifying administrator session...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-[75vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-8 text-center space-y-5 shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Lock className="w-6 h-6 text-slate-700 dark:text-slate-200" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
              Administrator Login
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sign in with an authorized administrator Google account. Public visitors cannot register for admin access.
            </p>
          </div>
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="w-full min-h-[48px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium hover:opacity-90"
          >
            Sign In with Google
          </button>
          <button
            type="button"
            onClick={() => navigate({ page: 'landing' })}
            className="text-xs text-slate-500 hover:underline"
          >
            Return to Public Site
          </button>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-[75vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-[#131924] p-8 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto" />
          <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
            Access Denied
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Account <span className="font-medium">{user.email || user.uid}</span> is not in the authorized administrator allowlist.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={logout}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium"
            >
              Sign Out &amp; Switch Account
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'landing' })}
              className="min-h-[44px] px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium"
            >
              Back to Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  const totalBytes = users.reduce((acc, u) => acc + (u.storageUsedBytes || 0), 0);
  const publishedCount = greetings.filter((g) => g.status === 'published').length;
  const filteredGreetings = greetings.filter((g) => {
    const q = greetingSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      g.title.toLowerCase().includes(q) ||
      g.recipientName.toLowerCase().includes(q) ||
      g.senderName.toLowerCase().includes(q) ||
      g.id.toLowerCase().includes(q)
    );
  });

  const handleSeedCatalog = async () => {
    setLoading(true);
    try {
      await seedDefaultCatalogToFirestore();
      await loadAllAdminData();
      await refreshCatalog();
      setNotice({ type: 'success', text: 'Default categories, templates, media library, and settings synced to Firestore.' });
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Seed failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Authorized Administrator · {user.email}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white mt-1">
            Platform Administration
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSeedCatalog}
            className="min-h-[40px] px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Seed Default Catalog</span>
          </button>
          <button
            type="button"
            onClick={loadAllAdminData}
            className="min-h-[40px] px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-xl border p-3 text-xs sm:text-sm flex items-center justify-between ${
            notice.type === 'error'
              ? 'border-rose-200 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200'
              : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="underline text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'greetings', label: `Greetings (${greetings.length})` },
            { id: 'categories', label: `Categories (${categories.length})` },
            { id: 'templates', label: `Templates (${templates.length})` },
            { id: 'media', label: `Media (${mediaAssets.length})` },
            { id: 'settings', label: 'Platform Settings' },
            { id: 'security', label: 'Users & Security' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              tab === t.id
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-white dark:bg-[#131924] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* A. OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="Total Greetings" value={greetings.length} />
            <StatCard label="Published Cards" value={publishedCount} />
            <StatCard label="Categories" value={categories.length} />
            <StatCard label="Templates" value={templates.length} />
            <StatCard label="Tracked Storage" value={`${(totalBytes / (1024 * 1024)).toFixed(2)} MB`} />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-5 space-y-3">
            <h2 className="font-semibold text-base text-slate-900 dark:text-white">Recent Activity Logs</h2>
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500">No activity logs recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.slice(0, 12).map((log) => (
                  <div key={log.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <div>
                      <span className="font-mono font-medium text-slate-900 dark:text-white">{log.action}</span>
                      {log.details && <span className="text-slate-500 ml-2">{log.details}</span>}
                    </div>
                    <span className="font-mono tabular-nums text-slate-400">
                      Actor: {log.actorId.slice(0, 10)}…
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* B. GREETING MANAGEMENT */}
      {tab === 'greetings' && (
        <div className="space-y-4">
          <input
            type="search"
            value={greetingSearch}
            onChange={(e) => setGreetingSearch(e.target.value)}
            placeholder="Search by title, recipient, sender, or ID..."
            className="w-full sm:w-80 min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131924] text-sm"
          />

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="p-3.5 font-medium">Title / ID</th>
                  <th className="p-3.5 font-medium">Recipient → Sender</th>
                  <th className="p-3.5 font-medium">Status</th>
                  <th className="p-3.5 font-medium">Access</th>
                  <th className="p-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredGreetings.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="p-3.5">
                      <p className="font-medium text-slate-900 dark:text-white">{g.title}</p>
                      <p className="font-mono text-[11px] text-slate-400">{g.id}</p>
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">
                      {g.recipientName} ← {g.senderName}
                    </td>
                    <td className="p-3.5 capitalize">{g.status}</td>
                    <td className="p-3.5 capitalize">{g.accessMode}</td>
                    <td className="p-3.5 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={async () => {
                          const nextStatus = g.status === 'published' ? 'unpublished' : 'published';
                          await adminUpdateGreeting(g.id, { status: nextStatus });
                          loadAllAdminData();
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium"
                      >
                        {g.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteGreetingDraft(g.id);
                          loadAllAdminData();
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredGreetings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No greetings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* C. CATEGORY MANAGEMENT */}
      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-base text-slate-900 dark:text-white">Manage Greeting Categories</h2>
            <button
              type="button"
              onClick={() =>
                setEditingCategory({
                  id: `cat_${Date.now()}`,
                  name: '',
                  slug: '',
                  description: '',
                  imageUrl: '',
                  accentColor: '#BE123C',
                  sortOrder: categories.length + 1,
                  enabled: true,
                })
              }
              className="min-h-[40px] px-4 rounded-xl bg-rose-700 text-white text-xs font-medium flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Category</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm text-slate-900 dark:text-white">{cat.name}</p>
                    <p className="text-xs text-slate-500">
                      Order: {cat.sortOrder} · {cat.enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: cat.accentColor || '#BE123C' }} />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{cat.description}</p>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingCategory(cat)}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await adminDeleteCategory(cat.id);
                      await loadAllAdminData();
                      await refreshCatalog();
                    }}
                    className="min-h-[36px] px-3 rounded-lg text-rose-600 text-xs font-medium ml-auto"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* D. TEMPLATE MANAGEMENT */}
      {tab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-base text-slate-900 dark:text-white">Manage Design Templates</h2>
            <button
              type="button"
              onClick={() =>
                setEditingTemplate({
                  id: `tpl_${Date.now()}`,
                  name: '',
                  categoryId: categories[0]?.id || 'birthday',
                  description: '',
                  animationStyle: 'confetti',
                  colorScheme: {
                    background: '#F8FAFC',
                    surface: '#FFFFFF',
                    text: '#0F172A',
                    accent: '#BE123C',
                    muted: '#64748B',
                  },
                  fontPair: 'editorial',
                  backgroundStyle: 'linear-gradient(145deg, #FFFFFF 0%, #F1F5F9 100%)',
                  layoutPreset: 'slideshow',
                  enabled: true,
                  featured: false,
                })
              }
              className="min-h-[40px] px-4 rounded-xl bg-rose-700 text-white text-xs font-medium flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Template</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-4 space-y-3"
              >
                <div>
                  <p className="font-medium text-sm text-slate-900 dark:text-white">{tpl.name}</p>
                  <p className="text-xs text-slate-500">
                    {tpl.categoryId} · {tpl.enabled ? 'Enabled' : 'Disabled'} {tpl.featured ? '· Featured' : ''}
                  </p>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{tpl.description}</p>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingTemplate(tpl)}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await adminDeleteTemplate(tpl.id);
                      await loadAllAdminData();
                      await refreshCatalog();
                    }}
                    className="min-h-[36px] px-3 rounded-lg text-rose-600 text-xs font-medium ml-auto"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* E. MEDIA MANAGEMENT */}
      {tab === 'media' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-base text-slate-900 dark:text-white">Platform Media Library</h2>
            <button
              type="button"
              onClick={() =>
                setEditingMedia({
                  id: `media_${Date.now()}`,
                  type: 'music',
                  title: '',
                  url: '',
                  license: 'Royalty-Free Platform License',
                  attribution: '',
                  category: 'celebration',
                  enabled: true,
                })
              }
              className="min-h-[40px] px-4 rounded-xl bg-rose-700 text-white text-xs font-medium flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Media Asset</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mediaAssets.map((asset) => (
              <div
                key={asset.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-4 space-y-2"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="uppercase font-medium">{asset.type}</span>
                  <span>{asset.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <p className="font-medium text-sm text-slate-900 dark:text-white">{asset.title}</p>
                <p className="text-xs text-slate-500 truncate">{asset.license}</p>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingMedia(asset)}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await adminDeleteMediaAsset(asset.id);
                      await loadAllAdminData();
                    }}
                    className="min-h-[36px] px-3 rounded-lg text-rose-600 text-xs font-medium ml-auto"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* F. PLATFORM SETTINGS */}
      {tab === 'settings' && platformSettings && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await adminSavePlatformSettings(platformSettings);
            await refreshCatalog();
            setNotice({ type: 'success', text: 'Platform settings updated across the live site.' });
          }}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-6 space-y-4 max-w-2xl"
        >
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">Global Platform Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Website Name</span>
              <input
                type="text"
                value={platformSettings.siteName}
                onChange={(e) => setPlatformSettings({ ...platformSettings, siteName: e.target.value })}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Default Theme</span>
              <select
                value={platformSettings.defaultTheme}
                onChange={(e) =>
                  setPlatformSettings({ ...platformSettings, defaultTheme: e.target.value as 'light' | 'dark' })
                }
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              >
                <option value="light">Light Theme</option>
                <option value="dark">Dark Theme</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Hero Headline</span>
            <input
              type="text"
              value={platformSettings.heroTitle || ''}
              onChange={(e) => setPlatformSettings({ ...platformSettings, heroTitle: e.target.value })}
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Hero Subtitle</span>
            <textarea
              rows={3}
              value={platformSettings.heroSubtitle || ''}
              onChange={(e) => setPlatformSettings({ ...platformSettings, heroSubtitle: e.target.value })}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Max Photos Per Card</span>
              <input
                type="number"
                min={1}
                max={20}
                value={platformSettings.maxPhotosPerCard}
                onChange={(e) =>
                  setPlatformSettings({ ...platformSettings, maxPhotosPerCard: Number(e.target.value) })
                }
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Max Upload Size (MB)</span>
              <input
                type="number"
                min={1}
                max={25}
                value={platformSettings.maxUploadSizeMb}
                onChange={(e) =>
                  setPlatformSettings({ ...platformSettings, maxUploadSizeMb: Number(e.target.value) })
                }
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-6 pt-2">
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={platformSettings.allowGuestCreation}
                onChange={(e) =>
                  setPlatformSettings({ ...platformSettings, allowGuestCreation: e.target.checked })
                }
                className="accent-rose-700"
              />
              <span>Allow Guest Anonymous Creation</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={platformSettings.sharingEnabled}
                onChange={(e) =>
                  setPlatformSettings({ ...platformSettings, sharingEnabled: e.target.checked })
                }
                className="accent-rose-700"
              />
              <span>Enable Public Sharing</span>
            </label>
          </div>
          <button
            type="submit"
            className="min-h-[44px] px-6 rounded-xl bg-rose-700 text-white text-sm font-medium"
          >
            Save Settings
          </button>
        </form>
      )}

      {/* G. USERS & SECURITY */}
      {tab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-5 space-y-4">
            <h2 className="font-semibold text-base text-slate-900 dark:text-white">Administrator Allowlist</h2>
            <div className="space-y-2">
              {admins.map((a) => (
                <div key={a.uid} className="flex items-center justify-between text-xs p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{a.email}</p>
                    <p className="font-mono text-[11px] text-slate-400">
                      {a.uid} · {a.role}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await adminRemoveModerator(a.uid);
                      loadAllAdminData();
                    }}
                    className="text-rose-600 p-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Add Moderator / Admin UID</p>
              <input
                type="text"
                value={newAdminUid}
                onChange={(e) => setNewAdminUid(e.target.value)}
                placeholder="Firebase User UID"
                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
              />
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="Admin Email"
                  className="flex-1 min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
                />
                <select
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value as 'moderator' | 'super_admin')}
                  className="min-h-[40px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                >
                  <option value="moderator">Moderator</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!newAdminUid.trim() || !newAdminEmail.trim()) return;
                  await adminAddModerator(newAdminUid.trim(), newAdminEmail.trim(), newAdminEmail.trim(), newAdminRole);
                  setNewAdminUid('');
                  setNewAdminEmail('');
                  loadAllAdminData();
                }}
                className="min-h-[40px] px-4 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium"
              >
                Grant Admin Role
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-5 space-y-3">
            <h2 className="font-semibold text-base text-slate-900 dark:text-white">
              Registered Creators ({users.length})
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {users.map((u) => (
                <div key={u.uid} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{u.displayName}</p>
                    <p className="font-mono text-[11px] text-slate-400">{u.uid}</p>
                  </div>
                  <span className="font-mono tabular-nums text-slate-500">
                    {u.greetingsCount} cards
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals for Category, Template, Media Editing */}
      {editingCategory && (
        <ModalShell title="Edit Category" onClose={() => setEditingCategory(null)}>
          <div className="space-y-3 text-xs">
            <input
              type="text"
              value={editingCategory.name}
              onChange={(e) =>
                setEditingCategory({
                  ...editingCategory,
                  name: e.target.value,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                })
              }
              placeholder="Category Name"
              className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
            />
            <textarea
              rows={2}
              value={editingCategory.description}
              onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
              placeholder="Description"
              className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
            />
            <input
              type="url"
              value={editingCategory.imageUrl || ''}
              onChange={(e) => setEditingCategory({ ...editingCategory, imageUrl: e.target.value })}
              placeholder="Cover Image URL"
              className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingCategory.enabled}
                  onChange={(e) => setEditingCategory({ ...editingCategory, enabled: e.target.checked })}
                />
                <span>Enabled</span>
              </label>
              <button
                type="button"
                onClick={async () => {
                  const isNew = !categories.some((c) => c.id === editingCategory.id);
                  await adminSaveCategory(editingCategory, isNew);
                  setEditingCategory(null);
                  await loadAllAdminData();
                  await refreshCatalog();
                }}
                className="min-h-[40px] px-5 rounded-lg bg-rose-700 text-white font-medium"
              >
                Save Category
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {editingTemplate && (
        <ModalShell title="Edit Template" onClose={() => setEditingTemplate(null)}>
          <div className="space-y-3 text-xs">
            <input
              type="text"
              value={editingTemplate.name}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
              placeholder="Template Name"
              className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
            />
            <select
              value={editingTemplate.categoryId}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, categoryId: e.target.value })}
              className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <textarea
              rows={2}
              value={editingTemplate.description}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
              placeholder="Description"
              className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
            />
            <select
              value={editingTemplate.animationStyle}
              onChange={(e) =>
                setEditingTemplate({
                  ...editingTemplate,
                  animationStyle: e.target.value as Template['animationStyle'],
                })
              }
              className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              {ANIMATION_LIBRARY.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={editingTemplate.enabled}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, enabled: e.target.checked })}
                  />
                  <span>Enabled</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={editingTemplate.featured}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, featured: e.target.checked })}
                  />
                  <span>Featured</span>
                </label>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const isNew = !templates.some((t) => t.id === editingTemplate.id);
                  await adminSaveTemplate(editingTemplate, isNew);
                  setEditingTemplate(null);
                  await loadAllAdminData();
                  await refreshCatalog();
                }}
                className="min-h-[40px] px-5 rounded-lg bg-rose-700 text-white font-medium"
              >
                Save Template
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {editingMedia && (
        <ModalShell title="Edit Media Asset" onClose={() => setEditingMedia(null)}>
          <div className="space-y-3 text-xs">
            <select
              value={editingMedia.type}
              onChange={(e) => setEditingMedia({ ...editingMedia, type: e.target.value as MediaAsset['type'] })}
              className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="music">Music Track</option>
              <option value="image">Licensed Image</option>
              <option value="sticker">Sticker Asset</option>
            </select>
            <input
              type="text"
              value={editingMedia.title}
              onChange={(e) => setEditingMedia({ ...editingMedia, title: e.target.value })}
              placeholder="Title"
              className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
            />
            <input
              type="text"
              value={editingMedia.url}
              onChange={(e) => setEditingMedia({ ...editingMedia, url: e.target.value })}
              placeholder="Asset URL"
              className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
            />
            <input
              type="text"
              value={editingMedia.license}
              onChange={(e) => setEditingMedia({ ...editingMedia, license: e.target.value })}
              placeholder="License (e.g. CC-BY 4.0)"
              className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
            />
            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editingMedia.enabled}
                  onChange={(e) => setEditingMedia({ ...editingMedia, enabled: e.target.checked })}
                />
                <span>Enabled</span>
              </label>
              <button
                type="button"
                onClick={async () => {
                  const isNew = !mediaAssets.some((m) => m.id === editingMedia.id);
                  await adminSaveMediaAsset(editingMedia, isNew);
                  setEditingMedia(null);
                  await loadAllAdminData();
                }}
                className="min-h-[40px] px-5 rounded-lg bg-rose-700 text-white font-medium"
              >
                Save Asset
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-white mt-1">
        {value}
      </p>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#131924] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base text-slate-900 dark:text-white">{title}</h3>
          <button type="button" onClick={onClose} className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
