import { STUDIO_ASSETS } from './assets';
import type {
  AnimationEffectId,
  Category,
  DesignConfig,
  ExperienceStepKey,
  Greeting,
  PhotoPresentationLayout,
  PhotoTransitionType,
  PlatformSettings,
  SlideshowStyleId,
  Template,
  TextAnimationStyle,
  VideoStudioConfig,
} from './types';

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  id: 'global',
  siteName: 'Keepsake',
  tagline: 'Interactive Digital Stationery & Gift Experiences',
  heroTitle: 'Craft memorable digital gifts worth unwrapping.',
  heroSubtitle:
    'Design personalized animated greeting cards with curated photography, musical accompaniment, and interactive birthday or memory gates.',
  defaultTheme: 'light',
  maxPhotosPerCard: 12,
  maxUploadSizeMb: 10,
  allowGuestCreation: true,
  sharingEnabled: true,
};

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'birthday',
    name: 'Birthday Cards',
    slug: 'birthday',
    description: 'Milestone celebrations with candles, confetti, and optional birthday verification gates.',
    imageUrl: STUDIO_ASSETS.birthday,
    accentColor: '#BE123C',
    sortOrder: 1,
    enabled: true,
  },
  {
    id: 'wedding',
    name: 'Wedding Congratulations',
    slug: 'wedding',
    description: 'Heirloom-inspired stationery suites, pressed florals, and timeless blessings.',
    imageUrl: STUDIO_ASSETS.wedding,
    accentColor: '#9F1239',
    sortOrder: 2,
    enabled: true,
  },
  {
    id: 'anniversary',
    name: 'Anniversary Cards',
    slug: 'anniversary',
    description: 'Commemorate shared years with multi-photo slideshows and memory questions.',
    imageUrl: STUDIO_ASSETS.floral,
    accentColor: '#B45309',
    sortOrder: 3,
    enabled: true,
  },
  {
    id: 'romantic-love',
    name: 'Romantic Love Cards',
    slug: 'romantic-love',
    description: 'Intimate letters paired with wax-sealed envelopes and acoustic melodies.',
    imageUrl: STUDIO_ASSETS.wedding,
    accentColor: '#E11D48',
    sortOrder: 4,
    enabled: true,
  },
  {
    id: 'graduation',
    name: 'Graduation Cards',
    slug: 'graduation',
    description: 'Celebrate academic milestones with firework bursts and proud personal notes.',
    imageUrl: STUDIO_ASSETS.heroGift,
    accentColor: '#1D4ED8',
    sortOrder: 5,
    enabled: true,
  },
  {
    id: 'christmas',
    name: 'Christmas Greetings',
    slug: 'christmas',
    description: 'Evergreen warmth, brass chimes, and glowing winter evening keepsakes.',
    imageUrl: STUDIO_ASSETS.festive,
    accentColor: '#15803D',
    sortOrder: 6,
    enabled: true,
  },
  {
    id: 'new-year',
    name: 'New Year Greetings',
    slug: 'new-year',
    description: 'Midnight firework celebrations, champagne sparkle, and fresh wishes.',
    imageUrl: STUDIO_ASSETS.festive,
    accentColor: '#D97706',
    sortOrder: 7,
    enabled: true,
  },
  {
    id: 'valentines',
    name: "Valentine's Day Cards",
    slug: 'valentines',
    description: 'Floating petals, heartfelt poetry, and personal secret prompts.',
    imageUrl: STUDIO_ASSETS.floral,
    accentColor: '#BE123C',
    sortOrder: 8,
    enabled: true,
  },
  {
    id: 'thank-you',
    name: 'Thank You Cards',
    slug: 'thank-you',
    description: 'Gracious, unhurried gratitude rendered on crisp digital cotton paper.',
    imageUrl: STUDIO_ASSETS.heroGift,
    accentColor: '#0F766E',
    sortOrder: 9,
    enabled: true,
  },
  {
    id: 'congratulations',
    name: 'Congratulations Cards',
    slug: 'congratulations',
    description: 'Promotions, new homes, and big moments framed with confetti and joy.',
    imageUrl: STUDIO_ASSETS.birthday,
    accentColor: '#7C3AED',
    sortOrder: 10,
    enabled: true,
  },
  {
    id: 'get-well',
    name: 'Get Well Soon Cards',
    slug: 'get-well',
    description: 'Gentle botanical animations and comforting music to lift someone’s spirits.',
    imageUrl: STUDIO_ASSETS.floral,
    accentColor: '#0284C7',
    sortOrder: 11,
    enabled: true,
  },
  {
    id: 'apology',
    name: 'Apology Cards',
    slug: 'apology',
    description: 'Sincere, quiet editorial layouts designed for thoughtful reconciliation.',
    imageUrl: STUDIO_ASSETS.heroGift,
    accentColor: '#475569',
    sortOrder: 12,
    enabled: true,
  },
  {
    id: 'custom',
    name: 'Custom Greetings',
    slug: 'custom',
    description: 'Start from a versatile blank canvas for any personal occasion.',
    imageUrl: STUDIO_ASSETS.heroGift,
    accentColor: '#334155',
    sortOrder: 13,
    enabled: true,
  },
];

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'tpl-candlelight-birthday',
    name: 'Candlelight Keepsake',
    categoryId: 'birthday',
    description: 'Warm alabaster typography with beeswax candle glow, confetti bursts, and interactive gift box.',
    previewImageUrl: STUDIO_ASSETS.birthday,
    animationStyle: 'animated-cake',
    colorScheme: {
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F8FAFC',
      accent: '#F59E0B',
      muted: '#94A3B8',
    },
    fontPair: 'editorial',
    backgroundStyle: 'linear-gradient(145deg, #0F172A 0%, #1E293B 55%, #31102F 100%)',
    musicTrackId: 'track-birthday-musicbox',
    layoutPreset: 'slideshow',
    enabled: true,
    featured: true,
  },
  {
    id: 'tpl-blush-peony',
    name: 'Pressed Peony Suite',
    categoryId: 'wedding',
    description: 'Delicate linen paper aesthetic with falling petals, wax-sealed envelope, and romantic strings.',
    previewImageUrl: STUDIO_ASSETS.wedding,
    animationStyle: 'falling-flowers',
    colorScheme: {
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#0F172A',
      accent: '#BE123C',
      muted: '#64748B',
    },
    fontPair: 'classic',
    backgroundStyle: 'linear-gradient(160deg, #FFFFFF 0%, #F1F5F9 50%, #FCE7F3 100%)',
    musicTrackId: 'track-romantic-strings',
    layoutPreset: 'gallery',
    enabled: true,
    featured: true,
  },
  {
    id: 'tpl-velvet-archive',
    name: 'Velvet Archive',
    categoryId: 'anniversary',
    description: 'Deep obsidian gallery layout with floating polaroids and glowing golden dust particles.',
    previewImageUrl: STUDIO_ASSETS.heroGift,
    animationStyle: 'floating-photos',
    colorScheme: {
      background: '#0B0F17',
      surface: '#161D2B',
      text: '#F1F5F9',
      accent: '#E11D48',
      muted: '#94A3B8',
    },
    fontPair: 'editorial',
    backgroundStyle: 'linear-gradient(135deg, #0B0F17 0%, #1B2336 100%)',
    musicTrackId: 'track-piano-waltz',
    layoutPreset: 'polaroid-stack',
    enabled: true,
    featured: true,
  },
  {
    id: 'tpl-pine-starlight',
    name: 'Winter Pine & Brass',
    categoryId: 'christmas',
    description: 'Evergreen charcoal palette with sparkling starlight particles and warm winter chimes.',
    previewImageUrl: STUDIO_ASSETS.festive,
    animationStyle: 'sparkles',
    colorScheme: {
      background: '#0D1B16',
      surface: '#152A22',
      text: '#F8FAFC',
      accent: '#D97706',
      muted: '#9CA3AF',
    },
    fontPair: 'classic',
    backgroundStyle: 'linear-gradient(155deg, #0D1B16 0%, #163026 60%, #1F2421 100%)',
    musicTrackId: 'track-winter-chimes',
    layoutPreset: 'slideshow',
    enabled: true,
    featured: true,
  },
  {
    id: 'tpl-midnight-fireworks',
    name: 'Midnight Soiree',
    categoryId: 'new-year',
    description: 'Celebratory midnight navy canvas with luminous firework bursts and bold countdown reveal.',
    previewImageUrl: STUDIO_ASSETS.festive,
    animationStyle: 'fireworks',
    colorScheme: {
      background: '#090D16',
      surface: '#141B2D',
      text: '#FFFFFF',
      accent: '#F59E0B',
      muted: '#94A3B8',
    },
    fontPair: 'modern',
    backgroundStyle: 'linear-gradient(145deg, #090D16 0%, #1E1B4B 100%)',
    musicTrackId: 'track-celebration-bell',
    layoutPreset: 'floating-frames',
    enabled: true,
    featured: true,
  },
  {
    id: 'tpl-crimson-letter',
    name: 'Crimson Wax Letter',
    categoryId: 'romantic-love',
    description: 'Opening envelope reveal with floating hearts, handwritten script accents, and soft piano.',
    previewImageUrl: STUDIO_ASSETS.floral,
    animationStyle: 'floating-hearts',
    colorScheme: {
      background: '#FFF1F2',
      surface: '#FFFFFF',
      text: '#1E293B',
      accent: '#BE123C',
      muted: '#64748B',
    },
    fontPair: 'script',
    backgroundStyle: 'linear-gradient(160deg, #FFF1F2 0%, #FFE4E6 100%)',
    musicTrackId: 'track-romantic-strings',
    layoutPreset: 'polaroid-stack',
    enabled: true,
    featured: true,
  },
  {
    id: 'tpl-laurel-honors',
    name: 'Laurel & Gold',
    categoryId: 'graduation',
    description: 'Crisp academic editorial layout with celebratory confetti and milestone timeline notes.',
    previewImageUrl: STUDIO_ASSETS.heroGift,
    animationStyle: 'confetti',
    colorScheme: {
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#0F172A',
      accent: '#1D4ED8',
      muted: '#64748B',
    },
    fontPair: 'editorial',
    backgroundStyle: 'linear-gradient(145deg, #F8FAFC 0%, #EFF6FF 100%)',
    musicTrackId: 'track-celebration-bell',
    layoutPreset: 'gallery',
    enabled: true,
    featured: false,
  },
  {
    id: 'tpl-botanical-grace',
    name: 'Botanical Grace',
    categoryId: 'thank-you',
    description: 'Serene porcelain stationery with animated butterflies and acoustic arpeggio.',
    previewImageUrl: STUDIO_ASSETS.floral,
    animationStyle: 'butterflies',
    colorScheme: {
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#0F172A',
      accent: '#0F766E',
      muted: '#64748B',
    },
    fontPair: 'classic',
    backgroundStyle: 'linear-gradient(160deg, #FFFFFF 0%, #F0FDFA 100%)',
    musicTrackId: 'track-acoustic-arpeggio',
    layoutPreset: 'gallery',
    enabled: true,
    featured: false,
  },
  {
    id: 'tpl-velvet-rose',
    name: 'Velvet Rose Valentine',
    categoryId: 'valentines',
    description: '3D card fold opening into floating hearts, rose petals, and personalized love notes.',
    previewImageUrl: STUDIO_ASSETS.wedding,
    animationStyle: 'card-3d-open',
    colorScheme: {
      background: '#1E0A14',
      surface: '#2D1120',
      text: '#FFF1F2',
      accent: '#FB7185',
      muted: '#FDA4AF',
    },
    fontPair: 'editorial',
    backgroundStyle: 'linear-gradient(145deg, #1E0A14 0%, #4C0519 100%)',
    musicTrackId: 'track-romantic-strings',
    layoutPreset: 'slideshow',
    enabled: true,
    featured: false,
  },
  {
    id: 'tpl-skyline-balloons',
    name: 'Skyline Celebration',
    categoryId: 'congratulations',
    description: 'Uplifting daytime gradient with rising balloons and crisp modern typography.',
    previewImageUrl: STUDIO_ASSETS.birthday,
    animationStyle: 'balloons',
    colorScheme: {
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#0F172A',
      accent: '#7C3AED',
      muted: '#64748B',
    },
    fontPair: 'modern',
    backgroundStyle: 'linear-gradient(145deg, #F8FAFC 0%, #F5F3FF 100%)',
    musicTrackId: 'track-celebration-bell',
    layoutPreset: 'floating-frames',
    enabled: true,
    featured: false,
  },
  {
    id: 'tpl-morning-dew',
    name: 'Morning Sunlight',
    categoryId: 'get-well',
    description: 'Soothing daylight tones with glowing warm particles and gentle floral drift.',
    previewImageUrl: STUDIO_ASSETS.floral,
    animationStyle: 'glowing-particles',
    colorScheme: {
      background: '#F0F9FF',
      surface: '#FFFFFF',
      text: '#0F172A',
      accent: '#0284C7',
      muted: '#64748B',
    },
    fontPair: 'editorial',
    backgroundStyle: 'linear-gradient(160deg, #F0F9FF 0%, #E0F2FE 100%)',
    musicTrackId: 'track-acoustic-arpeggio',
    layoutPreset: 'gallery',
    enabled: true,
    featured: false,
  },
  {
    id: 'tpl-quiet-linen',
    name: 'Quiet Linen Note',
    categoryId: 'apology',
    description: 'Understated minimalist stationery with unhurried text reveal and calm piano.',
    previewImageUrl: STUDIO_ASSETS.heroGift,
    animationStyle: 'elegant-text-reveal',
    colorScheme: {
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#1E293B',
      accent: '#475569',
      muted: '#64748B',
    },
    fontPair: 'classic',
    backgroundStyle: 'linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%)',
    musicTrackId: 'track-piano-waltz',
    layoutPreset: 'gallery',
    enabled: true,
    featured: false,
  },
];

