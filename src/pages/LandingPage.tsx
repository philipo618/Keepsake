import { useState } from 'react';
import { ArrowRight, Gift, Lock, Music, ShieldCheck } from 'lucide-react';
import { useApp } from '../components/AppContext';
import { STUDIO_ASSETS } from '../lib/assets';
import { triggerConfettiCelebration } from '../components/AnimationCanvas';
import { audioEngine } from '../lib/audioEngine';
import type { AppRoute } from '../components/Navbar';
import type { Template } from '../lib/types';

export function LandingPage({ navigate }: { navigate: (next: AppRoute) => void }) {
  const { categories, templates, settings } = useApp();
  const [heroImageError, setHeroImageError] = useState(false);
  const [sampleEnvelopeOpen, setSampleEnvelopeOpen] = useState(false);

  const featuredTemplates = templates.filter((t) => t.featured).slice(0, 6);

  const handleTestPreview = () => {
    const next = !sampleEnvelopeOpen;
    setSampleEnvelopeOpen(next);
    if (next) {
      audioEngine.playSfx('unwrap');
      triggerConfettiCelebration('#BE123C');
    }
  };

  return (
    <main className="overflow-x-hidden">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-16 lg:pt-16 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <p className="text-xs font-medium tracking-wider uppercase text-rose-700 dark:text-rose-400">
              {settings.tagline || 'Interactive Digital Stationery & Gift Experiences'}
            </p>
            <h1 className="font-display text-[clamp(2.25rem,4vw,3.75rem)] font-semibold tracking-tight leading-[1.08] text-slate-900 dark:text-white text-balance">
              {settings.heroTitle || 'Craft memorable digital gifts worth unwrapping.'}
            </h1>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              {settings.heroSubtitle ||
                'Design personalized animated greeting cards with curated photography, musical accompaniment, and interactive birthday or memory gates.'}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate({ page: 'create' })}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-medium text-sm flex items-center gap-2 transition-colors"
              >
                <span>Create Your Own Gift</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'explore' })}
                className="min-h-[48px] px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-sm transition-colors"
              >
                Explore Greeting Cards
              </button>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              <span>13 Greeting Occasions</span>
              <span aria-hidden="true">·</span>
              <span>Photo Slideshows &amp; Music</span>
              <span aria-hidden="true">·</span>
              <span>Unique Shareable URLs</span>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[300px] sm:min-h-[380px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
              {!heroImageError ? (
                <img
                  src={STUDIO_ASSETS.heroGift}
                  alt="Luxury textured greeting card with velvet gift box and white ranunculus"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={() => setHeroImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-100 to-rose-50 dark:from-slate-900 dark:to-rose-950/30">
                  <Gift className="w-12 h-12 text-rose-700 mb-3" />
                  <p className="font-display text-xl text-slate-900 dark:text-white">Keepsake Studio</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Greeting Card Preview Strip */}
      <section className="border-y border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101622] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5 space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Interactive Preview
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white text-balance">
              An unwrapping ritual built for every screen
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Every shared link opens smoothly on Android, iPhone, tablets, and desktop browsers. Add an optional birthday or memory verification sequence before the keepsake unfolds.
            </p>
            <div className="pt-2 space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-3">
                <Gift className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0" />
                <span>Animated gift boxes, wax-sealed envelopes &amp; 3D card folds</span>
              </div>
              <div className="flex items-center gap-3">
                <Music className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0" />
                <span>User-triggered music playback compatible with mobile Safari &amp; Chrome</span>
              </div>
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0" />
                <span>Protected backend answer verification for birthday &amp; secret gates</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div
              onClick={handleTestPreview}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleTestPreview();
              }}
              className="cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-900 via-[#161E2E] to-[#2D1221] text-white p-8 sm:p-10 min-h-[290px] flex flex-col items-center justify-center text-center transition-transform hover:scale-[1.01]"
            >
              {!sampleEnvelopeOpen ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-700/20 border border-rose-400/30 flex items-center justify-center">
                    <Gift className="w-7 h-7 text-rose-300" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-display text-2xl font-medium">A Birthday Keepsake for Maya</p>
                    <p className="text-xs text-slate-300">Tap this preview card to unwrap the interactive reveal</p>
                  </div>
                  <span className="inline-flex items-center justify-center min-h-[40px] px-5 py-2 rounded-lg bg-rose-700 text-xs font-medium text-white">
                    Tap to Open Sample
                  </span>
                </div>
              ) : (
                <div className="space-y-4 max-w-md animate-reveal-up">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Happy Milestone</p>
                  <h3 className="font-display text-3xl font-semibold text-white">
                    Wishing you a luminous year ahead
                  </h3>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    May every chapter bring laughter, quiet mornings, and adventures worth keeping forever.
                  </p>
                  <p className="text-xs text-slate-400 pt-2">Tap again to reset sample</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Greeting Categories Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
              Greeting Categories
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
              Select any occasion to open the guided studio with tailored templates and effects.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ page: 'explore' })}
            className="text-sm font-medium text-rose-700 dark:text-rose-400 hover:underline whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            View all templates →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => navigate({ page: 'create', categoryId: cat.id })}
              className="group text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] overflow-hidden hover:border-rose-300 dark:hover:border-rose-700 transition-colors flex flex-col"
            >
              <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
                {cat.imageUrl ? (
                  <img
                    src={cat.imageUrl}
                    alt={cat.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Gift className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-medium text-base text-slate-900 dark:text-white group-hover:text-rose-700 dark:group-hover:text-rose-400 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {cat.description}
                  </p>
                </div>
                <span className="mt-3 text-xs font-medium text-rose-700 dark:text-rose-400">
                  Create card →
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Featured Templates */}
      <section className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101622] py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
                Featured Design Templates
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
                Start from an editorial template or open a blank canvas with full visual controls.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate({ page: 'create' })}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 self-start sm:self-auto"
            >
              Start Blank Design
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredTemplates.map((tpl) => (
              <TemplateShowcaseCard
                key={tpl.id}
                template={tpl}
                categoryName={categories.find((c) => c.id === tpl.categoryId)?.name || 'Greeting'}
                onSelect={() => navigate({ page: 'create', templateId: tpl.id, categoryId: tpl.categoryId })}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
        <div className="max-w-2xl mb-12">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
            How Keepsake Works
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-2">
            From template selection to a shareable interactive gift in three guided steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              01. Choose Category &amp; Design
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Pick from 13 occasion categories, choose a crafted template or blank canvas, and customize typography, gradients, and layout.
            </p>
          </div>
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              02. Add Photos, Music &amp; Motion
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Upload and crop personal photos, select licensed stock imagery, add MP3/WAV or studio music, and layer up to 16 smooth animations.
            </p>
          </div>
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              03. Configure Access &amp; Share
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Publish with direct access or interactive birthday/memory verification, then send your unique URL via WhatsApp, Telegram, or Email.
            </p>
          </div>
        </div>

        {/* Three Main Experiences Summary Banner */}
        <div className="mt-16 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h3 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
              Ready to craft a gift someone will keep?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Create your greeting card in minutes, browse ready-made templates, or manage platform assets via authorized administrator login.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate({ page: 'create' })}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-sm font-medium transition-colors"
            >
              Create a Gift
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'explore' })}
              className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Explore Cards
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'admin' })}
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin Login</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export function TemplateShowcaseCard({
  template,
  categoryName,
  onSelect,
}: {
  template: Template;
  categoryName: string;
  onSelect: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] overflow-hidden flex flex-col">
      <div
        className="h-44 p-5 flex flex-col justify-between relative overflow-hidden"
        style={{ background: template.backgroundStyle, color: template.colorScheme.text }}
      >
        <div className="flex items-center justify-between text-xs opacity-80">
          <span>{categoryName}</span>
          <span className="capitalize">{template.animationStyle.replace(/-/g, ' ')}</span>
        </div>
        <div>
          <p className="font-display text-2xl font-semibold leading-tight">{template.name}</p>
          <p className="text-xs opacity-75 mt-1">
            {template.fontPair} typography · {template.layoutPreset} layout
          </p>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {template.description}
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5" aria-label="Template color palette">
            <span
              className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700"
              style={{ backgroundColor: template.colorScheme.background }}
            />
            <span
              className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700"
              style={{ backgroundColor: template.colorScheme.accent }}
            />
            <span
              className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700"
              style={{ backgroundColor: template.colorScheme.text }}
            />
          </div>
          <button
            type="button"
            onClick={onSelect}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Use Template
          </button>
        </div>
      </div>
    </div>
  );
}
