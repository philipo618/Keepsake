export type ThemeMode = 'light' | 'dark';

export type AnimationEffectId =
  | 'falling-flowers'
  | 'floating-hearts'
  | 'confetti'
  | 'balloons'
  | 'fireworks'
  | 'glowing-particles'
  | 'sparkles'
  | 'butterflies'
  | 'floating-photos'
  | 'gift-box'
  | 'opening-envelope'
  | 'animated-cake'
  | 'candle-effects'
  | 'romantic-transitions'
  | 'elegant-text-reveal'
  | 'card-3d-open';

export type PhotoSourceType = 'uploaded' | 'licensed-stock' | 'external-url';
export type PhotoTransitionType =
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'ken-burns'
  | 'flip-3d'
  | 'card-reveal-3d'
  | 'crossfade'
  | 'blur-reveal'
  | 'circular-reveal'
  | 'rotate-reveal'
  | 'dissolve'
  | 'polaroid-reveal'
  | 'stacked-photo'
  | 'filmstrip'
  | 'parallax'
  | 'soft-light'
  | 'split-screen'
  | 'film-burn'
  | 'light-sweep'
  | 'geometric-reveal'
  | 'layered-reveal'
  | 'camera-pan'
  // Legacy aliases retained for existing saved Firestore cards
  | 'slide'
  | 'zoom'
  | 'polaroid-float';

export type PhotoLayoutType = 'slideshow' | 'gallery' | 'floating-frames' | 'polaroid-stack';
export type PresentationMode = 'interactive-card' | 'fullscreen-slideshow' | 'cinematic-story';
export type ExperienceStepKey =
  | 'gift-box'
  | 'greeting-title'
  | 'photo-showcase'
  | 'main-message'
  | 'extra-notes'
  | 'closing-signature';

export type SlideshowStyleId =
  | 'cinematic-memories'
  | 'romantic-memories'
  | 'birthday-celebration'
  | 'elegant-gallery'
  | 'film-memories'
  | 'modern-dynamic'
  | 'photo-album'
  | 'luxury-presentation'
  | 'emotional-storytelling'
  | 'classic-slideshow';

export type PhotoPresentationLayout =
  | 'fullscreen'
  | 'framed'
  | 'polaroid'
  | 'two-photo'
  | 'collage'
  | 'stacked'
  | 'side-by-side'
  | 'filmstrip'
  | 'animated-card';

export type TextAnimationStyle =
  | 'fade-in'
  | 'typewriter'
  | 'smooth-slide'
  | 'zoom-reveal'
  | 'handwriting'
  | 'floating'
  | 'letter-by-letter'
  | 'cinematic-title'
  | 'glow-reveal'
  | 'soft-blur';

export type VideoAspectRatio = '16:9' | '9:16' | '1:1';
export type VideoResolution = '480p' | '720p' | '1080p';
export type VideoFrameRate = 24 | 30;
export type VideoQuality = 'standard' | 'high' | 'ultra';
export type VideoExportFormat = 'mp4' | 'webm';

export interface VideoStudioConfig {
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
  fps: VideoFrameRate;
  quality: VideoQuality;
  format: VideoExportFormat;
  slideshowStyle: SlideshowStyleId;
  photoPresentation: PhotoPresentationLayout;
  slideDurationSec: number;
  customTotalDurationSec?: number | null;
  photoFrame: {
    blurBackdrop: boolean;
    borderStyle: 'none' | 'thin' | 'double' | 'gold' | 'polaroid';
    shadowIntensity: 'none' | 'soft' | 'dramatic';
    borderRadius: number;
    spacing: number;
    backgroundColorOverride?: string;
  };
  textStyle: {
    animation: TextAnimationStyle;
    animDurationMs: number;
    displayDurationSec: number;
    fontSizeScale: 'compact' | 'standard' | 'large';
    color?: string;
    align: 'left' | 'center';
    position: 'top' | 'center' | 'bottom';
  };
  openingScene: {
    enabled: boolean;
    title: string;
    subtitle: string;
    durationSec: number;
    showIntroPhoto: boolean;
  };
  closingScene: {
    enabled: boolean;
    title: string;
    message: string;
    signature: string;
    durationSec: number;
  };
  audioOptions: {
    fadeInSec: number;
    fadeOutSec: number;
  };
}

