import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Film,
  Image as ImageIcon,
  Layers,
  Music,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Sliders,
  Sparkles,
  Type,
  UploadCloud,
  X,
} from 'lucide-react';
import { buildApiUrl } from '../lib/api';
import { LICENSED_MUSIC_LIBRARY } from '../lib/audioEngine';
import {
  createDefaultVideoStudioConfig,
  PHOTO_PRESENTATIONS,
  PHOTO_TRANSITIONS,
  resolvePhotoTransition,
  SLIDESHOW_STYLES,
  TEXT_ANIMATIONS,
} from '../lib/catalog';
import { uploadVideoBlob } from '../lib/imageUtils';
import { renderMusicToAudioBuffer, StudioAudioSyncPlayer } from '../lib/videoAudioPipeline';
import {
  buildVideoTimeline,
  exportGreetingVideo,
  getExportDimensions,
  loadVideoImageCache,
  renderVideoFrame,
  type ExportedVideoResult,
  type ExportVideoProgress,
  type LoadedImageCache,
} from '../lib/videoRenderer';
import { useApp } from './AppContext';
import type {
  ExportedVideoAttachment,
  Greeting,
  PhotoPresentationLayout,
  PhotoTransitionType,
  SlideshowStyleId,
  TextAnimationStyle,
  VideoAspectRatio,
  VideoExportFormat,
  VideoFrameRate,
  VideoQuality,
  VideoResolution,
  VideoStudioConfig,
} from '../lib/types';