export const ANIMATION_LIBRARY: Array<{
  id: AnimationEffectId;
  name: string;
  description: string;
  category: 'ambient' | 'celebration' | 'opening' | 'typography';
}> = [
  { id: 'gift-box', name: 'Animated Gift Box', description: 'Interactive ribboned gift box that unwraps on tap', category: 'opening' },
  { id: 'opening-envelope', name: 'Opening Envelope', description: 'Wax-sealed envelope flap that lifts smoothly', category: 'opening' },
  { id: 'card-3d-open', name: '3D Card Opening', description: 'Tactile folded stationery hinge reveal', category: 'opening' },
  { id: 'confetti', name: 'Confetti Burst', description: 'Crisp metallic and matte paper confetti shower', category: 'celebration' },
  { id: 'balloons', name: 'Rising Balloons', description: 'Softly drifting celebratory silk balloons', category: 'celebration' },
  { id: 'fireworks', name: 'Fireworks Display', description: 'Luminous night-sky celebration bursts', category: 'celebration' },
  { id: 'animated-cake', name: 'Animated Cake', description: 'Illustrated celebration cake centerpiece', category: 'celebration' },
  { id: 'candle-effects', name: 'Candlelight Glow', description: 'Warm flickering beeswax candle flames', category: 'celebration' },
  { id: 'falling-flowers', name: 'Falling Flowers', description: 'Botanical petals drifting gently downward', category: 'ambient' },
  { id: 'floating-hearts', name: 'Floating Hearts', description: 'Warm rising heart silhouettes', category: 'ambient' },
  { id: 'glowing-particles', name: 'Glowing Particles', description: 'Ambient golden firefly dust particles', category: 'ambient' },
  { id: 'sparkles', name: 'Starlight Sparkles', description: 'Twinkling atmospheric shimmer accents', category: 'ambient' },
  { id: 'butterflies', name: 'Animated Butterflies', description: 'Graceful fluttering botanical butterflies', category: 'ambient' },
  { id: 'floating-photos', name: 'Floating Photographs', description: 'Gentle parallax drift on photo frames', category: 'typography' },
  { id: 'romantic-transitions', name: 'Romantic Transitions', description: 'Velvet cross-fade scene transitions', category: 'typography' },
  { id: 'elegant-text-reveal', name: 'Elegant Text Reveal', description: 'Line-by-line editorial prose reveal', category: 'typography' },
];