export interface ExportedVideoAttachment {
  url: string;
  format: VideoExportFormat;
  fileName: string;
  durationSec: number;
  width: number;
  height: number;
  sizeBytes: number;
  attachedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl?: string;
  accentColor?: string;
  sortOrder: number;
  enabled: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TemplateColorScheme {
  background: string;
  surface: string;
  text: string;
  accent: string;
  muted: string;
}

export interface Template {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  previewImageUrl?: string;
  animationStyle: AnimationEffectId;
  colorScheme: TemplateColorScheme;
  fontPair: 'editorial' | 'classic' | 'modern' | 'script';
  backgroundStyle: string;
  musicTrackId?: string;
  layoutPreset: PhotoLayoutType;
  enabled: boolean;
  featured: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MediaAsset {
  id: string;
  type: 'music' | 'image' | 'sticker';
  title: string;
  url: string;
  license: string;
  attribution?: string;
  category?: string;
  enabled: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PlatformSettings {
  id: string;
  siteName: string;
  tagline?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  defaultTheme: ThemeMode;
  maxPhotosPerCard: number;
  maxUploadSizeMb: number;
  allowGuestCreation: boolean;
  sharingEnabled: boolean;
  updatedAt?: unknown;
}

export interface PhotoItem {
  id: string;
  url: string;
  caption?: string;
  sourceType: PhotoSourceType;
  license?: string;
  attribution?: string;
  isCover?: boolean;
  cropPosition: {
    x: number;
    y: number;
    zoom: number;
  };
  transition: PhotoTransitionType;
}

export interface MusicConfig {
  enabled: boolean;
  trackId?: string;
  trackTitle?: string;
  sourceType: 'library' | 'uploaded' | 'none';
  audioUrl?: string;
  volume: number;
  startTiming: 'on-gift-open' | 'after-intro' | 'manual';
  soundEffectsEnabled: boolean;
  momentMood?: 'celebration' | 'romantic' | 'reflective' | 'festive';
}

export interface StickerPlacement {
  id: string;
  label: string;
  symbol: string;
  x: number;
  y: number;
  scale: number;
}

export interface DesignConfig {
  backgroundType: 'solid' | 'gradient' | 'image';
  backgroundColor: string;
  gradientCss: string;
  backgroundImageUrl?: string;
  surfaceColor: string;
  textColor: string;
  accentColor: string;
  fontPair: 'editorial' | 'classic' | 'modern' | 'script';
  fontSizeScale: 'compact' | 'standard' | 'large';
  textAlign: 'left' | 'center';
  textPosition: 'top' | 'center' | 'bottom';
  photoLayout: PhotoLayoutType;
  presentationMode: PresentationMode;
  defaultPhotoTransition?: PhotoTransitionType;
  transitionDurationMs?: number;
  slideshowIntervalMs?: number;
  stickers: StickerPlacement[];
  sequenceOrder: ExperienceStepKey[];
  animationIntensity: 'gentle' | 'balanced' | 'festive';
  videoConfig?: VideoStudioConfig;
}

export interface CustomQuestionPrompt {
  id: string;
  question: string;
  enabled: boolean;
  hint?: string;
}

export interface VerificationMeta {
  enableBirthdayDay: boolean;
  enableBirthdayMonth: boolean;
  enableBirthdayYear: boolean;
  customQuestions: CustomQuestionPrompt[];
  maxRetries: number; // 0 = unlimited
  friendlyErrorMessage: string;
}

export interface VerificationSecretsInput {
  birthDay?: number | null;
  birthMonth?: number | null;
  birthYear?: number | null;
  customAnswers: Array<{ id: string; answer: string }>;
}

export interface Greeting {
  id: string;
  creatorId: string;
  categoryId: string;
  templateId?: string;
  recipientName: string;
  senderName: string;
  title: string;
  mainMessage: string;
  additionalMessages: string[];
  cardDate?: string;
  signature?: string;
  designConfig: DesignConfig;
  photos: PhotoItem[];
  musicConfig: MusicConfig;
  animations: AnimationEffectId[];
  accessMode: 'direct' | 'interactive';
  verificationMeta: VerificationMeta;
  status: 'draft' | 'published' | 'unpublished';
  exportedVideo?: ExportedVideoAttachment | null;
  isReported?: boolean;
  viewCount?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CreatorUser {
  uid: string;
  displayName: string;
  photoURL?: string;
  isAnonymous?: boolean;
  greetingsCount: number;
  storageUsedBytes: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminUser {
  uid: string;
  email: string;
  displayName?: string;
  role: 'super_admin' | 'moderator';
  createdAt?: unknown;
}

export interface ActivityLog {
  id: string;
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: string;
  createdAt?: unknown;
}