type StudioTab = 'styles' | 'photos' | 'text-audio' | 'export';

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${rem.toString().padStart(2, '0')}`;
}

export function VideoExportStudio({
  greeting,
  onUpdateGreeting,
  onClose,
}: {
  greeting: Greeting;
  onUpdateGreeting: (updater: (prev: Greeting) => Greeting) => void;
  onClose: () => void;
}) {
  const { user, promptAuth } = useApp();
  const [activeTab, setActiveTab] = useState<StudioTab>('styles');

  const config: VideoStudioConfig = useMemo(
    () => createDefaultVideoStudioConfig(greeting),
    [greeting]
  );

  const updateConfig = useCallback(
    (updater: (prev: VideoStudioConfig) => VideoStudioConfig) => {
      onUpdateGreeting((prev) => {
        const current = createDefaultVideoStudioConfig(prev);
        return {
          ...prev,
          designConfig: {
            ...prev.designConfig,
            videoConfig: updater(current),
          },
        };
      });
    },
    [onUpdateGreeting]
  );

  const timeline = useMemo(() => buildVideoTimeline(greeting, config), [greeting, config]);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCacheRef = useRef<LoadedImageCache | null>(null);
  const audioSyncRef = useRef<StudioAudioSyncPlayer | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const exportedUrlRef = useRef<string | null>(null);

  const [cacheVersion, setCacheVersion] = useState(0);
  const [imageWarnings, setImageWarnings] = useState<string[]>([]);
  const [audioWarning, setAudioWarning] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Backend capabilities
  const [ffmpegAvailable, setFfmpegAvailable] = useState(false);
  const [healthChecked, setHealthChecked] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportVideoProgress | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportedResult, setExportedResult] = useState<ExportedVideoResult | null>(null);

  // Attach to card state
  const [attaching, setAttaching] = useState(false);
  const [attachSuccess, setAttachSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    fetch(buildApiUrl('/health'))
      .then((r) => r.json())
      .then((data: { ffmpegAvailable?: boolean }) => {
        setFfmpegAvailable(Boolean(data.ffmpegAvailable));
      })
      .catch(() => {
        setFfmpegAvailable(false);
      })
      .finally(() => setHealthChecked(true));

    audioSyncRef.current = new StudioAudioSyncPlayer();
    return () => {
      abortControllerRef.current?.abort();
      audioSyncRef.current?.dispose();
      imageCacheRef.current?.release();
      if (exportedUrlRef.current) {
        URL.revokeObjectURL(exportedUrlRef.current);
      }
    };
  }, []);

  // Keep image cache warm whenever photos or background change
  const photoSig = useMemo(
    () => `${greeting.photos.map((p) => p.url).join('|')}::${greeting.designConfig.backgroundImageUrl || ''}`,
    [greeting.photos, greeting.designConfig.backgroundImageUrl]
  );

  useEffect(() => {
    let active = true;
    loadVideoImageCache(greeting, 1280).then((cache) => {
      if (!active) {
        cache.release();
        return;
      }
      imageCacheRef.current?.release();
      imageCacheRef.current = cache;
      setImageWarnings(cache.warnings);
      setCacheVersion((v) => v + 1);
    });
    return () => {
      active = false;
    };
  }, [photoSig, greeting]);

  // Pre-render studio music audio buffer for instant seek-synced preview
  const musicSig = useMemo(
    () =>
      JSON.stringify({
        music: greeting.musicConfig,
        fade: config.audioOptions,
        dur: Math.round(timeline.totalDurationSec * 10),
      }),
    [greeting.musicConfig, config.audioOptions, timeline.totalDurationSec]
  );

  useEffect(() => {
    let active = true;
    setAudioWarning(null);
    renderMusicToAudioBuffer(greeting.musicConfig, config.audioOptions, timeline.totalDurationSec).then(
      (res) => {
        if (!active) return;
        audioSyncRef.current?.setBuffer(res.buffer);
        if (res.warning) setAudioWarning(res.warning);
      }
    );
    return () => {
      active = false;
    };
  }, [musicSig, greeting.musicConfig, config.audioOptions, timeline.totalDurationSec]);

  // Paint single frame onto preview canvas whenever time/config/cache changes
  const previewDims = useMemo(() => {
    const full = getExportDimensions(config.aspectRatio, '480p');
    return full;
  }, [config.aspectRatio]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const cache = imageCacheRef.current;
    if (!canvas || !cache) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderVideoFrame(
      ctx,
      previewDims.width,
      previewDims.height,
      greeting,
      config,
      timeline,
      cache,
      currentTimeSec,
      reducedMotion
    );
  }, [previewDims, greeting, config, timeline, currentTimeSec, cacheVersion, reducedMotion]);

  // Smooth RAF playback loop
  useEffect(() => {
    if (!isPlaying) {
      audioSyncRef.current?.stop();
      return;
    }

    let rafId = 0;
    let lastPerf = performance.now();
    audioSyncRef.current?.playFrom(currentTimeSec, 0.9);

    const tick = (now: number) => {
      const dt = (now - lastPerf) / 1000;
      lastPerf = now;
      setCurrentTimeSec((prev) => {
        const next = prev + dt;
        if (next >= timeline.totalDurationSec) {
          setIsPlaying(false);
          return timeline.totalDurationSec;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      audioSyncRef.current?.stop();
    };
    // Intentionally omit currentTimeSec so audio doesn't restart each tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, timeline.totalDurationSec]);

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (currentTimeSec >= timeline.totalDurationSec - 0.05) {
      setCurrentTimeSec(0);
    }
    setIsPlaying(true);
  };

  const handleRestartPreview = () => {
    setIsPlaying(false);
    setCurrentTimeSec(0);
    window.setTimeout(() => setIsPlaying(true), 40);
  };

  const handleScrub = (nextSec: number) => {
    setIsPlaying(false);
    setCurrentTimeSec(Math.max(0, Math.min(timeline.totalDurationSec, nextSec)));
  };

  const applySlideshowStyle = (styleId: SlideshowStyleId) => {
    const preset = SLIDESHOW_STYLES.find((s) => s.id === styleId);
    if (!preset) return;
    updateConfig((prev) => ({
      ...prev,
      slideshowStyle: preset.id,
      photoPresentation: preset.defaultPresentation,
      photoFrame: {
        ...prev.photoFrame,
        borderStyle: preset.borderStyle,
        blurBackdrop: preset.blurBackdrop,
      },
      textStyle: {
        ...prev.textStyle,
        animation: preset.defaultTextAnimation,
      },
    }));
    onUpdateGreeting((prev) => ({
      ...prev,
      designConfig: {
        ...prev.designConfig,
        defaultPhotoTransition: preset.defaultTransition,
      },
    }));
  };

  const handleStartExport = async () => {
    setIsPlaying(false);
    setExportError(null);
    setAttachSuccess(null);
    if (exportedUrlRef.current) {
      URL.revokeObjectURL(exportedUrlRef.current);
      exportedUrlRef.current = null;
    }
    setExportedResult(null);
    setExporting(true);
    setExportProgress({
      phase: 'preparing',
      percent: 2,
      message: 'Starting Keepsake Video Studio...',
      elapsedMs: 0,
      estimatedRemainingMs: null,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const effectiveConfig: VideoStudioConfig = {
        ...config,
        format: config.format === 'mp4' && ffmpegAvailable ? 'mp4' : config.format,
      };
      const result = await exportGreetingVideo(greeting, effectiveConfig, {
        signal: controller.signal,
        ffmpegAvailable,
        onProgress: (prog) => setExportProgress(prog),
      });
      exportedUrlRef.current = result.url;
      setExportedResult(result);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setExportError('Export cancelled.');
      } else {
        setExportError(err instanceof Error ? err.message : 'Video export failed.');
      }
    } finally {
      setExporting(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelExport = () => {
    abortControllerRef.current?.abort();
  };

  const handleAttachVideoToCard = async () => {
    if (!exportedResult) return;
    if (!user) {
      promptAuth('Sign in to attach this rendered video to your published greeting card.');
      return;
    }
    setAttaching(true);
    setExportError(null);
    setAttachSuccess(null);
    try {
      const uploaded = await uploadVideoBlob(
        exportedResult.blob,
        greeting.id,
        exportedResult.fileName,
        exportedResult.format
      );
      const attachment: ExportedVideoAttachment = {
        url: uploaded.url,
        format: exportedResult.format,
        fileName: exportedResult.fileName,
        durationSec: Math.round(exportedResult.durationSec * 10) / 10,
        width: exportedResult.width,
        height: exportedResult.height,
        sizeBytes: uploaded.sizeBytes,
        attachedAt: new Date().toISOString(),
      };
      onUpdateGreeting((prev) => ({
        ...prev,
        exportedVideo: attachment,
      }));
      setAttachSuccess(
        'Video attached to your greeting card! Remember to Save Draft or Publish to persist it for recipients.'
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Unable to attach video to greeting card.');
    } finally {
      setAttaching(false);
    }
  };

  const activeScene = useMemo(
    () =>
      timeline.scenes.find(
        (s) => currentTimeSec >= s.startSec && currentTimeSec <= s.endSec + 0.001
      ) || timeline.scenes[0],
    [timeline.scenes, currentTimeSec]
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col overflow-hidden">
      {/* Studio Top Bar */}
      <header className="shrink-0 h-14 sm:h-16 px-4 sm:px-6 border-b border-slate-800 bg-[#0B0F17] text-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-rose-700 flex items-center justify-center shrink-0">
            <Film className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-lg font-semibold truncate">
              Cinematic Video Export Studio
            </h2>
            <p className="text-[11px] text-slate-400 truncate">
              {greeting.title || 'Untitled Greeting'} · {config.aspectRatio} · {config.resolution} ·{' '}
              {formatClock(timeline.totalDurationSec)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] px-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5"
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline">Close Studio</span>
        </button>
      </header>

      {/* Studio Main Split Workspace */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left: Real-time Canvas Preview Stage */}
        <section className="lg:col-span-7 bg-[#070A10] p-4 sm:p-6 flex flex-col justify-between gap-4 border-b lg:border-b-0 lg:border-r border-slate-800">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
            <span className="font-medium truncate">
              Scene: <strong className="text-white">{activeScene?.label || 'Preview'}</strong>
            </span>
            <span className="font-mono tabular-nums text-slate-400">
              {formatClock(currentTimeSec)} / {formatClock(timeline.totalDurationSec)}
            </span>
          </div>

          <div className="flex-1 flex items-center justify-center min-h-[240px] max-h-[58vh]">
            <div
              className={`relative rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-black flex items-center justify-center ${
                config.aspectRatio === '9:16'
                  ? 'h-full max-h-[54vh] aspect-[9/16]'
                  : config.aspectRatio === '1:1'
                  ? 'h-full max-h-[54vh] aspect-square'
                  : 'w-full max-w-3xl aspect-video'
              }`}
            >
              <canvas
                ref={previewCanvasRef}
                width={previewDims.width}
                height={previewDims.height}
                className="w-full h-full object-contain block"
              />
            </div>
          </div>

          {/* Playback Scrubber & Controls */}
          <div className="rounded-xl border border-slate-800 bg-[#0D131F] p-3 sm:p-4 space-y-3 text-white">
            <input
              type="range"
              min={0}
              max={timeline.totalDurationSec}
              step={0.05}
              value={currentTimeSec}
              onChange={(e) => handleScrub(Number(e.target.value))}
              aria-label="Timeline scrubber"
              className="w-full accent-rose-600 cursor-pointer"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="min-h-[44px] px-4 rounded-xl bg-rose-700 hover:bg-rose-800 text-xs font-medium flex items-center gap-2"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isPlaying ? 'Pause' : 'Play Sequence'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleRestartPreview}
                  className="min-h-[44px] px-3.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restart</span>
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto max-w-full">
                {timeline.scenes.map((s) => {
                  const isActive = activeScene?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleScrub(s.startSec + 0.05)}
                      className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? 'bg-white text-slate-900'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {(imageWarnings.length > 0 || audioWarning) && (
              <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-2.5 text-[11px] text-amber-200 space-y-1">
                {audioWarning && <p>• {audioWarning}</p>}
                {imageWarnings.slice(0, 2).map((w, i) => (
                  <p key={i}>• {w}</p>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right: Studio Configuration & Render Pipeline */}
        <section className="lg:col-span-5 bg-white dark:bg-[#0F1522] text-slate-900 dark:text-slate-100 flex flex-col lg:overflow-hidden">
          {/* Studio Control Tabs */}
          <nav className="shrink-0 grid grid-cols-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]">
            {(
              [
                { id: 'styles', label: 'Styles', icon: Sparkles },
                { id: 'photos', label: 'Photos', icon: ImageIcon },
                { id: 'text-audio', label: 'Text & Audio', icon: Type },
                { id: 'export', label: 'Export', icon: Download },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[48px] px-2 py-2 text-xs font-medium flex flex-col sm:flex-row items-center justify-center gap-1.5 border-b-2 transition-colors ${
                    active
                      ? 'border-rose-700 text-rose-700 dark:text-rose-400 bg-white dark:bg-[#0F1522]'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Tab Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* TAB 1: STYLES & OPENING/CLOSING SCENES */}
            {activeTab === 'styles' && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      10 Slideshow Presentation Styles
                    </h3>
                    <span className="text-[11px] text-slate-400">Live preview updates</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {SLIDESHOW_STYLES.map((style) => {
                      const selected = config.slideshowStyle === style.id;
                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => applySlideshowStyle(style.id)}
                          className={`text-left rounded-xl border p-3 transition-all ${
                            selected
                              ? 'border-rose-600 ring-2 ring-rose-600/20 bg-rose-50/50 dark:bg-rose-950/20'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-xs text-slate-900 dark:text-white">
                              {style.name}
                            </span>
                            <span className="flex items-center gap-1 shrink-0">
                              <span
                                className="w-3 h-3 rounded-full border border-black/15"
                                style={{ backgroundColor: style.palette.backdrop }}
                              />
                              <span
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: style.palette.accent }}
                              />
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {style.tagline} · {style.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Opening Scene Config */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Opening Title Scene
                    </span>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.openingScene.enabled}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            openingScene: { ...c.openingScene, enabled: e.target.checked },
                          }))
                        }
                        className="accent-rose-700 w-4 h-4"
                      />
                      <span>Include</span>
                    </label>
                  </div>
                  {config.openingScene.enabled && (
                    <div className="space-y-2.5 text-xs">
                      <input
                        type="text"
                        value={config.openingScene.title}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            openingScene: { ...c.openingScene, title: e.target.value },
                          }))
                        }
                        placeholder="Opening title..."
                        className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                      />
                      <input
                        type="text"
                        value={config.openingScene.subtitle}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            openingScene: { ...c.openingScene, subtitle: e.target.value },
                          }))
                        }
                        placeholder="Subtitle (e.g., For Maya)"
                        className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex-1 space-y-1">
                          <span className="text-slate-500">
                            Duration ({config.openingScene.durationSec.toFixed(1)}s)
                          </span>
                          <input
                            type="range"
                            min={1.5}
                            max={7}
                            step={0.5}
                            value={config.openingScene.durationSec}
                            onChange={(e) =>
                              updateConfig((c) => ({
                                ...c,
                                openingScene: { ...c.openingScene, durationSec: Number(e.target.value) },
                              }))
                            }
                            className="w-full accent-rose-700"
                          />
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer pt-3">
                          <input
                            type="checkbox"
                            checked={config.openingScene.showIntroPhoto}
                            onChange={(e) =>
                              updateConfig((c) => ({
                                ...c,
                                openingScene: { ...c.openingScene, showIntroPhoto: e.target.checked },
                              }))
                            }
                            className="accent-rose-700"
                          />
                          <span>Photo backdrop</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Closing Scene Config */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Closing Signature Scene
                    </span>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.closingScene.enabled}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            closingScene: { ...c.closingScene, enabled: e.target.checked },
                          }))
                        }
                        className="accent-rose-700 w-4 h-4"
                      />
                      <span>Include</span>
                    </label>
                  </div>
                  {config.closingScene.enabled && (
                    <div className="space-y-2.5 text-xs">
                      <input
                        type="text"
                        value={config.closingScene.title}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            closingScene: { ...c.closingScene, title: e.target.value },
                          }))
                        }
                        placeholder="Closing headline..."
                        className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                      />
                      <input
                        type="text"
                        value={config.closingScene.signature}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            closingScene: { ...c.closingScene, signature: e.target.value },
                          }))
                        }
                        placeholder="Signature line..."
                        className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                      />
                      <input
                        type="text"
                        value={config.closingScene.message}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            closingScene: { ...c.closingScene, message: e.target.value },
                          }))
                        }
                        placeholder="Closing date or note..."
                        className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                      />
                      <label className="block space-y-1">
                        <span className="text-slate-500">
                          Duration ({config.closingScene.durationSec.toFixed(1)}s)
                        </span>
                        <input
                          type="range"
                          min={1.5}
                          max={7}
                          step={0.5}
                          value={config.closingScene.durationSec}
                          onChange={(e) =>
                            updateConfig((c) => ({
                              ...c,
                              closingScene: { ...c.closingScene, durationSec: Number(e.target.value) },
                            }))
                          }
                          className="w-full accent-rose-700"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB 2: PHOTO PRESENTATIONS, STYLING & TRANSITIONS */}
            {activeTab === 'photos' && (
              <>
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Photo Presentation Layout (9 Styles)</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PHOTO_PRESENTATIONS.map((pres) => {
                      const active = config.photoPresentation === pres.id;
                      return (
                        <button
                          key={pres.id}
                          type="button"
                          onClick={() =>
                            updateConfig((c) => ({
                              ...c,
                              photoPresentation: pres.id as PhotoPresentationLayout,
                            }))
                          }
                          className={`text-left rounded-xl border p-2.5 text-xs transition-colors ${
                            active
                              ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/25'
                              : 'border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <p className="font-medium text-slate-900 dark:text-white">{pres.name}</p>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{pres.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Framing & Styling Controls */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase tracking-wider text-slate-500">
                      Framing &amp; Backdrop
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.photoFrame.blurBackdrop}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            photoFrame: { ...c.photoFrame, blurBackdrop: e.target.checked },
                          }))
                        }
                        className="accent-rose-700 w-4 h-4"
                      />
                      <span>Blur photo backdrop</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-slate-500">Border Frame</span>
                      <select
                        value={config.photoFrame.borderStyle}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            photoFrame: {
                              ...c.photoFrame,
                              borderStyle: e.target.value as VideoStudioConfig['photoFrame']['borderStyle'],
                            },
                          }))
                        }
                        className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      >
                        <option value="none">Borderless</option>
                        <option value="thin">Crisp Hairline</option>
                        <option value="double">Double Gallery Mat</option>
                        <option value="gold">Brushed Gold Foil</option>
                        <option value="polaroid">Polaroid Print Mat</option>
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <span className="text-slate-500">Shadow Depth</span>
                      <select
                        value={config.photoFrame.shadowIntensity}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            photoFrame: {
                              ...c.photoFrame,
                              shadowIntensity: e.target.value as VideoStudioConfig['photoFrame']['shadowIntensity'],
                            },
                          }))
                        }
                        className="w-full min-h-[38px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      >
                        <option value="none">Flat</option>
                        <option value="soft">Soft Elevation</option>
                        <option value="dramatic">Dramatic Studio</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-slate-500">
                        Corner Radius ({config.photoFrame.borderRadius}px)
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={40}
                        value={config.photoFrame.borderRadius}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            photoFrame: { ...c.photoFrame, borderRadius: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-rose-700"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-slate-500">Margin ({config.photoFrame.spacing}px)</span>
                      <input
                        type="range"
                        min={8}
                        max={64}
                        value={config.photoFrame.spacing}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            photoFrame: { ...c.photoFrame, spacing: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-rose-700"
                      />
                    </label>
                  </div>
                </div>

                {/* Global + Per-Photo Transitions */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 text-xs">
                  <span className="block font-semibold uppercase tracking-wider text-slate-500">
                    Transitions ({PHOTO_TRANSITIONS.length} Effects)
                  </span>

                  <div className="flex flex-wrap gap-2">
                    <select
                      value={resolvePhotoTransition(greeting.designConfig.defaultPhotoTransition)}
                      onChange={(e) =>
                        onUpdateGreeting((prev) => ({
                          ...prev,
                          designConfig: {
                            ...prev.designConfig,
                            defaultPhotoTransition: e.target.value as PhotoTransitionType,
                          },
                        }))
                      }
                      className="flex-1 min-h-[40px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      {PHOTO_TRANSITIONS.map((tx) => (
                        <option key={tx.id} value={tx.id}>
                          {tx.name} — {tx.description}
                        </option>
                      ))}
                    </select>
                    {greeting.photos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const tx = resolvePhotoTransition(greeting.designConfig.defaultPhotoTransition);
                          onUpdateGreeting((prev) => ({
                            ...prev,
                            photos: prev.photos.map((ph) => ({ ...ph, transition: tx })),
                          }));
                        }}
                        className="min-h-[40px] px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium shrink-0"
                      >
                        Apply to All
                      </button>
                    )}
                  </div>

                  <label className="block space-y-1">
                    <span className="text-slate-500">
                      Transition Duration ({((greeting.designConfig.transitionDurationMs || 750) / 1000).toFixed(2)}s)
                    </span>
                    <input
                      type="range"
                      min={300}
                      max={2000}
                      step={50}
                      value={greeting.designConfig.transitionDurationMs || 750}
                      onChange={(e) =>
                        onUpdateGreeting((prev) => ({
                          ...prev,
                          designConfig: { ...prev.designConfig, transitionDurationMs: Number(e.target.value) },
                        }))
                      }
                      className="w-full accent-rose-700"
                    />
                  </label>

                  {greeting.photos.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-slate-500 font-medium">Per-Photo Transitions</p>
                      {greeting.photos.map((photo, idx) => (
                        <div key={photo.id} className="flex items-center gap-2">
                          <img
                            src={photo.url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-10 h-8 rounded object-cover shrink-0"
                          />
                          <span className="truncate flex-1">{photo.caption || `Photo ${idx + 1}`}</span>
                          <select
                            value={resolvePhotoTransition(photo.transition)}
                            onChange={(e) =>
                              onUpdateGreeting((prev) => ({
                                ...prev,
                                photos: prev.photos.map((ph) =>
                                  ph.id === photo.id
                                    ? { ...ph, transition: e.target.value as PhotoTransitionType }
                                    : ph
                                ),
                              }))
                            }
                            className="w-40 min-h-[34px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          >
                            {PHOTO_TRANSITIONS.map((tx) => (
                              <option key={tx.id} value={tx.id}>
                                {tx.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB 3: ANIMATED TEXT & MUSIC AUDIO */}
            {activeTab === 'text-audio' && (
              <>
                <div className="space-y-3 text-xs">
                  <h3 className="font-semibold uppercase tracking-wider text-slate-500">
                    Animated Text Engine (10 Styles)
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {TEXT_ANIMATIONS.map((ta) => {
                      const active = config.textStyle.animation === ta.id;
                      return (
                        <button
                          key={ta.id}
                          type="button"
                          onClick={() =>
                            updateConfig((c) => ({
                              ...c,
                              textStyle: { ...c.textStyle, animation: ta.id as TextAnimationStyle },
                            }))
                          }
                          className={`text-left rounded-xl border p-2.5 transition-colors ${
                            active
                              ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/25'
                              : 'border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <p className="font-medium text-slate-900 dark:text-white">{ta.name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{ta.description}</p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <label className="block space-y-1">
                        <span className="text-slate-500">Size</span>
                        <select
                          value={config.textStyle.fontSizeScale}
                          onChange={(e) =>
                            updateConfig((c) => ({
                              ...c,
                              textStyle: {
                                ...c.textStyle,
                                fontSizeScale: e.target.value as 'compact' | 'standard' | 'large',
                              },
                            }))
                          }
                          className="w-full min-h-[38px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        >
                          <option value="compact">Compact</option>
                          <option value="standard">Standard</option>
                          <option value="large">Large</option>
                        </select>
                      </label>

                      <label className="block space-y-1">
                        <span className="text-slate-500">Align</span>
                        <select
                          value={config.textStyle.align}
                          onChange={(e) =>
                            updateConfig((c) => ({
                              ...c,
                              textStyle: { ...c.textStyle, align: e.target.value as 'left' | 'center' },
                            }))
                          }
                          className="w-full min-h-[38px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        >
                          <option value="center">Center</option>
                          <option value="left">Left</option>
                        </select>
                      </label>

                      <label className="block space-y-1">
                        <span className="text-slate-500">Position</span>
                        <select
                          value={config.textStyle.position}
                          onChange={(e) =>
                            updateConfig((c) => ({
                              ...c,
                              textStyle: {
                                ...c.textStyle,
                                position: e.target.value as 'top' | 'center' | 'bottom',
                              },
                            }))
                          }
                          className="w-full min-h-[38px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        >
                          <option value="top">Top</option>
                          <option value="center">Center</option>
                          <option value="bottom">Bottom</option>
                        </select>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block space-y-1">
                        <span className="text-slate-500">
                          Text Reveal ({(config.textStyle.animDurationMs / 1000).toFixed(2)}s)
                        </span>
                        <input
                          type="range"
                          min={300}
                          max={2500}
                          step={100}
                          value={config.textStyle.animDurationMs}
                          onChange={(e) =>
                            updateConfig((c) => ({
                              ...c,
                              textStyle: { ...c.textStyle, animDurationMs: Number(e.target.value) },
                            }))
                          }
                          className="w-full accent-rose-700"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-slate-500">
                          Message Hold ({config.textStyle.displayDurationSec.toFixed(1)}s)
                        </span>
                        <input
                          type="range"
                          min={2.5}
                          max={12}
                          step={0.5}
                          value={config.textStyle.displayDurationSec}
                          onChange={(e) =>
                            updateConfig((c) => ({
                              ...c,
                              textStyle: { ...c.textStyle, displayDurationSec: Number(e.target.value) },
                            }))
                          }
                          className="w-full accent-rose-700"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Music & Fades */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5" />
                      <span>Soundtrack &amp; Fades</span>
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={greeting.musicConfig.enabled}
                        onChange={(e) =>
                          onUpdateGreeting((prev) => ({
                            ...prev,
                            musicConfig: { ...prev.musicConfig, enabled: e.target.checked },
                          }))
                        }
                        className="accent-rose-700 w-4 h-4"
                      />
                      <span>Include Audio</span>
                    </label>
                  </div>

                  {greeting.musicConfig.enabled && (
                    <div className="space-y-3">
                      <select
                        value={
                          greeting.musicConfig.sourceType === 'uploaded'
                            ? 'uploaded'
                            : greeting.musicConfig.trackId || 'track-birthday-musicbox'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'uploaded') return;
                          const track = LICENSED_MUSIC_LIBRARY.find((t) => t.id === val);
                          if (!track) return;
                          onUpdateGreeting((prev) => ({
                            ...prev,
                            musicConfig: {
                              ...prev.musicConfig,
                              enabled: true,
                              sourceType: 'library',
                              trackId: track.id,
                              trackTitle: track.title,
                            },
                          }));
                        }}
                        className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      >
                        {greeting.musicConfig.sourceType === 'uploaded' && (
                          <option value="uploaded">
                            Uploaded: {greeting.musicConfig.trackTitle || 'Custom Audio'}
                          </option>
                        )}
                        {LICENSED_MUSIC_LIBRARY.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title} ({t.mood})
                          </option>
                        ))}
                      </select>

                      <div className="grid grid-cols-3 gap-2">
                        <label className="block space-y-1">
                          <span className="text-slate-500">
                            Volume ({Math.round((greeting.musicConfig.volume ?? 0.65) * 100)}%)
                          </span>
                          <input
                            type="range"
                            min={0.1}
                            max={1}
                            step={0.05}
                            value={greeting.musicConfig.volume ?? 0.65}
                            onChange={(e) =>
                              onUpdateGreeting((prev) => ({
                                ...prev,
                                musicConfig: { ...prev.musicConfig, volume: Number(e.target.value) },
                              }))
                            }
                            className="w-full accent-rose-700"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-slate-500">
                            Fade In ({config.audioOptions.fadeInSec.toFixed(1)}s)
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={5}
                            step={0.5}
                            value={config.audioOptions.fadeInSec}
                            onChange={(e) =>
                              updateConfig((c) => ({
                                ...c,
                                audioOptions: { ...c.audioOptions, fadeInSec: Number(e.target.value) },
                              }))
                            }
                            className="w-full accent-rose-700"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-slate-500">
                            Fade Out ({config.audioOptions.fadeOutSec.toFixed(1)}s)
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={5}
                            step={0.5}
                            value={config.audioOptions.fadeOutSec}
                            onChange={(e) =>
                              updateConfig((c) => ({
                                ...c,
                                audioOptions: { ...c.audioOptions, fadeOutSec: Number(e.target.value) },
                              }))
                            }
                            className="w-full accent-rose-700"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB 4: EXPORT FORMAT, QUALITY & RENDER */}
            {activeTab === 'export' && (
              <div className="space-y-5 text-xs">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Video Output Settings</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      Total: {timeline.totalDurationSec.toFixed(1)}s
                    </span>
                  </div>

                  {/* Format selection */}
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        {
                          id: 'mp4',
                          title: 'MP4 (H.264 / AAC)',
                          sub: healthChecked
                            ? ffmpegAvailable
                              ? 'Server FFmpeg transcode active'
                              : 'Native MP4 or automatic WebM'
                            : 'Checking transcode server...',
                        },
                        {
                          id: 'webm',
                          title: 'WebM (VP9 / Opus)',
                          sub: '100% instant browser export',
                        },
                      ] as const
                    ).map((fmt) => {
                      const active = config.format === fmt.id;
                      return (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() =>
                            updateConfig((c) => ({ ...c, format: fmt.id as VideoExportFormat }))
                          }
                          className={`text-left rounded-xl border p-3 transition-colors ${
                            active
                              ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/25'
                              : 'border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <p className="font-semibold text-slate-900 dark:text-white">{fmt.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{fmt.sub}</p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <label className="block space-y-1">
                      <span className="text-slate-500">Aspect Ratio</span>
                      <select
                        value={config.aspectRatio}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            aspectRatio: e.target.value as VideoAspectRatio,
                          }))
                        }
                        className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      >
                        <option value="16:9">Landscape (16:9)</option>
                        <option value="9:16">Portrait (9:16)</option>
                        <option value="1:1">Square (1:1)</option>
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <span className="text-slate-500">Resolution</span>
                      <select
                        value={config.resolution}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            resolution: e.target.value as VideoResolution,
                          }))
                        }
                        className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      >
                        <option value="480p">480p (Fast)</option>
                        <option value="720p">720p HD</option>
                        <option value="1080p">1080p Full HD</option>
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <span className="text-slate-500">Frame Rate</span>
                      <select
                        value={config.fps}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            fps: Number(e.target.value) as VideoFrameRate,
                          }))
                        }
                        className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      >
                        <option value={24}>24 FPS Cinema</option>
                        <option value={30}>30 FPS Smooth</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="block space-y-1">
                      <span className="text-slate-500">Bitrate Quality</span>
                      <select
                        value={config.quality}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            quality: e.target.value as VideoQuality,
                          }))
                        }
                        className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      >
                        <option value="standard">Standard</option>
                        <option value="high">High (Recommended)</option>
                        <option value="ultra">Ultra</option>
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <span className="text-slate-500">
                        Slide Timing ({config.slideDurationSec.toFixed(1)}s)
                      </span>
                      <input
                        type="range"
                        min={2}
                        max={10}
                        step={0.5}
                        value={config.slideDurationSec}
                        onChange={(e) =>
                          updateConfig((c) => ({
                            ...c,
                            slideDurationSec: Number(e.target.value),
                            customTotalDurationSec: null,
                          }))
                        }
                        className="w-full accent-rose-700 mt-2"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-slate-500">Custom Total (sec)</span>
                      <input
                        type="number"
                        min={5}
                        max={180}
                        placeholder="Auto"
                        value={config.customTotalDurationSec ?? ''}
                        onChange={(e) => {
                          const v = e.target.value ? Math.max(5, Math.min(180, Number(e.target.value))) : null;
                          updateConfig((c) => ({ ...c, customTotalDurationSec: v }));
                        }}
                        className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent font-mono"
                      />
                    </label>
                  </div>
                </div>

                {/* Export Trigger & Progress */}
                <div className="space-y-3">
                  {!exporting ? (
                    <button
                      type="button"
                      onClick={handleStartExport}
                      className="w-full min-h-[50px] px-5 py-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-rose-900/20"
                    >
                      <Film className="w-4 h-4" />
                      <span>
                        Generate &amp; Export {config.format === 'mp4' && ffmpegAvailable ? 'MP4' : config.format === 'webm' ? 'WebM' : 'Video'}
                      </span>
                    </button>
                  ) : (
                    <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span>{exportProgress?.message || 'Rendering video...'}</span>
                        <span className="font-mono tabular-nums">{exportProgress?.percent || 0}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-rose-700 transition-all duration-150"
                          style={{ width: `${exportProgress?.percent || 0}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-mono tabular-nums">
                          Elapsed: {((exportProgress?.elapsedMs || 0) / 1000).toFixed(1)}s
                          {exportProgress?.estimatedRemainingMs != null &&
                            ` · Est. left: ${(exportProgress.estimatedRemainingMs / 1000).toFixed(0)}s`}
                        </span>
                        <button
                          type="button"
                          onClick={handleCancelExport}
                          className="min-h-[34px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-white dark:hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {exportError && (
                    <div className="rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3.5 text-xs text-rose-800 dark:text-rose-200 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{exportError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleStartExport}
                        className="min-h-[36px] px-3 rounded-lg bg-rose-700 text-white text-xs font-medium inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry Export</span>
                      </button>
                    </div>
                  )}

                  {/* Rendered Playable Video Result */}
                  {exportedResult && (
                    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-xs">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            Verified {exportedResult.format.toUpperCase()} Ready (
                            {(exportedResult.sizeBytes / (1024 * 1024)).toFixed(2)} MB)
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">
                          {exportedResult.width}×{exportedResult.height}
                        </span>
                      </div>

                      <video
                        controls
                        playsInline
                        src={exportedResult.url}
                        className="w-full max-h-56 rounded-xl bg-black border border-slate-800"
                      />

                      {exportedResult.warnings.length > 0 && (
                        <div className="text-[11px] text-amber-700 dark:text-amber-300 space-y-0.5">
                          {exportedResult.warnings.map((w, i) => (
                            <p key={i}>• {w}</p>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <a
                          href={exportedResult.url}
                          download={exportedResult.fileName}
                          className="min-h-[44px] px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download Video</span>
                        </a>

                        <button
                          type="button"
                          disabled={attaching}
                          onClick={handleAttachVideoToCard}
                          className="min-h-[44px] px-4 rounded-xl border border-rose-600 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <UploadCloud className="w-4 h-4" />
                          <span>{attaching ? 'Uploading...' : 'Attach to Card'}</span>
                        </button>
                      </div>

                      {attachSuccess && (
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                          {attachSuccess}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
