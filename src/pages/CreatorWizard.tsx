import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Eye,
  Film,
  Music,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { useApp } from '../components/AppContext';
import { PhotoManagerPanel } from '../components/PhotoManagerPanel';
import { GreetingExperience } from '../components/GreetingExperience';
import { VerificationGate } from '../components/VerificationGate';
import { VideoExportStudio } from '../components/VideoExportStudio';
import { ShareModal } from '../components/ShareModal';
import {
  ANIMATION_LIBRARY,
  createDefaultDesignConfig,
  DEFAULT_SEQUENCE_ORDER,
  EXPERIENCE_STEP_LABELS,
  GRADIENT_PRESETS,
  STICKER_PALETTE,
} from '../lib/catalog';
import { audioEngine, LICENSED_MUSIC_LIBRARY } from '../lib/audioEngine';
import { hasApiBackend } from '../lib/api';
import { uploadMediaFile } from '../lib/imageUtils';
import {
  fetchGreetingById,
  fetchGreetingSecretForOwner,
  fetchMediaLibrary,
  generateShortId,
  saveGreeting,
} from '../lib/firestoreService';
import type { AppRoute } from '../components/Navbar';
import type {
  AnimationEffectId,
  CustomQuestionPrompt,
  ExperienceStepKey,
  Greeting,
  MediaAsset,
  PhotoLayoutType,
  PresentationMode,
  Template,
  VerificationSecretsInput,
} from '../lib/types';