export const STICKER_PALETTE = [
  { id: 'wax-seal', label: 'Crimson Wax Seal', symbol: '❦' },
  { id: 'star-burst', label: 'Gold Star', symbol: '✦' },
  { id: 'botanical', label: 'Botanical Sprig', symbol: '✿' },
  { id: 'heart-mark', label: 'Classic Heart', symbol: '♥' },
  { id: 'ribbon', label: 'Fleuron', symbol: '❁' },
  { id: 'spark', label: 'Sparkle', symbol: '✧' },
];

export const GRADIENT_PRESETS = [
  { name: 'Porcelain Mist', css: 'linear-gradient(145deg, #FFFFFF 0%, #F1F5F9 100%)', text: '#0F172A', surface: '#FFFFFF', accent: '#BE123C' },
  { name: 'Midnight Velvet', css: 'linear-gradient(145deg, #0B0F17 0%, #1E293B 100%)', text: '#F8FAFC', surface: '#161F30', accent: '#F59E0B' },
  { name: 'Rosewater Silk', css: 'linear-gradient(160deg, #FFF1F2 0%, #FFE4E6 100%)', text: '#1E293B', surface: '#FFFFFF', accent: '#BE123C' },
  { name: 'Emerald Pine', css: 'linear-gradient(155deg, #0D1B16 0%, #163026 100%)', text: '#F8FAFC', surface: '#162C23', accent: '#F59E0B' },
  { name: 'Royal Indigo', css: 'linear-gradient(145deg, #0F172A 0%, #1E1B4B 100%)', text: '#F8FAFC', surface: '#1E1B4B', accent: '#FB7185' },
  { name: 'Sky & Linen', css: 'linear-gradient(160deg, #F0F9FF 0%, #E0F2FE 100%)', text: '#0F172A', surface: '#FFFFFF', accent: '#0284C7' },
];

