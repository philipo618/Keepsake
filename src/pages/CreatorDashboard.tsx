import { useEffect, useState } from 'react';
import { Copy, Edit3, ExternalLink, Film, Plus, Share2, Trash2 } from 'lucide-react';
import { useApp } from '../components/AppContext';
import { deleteGreetingDraft, fetchCreatorGreetings } from '../lib/firestoreService';
import { buildGreetingShareUrl, ShareModal } from '../components/ShareModal';
import type { AppRoute } from '../components/Navbar';
import type { Greeting } from '../lib/types';

export function CreatorDashboard({ navigate }: { navigate: (next: AppRoute) => void }) {
  const { user, authReady, categories, promptAuth, logout } = useApp();
  const [greetings, setGreetings] = useState<Greeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'all' | 'draft' | 'published'>('all');
  const [shareTarget, setShareTarget] = useState<Greeting | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadGreetings = async (uid: string) => {
    setLoading(true);
    try {
      const items = await fetchCreatorGreetings(uid);
      setGreetings(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authReady && user) {
      loadGreetings(user.uid);
    } else if (authReady && !user) {
      setGreetings([]);
    }
  }, [authReady, user]);

  const handleDeleteDraft = async (id: string) => {
    await deleteGreetingDraft(id);
    setGreetings((prev) => prev.filter((g) => g.id !== id));
  };

  const handleCopy = async (id: string) => {
    await navigator.clipboard.writeText(buildGreetingShareUrl(id)).catch(() => {});
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  const drafts = greetings.filter((g) => g.status === 'draft');
  const published = greetings.filter((g) => g.status === 'published');
  const visibleList =
    tab === 'draft' ? drafts : tab === 'published' ? published : greetings;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-900 dark:text-white">
            My Keepsake Studio
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage your saved drafts, published greeting links, and creator session.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate({ page: 'create' })}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-sm font-medium flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Greeting</span>
        </button>
      </div>

      {!user ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-8 sm:p-12 text-center space-y-4">
          <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
            Sign in to view your saved drafts &amp; published cards
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Your drafts and gift links stay private to your creator account so only you can edit or delete them.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => promptAuth('Sign in to access your saved drafts and published greeting cards.')}
              className="min-h-[46px] px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium"
            >
              Sign In / Continue as Guest
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'create' })}
              className="min-h-[46px] px-6 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium"
            >
              Start Creating Now
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Drafts</p>
              <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-white mt-1">
                {drafts.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Published Links</p>
              <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-white mt-1">
                {published.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-4 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">Session Account</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate mt-1">
                  {user.displayName || user.email || 'Guest Creator'}
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium shrink-0"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit">
            {(
              [
                { id: 'all', label: `All (${greetings.length})` },
                { id: 'draft', label: `My Drafts (${drafts.length})` },
                { id: 'published', label: `Published (${published.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tab === t.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading your greetings...</div>
          ) : visibleList.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-10 text-center space-y-3">
              <p className="font-medium text-slate-900 dark:text-white">No greetings in this view yet</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Create a personalized birthday, wedding, or custom keepsake card to get started.
              </p>
              <button
                type="button"
                onClick={() => navigate({ page: 'create' })}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-700 text-white text-sm font-medium"
              >
                Create Your First Greeting
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleList.map((g) => {
                const catName = categories.find((c) => c.id === g.categoryId)?.name || 'Greeting';
                return (
                  <div
                    key={g.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] overflow-hidden flex flex-col justify-between"
                  >
                    <div
                      className="p-5 space-y-2 border-b border-slate-100 dark:border-slate-800"
                      style={{ background: g.designConfig.gradientCss, color: g.designConfig.textColor }}
                    >
                      <div className="flex items-center justify-between text-xs opacity-80">
                        <span>{catName}</span>
                        <span className="capitalize">{g.status}</span>
                      </div>
                      <h3 className="font-display text-xl font-semibold truncate">{g.title}</h3>
                      <p className="text-xs opacity-80">
                        For {g.recipientName} · {g.accessMode === 'interactive' ? 'Protected Gate' : 'Direct Access'}
                      </p>
                    </div>

                    <div className="p-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate({ page: 'create', editId: g.id })}
                        className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate({ page: 'create', editId: g.id, openVideoStudio: true })}
                        className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Film className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
                        <span>Export Video</span>
                      </button>

                      {g.status === 'published' && (
                        <>
                          <button
                            type="button"
                            onClick={() => navigate({ page: 'greeting', id: g.id })}
                            className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(g.id)}
                            className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>{copiedId === g.id ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShareTarget(g)}
                            className="min-h-[38px] px-3 rounded-lg bg-rose-700 text-white text-xs font-medium flex items-center gap-1.5"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share</span>
                          </button>
                        </>
                      )}

                      {g.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(g.id)}
                          className="min-h-[38px] px-3 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 text-xs font-medium flex items-center gap-1.5 ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {shareTarget && (
        <ShareModal
          greetingId={shareTarget.id}
          recipientName={shareTarget.recipientName}
          title={shareTarget.title}
          onClose={() => setShareTarget(null)}
        />
      )}
    </main>
  );
}