const WIZARD_STEPS = [
  'Category',
  'Template',
  'Personalize',
  'Photos',
  'Music & Sound',
  'Animations',
  'Visual Design',
  'Access & Publish',
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function createInitialGreeting(creatorId: string, categoryId = 'birthday', template?: Template): Greeting {
  return {
    id: generateShortId('g'),
    creatorId,
    categoryId: template?.categoryId || categoryId,
    templateId: template?.id || '',
    recipientName: '',
    senderName: '',
    title: 'Wishing You a Wonderful Day',
    mainMessage:
      'Thinking of you today and celebrating all the warmth, laughter, and unforgettable memories we share.',
    additionalMessages: [],
    cardDate: '',
    signature: '',
    designConfig: createDefaultDesignConfig(template),
    photos: [],
    musicConfig: {
      enabled: Boolean(template?.musicTrackId),
      trackId: template?.musicTrackId || 'track-birthday-musicbox',
      trackTitle:
        LICENSED_MUSIC_LIBRARY.find((t) => t.id === (template?.musicTrackId || 'track-birthday-musicbox'))
          ?.title || 'Golden Birthday Music Box',
      sourceType: 'library',
      volume: 0.65,
      startTiming: 'on-gift-open',
      soundEffectsEnabled: true,
      momentMood: 'celebration',
    },
    animations: template ? ['gift-box', template.animationStyle, 'sparkles'] : ['gift-box', 'confetti', 'sparkles'],
    accessMode: 'direct',
    verificationMeta: {
      enableBirthdayDay: true,
      enableBirthdayMonth: true,
      enableBirthdayYear: true,
      customQuestions: [],
      maxRetries: 5,
      friendlyErrorMessage: 'Not quite! Take another moment and try again.',
    },
    status: 'draft',
  };
}

export function CreatorWizard({
  editId,
  initialTemplateId,
  initialCategoryId,
  initialOpenVideoStudio = false,
  navigate,
}: {
  editId?: string;
  initialTemplateId?: string;
  initialCategoryId?: string;
  initialOpenVideoStudio?: boolean;
  navigate: (next: AppRoute) => void;
}) {
  const { user, categories, templates, settings, promptAuth } = useApp();

  const [step, setStep] = useState(0);
  const [greeting, setGreeting] = useState<Greeting>(() => {
    const tpl = initialTemplateId ? templates.find((t) => t.id === initialTemplateId) : undefined;
    return createInitialGreeting(user?.uid || 'guest', initialCategoryId || tpl?.categoryId || 'birthday', tpl);
  });

  const [secrets, setSecrets] = useState<VerificationSecretsInput>({
    birthDay: 15,
    birthMonth: 6,
    birthYear: 1995,
    customAnswers: [],
  });

  // History for Undo / Redo
  const [historyPast, setHistoryPast] = useState<Greeting[]>([]);
  const [historyFuture, setHistoryFuture] = useState<Greeting[]>([]);

  const [extraNoteDraft, setExtraNoteDraft] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionAnswer, setNewQuestionAnswer] = useState('');
  const [newQuestionHint, setNewQuestionHint] = useState('');

  const [adminMusicAssets, setAdminMusicAssets] = useState<MediaAsset[]>([]);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);

  const [loadingExisting, setLoadingExisting] = useState(Boolean(editId));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const [videoStudioOpen, setVideoStudioOpen] = useState(Boolean(initialOpenVideoStudio));
  const [previewGateUnlocked, setPreviewGateUnlocked] = useState(false);
  const [previewResetSeed, setPreviewResetSeed] = useState(0);
  const [publishedShareId, setPublishedShareId] = useState<string | null>(null);

  const openFullPreview = () => {
    setPreviewGateUnlocked(false);
    setPreviewResetSeed((n) => n + 1);
    setFullPreviewOpen(true);
  };

  useEffect(() => {
    fetchMediaLibrary(false).then((items) => {
      setAdminMusicAssets(items.filter((i) => i.type === 'music'));
    });
    return () => {
      audioEngine.stop();
    };
  }, []);

  useEffect(() => {
    if (!editId) return;
    let active = true;
    setLoadingExisting(true);
    Promise.all([fetchGreetingById(editId), fetchGreetingSecretForOwner(editId)])
      .then(([loaded, loadedSecret]) => {
        if (!active || !loaded) return;
        const unlocked = loadedSecret?.unlockedPayload as
          | {
              mainMessage?: string;
              additionalMessages?: string[];
              cardDate?: string;
              signature?: string;
              photos?: Greeting['photos'];
              exportedVideo?: Greeting['exportedVideo'];
            }
          | undefined;

        setGreeting({
          ...loaded,
          mainMessage: unlocked?.mainMessage ?? loaded.mainMessage,
          additionalMessages: unlocked?.additionalMessages ?? loaded.additionalMessages ?? [],
          cardDate: unlocked?.cardDate ?? loaded.cardDate ?? '',
          signature: unlocked?.signature ?? loaded.signature ?? '',
          photos: unlocked?.photos ?? loaded.photos ?? [],
          exportedVideo: unlocked?.exportedVideo ?? loaded.exportedVideo ?? null,
        });

        if (loadedSecret) {
          setSecrets({
            birthDay: loadedSecret.birthDay ?? 15,
            birthMonth: loadedSecret.birthMonth ?? 6,
            birthYear: loadedSecret.birthYear ?? 1995,
            customAnswers: loadedSecret.customAnswers || [],
          });
        }
      })
      .finally(() => {
        if (active) setLoadingExisting(false);
      });
    return () => {
      active = false;
    };
  }, [editId]);

  const commitChange = (updater: (prev: Greeting) => Greeting) => {
    setGreeting((prev) => {
      const next = updater(prev);
      setHistoryPast((p) => [...p.slice(-24), prev]);
      setHistoryFuture([]);
      return next;
    });
  };

  const handleUndo = () => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((p) => p.slice(0, -1));
    setHistoryFuture((f) => [greeting, ...f]);
    setGreeting(previous);
  };

  const handleRedo = () => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryFuture((f) => f.slice(1));
    setHistoryPast((p) => [...p, greeting]);
    setGreeting(next);
  };

  const handleReset = () => {
    const tpl = greeting.templateId ? templates.find((t) => t.id === greeting.templateId) : undefined;
    commitChange(() => createInitialGreeting(user?.uid || 'guest', greeting.categoryId, tpl));
    setStatusMessage({ type: 'success', text: 'Card styling and fields reset to template defaults.' });
  };

  const applyTemplate = (tpl: Template | null) => {
    commitChange((prev) => {
      if (!tpl) {
        return {
          ...prev,
          templateId: '',
          designConfig: createDefaultDesignConfig(undefined),
        };
      }
      return {
        ...prev,
        categoryId: tpl.categoryId,
        templateId: tpl.id,
        designConfig: createDefaultDesignConfig(tpl),
        animations: ['gift-box', tpl.animationStyle, 'sparkles'],
        musicConfig: {
          ...prev.musicConfig,
          enabled: Boolean(tpl.musicTrackId),
          trackId: tpl.musicTrackId || prev.musicConfig.trackId,
          trackTitle:
            LICENSED_MUSIC_LIBRARY.find((t) => t.id === tpl.musicTrackId)?.title || prev.musicConfig.trackTitle,
          sourceType: 'library',
        },
      };
    });
  };

  const toggleAnimation = (effectId: AnimationEffectId) => {
    commitChange((prev) => {
      const exists = prev.animations.includes(effectId);
      const next = exists
        ? prev.animations.filter((a) => a !== effectId)
        : [...prev.animations, effectId].slice(0, 12);
      return { ...prev, animations: next };
    });
  };

  const handleAudioPreview = async (trackId: string, audioUrl?: string) => {
    if (previewPlayingId === trackId) {
      audioEngine.stop();
      setPreviewPlayingId(null);
      return;
    }
    setPreviewPlayingId(trackId);
    if (audioUrl && !audioUrl.startsWith('synth://')) {
      const ok = await audioEngine.playAudioUrl(audioUrl, greeting.musicConfig.volume);
      if (!ok) setPreviewPlayingId(null);
    } else {
      audioEngine.playSynthTrack(trackId, greeting.musicConfig.volume);
    }
  };

  const handleUploadAudio = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!user) {
      promptAuth('Sign in to upload an MP3 or WAV audio file.');
      return;
    }
    setAudioUploading(true);
    setStatusMessage(null);
    try {
      const res = await uploadMediaFile(file, greeting.id, 'audio');
      commitChange((prev) => ({
        ...prev,
        musicConfig: {
          ...prev.musicConfig,
          enabled: true,
          sourceType: 'uploaded',
          audioUrl: res.url,
          trackTitle: file.name.replace(/\.[^.]+$/, '').slice(0, 80),
          trackId: 'uploaded-audio',
        },
      }));
      setStatusMessage({ type: 'success', text: `Uploaded "${file.name}" successfully.` });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to upload audio file.',
      });
    } finally {
      setAudioUploading(false);
    }
  };

  const validateBeforeSaveOrPublish = (isPublishing: boolean): string | null => {
    if (!greeting.recipientName.trim()) return 'Please enter the recipient’s name in Step 3.';
    if (!greeting.senderName.trim()) return 'Please enter your sender name in Step 3.';
    if (!greeting.title.trim()) return 'Please provide a card headline in Step 3.';
    if (isPublishing && greeting.accessMode === 'interactive') {
      const v = greeting.verificationMeta;
      const hasAnyStep =
        v.enableBirthdayDay ||
        v.enableBirthdayMonth ||
        v.enableBirthdayYear ||
        v.customQuestions.some((q) => q.enabled);
      if (!hasAnyStep) {
        return 'Interactive Access is selected, so enable at least one birthday or personalized question step.';
      }
      if (v.enableBirthdayDay && (!secrets.birthDay || secrets.birthDay < 1 || secrets.birthDay > 31)) {
        return 'Enter a valid birthday day (1–31).';
      }
      if (v.enableBirthdayMonth && (!secrets.birthMonth || secrets.birthMonth < 1 || secrets.birthMonth > 12)) {
        return 'Select a valid birth month.';
      }
      if (v.enableBirthdayYear && (!secrets.birthYear || secrets.birthYear < 1900 || secrets.birthYear > 2100)) {
        return 'Enter a valid 4-digit birth year.';
      }
      for (const q of v.customQuestions.filter((c) => c.enabled)) {
        const ans = secrets.customAnswers.find((a) => a.id === q.id)?.answer?.trim();
        if (!ans) {
          return `Please provide an expected answer for "${q.question}".`;
        }
      }
    }
    return null;
  };

  const handleSave = async (targetStatus: 'draft' | 'published') => {
    if (!user) {
      promptAuth(
        targetStatus === 'published'
          ? 'Sign in to publish your greeting card and generate a unique shareable link.'
          : 'Sign in to save your greeting draft to your Keepsake studio.'
      );
      return;
    }

    const validationError = validateBeforeSaveOrPublish(targetStatus === 'published');
    if (validationError) {
      setStatusMessage({ type: 'error', text: validationError });
      return;
    }

    if (targetStatus === 'published') setPublishing(true);
    else setSaving(true);
    setStatusMessage(null);

    try {
      const payload: Greeting = {
        ...greeting,
        creatorId: greeting.creatorId === 'guest' ? user.uid : greeting.creatorId,
        status: targetStatus,
      };
      const saved = await saveGreeting(payload, greeting.accessMode === 'interactive' ? secrets : undefined);
      setGreeting(saved);
      if (targetStatus === 'published') {
        setPublishedShareId(saved.id);
        setStatusMessage({ type: 'success', text: 'Your greeting is published and live!' });
      } else {
        setStatusMessage({ type: 'success', text: 'Draft saved securely to Firestore.' });
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save greeting. Check your connection and permissions.',
      });
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  const moveSequenceStep = (idx: number, dir: -1 | 1) => {
    const order = [...(greeting.designConfig.sequenceOrder || DEFAULT_SEQUENCE_ORDER)];
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    const [item] = order.splice(idx, 1);
    order.splice(target, 0, item);
    commitChange((prev) => ({
      ...prev,
      designConfig: { ...prev.designConfig, sequenceOrder: order },
    }));
  };

  const addCustomQuestion = () => {
    if (!newQuestionText.trim() || !newQuestionAnswer.trim()) return;
    const qId = `q_${Date.now()}`;
    const newQ: CustomQuestionPrompt = {
      id: qId,
      question: newQuestionText.trim(),
      enabled: true,
      hint: newQuestionHint.trim() || undefined,
    };
    commitChange((prev) => ({
      ...prev,
      verificationMeta: {
        ...prev.verificationMeta,
        customQuestions: [...prev.verificationMeta.customQuestions, newQ],
      },
    }));
    setSecrets((prev) => ({
      ...prev,
      customAnswers: [...prev.customAnswers, { id: qId, answer: newQuestionAnswer.trim() }],
    }));
    setNewQuestionText('');
    setNewQuestionAnswer('');
    setNewQuestionHint('');
  };

  if (loadingExisting) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center text-sm text-slate-500">
        Loading your greeting draft...
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-10 pb-28 lg:pb-12">
      {/* Studio Top Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
            Gift Creation Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Step {step + 1} of {WIZARD_STEPS.length} · {WIZARD_STEPS[step]}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={historyPast.length === 0}
            onClick={handleUndo}
            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
          <button
            type="button"
            disabled={historyFuture.length === 0}
            onClick={handleRedo}
            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span>Redo</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={openFullPreview}
            className="min-h-[40px] px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>
          <button
            type="button"
            onClick={() => setVideoStudioOpen(true)}
            className="min-h-[40px] px-3.5 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-1.5 hover:bg-rose-100 dark:hover:bg-rose-950/50"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Export as Video</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('draft')}
            className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Draft'}</span>
          </button>
        </div>
      </div>

      {/* Stepper Bar */}
      <div className="py-4 flex items-center gap-2 overflow-x-auto border-b border-slate-200/70 dark:border-slate-800/70">
        {WIZARD_STEPS.map((label, idx) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(idx)}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors flex items-center gap-2 ${
              step === idx
                ? 'bg-rose-700 text-white'
                : idx < step
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <span className="font-mono tabular-nums">{idx + 1}.</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {statusMessage && (
        <div
          className={`mt-4 rounded-xl border p-3.5 text-sm flex items-center justify-between gap-3 ${
            statusMessage.type === 'error'
              ? 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
              : 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Editor + Live Preview Split */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Wizard Controls */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-5 sm:p-7 space-y-6">
          {/* STEP 1: CATEGORY */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                  1. Select Greeting Category
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Choose the occasion for this gift card. Categories are dynamically curated.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categories.map((cat) => {
                  const selected = greeting.categoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => commitChange((prev) => ({ ...prev, categoryId: cat.id }))}
                      className={`text-left rounded-xl border p-3.5 transition-colors flex items-start gap-3 ${
                        selected
                          ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/25'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {cat.imageUrl && (
                        <img
                          src={cat.imageUrl}
                          alt={cat.name}
                          className="w-14 h-14 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-slate-900 dark:text-white">{cat.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {cat.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: TEMPLATE */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                    2. Select a Design Template
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Start from a ready-made theme or design from a blank canvas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => applyTemplate(null)}
                  className={`min-h-[40px] px-3.5 rounded-lg border text-xs font-medium ${
                    !greeting.templateId
                      ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Blank Canvas
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {templates
                  .slice()
                  .sort((a, b) =>
                    a.categoryId === greeting.categoryId && b.categoryId !== greeting.categoryId ? -1 : 1
                  )
                  .map((tpl) => {
                    const selected = greeting.templateId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className={`text-left rounded-xl border overflow-hidden transition-all ${
                          selected
                            ? 'border-rose-600 ring-2 ring-rose-600/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className="h-28 p-4 flex flex-col justify-between"
                          style={{ background: tpl.backgroundStyle, color: tpl.colorScheme.text }}
                        >
                          <span className="text-[11px] opacity-80">
                            {categories.find((c) => c.id === tpl.categoryId)?.name}
                          </span>
                          <p className="font-display text-lg font-semibold">{tpl.name}</p>
                        </div>
                        <div className="p-3.5 space-y-1.5">
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                            {tpl.description}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {tpl.animationStyle.replace(/-/g, ' ')} · {tpl.fontPair} · {tpl.layoutPreset}
                          </p>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* STEP 3: PERSONALIZE */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                  3. Personalize Your Greeting
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Write your message and tune text styling.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Recipient’s Name *
                  </span>
                  <input
                    type="text"
                    value={greeting.recipientName}
                    onChange={(e) => commitChange((p) => ({ ...p, recipientName: e.target.value }))}
                    placeholder="e.g., Maya Lin"
                    maxLength={100}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm outline-none focus:border-rose-600"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Sender’s Name *
                  </span>
                  <input
                    type="text"
                    value={greeting.senderName}
                    onChange={(e) => commitChange((p) => ({ ...p, senderName: e.target.value }))}
                    placeholder="e.g., Jordan"
                    maxLength={100}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm outline-none focus:border-rose-600"
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Card Headline *
                </span>
                <input
                  type="text"
                  value={greeting.title}
                  onChange={(e) => commitChange((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Happy Birthday, Maya!"
                  maxLength={140}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm outline-none focus:border-rose-600"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Main Greeting Message *
                </span>
                <textarea
                  rows={5}
                  value={greeting.mainMessage}
                  onChange={(e) => commitChange((p) => ({ ...p, mainMessage: e.target.value }))}
                  maxLength={4000}
                  className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm outline-none focus:border-rose-600"
                />
              </label>

              {/* Additional Personal Messages */}
              <div className="space-y-2.5">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                  Additional Personal Notes (Optional)
                </span>
                {greeting.additionalMessages.map((note, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={note}
                      onChange={(e) =>
                        commitChange((p) => ({
                          ...p,
                          additionalMessages: p.additionalMessages.map((m, i) => (i === idx ? e.target.value : m)),
                        }))
                      }
                      className="flex-1 min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        commitChange((p) => ({
                          ...p,
                          additionalMessages: p.additionalMessages.filter((_, i) => i !== idx),
                        }))
                      }
                      className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={extraNoteDraft}
                    onChange={(e) => setExtraNoteDraft(e.target.value)}
                    placeholder="Add a P.S., inside joke, or memory quote..."
                    className="flex-1 min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs outline-none focus:border-rose-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!extraNoteDraft.trim()) return;
                      commitChange((p) => ({
                        ...p,
                        additionalMessages: [...p.additionalMessages, extraNoteDraft.trim()].slice(0, 10),
                      }));
                      setExtraNoteDraft('');
                    }}
                    className="min-h-[42px] px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Note</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Optional Date Label
                  </span>
                  <input
                    type="text"
                    value={greeting.cardDate || ''}
                    onChange={(e) => commitChange((p) => ({ ...p, cardDate: e.target.value }))}
                    placeholder="e.g., November 13, 2026"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Optional Closing Signature
                  </span>
                  <input
                    type="text"
                    value={greeting.signature || ''}
                    onChange={(e) => commitChange((p) => ({ ...p, signature: e.target.value }))}
                    placeholder="e.g., Always yours, Jordan"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                  />
                </label>
              </div>

              {/* Quick Typography Controls */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block space-y-1">
                  <span className="text-xs text-slate-500">Font Style</span>
                  <select
                    value={greeting.designConfig.fontPair}
                    onChange={(e) =>
                      commitChange((p) => ({
                        ...p,
                        designConfig: { ...p.designConfig, fontPair: e.target.value as Greeting['designConfig']['fontPair'] },
                      }))
                    }
                    className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    <option value="editorial">Editorial Serif</option>
                    <option value="classic">Classic Luxury</option>
                    <option value="modern">Modern Sans</option>
                    <option value="script">Handwritten Script</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-slate-500">Text Size</span>
                  <select
                    value={greeting.designConfig.fontSizeScale}
                    onChange={(e) =>
                      commitChange((p) => ({
                        ...p,
                        designConfig: {
                          ...p.designConfig,
                          fontSizeScale: e.target.value as Greeting['designConfig']['fontSizeScale'],
                        },
                      }))
                    }
                    className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    <option value="compact">Compact</option>
                    <option value="standard">Standard</option>
                    <option value="large">Large</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-slate-500">Alignment</span>
                  <select
                    value={greeting.designConfig.textAlign}
                    onChange={(e) =>
                      commitChange((p) => ({
                        ...p,
                        designConfig: { ...p.designConfig, textAlign: e.target.value as 'left' | 'center' },
                      }))
                    }
                    className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    <option value="center">Centered</option>
                    <option value="left">Left Aligned</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-slate-500">Text Color</span>
                  <input
                    type="color"
                    value={greeting.designConfig.textColor}
                    onChange={(e) =>
                      commitChange((p) => ({
                        ...p,
                        designConfig: { ...p.designConfig, textColor: e.target.value },
                      }))
                    }
                    className="w-full h-[40px] rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-transparent cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* STEP 4: PHOTOS */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                  4. Photo &amp; Gallery Management
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Upload personal photographs, crop framing, choose transitions, or search openly licensed photography.
                </p>
              </div>
              <PhotoManagerPanel
                greetingId={greeting.id}
                photos={greeting.photos}
                maxPhotos={settings.maxPhotosPerCard || 12}
                defaultTransition={greeting.designConfig.defaultPhotoTransition || 'fade'}
                transitionDurationMs={greeting.designConfig.transitionDurationMs || 750}
                slideshowIntervalMs={greeting.designConfig.slideshowIntervalMs || 4500}
                onChange={(nextPhotos) => commitChange((p) => ({ ...p, photos: nextPhotos }))}
                onTransitionSettingsChange={(patch) =>
                  commitChange((p) => ({
                    ...p,
                    designConfig: { ...p.designConfig, ...patch },
                  }))
                }
              />

              <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Turn photos &amp; music into a downloadable video
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    Open the Cinematic Video Studio to pick 10 slideshow styles, 9 photo layouts, and export MP4 or WebM.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVideoStudioOpen(true)}
                  className="min-h-[42px] px-4 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-medium flex items-center gap-2 shrink-0"
                >
                  <Film className="w-4 h-4" />
                  <span>Open Video Studio</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: MUSIC & SOUND */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                    5. Music &amp; Sound Library
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Preview studio-licensed melodies or upload your own MP3 / WAV audio.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={greeting.musicConfig.enabled}
                    onChange={(e) =>
                      commitChange((p) => ({
                        ...p,
                        musicConfig: { ...p.musicConfig, enabled: e.target.checked },
                      }))
                    }
                    className="accent-rose-700 w-4 h-4"
                  />
                  <span>Enable Music</span>
                </label>
              </div>

              {/* Upload MP3/WAV */}
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Music className="w-5 h-5 text-rose-700 dark:text-rose-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Upload Personal Audio (MP3 / WAV)
                    </p>
                    <p className="text-xs text-slate-500">
                      {greeting.musicConfig.sourceType === 'uploaded' && greeting.musicConfig.trackTitle
                        ? `Selected: ${greeting.musicConfig.trackTitle}`
                        : 'Max 10 MB · Respect copyright permissions'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="min-h-[40px] px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium cursor-pointer flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{audioUploading ? 'Uploading...' : 'Upload Audio'}</span>
                    <input
                      type="file"
                      accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg"
                      disabled={audioUploading}
                      onChange={(e) => handleUploadAudio(e.target.files)}
                      className="hidden"
                    />
                  </label>
                  {greeting.musicConfig.sourceType === 'uploaded' && greeting.musicConfig.audioUrl && (
                    <button
                      type="button"
                      onClick={() => handleAudioPreview('uploaded', greeting.musicConfig.audioUrl)}
                      className="min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
                    >
                      {previewPlayingId === 'uploaded' ? 'Stop' : 'Preview'}
                    </button>
                  )}
                </div>
              </div>

              {/* Licensed Studio Library */}
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Licensed Platform Music Library
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {LICENSED_MUSIC_LIBRARY.map((track) => {
                    const selected =
                      greeting.musicConfig.enabled &&
                      greeting.musicConfig.sourceType === 'library' &&
                      greeting.musicConfig.trackId === track.id;
                    const playing = previewPlayingId === track.id;

                    return (
                      <div
                        key={track.id}
                        className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                          selected
                            ? 'border-rose-600 bg-rose-50/60 dark:bg-rose-950/25'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            commitChange((p) => ({
                              ...p,
                              musicConfig: {
                                ...p.musicConfig,
                                enabled: true,
                                sourceType: 'library',
                                trackId: track.id,
                                trackTitle: track.title,
                                momentMood: track.mood,
                              },
                            }))
                          }
                          className="text-left flex-1 min-w-0"
                        >
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {track.title}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {track.mood} · {track.durationLabel}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAudioPreview(track.id)}
                          className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
                          aria-label={playing ? `Stop ${track.title}` : `Preview ${track.title}`}
                        >
                          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                      </div>
                    );
                  })}

                  {adminMusicAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                        greeting.musicConfig.trackId === asset.id
                          ? 'border-rose-600 bg-rose-50/60 dark:bg-rose-950/25'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          commitChange((p) => ({
                            ...p,
                            musicConfig: {
                              ...p.musicConfig,
                              enabled: true,
                              sourceType: asset.url.startsWith('synth://') ? 'library' : 'uploaded',
                              trackId: asset.id,
                              trackTitle: asset.title,
                              audioUrl: asset.url,
                            },
                          }))
                        }
                        className="text-left flex-1 min-w-0"
                      >
                        <p className="text-sm font-medium truncate">{asset.title}</p>
                        <p className="text-[11px] text-slate-500 truncate">{asset.license}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAudioPreview(asset.id, asset.url)}
                        className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center"
                      >
                        {previewPlayingId === asset.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Playback Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <label className="block space-y-1.5">
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    Volume ({Math.round(greeting.musicConfig.volume * 100)}%)
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={greeting.musicConfig.volume}
                    onChange={(e) => {
                      const vol = Number(e.target.value);
                      audioEngine.setVolume(vol);
                      commitChange((p) => ({
                        ...p,
                        musicConfig: { ...p.musicConfig, volume: vol },
                      }));
                    }}
                    className="w-full accent-rose-700"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-slate-600 dark:text-slate-300">Music Starts</span>
                  <select
                    value={greeting.musicConfig.startTiming}
                    onChange={(e) =>
                      commitChange((p) => ({
                        ...p,
                        musicConfig: {
                          ...p.musicConfig,
                          startTiming: e.target.value as Greeting['musicConfig']['startTiming'],
                        },
                      }))
                    }
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    <option value="on-gift-open">When recipient opens gift</option>
                    <option value="after-intro">After opening animation</option>
                    <option value="manual">Manual play button only</option>
                  </select>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium pt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={greeting.musicConfig.soundEffectsEnabled}
                    onChange={(e) =>
                      commitChange((p) => ({
                        ...p,
                        musicConfig: { ...p.musicConfig, soundEffectsEnabled: e.target.checked },
                      }))
                    }
                    className="accent-rose-700 w-4 h-4"
                  />
                  <span>Enable Gift &amp; Celebration SFX</span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 6: ANIMATIONS */}
          {step === 5 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                    6. Animation &amp; Effects Library
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Select and combine up to 12 mobile-optimized effects.
                  </p>
                </div>
                <select
                  value={greeting.designConfig.animationIntensity}
                  onChange={(e) =>
                    commitChange((p) => ({
                      ...p,
                      designConfig: {
                        ...p.designConfig,
                        animationIntensity: e.target.value as 'gentle' | 'balanced' | 'festive',
                      },
                    }))
                  }
                  className="min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                >
                  <option value="gentle">Intensity: Gentle</option>
                  <option value="balanced">Intensity: Balanced</option>
                  <option value="festive">Intensity: Festive</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ANIMATION_LIBRARY.map((anim) => {
                  const active = greeting.animations.includes(anim.id);
                  return (
                    <button
                      key={anim.id}
                      type="button"
                      onClick={() => toggleAnimation(anim.id)}
                      className={`text-left rounded-xl border p-3.5 flex items-start justify-between gap-3 transition-colors ${
                        active
                          ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/25'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{anim.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{anim.description}</p>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-xs ${
                          active
                            ? 'bg-rose-700 text-white'
                            : 'border border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 7: ADVANCED VISUAL DESIGN */}
          {step === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                  7. Visual Design &amp; Sequence
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Customize background gradients, card surfaces, stickers, layouts, and reveal sequence.
                </p>
              </div>

              {/* Gradient & Color Presets */}
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Background Theme Presets</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {GRADIENT_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() =>
                        commitChange((p) => ({
                          ...p,
                          designConfig: {
                            ...p.designConfig,
                            backgroundType: 'gradient',
                            gradientCss: preset.css,
                            surfaceColor: preset.surface,
                            textColor: preset.text,
                            accentColor: preset.accent,
                          },
                        }))
                      }
                      className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 text-left hover:border-rose-500 transition-colors"
                    >
                      <div className="h-8 w-full rounded-lg mb-2 border border-black/10" style={{ background: preset.css }} />
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs text-slate-500">Background Mode</span>
                  <select
                    value={greeting.designConfig.backgroundType}
                    onChange={(e) =>
                      commitChange((p) => ({
                        ...p,
                        designConfig: {
                          ...p.designConfig,
                          backgroundType: e.target.value as 'solid' | 'gradient' | 'image',
                        },
                      }))
                    }
                    className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    <option value="gradient">Gradient</option>
                    <option value="solid">Solid Color</option>
                    <option value="image">Backdrop Image</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-slate-500">Card Surface</span>
                  <input
                    type="color"
                    value={greeting.designConfig.surfaceColor}
                    onChange={(e) =>
                      commitChange((p) => ({
                        ...p,
                        designConfig: { ...p.designConfig, surfaceColor: e.target.value },
                      }))
                    }
                    className="w-full h-[40px] rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-transparent"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-slate-500">Accent Color</span>
                  <input
                    type="color"
                    value={greeting.designConfig.accentColor}
                    onChange={(e) =>
                      commitChange((p) => ({
                        ...p,
                        designConfig: { ...p.designConfig, accentColor: e.target.value },
                      }))
                    }
                    className="w-full h-[40px] rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-transparent"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-slate-500">Solid BG</span>
                  <input
                    type="color"
                    value={greeting.designConfig.backgroundColor}
                    onChange={(e) =>
                      commitChange((p) => ({
                        ...p,
                        designConfig: {
                          ...p.designConfig,
                          backgroundType: 'solid',
                          backgroundColor: e.target.value,
                        },
                      }))
                    }
                    className="w-full h-[40px] rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-transparent"
                  />
                </label>
              </div>

              {greeting.designConfig.backgroundType === 'image' && (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Background Image URL
                  </span>
                  <input
                    type="url"
                    value={greeting.designConfig.backgroundImageUrl || ''}
                    onChange={(e) =>
                      commitChange((p) => ({
                        ...p,
                        designConfig: { ...p.designConfig, backgroundImageUrl: e.target.value },
                      }))
                    }
                    placeholder="Paste an uploaded or stock image URL..."
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
                  />
                </label>
              )}

              {/* Photo & Presentation Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Photo Layout</span>
                  <select
                    value={greeting.designConfig.photoLayout}
                    onChange={(e) =>
                      commitChange((p) => ({
                        ...p,
                        designConfig: { ...p.designConfig, photoLayout: e.target.value as PhotoLayoutType },
                      }))
                    }
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    <option value="slideshow">Interactive Slideshow</option>
                    <option value="gallery">Multi-Column Gallery</option>
                    <option value="polaroid-stack">Polaroid Prints</option>
                    <option value="floating-frames">Floating Frames</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Presentation Mode</span>
                  <select
                    value={greeting.designConfig.presentationMode}
                    onChange={(e) =>
                      commitChange((p) => ({
                        ...p,
                        designConfig: {
                          ...p.designConfig,
                          presentationMode: e.target.value as PresentationMode,
                        },
                      }))
                    }
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    <option value="interactive-card">Interactive Card View</option>
                    <option value="fullscreen-slideshow">Full-Screen Slideshow</option>
                    <option value="cinematic-story">Chapter-by-Chapter Story</option>
                  </select>
                </label>
              </div>

              {/* Decorative Stickers */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Decorative Stationery Marks ({greeting.designConfig.stickers.length})
                  </span>
                  {greeting.designConfig.stickers.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        commitChange((p) => ({ ...p, designConfig: { ...p.designConfig, stickers: [] } }))
                      }
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Clear Marks
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {STICKER_PALETTE.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() =>
                        commitChange((p) => ({
                          ...p,
                          designConfig: {
                            ...p.designConfig,
                            stickers: [
                              ...p.designConfig.stickers,
                              {
                                id: `${st.id}_${Date.now()}`,
                                label: st.label,
                                symbol: st.symbol,
                                x: 12 + Math.round(Math.random() * 76),
                                y: 12 + Math.round(Math.random() * 76),
                                scale: 1,
                              },
                            ].slice(0, 10),
                          },
                        }))
                      }
                      className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
                    >
                      <span>{st.symbol}</span>
                      <span>{st.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Event Sequence Ordering */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Gift Reveal Sequence Order
                </p>
                <div className="space-y-2">
                  {(greeting.designConfig.sequenceOrder || DEFAULT_SEQUENCE_ORDER).map((seqKey: ExperienceStepKey, idx) => (
                    <div
                      key={seqKey}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs"
                    >
                      <span>
                        <span className="font-mono tabular-nums text-slate-400 mr-2">0{idx + 1}.</span>
                        {EXPERIENCE_STEP_LABELS[seqKey]}
                      </span>
                      {seqKey !== 'gift-box' && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx <= 1}
                            onClick={() => moveSequenceStep(idx, -1)}
                            className="min-h-[34px] min-w-[34px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-35"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx >= greeting.designConfig.sequenceOrder.length - 1}
                            onClick={() => moveSequenceStep(idx, 1)}
                            className="min-h-[34px] min-w-[34px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-35"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: RECIPIENT ACCESS SETTINGS & PUBLISH */}
          {step === 7 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                  8. Recipient Access &amp; Publish
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Choose whether the link opens immediately or requires personalized gift-opening verification.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewGateUnlocked(false);
                    commitChange((p) => ({ ...p, accessMode: 'direct' }));
                  }}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    greeting.accessMode === 'direct'
                      ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/25'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <p className="font-medium text-sm text-slate-900 dark:text-white">Mode A: Direct Access</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Recipient opens your unique URL and enters the greeting immediately.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewGateUnlocked(false);
                    setPreviewResetSeed((n) => n + 1);
                    commitChange((p) => ({ ...p, accessMode: 'interactive' }));
                  }}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    greeting.accessMode === 'interactive'
                      ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/25'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <p className="font-medium text-sm text-slate-900 dark:text-white">Mode B: Interactive Access</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Recipient answers birthday dates or personal memory prompts validated securely on our backend.
                  </p>
                </button>
              </div>

              {greeting.accessMode === 'interactive' && (
                <div className="space-y-5 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 bg-slate-50/60 dark:bg-slate-900/40">
                  {!hasApiBackend() && (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200">
                      Previewing Mode B works locally here, while publishing a locked Mode B link requires a verification backend URL (VITE_API_BASE_URL). For 100% static billing-free GitHub Pages publishing, use Mode A (Direct Access).
                    </div>
                  )}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Birthday Verification Sequence
                    </p>

                    {/* Day */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-slate-800">
                      <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={greeting.verificationMeta.enableBirthdayDay}
                          onChange={(e) =>
                            commitChange((p) => ({
                              ...p,
                              verificationMeta: { ...p.verificationMeta, enableBirthdayDay: e.target.checked },
                            }))
                          }
                          className="accent-rose-700 w-4 h-4"
                        />
                        <span>Screen 1: Birth Day (1–31)</span>
                      </label>
                      {greeting.verificationMeta.enableBirthdayDay && (
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={secrets.birthDay ?? ''}
                          onChange={(e) =>
                            setSecrets((s) => ({ ...s, birthDay: Number(e.target.value) || null }))
                          }
                          placeholder="Day (1–31)"
                          className="w-32 min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono tabular-nums"
                        />
                      )}
                    </div>

                    {/* Month */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-slate-800">
                      <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={greeting.verificationMeta.enableBirthdayMonth}
                          onChange={(e) =>
                            commitChange((p) => ({
                              ...p,
                              verificationMeta: { ...p.verificationMeta, enableBirthdayMonth: e.target.checked },
                            }))
                          }
                          className="accent-rose-700 w-4 h-4"
                        />
                        <span>Screen 2: Birth Month (Jan–Dec)</span>
                      </label>
                      {greeting.verificationMeta.enableBirthdayMonth && (
                        <select
                          value={secrets.birthMonth ?? 6}
                          onChange={(e) =>
                            setSecrets((s) => ({ ...s, birthMonth: Number(e.target.value) }))
                          }
                          className="w-44 min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                        >
                          {MONTHS.map((m, i) => (
                            <option key={m} value={i + 1}>
                              {m}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Year */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={greeting.verificationMeta.enableBirthdayYear}
                          onChange={(e) =>
                            commitChange((p) => ({
                              ...p,
                              verificationMeta: { ...p.verificationMeta, enableBirthdayYear: e.target.checked },
                            }))
                          }
                          className="accent-rose-700 w-4 h-4"
                        />
                        <span>Screen 3: Birth Year</span>
                      </label>
                      {greeting.verificationMeta.enableBirthdayYear && (
                        <input
                          type="number"
                          min={1900}
                          max={2026}
                          value={secrets.birthYear ?? ''}
                          onChange={(e) =>
                            setSecrets((s) => ({ ...s, birthYear: Number(e.target.value) || null }))
                          }
                          placeholder="e.g., 1995"
                          className="w-32 min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono tabular-nums"
                        />
                      )}
                    </div>
                  </div>

                  {/* Additional Personalized Questions */}
                  <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Additional Personalized Questions
                    </p>

                    {greeting.verificationMeta.customQuestions.map((q) => {
                      const ansObj = secrets.customAnswers.find((a) => a.id === q.id);
                      return (
                        <div
                          key={q.id}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                              <input
                                type="checkbox"
                                checked={q.enabled}
                                onChange={(e) =>
                                  commitChange((p) => ({
                                    ...p,
                                    verificationMeta: {
                                      ...p.verificationMeta,
                                      customQuestions: p.verificationMeta.customQuestions.map((cq) =>
                                        cq.id === q.id ? { ...cq, enabled: e.target.checked } : cq
                                      ),
                                    },
                                  }))
                                }
                                className="accent-rose-700"
                              />
                              <span>{q.question}</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                commitChange((p) => ({
                                  ...p,
                                  verificationMeta: {
                                    ...p.verificationMeta,
                                    customQuestions: p.verificationMeta.customQuestions.filter((cq) => cq.id !== q.id),
                                  },
                                }));
                                setSecrets((s) => ({
                                  ...s,
                                  customAnswers: s.customAnswers.filter((a) => a.id !== q.id),
                                }));
                              }}
                              className="text-rose-600 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={ansObj?.answer || ''}
                            onChange={(e) =>
                              setSecrets((s) => ({
                                ...s,
                                customAnswers: s.customAnswers.some((a) => a.id === q.id)
                                  ? s.customAnswers.map((a) =>
                                      a.id === q.id ? { ...a, answer: e.target.value } : a
                                    )
                                  : [...s.customAnswers, { id: q.id, answer: e.target.value }],
                              }))
                            }
                            placeholder="Expected answer (stored privately, case-insensitive)"
                            className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
                          />
                        </div>
                      );
                    })}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newQuestionText}
                        onChange={(e) => setNewQuestionText(e.target.value)}
                        placeholder="Question (e.g., What is your favorite color?)"
                        className="min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                      <input
                        type="text"
                        value={newQuestionAnswer}
                        onChange={(e) => setNewQuestionAnswer(e.target.value)}
                        placeholder="Expected answer (e.g., Emerald)"
                        className="min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newQuestionHint}
                        onChange={(e) => setNewQuestionHint(e.target.value)}
                        placeholder="Optional friendly hint..."
                        className="flex-1 min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                      <button
                        type="button"
                        onClick={addCustomQuestion}
                        className="min-h-[40px] px-4 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium shrink-0"
                      >
                        Add Question
                      </button>
                    </div>
                  </div>

                  {/* Retry Policy */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <label className="block space-y-1">
                      <span className="text-xs text-slate-600 dark:text-slate-300">Retry Policy</span>
                      <select
                        value={greeting.verificationMeta.maxRetries}
                        onChange={(e) =>
                          commitChange((p) => ({
                            ...p,
                            verificationMeta: {
                              ...p.verificationMeta,
                              maxRetries: Number(e.target.value),
                            },
                          }))
                        }
                        className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      >
                        <option value={3}>3 Attempts before 60s pause</option>
                        <option value={5}>5 Attempts before 60s pause</option>
                        <option value={10}>10 Attempts before 60s pause</option>
                        <option value={0}>Unlimited Attempts</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs text-slate-600 dark:text-slate-300">Friendly Retry Message</span>
                      <input
                        type="text"
                        value={greeting.verificationMeta.friendlyErrorMessage}
                        onChange={(e) =>
                          commitChange((p) => ({
                            ...p,
                            verificationMeta: {
                              ...p.verificationMeta,
                              friendlyErrorMessage: e.target.value,
                            },
                          }))
                        }
                        className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                    </label>
                  </div>
                </div>
              )}

              {greeting.exportedVideo?.url && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                      Attached Video Keepsake: {greeting.exportedVideo.fileName}
                    </p>
                    <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                      {greeting.exportedVideo.width}×{greeting.exportedVideo.height} ·{' '}
                      {greeting.exportedVideo.durationSec}s · Recipients can optionally watch or download this video.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => commitChange((p) => ({ ...p, exportedVideo: null }))}
                    className="min-h-[34px] px-3 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-medium"
                  >
                    Detach Video
                  </button>
                </div>
              )}

              {/* Final Publish Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => handleSave('published')}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{publishing ? 'Publishing...' : 'Publish & Generate Unique URL'}</span>
                </button>
                <button
                  type="button"
                  onClick={openFullPreview}
                  className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>
                    {greeting.accessMode === 'interactive' ? 'Preview Interactive Gate' : 'Preview Gift'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setVideoStudioOpen(true)}
                  className="min-h-[48px] px-5 py-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm font-medium flex items-center gap-2"
                >
                  <Film className="w-4 h-4" />
                  <span>Export as Video</span>
                </button>
              </div>
            </div>
          )}

          {/* Desktop Step Footer Navigation */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium flex items-center gap-2 disabled:opacity-40"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {step < WIZARD_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1))}
                className="min-h-[44px] px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium flex items-center gap-2"
              >
                <span>Next: {WIZARD_STEPS[step + 1]}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate({ page: 'dashboard' })}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                Go to My Studio
              </button>
            )}
          </div>
        </div>

        {/* Right: Desktop Live Card Preview */}
        <div className="hidden lg:block lg:col-span-5 sticky top-20 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              {step === 7 && greeting.accessMode === 'interactive'
                ? 'Live Mode B Gate Preview'
                : 'Live Interactive Preview'}
            </span>
            <div className="flex items-center gap-2">
              <span>{greeting.accessMode === 'interactive' ? 'Interactive Access' : 'Direct Access'}</span>
              {step === 7 && greeting.accessMode === 'interactive' && previewGateUnlocked && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewGateUnlocked(false);
                    setPreviewResetSeed((n) => n + 1);
                  }}
                  className="text-rose-700 dark:text-rose-400 underline"
                >
                  Re-lock Gate
                </button>
              )}
            </div>
          </div>

          {step === 7 && greeting.accessMode === 'interactive' && !previewGateUnlocked ? (
            <VerificationGate
              key={`inline-gate-${previewResetSeed}`}
              greeting={{
                ...greeting,
                recipientName: greeting.recipientName || 'Recipient',
                senderName: greeting.senderName || 'You',
              }}
              previewMode
              previewSecrets={secrets}
              onVerified={() => setPreviewGateUnlocked(true)}
            />
          ) : (
            <GreetingExperience
              greeting={{
                ...greeting,
                recipientName: greeting.recipientName || 'Recipient',
                senderName: greeting.senderName || 'You',
              }}
              isPreview
              autoOpened={step >= 2 && step <= 6}
            />
          )}
        </div>
      </div>

      {/* Mobile Sticky Bottom Bar (<= 15% viewport) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md px-4 py-2.5 flex items-center justify-between gap-2 pb-safe">
        <button
          type="button"
          onClick={openFullPreview}
          className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5"
        >
          <Eye className="w-4 h-4" />
          <span>Preview</span>
        </button>

        {step < WIZARD_STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1))}
            className="flex-1 min-h-[44px] px-4 rounded-xl bg-rose-700 text-white text-xs font-medium flex items-center justify-center gap-1.5"
          >
            <span>Continue ({step + 1}/{WIZARD_STEPS.length})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={publishing}
            onClick={() => handleSave('published')}
            className="flex-1 min-h-[44px] px-4 rounded-xl bg-rose-700 text-white text-xs font-medium flex items-center justify-center gap-1.5"
          >
            <Send className="w-4 h-4" />
            <span>{publishing ? 'Publishing...' : 'Publish Gift'}</span>
          </button>
        )}
      </div>

      {/* Full-Screen Preview Modal */}
      {fullPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-white">
              <span className="text-sm font-medium">
                {greeting.accessMode === 'interactive'
                  ? 'Preview · Mode B: Interactive Access'
                  : 'Preview · Mode A: Direct Access'}
              </span>
              <div className="flex items-center gap-2">
                {greeting.accessMode === 'interactive' && previewGateUnlocked && (
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewGateUnlocked(false);
                      setPreviewResetSeed((n) => n + 1);
                    }}
                    className="min-h-[44px] px-4 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-xs font-medium"
                  >
                    Re-test Verification Gate
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFullPreviewOpen(false)}
                  className="min-h-[44px] px-4 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-medium"
                >
                  Close Preview
                </button>
              </div>
            </div>

            {greeting.accessMode === 'interactive' && !previewGateUnlocked ? (
              <div className="py-6">
                <VerificationGate
                  key={`modal-gate-${previewResetSeed}`}
                  greeting={{
                    ...greeting,
                    recipientName: greeting.recipientName || 'Recipient',
                    senderName: greeting.senderName || 'You',
                  }}
                  previewMode
                  previewSecrets={secrets}
                  onVerified={() => setPreviewGateUnlocked(true)}
                />
              </div>
            ) : (
              <GreetingExperience
                greeting={{
                  ...greeting,
                  recipientName: greeting.recipientName || 'Recipient',
                  senderName: greeting.senderName || 'You',
                }}
                isPreview
              />
            )}
          </div>
        </div>
      )}

      {/* Cinematic Video Export Studio */}
      {videoStudioOpen && (
        <VideoExportStudio
          greeting={{
            ...greeting,
            recipientName: greeting.recipientName || 'Recipient',
            senderName: greeting.senderName || 'You',
          }}
          onUpdateGreeting={commitChange}
          onClose={() => setVideoStudioOpen(false)}
        />
      )}

      {/* Share Modal after Publishing */}
      {publishedShareId && (
        <ShareModal
          greetingId={publishedShareId}
          recipientName={greeting.recipientName || 'your recipient'}
          title={greeting.title}
          onClose={() => setPublishedShareId(null)}
        />
      )}
    </main>
  );
}
