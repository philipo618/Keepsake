import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useApp } from '../components/AppContext';
import { TemplateShowcaseCard } from './LandingPage';
import { GreetingExperience } from '../components/GreetingExperience';
import { createDefaultDesignConfig } from '../lib/catalog';
import type { AppRoute } from '../components/Navbar';
import type { Greeting, Template } from '../lib/types';

export function ExplorePage({ navigate }: { navigate: (next: AppRoute) => void }) {
  const { categories, templates } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesCat = selectedCategory === 'all' || t.categoryId === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.animationStyle.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [templates, selectedCategory, searchQuery]);

  const buildSamplePreviewGreeting = (tpl: Template): Greeting => ({
    id: 'preview',
    creatorId: 'preview',
    categoryId: tpl.categoryId,
    templateId: tpl.id,
    recipientName: 'Alex',
    senderName: 'Jordan',
    title: tpl.name,
    mainMessage:
      'Every detail in this template—typography, animations, color palette, and music—can be customized in the Keepsake studio.',
    additionalMessages: ['Add personal photos, custom notes, and optional birthday verification.'],
    cardDate: 'November 2026',
    signature: 'Warmest wishes, Jordan',
    designConfig: createDefaultDesignConfig(tpl),
    photos: tpl.previewImageUrl
      ? [
          {
            id: 'sample-1',
            url: tpl.previewImageUrl,
            caption: tpl.name,
            sourceType: 'licensed-stock',
            cropPosition: { x: 50, y: 50, zoom: 1 },
            transition: 'fade',
          },
        ]
      : [],
    musicConfig: {
      enabled: Boolean(tpl.musicTrackId),
      trackId: tpl.musicTrackId || 'track-piano-waltz',
      sourceType: 'library',
      volume: 0.65,
      startTiming: 'on-gift-open',
      soundEffectsEnabled: true,
    },
    animations: [tpl.animationStyle, 'sparkles'],
    accessMode: 'direct',
    verificationMeta: {
      enableBirthdayDay: false,
      enableBirthdayMonth: false,
      enableBirthdayYear: false,
      customQuestions: [],
      maxRetries: 5,
      friendlyErrorMessage: 'Please try again.',
    },
    status: 'published',
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-14 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-white">
            Explore Greeting Templates
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1.5">
            Preview animated layouts, palettes, and music compatibility before customizing your card.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates or styles..."
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131924] text-sm text-slate-900 dark:text-white outline-none focus:border-rose-600"
          />
        </div>
      </div>

      {/* Category Filter Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
            selectedCategory === 'all'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
              : 'bg-white dark:bg-[#131924] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          All Occasions
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              selectedCategory === cat.id
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-white dark:bg-[#131924] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-10 text-center space-y-3">
          <p className="font-medium text-slate-900 dark:text-white">No templates matched your filter</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Try clearing your search or start directly from a blank canvas.
          </p>
          <button
            type="button"
            onClick={() => navigate({ page: 'create' })}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-700 text-white text-sm font-medium"
          >
            Start Blank Design
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((tpl) => (
            <div key={tpl.id} className="space-y-2">
              <TemplateShowcaseCard
                template={tpl}
                categoryName={categories.find((c) => c.id === tpl.categoryId)?.name || 'Greeting'}
                onSelect={() => navigate({ page: 'create', templateId: tpl.id, categoryId: tpl.categoryId })}
              />
              <button
                type="button"
                onClick={() => setPreviewTemplate(tpl)}
                className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Preview Interactive Experience
              </button>
            </div>
          ))}
        </div>
      )}

      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto flex items-center justify-center">
          <div className="w-full max-w-4xl space-y-3">
            <div className="flex items-center justify-between text-white">
              <span className="text-sm font-medium">Template Preview: {previewTemplate.name}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const tpl = previewTemplate;
                    setPreviewTemplate(null);
                    navigate({ page: 'create', templateId: tpl.id, categoryId: tpl.categoryId });
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-xs font-medium text-white"
                >
                  Customize This Template
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(null)}
                  className="min-h-[40px] min-w-[40px] rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            </div>
            <GreetingExperience greeting={buildSamplePreviewGreeting(previewTemplate)} isPreview />
          </div>
        </div>
      )}
    </main>
  );
}