export const DEFAULT_SEQUENCE_ORDER: ExperienceStepKey[] = [
  'gift-box',
  'greeting-title',
  'photo-showcase',
  'main-message',
  'extra-notes',
  'closing-signature',
];

export const EXPERIENCE_STEP_LABELS: Record<ExperienceStepKey, string> = {
  'gift-box': 'Unwrap Gift Box / Envelope',
  'greeting-title': 'Greeting Headline & Occasion',
  'photo-showcase': 'Photo Gallery & Slideshow',
  'main-message': 'Main Personalized Letter',
  'extra-notes': 'Additional Personal Notes',
  'closing-signature': 'Date & Closing Signature',
};

export interface PhotoTransitionDefinition {
  id: PhotoTransitionType;
  name: string;
  description: string;
  category: 'classic' | 'directional' | 'cinematic' | 'editorial';
}

export const PHOTO_TRANSITIONS: PhotoTransitionDefinition[] = [
  { id: 'fade', name: 'Fade In / Out', description: 'Gentle opacity fade', category: 'classic' },
  { id: 'slide-left', name: 'Smooth Slide Left', description: 'Crisp leftward glide', category: 'directional' },
  { id: 'slide-right', name: 'Smooth Slide Right', description: 'Crisp rightward glide', category: 'directional' },
  { id: 'slide-up', name: 'Slide Up', description: 'Rises softly into frame', category: 'directional' },
  { id: 'slide-down', name: 'Slide Down', description: 'Drops gracefully into place', category: 'directional' },
  { id: 'zoom-in', name: 'Zoom In', description: 'Warm focal magnification', category: 'cinematic' },
  { id: 'zoom-out', name: 'Zoom Out', description: 'Settles from close-up', category: 'cinematic' },
  { id: 'ken-burns', name: 'Ken Burns Effect', description: 'Slow documentary pan & zoom', category: 'cinematic' },
  { id: 'flip-3d', name: '3D Flip', description: 'Perspective Y-axis card turn', category: 'cinematic' },
  { id: 'card-reveal-3d', name: '3D Card Reveal', description: 'Tilted keepsake card lift', category: 'cinematic' },
  { id: 'crossfade', name: 'Crossfade', description: 'Velvet blend over previous photo', category: 'classic' },
  { id: 'blur-reveal', name: 'Blur Reveal', description: 'Soft focus sharpening into view', category: 'classic' },
  { id: 'circular-reveal', name: 'Circular Reveal', description: 'Expanding circular iris wipe', category: 'editorial' },
  { id: 'rotate-reveal', name: 'Rotating Reveal', description: 'Subtle arc tilt & settle', category: 'editorial' },
  { id: 'dissolve', name: 'Elegant Dissolve', description: 'Luminous satin dissolve', category: 'classic' },
  { id: 'polaroid-reveal', name: 'Polaroid Photo Reveal', description: 'Prints & settles like film', category: 'editorial' },
  { id: 'stacked-photo', name: 'Stacked Photo Transition', description: 'Deals from an album stack', category: 'editorial' },
  { id: 'filmstrip', name: 'Filmstrip Transition', description: 'Cinema reel frame advance', category: 'editorial' },
  { id: 'parallax', name: 'Parallax Photo Movement', description: 'Layered depth drift', category: 'cinematic' },
  { id: 'soft-light', name: 'Soft Light Reveal', description: 'Warm sunlit sweep reveal', category: 'classic' },
  { id: 'split-screen', name: 'Split-Screen Reveal', description: 'Dual-half curtain reveal', category: 'editorial' },
  { id: 'film-burn', name: 'Film Burn Wash', description: 'Warm amber projector flash', category: 'cinematic' },
  { id: 'light-sweep', name: 'Light Sweep Wipe', description: 'Luminous directional beam wipe', category: 'cinematic' },
  { id: 'geometric-reveal', name: 'Geometric Diamond Reveal', description: 'Expanding diamond aperture clip', category: 'editorial' },
  { id: 'layered-reveal', name: 'Layered Album Reveal', description: 'Staggered backing frame reveal', category: 'editorial' },
  { id: 'camera-pan', name: 'Dynamic Camera Pan', description: 'Fluid lateral cinema pan', category: 'cinematic' },
];

