import { useEffect, useState } from 'react';
import { AppProvider } from './components/AppContext';
import { Footer } from './components/Footer';
import { Navbar, type AppRoute } from './components/Navbar';
import { AdminDashboard } from './pages/AdminDashboard';
import { CreatorDashboard } from './pages/CreatorDashboard';
import { CreatorWizard } from './pages/CreatorWizard';
import { ExplorePage } from './pages/ExplorePage';
import { LandingPage } from './pages/LandingPage';
import { RecipientGreetingPage } from './pages/RecipientGreetingPage';

function getNormalizedBase(): string {
  const raw = import.meta.env.BASE_URL || '/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function parseRouteFromLocation(): AppRoute {
  const base = getNormalizedBase();
  let path = window.location.pathname;
  if (base !== '/' && path.startsWith(base)) {
    path = '/' + path.slice(base.length);
  }
  const clean = path.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(window.location.search);

  if (clean.startsWith('/g/')) {
    const id = clean.slice(3).split('/')[0];
    if (id) return { page: 'greeting', id };
  }
  if (clean === '/explore') return { page: 'explore' };
  if (clean === '/create') {
    return {
      page: 'create',
      editId: params.get('edit') || undefined,
      templateId: params.get('template') || undefined,
      categoryId: params.get('category') || undefined,
    };
  }
  if (clean === '/studio') return { page: 'dashboard' };
  if (clean === '/admin') return { page: 'admin' };
  return { page: 'landing' };
}

function buildPathForRoute(route: AppRoute): string {
  const base = getNormalizedBase();
  const join = (sub: string) => (base === '/' ? sub : `${base.slice(0, -1)}${sub}`);

  switch (route.page) {
    case 'landing':
      return join('/');
    case 'explore':
      return join('/explore');
    case 'dashboard':
      return join('/studio');
    case 'admin':
      return join('/admin');
    case 'greeting':
      return join(`/g/${route.id}`);
    case 'create': {
      const qs = new URLSearchParams();
      if (route.editId) qs.set('edit', route.editId);
      if (route.templateId) qs.set('template', route.templateId);
      if (route.categoryId) qs.set('category', route.categoryId);
      const qStr = qs.toString();
      return join(`/create${qStr ? `?${qStr}` : ''}`);
    }
  }
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => parseRouteFromLocation());

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRouteFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (next: AppRoute) => {
    const nextUrl = buildPathForRoute(next);
    window.history.pushState(null, '', nextUrl);
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isGreetingView = route.page === 'greeting';

  return (
    <AppProvider>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-[#0B0F17] dark:text-slate-100">
        {!isGreetingView ? (
          <Navbar route={route} navigate={navigate} />
        ) : (
          <header className="border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-[#0B0F17]/80 backdrop-blur-md">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate({ page: 'landing' })}
                className="font-display text-lg font-semibold text-slate-900 dark:text-white"
              >
                Keepsake
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'create' })}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-medium"
              >
                Create Your Own
              </button>
            </div>
          </header>
        )}

        <div className="flex-1">
          {route.page === 'landing' && <LandingPage navigate={navigate} />}
          {route.page === 'explore' && <ExplorePage navigate={navigate} />}
          {route.page === 'create' && (
            <CreatorWizard
              key={`${route.editId || 'new'}-${route.templateId || ''}-${route.categoryId || ''}`}
              editId={route.editId}
              initialTemplateId={route.templateId}
              initialCategoryId={route.categoryId}
              navigate={navigate}
            />
          )}
          {route.page === 'dashboard' && <CreatorDashboard navigate={navigate} />}
          {route.page === 'admin' && <AdminDashboard navigate={navigate} />}
          {route.page === 'greeting' && (
            <RecipientGreetingPage greetingId={route.id} navigate={navigate} />
          )}
        </div>

        {!isGreetingView && <Footer navigate={navigate} />}
      </div>
    </AppProvider>
  );
}
