import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Gift,
  Heart,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AnimationCanvas, triggerConfettiCelebration } from './AnimationCanvas';
import { audioEngine } from '../lib/audioEngine';
import { resolvePhotoTransition } from '../lib/catalog';
import type {
  ExperienceStepKey,
  Greeting,
  PhotoItem,
  PresentationMode,
} from '../lib/types';

export function GreetingExperience({
  greeting,
  isPreview = false,
  autoOpened = false,
  onReport,
}: {
  greeting: Greeting;
  isPreview?: boolean;
  autoOpened?: boolean;
  onReport?: () => void;
}) {
  const [opened, setOpened] = useState(autoOpened);
  const [openingAnim, setOpeningAnim] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [prevSlideIndex, setPrevSlideIndex] = useState<number | null>(null);
  const prevSlideRef = useRef(0);
  const [candlesLit, setCandlesLit] = useState(true);
  const [viewMode, setViewMode] = useState<PresentationMode>(
    greeting.designConfig.presentationMode || 'interactive-card'
  );
  const [storyStep, setStoryStep] = useState(0);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  useEffect(() => {
    setViewMode(greeting.designConfig.presentationMode || 'interactive-card');
  }, [greeting.designConfig.presentationMode]);

  useEffect(() => {
    return () => {
      if (!isPreview) {
        audioEngine.stop();
      }
    };
  }, [isPreview]);

  const photos = useMemo(() => {
    const list = greeting.photos || [];
    const cover = list.find((p) => p.isCover);
    if (!cover) return list;
    return [cover, ...list.filter((p) => p.id !== cover.id)];
  }, [greeting.photos]);

  const goToSlide = (computeNext: (curr: number) => number) => {
    setSlideIndex((curr) => {
      const next = photos.length > 0 ? computeNext(curr) % photos.length : 0;
      const safeNext = next < 0 ? (next + photos.length) % photos.length : next;
      if (safeNext !== curr) {
        prevSlideRef.current = curr;
        setPrevSlideIndex(curr);
      }
      return safeNext;
    });
  };

  const slideshowIntervalMs = Math.min(
    12000,
    Math.max(2000, greeting.designConfig.slideshowIntervalMs || 4500)
  );
  const transitionDurationMs = Math.min(
    2500,
    Math.max(250, greeting.designConfig.transitionDurationMs || 750)
  );

  useEffect(() => {
    if (!opened || photos.length <= 1) return;
    if (viewMode === 'fullscreen-slideshow' || greeting.designConfig.photoLayout === 'slideshow') {
      const timer = window.setInterval(() => {
        setSlideIndex((prev) => {
          prevSlideRef.current = prev;
          setPrevSlideIndex(prev);
          return (prev + 1) % photos.length;
        });
      }, slideshowIntervalMs);
      return () => window.clearInterval(timer);
    }
  }, [opened, photos.length, viewMode, greeting.designConfig.photoLayout, slideshowIntervalMs]);

  const startConfiguredMusic = async () => {
    if (!greeting.musicConfig?.enabled) return;
    const vol = muted ? 0 : greeting.musicConfig.volume ?? 0.65;
    if (greeting.musicConfig.sourceType === 'uploaded' && greeting.musicConfig.audioUrl) {
      const ok = await audioEngine.playAudioUrl(greeting.musicConfig.audioUrl, vol);
      setMusicPlaying(ok);
    } else if (greeting.musicConfig.trackId) {
      audioEngine.playSynthTrack(greeting.musicConfig.trackId, vol);
      setMusicPlaying(true);
    }
  };

  const handleOpenGift = () => {
    if (openingAnim) return;
    setOpeningAnim(true);
    if (greeting.musicConfig?.soundEffectsEnabled !== false) {
      audioEngine.playSfx('unwrap');
    }
    if (greeting.animations.includes('confetti') || greeting.animations.includes('fireworks')) {
      triggerConfettiCelebration(greeting.designConfig.accentColor);
    }
    if (greeting.musicConfig?.enabled && greeting.musicConfig.startTiming !== 'manual') {
      if (greeting.musicConfig.startTiming === 'after-intro') {
        window.setTimeout(() => {
          startConfiguredMusic();
        }, 900);
      } else {
        startConfiguredMusic();
      }
    }
    window.setTimeout(() => {
      setOpened(true);
      setOpeningAnim(false);
    }, 650);
  };

  const handleReplay = () => {
    audioEngine.stop();
    setMusicPlaying(false);
    setOpened(false);
    setSlideIndex(0);
    setPrevSlideIndex(null);
    setStoryStep(0);
    setCandlesLit(true);
  };

  const toggleMusic = () => {
    if (musicPlaying) {
      audioEngine.stop();
      setMusicPlaying(false);
    } else {
      startConfiguredMusic();
    }
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    audioEngine.setVolume(nextMuted ? 0 : greeting.musicConfig.volume ?? 0.65);
  };

  const design = greeting.designConfig;
  const fontClass =
    design.fontPair === 'classic'
      ? 'font-classic'
      : design.fontPair === 'script'
      ? 'font-script'
      : design.fontPair === 'modern'
      ? 'font-sans'
      : 'font-display';

  const bodySizeClass =
    design.fontSizeScale === 'compact'
      ? 'text-sm sm:text-base'
      : design.fontSizeScale === 'large'
      ? 'text-lg sm:text-xl'
      : 'text-base sm:text-lg';

  const alignClass = design.textAlign === 'left' ? 'text-left items-start' : 'text-center items-center';

  const bgStyle: React.CSSProperties =
    design.backgroundType === 'image' && design.backgroundImageUrl
      ? {
          backgroundImage: `linear-gradient(rgba(10,14,22,0.55), rgba(10,14,22,0.65)), url(${design.backgroundImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : design.backgroundType === 'solid'
      ? { backgroundColor: design.backgroundColor }
      : { background: design.gradientCss || design.backgroundColor };

  const openerType = greeting.animations.includes('opening-envelope')
    ? 'envelope'
    : greeting.animations.includes('card-3d-open')
    ? 'card3d'
    : 'giftbox';

  const hasCake =
    greeting.animations.includes('animated-cake') ||
    greeting.animations.includes('candle-effects');

  const getTransitionClass = (photo: PhotoItem) => {
    const tx = resolvePhotoTransition(photo.transition || design.defaultPhotoTransition);
    return `photo-tx-${tx}`;
  };

  const renderPhotoCard = (
    photo: PhotoItem,
    idx: number,
    extraClass = '',
    underlayPhoto?: PhotoItem | null,
    keySuffix = ''
  ) => {
    const isBroken = brokenImages[photo.id];
    const txClass = getTransitionClass(photo);
    const txStyle = {
      ['--photo-tx-duration' as string]: `${transitionDurationMs}ms`,
    } as React.CSSProperties;

    return (
      <div className="photo-tx-stage w-full">
        <figure
          key={`${photo.id || idx}-${keySuffix}`}
          className={`overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-white/10 backdrop-blur-sm ${txClass} ${extraClass}`}
          style={txStyle}
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-200/40 dark:bg-slate-800/40">
            {underlayPhoto && underlayPhoto.id !== photo.id && underlayPhoto.url && !brokenImages[underlayPhoto.id] && (
              <img
                src={underlayPhoto.url}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none"
                style={{
                  objectPosition: `${underlayPhoto.cropPosition?.x ?? 50}% ${underlayPhoto.cropPosition?.y ?? 50}%`,
                }}
              />
            )}
            {!isBroken && photo.url ? (
              <img
                src={photo.url}
                alt={photo.caption || `Memory ${idx + 1}`}
                referrerPolicy="no-referrer"
                loading="lazy"
                onError={() => setBrokenImages((prev) => ({ ...prev, [photo.id]: true }))}
                className="relative z-10 w-full h-full object-cover"
                style={{
                  objectPosition: `${photo.cropPosition?.x ?? 50}% ${photo.cropPosition?.y ?? 50}%`,
                  transform: `scale(${photo.cropPosition?.zoom ?? 1})`,
                }}
              />
            ) : (
              <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4 text-center opacity-70">
                <ImageIcon className="w-8 h-8 mb-2" />
                <span className="text-xs">{photo.caption || 'Memory Photo'}</span>
              </div>
            )}
          </div>
          {(photo.caption || photo.attribution) && (
            <figcaption className="px-3 py-2 text-xs opacity-85 flex items-center justify-between gap-2">
              <span className="truncate">{photo.caption || ''}</span>
              {photo.sourceType !== 'uploaded' && photo.attribution && (
                <span className="opacity-65 shrink-0 text-[11px]">{photo.attribution}</span>
              )}
            </figcaption>
          )}
        </figure>
      </div>
    );
  };

  const renderSection = (step: ExperienceStepKey) => {
    switch (step) {
      case 'gift-box':
        return null;
      case 'greeting-title':
        return (
          <div key="greeting-title" className={`flex flex-col ${alignClass} space-y-3 animate-reveal-up`}>
            <p className="text-xs uppercase tracking-[0.2em] font-medium opacity-75">
              For {greeting.recipientName}
            </p>
            <h1
              className={`${fontClass} text-3xl sm:text-5xl font-semibold leading-tight text-balance`}
              style={{ color: design.textColor }}
            >
              {greeting.title}
            </h1>
            {hasCake && (
              <div className="pt-3 flex flex-col items-center">
                <div className="relative inline-flex flex-col items-center">
                  {/* Candles */}
                  <div className="flex items-end gap-3 mb-0.5">
                    {[0, 1, 2].map((c) => (
                      <div key={c} className="flex flex-col items-center">
                        {candlesLit ? (
                          <div className="w-2.5 h-4 rounded-full bg-amber-300 shadow-[0_0_12px_#F59E0B] animate-candle-flicker mb-0.5" />
                        ) : (
                          <div className="w-1 h-2 bg-slate-400/50 rounded-full mb-1" />
                        )}
                        <div className="w-2 h-6 rounded-sm bg-rose-200 border border-rose-300/60" />
                      </div>
                    ))}
                  </div>
                  {/* Cake tier */}
                  <div
                    className="w-32 h-10 rounded-t-xl border border-white/25 shadow-sm flex items-center justify-center text-[11px] font-medium"
                    style={{ backgroundColor: design.accentColor, color: '#FFFFFF' }}
                  >
                    Make a Wish
                  </div>
                  <div className="w-36 h-3 rounded-b-lg bg-white/80 dark:bg-slate-200/80" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCandlesLit((prev) => !prev);
                    if (candlesLit && greeting.musicConfig?.soundEffectsEnabled !== false) {
                      audioEngine.playSfx('confetti');
                      triggerConfettiCelebration(design.accentColor);
                    }
                  }}
                  className="mt-2 min-h-[36px] px-3 py-1 rounded-lg border border-current/20 text-xs font-medium hover:bg-white/10 transition-colors"
                >
                  {candlesLit ? 'Tap to Blow Out Candles' : 'Relight Candles'}
                </button>
              </div>
            )}
          </div>
        );

      case 'photo-showcase':
        if (photos.length === 0) return null;
        return (
          <div key="photo-showcase" className="w-full space-y-3 animate-reveal-up">
            {design.photoLayout === 'slideshow' || photos.length === 1 ? (
              <div className="relative max-w-xl mx-auto">
                {renderPhotoCard(
                  photos[slideIndex % photos.length],
                  slideIndex,
                  '',
                  prevSlideIndex !== null ? photos[prevSlideIndex % photos.length] : null,
                  `slide-${slideIndex}`
                )}
                {photos.length > 1 && (
                  <div className="mt-3 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => goToSlide((prev) => prev - 1)}
                      className="min-h-[44px] min-w-[44px] rounded-full border border-current/20 flex items-center justify-center hover:bg-white/10"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono tabular-nums opacity-75">
                      {(slideIndex % photos.length) + 1} / {photos.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => goToSlide((prev) => prev + 1)}
                      className="min-h-[44px] min-w-[44px] rounded-full border border-current/20 flex items-center justify-center hover:bg-white/10"
                      aria-label="Next photo"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : design.photoLayout === 'polaroid-stack' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {photos.map((photo, idx) => (
                  <div
                    key={photo.id || idx}
                    className={`p-2.5 pb-4 rounded-lg bg-white text-slate-900 shadow-md ${
                      idx % 2 === 0 ? '-rotate-1' : 'rotate-1'
                    }`}
                  >
                    {renderPhotoCard(photo, idx, 'border-0')}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {photos.map((photo, idx) =>
                  renderPhotoCard(
                    photo,
                    idx,
                    design.photoLayout === 'floating-frames' ? 'animate-float-slow' : ''
                  )
                )}
              </div>
            )}
          </div>
        );

      case 'main-message':
        return (
          <div key="main-message" className={`flex flex-col ${alignClass} animate-reveal-up`}>
            <p className={`${bodySizeClass} leading-relaxed whitespace-pre-line max-w-2xl`}>
              {greeting.mainMessage}
            </p>
          </div>
        );

      case 'extra-notes':
        if (!greeting.additionalMessages || greeting.additionalMessages.length === 0) return null;
        return (
          <div key="extra-notes" className="w-full max-w-xl mx-auto space-y-3 animate-reveal-up">
            {greeting.additionalMessages.map((note, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-current/15 bg-white/10 dark:bg-black/15 px-5 py-4 text-sm sm:text-base leading-relaxed"
              >
                {note}
              </div>
            ))}
          </div>
        );

      case 'closing-signature':
        return (
          <div
            key="closing-signature"
            className={`pt-4 border-t border-current/15 flex flex-col ${alignClass} gap-1 animate-reveal-up`}
          >
            <p className={`${fontClass} text-xl font-medium`} style={{ color: design.accentColor }}>
              {greeting.signature || `With love, ${greeting.senderName}`}
            </p>
            <p className="text-xs opacity-75">
              From {greeting.senderName}
              {greeting.cardDate ? ` · ${greeting.cardDate}` : ''}
            </p>
          </div>
        );
    }
  };

  const orderedSections = (design.sequenceOrder || [
    'gift-box',
    'greeting-title',
    'photo-showcase',
    'main-message',
    'extra-notes',
    'closing-signature',
  ]).filter((s) => s !== 'gift-box');

  const visibleStorySections = orderedSections.filter((step) => {
    if (step === 'photo-showcase' && photos.length === 0) return false;
    if (step === 'extra-notes' && (!greeting.additionalMessages || greeting.additionalMessages.length === 0)) return false;
    return true;
  });

  const activeFullscreenPhoto = photos.length > 0 ? photos[slideIndex % photos.length] : null;
  const activeFullscreenTxClass = activeFullscreenPhoto ? getTransitionClass(activeFullscreenPhoto) : 'photo-tx-fade';

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/80 ${
        isPreview ? 'min-h-[540px]' : 'min-h-[calc(100vh-4rem)]'
      } flex flex-col justify-between`}
      style={{ ...bgStyle, color: design.textColor }}
    >
      <AnimationCanvas
        effects={opened ? greeting.animations : greeting.animations.filter((e) => e === 'sparkles' || e === 'glowing-particles')}
        intensity={design.animationIntensity}
        accentColor={design.accentColor}
        active={true}
      />

      {/* Decorative Stickers Layer */}
      {opened && design.stickers && design.stickers.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
          {design.stickers.map((s) => (
            <span
              key={s.id}
              className="absolute select-none opacity-80"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                fontSize: `${Math.round(24 * (s.scale || 1))}px`,
                color: design.accentColor,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {s.symbol}
            </span>
          ))}
        </div>
      )}

      {/* Top Controls Bar inside experience */}
      <div className="relative z-20 flex items-center justify-between gap-3 px-4 sm:px-6 pt-4">
        <span className="text-xs font-medium opacity-75 truncate">
          {greeting.senderName} → {greeting.recipientName}
        </span>

        <div className="flex items-center gap-2 shrink-0">
          {opened && greeting.musicConfig?.enabled && (
            <>
              <button
                type="button"
                onClick={toggleMusic}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-xs font-medium flex items-center gap-1.5 backdrop-blur-sm"
              >
                {musicPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{musicPlaying ? 'Pause Music' : 'Play Music'}</span>
              </button>
              <button
                type="button"
                onClick={toggleMute}
                className="min-h-[38px] min-w-[38px] rounded-lg bg-black/20 hover:bg-black/30 flex items-center justify-center backdrop-blur-sm"
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </>
          )}

          {opened && photos.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setViewMode((m) =>
                  m === 'fullscreen-slideshow' ? 'interactive-card' : 'fullscreen-slideshow'
                )
              }
              className="min-h-[38px] min-w-[38px] rounded-lg bg-black/20 hover:bg-black/30 flex items-center justify-center backdrop-blur-sm"
              aria-label="Toggle slideshow mode"
            >
              {viewMode === 'fullscreen-slideshow' ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          )}

          {opened && greeting.exportedVideo?.url && (
            <button
              type="button"
              onClick={() => {
                if (musicPlaying) {
                  audioEngine.stop();
                  setMusicPlaying(false);
                }
                setVideoModalOpen(true);
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm"
            >
              <Film className="w-3.5 h-3.5" />
              <span>Play Video</span>
            </button>
          )}

          {opened && (
            <button
              type="button"
              onClick={handleReplay}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-xs font-medium flex items-center gap-1.5 backdrop-blur-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Replay</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Stage */}
      <div className="relative z-20 flex-1 flex items-center justify-center px-4 sm:px-8 py-8">
        {!opened ? (
          <div className="max-w-md w-full text-center space-y-6">
            <div
              onClick={handleOpenGift}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleOpenGift();
              }}
              className={`mx-auto cursor-pointer select-none transition-all duration-500 ${
                openingAnim ? 'scale-110 opacity-0' : 'hover:scale-[1.03]'
              }`}
            >
              {openerType === 'envelope' ? (
                <div className="relative mx-auto w-64 h-44 rounded-xl shadow-2xl border border-white/25 flex flex-col items-center justify-center p-6" style={{ backgroundColor: design.surfaceColor, color: design.textColor }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-md mb-3" style={{ backgroundColor: design.accentColor, color: '#FFFFFF' }}>
                    <Heart className="w-5 h-5" />
                  </div>
                  <p className={`${fontClass} text-lg font-medium`}>For {greeting.recipientName}</p>
                  <p className="text-xs opacity-70 mt-1">Sealed by {greeting.senderName}</p>
                </div>
              ) : openerType === 'card3d' ? (
                <div className="relative mx-auto w-56 h-72 rounded-xl shadow-2xl border border-white/25 flex flex-col items-center justify-center p-6" style={{ backgroundColor: design.surfaceColor, color: design.textColor }}>
                  <p className="text-[11px] uppercase tracking-[0.2em] opacity-65 mb-2">Keepsake</p>
                  <p className={`${fontClass} text-2xl font-semibold text-balance`}>{greeting.title}</p>
                  <div className="w-10 h-0.5 my-4 opacity-40" style={{ backgroundColor: design.accentColor }} />
                  <p className="text-xs opacity-75">For {greeting.recipientName}</p>
                </div>
              ) : (
                <div className="relative mx-auto w-56 h-56 flex flex-col items-center justify-center">
                  <div
                    className="w-44 h-10 rounded-t-lg shadow-md border-b border-black/15 flex items-center justify-center"
                    style={{ backgroundColor: design.accentColor }}
                  >
                    <div className="w-10 h-10 bg-amber-300/90 rounded-sm shadow-inner" />
                  </div>
                  <div
                    className="w-40 h-32 rounded-b-xl shadow-2xl flex flex-col items-center justify-center p-4 relative overflow-hidden"
                    style={{ backgroundColor: design.surfaceColor, color: design.textColor }}
                  >
                    <div className="absolute inset-y-0 w-7 bg-amber-300/85" />
                    <Gift className="relative z-10 w-8 h-8 mb-2" style={{ color: design.accentColor }} />
                    <span className="relative z-10 text-xs font-semibold px-2 py-0.5 rounded bg-white/80 text-slate-900">
                      For {greeting.recipientName}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm opacity-85">
                {greeting.senderName} prepared a personal keepsake for you.
              </p>
              <button
                type="button"
                onClick={handleOpenGift}
                className="min-h-[48px] px-7 py-3 rounded-xl font-medium text-sm text-white shadow-lg transition-transform active:scale-[0.98]"
                style={{ backgroundColor: design.accentColor }}
              >
                Open Your Gift
              </button>
              {greeting.musicConfig?.enabled && (
                <p className="text-xs opacity-70">
                  Tap above to unwrap animations and start background music.
                </p>
              )}
            </div>
          </div>
        ) : viewMode === 'fullscreen-slideshow' && activeFullscreenPhoto ? (
          <div className="w-full max-w-4xl mx-auto space-y-6 text-center photo-tx-stage">
            <div
              key={`fs-${activeFullscreenPhoto.id}-${slideIndex}`}
              className={`relative aspect-[16/10] w-full rounded-2xl overflow-hidden shadow-2xl border border-white/15 ${activeFullscreenTxClass}`}
              style={{ ['--photo-tx-duration' as string]: `${transitionDurationMs}ms` }}
            >
              <img
                src={activeFullscreenPhoto.url}
                alt={activeFullscreenPhoto.caption || greeting.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                style={{
                  objectPosition: `${activeFullscreenPhoto.cropPosition?.x ?? 50}% ${activeFullscreenPhoto.cropPosition?.y ?? 50}%`,
                  transform: `scale(${activeFullscreenPhoto.cropPosition?.zoom ?? 1})`,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex flex-col justify-end p-6 sm:p-8 text-left text-white">
                <h2 className={`${fontClass} text-2xl sm:text-4xl font-semibold`}>
                  {greeting.title}
                </h2>
                <p className="mt-2 text-sm sm:text-base text-white/90 max-w-2xl line-clamp-3">
                  {activeFullscreenPhoto.caption || greeting.mainMessage}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => goToSlide((prev) => prev - 1)}
                className="min-h-[44px] px-4 rounded-xl bg-black/25 hover:bg-black/35 text-sm font-medium"
              >
                Previous
              </button>
              <span className="text-xs font-mono tabular-nums">
                {(slideIndex % photos.length) + 1} / {photos.length}
              </span>
              <button
                type="button"
                onClick={() => goToSlide((prev) => prev + 1)}
                className="min-h-[44px] px-4 rounded-xl bg-black/25 hover:bg-black/35 text-sm font-medium"
              >
                Next
              </button>
            </div>
          </div>
        ) : viewMode === 'cinematic-story' ? (
          <div className="w-full max-w-2xl mx-auto rounded-2xl p-6 sm:p-10 shadow-xl border border-white/15 backdrop-blur-md space-y-6" style={{ backgroundColor: design.surfaceColor, color: design.textColor }}>
            {renderSection(visibleStorySections[storyStep % visibleStorySections.length])}
            <div className="pt-4 flex items-center justify-between border-t border-current/15">
              <button
                type="button"
                disabled={storyStep === 0}
                onClick={() => setStoryStep((s) => Math.max(0, s - 1))}
                className="min-h-[44px] px-4 rounded-lg border border-current/20 text-xs font-medium disabled:opacity-35"
              >
                Previous
              </button>
              <span className="text-xs font-mono tabular-nums opacity-70">
                {storyStep + 1} / {visibleStorySections.length}
              </span>
              <button
                type="button"
                disabled={storyStep >= visibleStorySections.length - 1}
                onClick={() => setStoryStep((s) => Math.min(visibleStorySections.length - 1, s + 1))}
                className="min-h-[44px] px-4 rounded-lg text-white text-xs font-medium disabled:opacity-35"
                style={{ backgroundColor: design.accentColor }}
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div
            className="w-full max-w-3xl mx-auto rounded-2xl p-6 sm:p-10 shadow-2xl border border-white/15 space-y-7"
            style={{ backgroundColor: design.surfaceColor, color: design.textColor }}
          >
            {orderedSections.map((step) => renderSection(step))}
          </div>
        )}
      </div>

      {/* Bottom Meta Bar */}
      <div className="relative z-20 px-4 sm:px-6 pb-4 flex flex-wrap items-center justify-between gap-2 text-xs opacity-75">
        <span>Keepsake Digital Gift</span>
        <div className="flex items-center gap-3">
          {opened && greeting.exportedVideo?.url && (
            <a
              href={greeting.exportedVideo.url}
              download={greeting.exportedVideo.fileName || 'Keepsake_Memory.mp4'}
              className="hover:underline min-h-[36px] px-2 inline-flex items-center gap-1 font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Video</span>
            </a>
          )}
          {!isPreview && onReport && (
            <button type="button" onClick={onReport} className="hover:underline min-h-[36px] px-2">
              Report Card
            </button>
          )}
        </div>
      </div>

      {/* Optional Video Playback Modal for Recipients */}
      {videoModalOpen && greeting.exportedVideo?.url && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#0B0F17] text-white overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-base font-semibold truncate">{greeting.title}</p>
                <p className="text-[11px] text-slate-400">
                  Video Keepsake · {greeting.exportedVideo.width}×{greeting.exportedVideo.height}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={greeting.exportedVideo.url}
                  download={greeting.exportedVideo.fileName || 'Keepsake_Memory.mp4'}
                  className="min-h-[40px] px-3.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setVideoModalOpen(false)}
                  aria-label="Close video player"
                  className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-700 hover:bg-slate-800 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-3 sm:p-4 bg-black">
              <video
                controls
                autoPlay
                playsInline
                src={greeting.exportedVideo.url}
                className="w-full max-h-[70vh] rounded-xl mx-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