export interface SlideshowStyleDefinition {
  id: SlideshowStyleId;
  name: string;
  tagline: string;
  description: string;
  defaultTransition: PhotoTransitionType;
  defaultPresentation: PhotoPresentationLayout;
  defaultTextAnimation: TextAnimationStyle;
  palette: {
    backdrop: string;
    accent: string;
    surface: string;
    text: string;
  };
  borderStyle: VideoStudioConfig['photoFrame']['borderStyle'];
  blurBackdrop: boolean;
}

export const SLIDESHOW_STYLES: SlideshowStyleDefinition[] = [
  {
    id: 'cinematic-memories',
    name: 'Cinematic Memories',
    tagline: 'Letterbox depth & golden rim grade',
    description: 'Deep theater bars, smooth Ken Burns zooms, subtle teal-amber grading, and slow title reveals.',
    defaultTransition: 'ken-burns',
    defaultPresentation: 'fullscreen',
    defaultTextAnimation: 'cinematic-title',
    palette: { backdrop: '#090D16', accent: '#F59E0B', surface: '#121928', text: '#F8FAFC' },
    borderStyle: 'none',
    blurBackdrop: true,
  },
  {
    id: 'romantic-memories',
    name: 'Romantic Memories',
    tagline: 'Blush mist, soft glows & poetry',
    description: 'Warm rosewater gradients, drifting petals/hearts aesthetic, handwriting text reveal, and velvet dissolves.',
    defaultTransition: 'dissolve',
    defaultPresentation: 'framed',
    defaultTextAnimation: 'handwriting',
    palette: { backdrop: '#230C18', accent: '#FB7185', surface: '#341324', text: '#FFF1F2' },
    borderStyle: 'thin',
    blurBackdrop: true,
  },
  {
    id: 'birthday-celebration',
    name: 'Birthday Celebration',
    tagline: 'Bright confetti & upbeat reveals',
    description: 'Celebratory glow rings, dynamic zoom/card flips, energetic sparkles, and festive caption bands.',
    defaultTransition: 'card-reveal-3d',
    defaultPresentation: 'animated-card',
    defaultTextAnimation: 'zoom-reveal',
    palette: { backdrop: '#111827', accent: '#F43F5E', surface: '#1F2937', text: '#FFFFFF' },
    borderStyle: 'thin',
    blurBackdrop: true,
  },
  {
    id: 'elegant-gallery',
    name: 'Elegant Gallery',
    tagline: 'Curated exhibition framing',
    description: 'Museum-grade ivory mats, crisp architectural margins, gallery placard captions, and soft fades.',
    defaultTransition: 'crossfade',
    defaultPresentation: 'framed',
    defaultTextAnimation: 'fade-in',
    palette: { backdrop: '#F4F1EA', accent: '#9F1239', surface: '#FFFFFF', text: '#0F172A' },
    borderStyle: 'double',
    blurBackdrop: false,
  },
  {
    id: 'film-memories',
    name: 'Film Memories',
    tagline: '35mm analog sprocket reel',
    description: 'Authentic film sprockets, warm analog grain texture, frame numbers, and projector burn transitions.',
    defaultTransition: 'film-burn',
    defaultPresentation: 'filmstrip',
    defaultTextAnimation: 'typewriter',
    palette: { backdrop: '#14110F', accent: '#D97706', surface: '#1E1915', text: '#FEF3C7' },
    borderStyle: 'thin',
    blurBackdrop: false,
  },
  {
    id: 'modern-dynamic',
    name: 'Modern Dynamic',
    tagline: 'Crisp split wipes & kinetic type',
    description: 'High-contrast asymmetric framing, sharp split-screen & slide reveals, and punchy modern typography.',
    defaultTransition: 'split-screen',
    defaultPresentation: 'two-photo',
    defaultTextAnimation: 'smooth-slide',
    palette: { backdrop: '#0F172A', accent: '#38BDF8', surface: '#1E293B', text: '#F8FAFC' },
    borderStyle: 'none',
    blurBackdrop: true,
  },
  {
    id: 'photo-album',
    name: 'Photo Album',
    tagline: 'Tactile Polaroid & scrapbook keepsake',
    description: 'Warm parchment spread, angled Polaroid mats with soft paper shadows, and stacked album reveals.',
    defaultTransition: 'polaroid-reveal',
    defaultPresentation: 'polaroid',
    defaultTextAnimation: 'handwriting',
    palette: { backdrop: '#EFE9DF', accent: '#B45309', surface: '#FFFDF9', text: '#1E293B' },
    borderStyle: 'polaroid',
    blurBackdrop: false,
  },
  {
    id: 'luxury-presentation',
    name: 'Luxury Presentation',
    tagline: 'Obsidian & brushed gold foil',
    description: 'Obsidian velvet stage with double gold hairline frames, radiant glow text, and slow regal camera pans.',
    defaultTransition: 'light-sweep',
    defaultPresentation: 'framed',
    defaultTextAnimation: 'glow-reveal',
    palette: { backdrop: '#07080C', accent: '#EAB308', surface: '#101219', text: '#FAF7F0' },
    borderStyle: 'gold',
    blurBackdrop: true,
  },
  {
    id: 'emotional-storytelling',
    name: 'Emotional Storytelling',
    tagline: 'Intimate prose & soft-focus drift',
    description: 'Unobtrusive full-bleed visuals paired with soft blur text reveals and unhurried letter-by-letter cadence.',
    defaultTransition: 'blur-reveal',
    defaultPresentation: 'fullscreen',
    defaultTextAnimation: 'soft-blur',
    palette: { backdrop: '#111622', accent: '#FDA4AF', surface: '#182032', text: '#F8FAFC' },
    borderStyle: 'none',
    blurBackdrop: true,
  },
  {
    id: 'classic-slideshow',
    name: 'Classic Slideshow',
    tagline: 'Timeless clean balanced presentation',
    description: 'Clear aspect-safe framing, crisp captions below each memory, and smooth classic fades.',
    defaultTransition: 'fade',
    defaultPresentation: 'framed',
    defaultTextAnimation: 'fade-in',
    palette: { backdrop: '#F8FAFC', accent: '#BE123C', surface: '#FFFFFF', text: '#0F172A' },
    borderStyle: 'thin',
    blurBackdrop: true,
  },
];

export const PHOTO_PRESENTATIONS: Array<{
  id: PhotoPresentationLayout;
  name: string;
  description: string;
}> = [
  { id: 'fullscreen', name: 'Full-Screen', description: 'Edge-to-edge canvas fit with blur backdrop fill' },
  { id: 'framed', name: 'Framed Gallery', description: 'Elevated matte border with balanced margins' },
  { id: 'polaroid', name: 'Polaroid Style', description: 'Tactile white instant-print mat & caption lip' },
  { id: 'two-photo', name: 'Two-Photo Pairing', description: 'Complementary asymmetric memory duo' },
  { id: 'collage', name: 'Collage Grid', description: 'Up to 3–4 curated memories per scene' },
  { id: 'stacked', name: 'Stacked Cards', description: 'Layered physical prints fanned softly' },
  { id: 'side-by-side', name: 'Side-by-Side', description: 'Symmetric dual-panel comparison showcase' },
  { id: 'filmstrip', name: 'Filmstrip Reel', description: 'Cinema reel frames sliding sequentially' },
  { id: 'animated-card', name: 'Animated Photo Card', description: 'Tilted 3D keepsake card floating in frame' },
];

export const TEXT_ANIMATIONS: Array<{
  id: TextAnimationStyle;
  name: string;
  description: string;
}> = [
  { id: 'fade-in', name: 'Fade In', description: 'Smooth gentle opacity entrance' },
  { id: 'typewriter', name: 'Typewriter', description: 'Character-by-character typed cursor' },
  { id: 'smooth-slide', name: 'Smooth Slide', description: 'Crisp upward slide into rest' },
  { id: 'zoom-reveal', name: 'Zoom Reveal', description: 'Expands warmly from focal depth' },
  { id: 'handwriting', name: 'Handwriting Sweep', description: 'Fluid left-to-right ink brush wipe' },
  { id: 'floating', name: 'Floating Text', description: 'Weightless gentle vertical suspension' },
  { id: 'letter-by-letter', name: 'Letter by Letter', description: 'Staggered typographic cascade' },
  { id: 'cinematic-title', name: 'Cinematic Title', description: 'Wide-tracked film title settle' },
  { id: 'glow-reveal', name: 'Glow Reveal', description: 'Luminous golden halo bloom' },
  { id: 'soft-blur', name: 'Soft Blur Reveal', description: 'Focus pull from atmospheric haze' },
];

export function resolvePhotoTransition(raw?: PhotoTransitionType): PhotoTransitionType {
  if (!raw) return 'fade';
  if (raw === 'slide') return 'slide-left';
  if (raw === 'zoom') return 'zoom-in';
  if (raw === 'polaroid-float') return 'polaroid-reveal';
  return raw;
}

export function createDefaultVideoStudioConfig(greeting?: Partial<Greeting>): VideoStudioConfig {
  const existing = greeting?.designConfig?.videoConfig;
  if (existing) {
    return existing;
  }

  const cat = greeting?.categoryId || 'birthday';
  const defaultStyleId: SlideshowStyleId =
    cat === 'birthday'
      ? 'birthday-celebration'
      : cat === 'romantic-love' || cat === 'valentines'
      ? 'romantic-memories'
      : cat === 'wedding'
      ? 'elegant-gallery'
      : cat === 'anniversary'
      ? 'cinematic-memories'
      : 'classic-slideshow';

  const preset = SLIDESHOW_STYLES.find((s) => s.id === defaultStyleId) || SLIDESHOW_STYLES[0];
  const slideSec = Math.max(
    2.5,
    Math.min(10, Math.round(((greeting?.designConfig?.slideshowIntervalMs || 4000) / 1000) * 10) / 10)
  );

  return {
    aspectRatio: '16:9',
    resolution: '720p',
    fps: 30,
    quality: 'high',
    format: 'webm',
    slideshowStyle: preset.id,
    photoPresentation: preset.defaultPresentation,
    slideDurationSec: slideSec,
    customTotalDurationSec: null,
    photoFrame: {
      blurBackdrop: preset.blurBackdrop,
      borderStyle: preset.borderStyle,
      shadowIntensity: 'soft',
      borderRadius: 18,
      spacing: 28,
    },
    textStyle: {
      animation: preset.defaultTextAnimation,
      animDurationMs: 900,
      displayDurationSec: 4.5,
      fontSizeScale: greeting?.designConfig?.fontSizeScale || 'standard',
      align: greeting?.designConfig?.textAlign || 'center',
      position: greeting?.designConfig?.textPosition || 'bottom',
    },
    openingScene: {
      enabled: true,
      title: greeting?.title || 'A Special Keepsake',
      subtitle: greeting?.recipientName ? `For ${greeting.recipientName}` : 'Created with Love',
      durationSec: 3.5,
      showIntroPhoto: true,
    },
    closingScene: {
      enabled: true,
      title: 'With Love Always',
      message: greeting?.cardDate || 'A moment to keep forever',
      signature: greeting?.signature || (greeting?.senderName ? `With love, ${greeting.senderName}` : 'Keepsake'),
      durationSec: 3.5,
    },
    audioOptions: {
      fadeInSec: 1.5,
      fadeOutSec: 2.0,
    },
  };
}

export function createDefaultDesignConfig(template?: Template): DesignConfig {
  return {
    backgroundType: 'gradient',
    backgroundColor: template?.colorScheme.background || '#F8FAFC',
    gradientCss: template?.backgroundStyle || 'linear-gradient(145deg, #FFFFFF 0%, #F1F5F9 100%)',
    surfaceColor: template?.colorScheme.surface || '#FFFFFF',
    textColor: template?.colorScheme.text || '#0F172A',
    accentColor: template?.colorScheme.accent || '#BE123C',
    fontPair: template?.fontPair || 'editorial',
    fontSizeScale: 'standard',
    textAlign: 'center',
    textPosition: 'center',
    photoLayout: template?.layoutPreset || 'slideshow',
    presentationMode: 'interactive-card',
    defaultPhotoTransition: 'fade',
    transitionDurationMs: 750,
    slideshowIntervalMs: 4500,
    stickers: [],
    sequenceOrder: [...DEFAULT_SEQUENCE_ORDER],
    animationIntensity: 'balanced',
  };
}
