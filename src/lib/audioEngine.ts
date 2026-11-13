export interface LicensedMusicTrack {
  id: string;
  title: string;
  composer: string;
  mood: 'celebration' | 'romantic' | 'reflective' | 'festive';
  durationLabel: string;
  license: string;
  bpm: number;
  notes: number[];
  waveform: 'sine' | 'triangle';
}

export const LICENSED_MUSIC_LIBRARY: LicensedMusicTrack[] = [
  {
    id: 'track-birthday-musicbox',
    title: 'Golden Birthday Music Box',
    composer: 'Keepsake Studio Originals',
    mood: 'celebration',
    durationLabel: 'Looping · Ambient',
    license: 'Platform Royalty-Free License',
    bpm: 108,
    notes: [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 587.33, 698.46, 880.0, 783.99],
    waveform: 'triangle',
  },
  {
    id: 'track-romantic-strings',
    title: 'Velvet Evening Prelude',
    composer: 'Keepsake Studio Originals',
    mood: 'romantic',
    durationLabel: 'Looping · Warm',
    license: 'Platform Royalty-Free License',
    bpm: 72,
    notes: [261.63, 329.63, 392.0, 493.88, 440.0, 392.0, 349.23, 329.63],
    waveform: 'sine',
  },
  {
    id: 'track-piano-waltz',
    title: 'Porcelain Piano Waltz',
    composer: 'Keepsake Studio Originals',
    mood: 'reflective',
    durationLabel: 'Looping · Gentle',
    license: 'Platform Royalty-Free License',
    bpm: 86,
    notes: [293.66, 369.99, 440.0, 587.33, 440.0, 369.99, 329.63, 440.0],
    waveform: 'sine',
  },
  {
    id: 'track-celebration-bell',
    title: 'Champagne Toast Chimes',
    composer: 'Keepsake Studio Originals',
    mood: 'celebration',
    durationLabel: 'Looping · Uplifting',
    license: 'Platform Royalty-Free License',
    bpm: 116,
    notes: [392.0, 493.88, 587.33, 783.99, 659.25, 587.33, 783.99, 987.77],
    waveform: 'triangle',
  },
  {
    id: 'track-acoustic-arpeggio',
    title: 'Morning Sunlight Arpeggio',
    composer: 'Keepsake Studio Originals',
    mood: 'reflective',
    durationLabel: 'Looping · Serene',
    license: 'Platform Royalty-Free License',
    bpm: 80,
    notes: [329.63, 415.3, 493.88, 659.25, 587.33, 493.88, 440.0, 493.88],
    waveform: 'sine',
  },
  {
    id: 'track-winter-chimes',
    title: 'Winter Starlight Bells',
    composer: 'Keepsake Studio Originals',
    mood: 'festive',
    durationLabel: 'Looping · Seasonal',
    license: 'Platform Royalty-Free License',
    bpm: 92,
    notes: [523.25, 493.88, 523.25, 392.0, 440.0, 523.25, 587.33, 659.25],
    waveform: 'triangle',
  },
];

class KeepsakeAudioEngine {
  private ctx: AudioContext | null = null;
  private htmlAudio: HTMLAudioElement | null = null;
  private synthTimer: number | null = null;
  private masterGain: GainNode | null = null;
  private currentVolume = 0.65;
  private isPlaying = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.currentVolume * 0.28;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setVolume(vol: number) {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.currentVolume * 0.28, this.ctx.currentTime, 0.05);
    }
    if (this.htmlAudio) {
      this.htmlAudio.volume = this.currentVolume;
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.synthTimer !== null) {
      window.clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
    if (this.htmlAudio) {
      this.htmlAudio.pause();
      this.htmlAudio.currentTime = 0;
      this.htmlAudio = null;
    }
  }

  getPlayingState(): boolean {
    return this.isPlaying;
  }

  playSynthTrack(trackId: string, volume = 0.65) {
    this.stop();
    const track = LICENSED_MUSIC_LIBRARY.find((t) => t.id === trackId) || LICENSED_MUSIC_LIBRARY[0];
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    this.setVolume(volume);
    this.isPlaying = true;
    let stepIndex = 0;
    const intervalMs = Math.round((60 / track.bpm) * 1000 * 0.75);

    const triggerNote = () => {
      if (!this.isPlaying || !this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;
      const freq = track.notes[stepIndex % track.notes.length];
      stepIndex += 1;

      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      osc.type = track.waveform;
      osc.frequency.setValueAtTime(freq, now);

      // Subtle warm harmonic shimmer
      const harmonic = this.ctx.createOscillator();
      const harmGain = this.ctx.createGain();
      harmonic.type = 'sine';
      harmonic.frequency.setValueAtTime(freq * 2, now);
      harmGain.gain.setValueAtTime(0.001, now);
      harmGain.gain.exponentialRampToValueAtTime(0.08, now + 0.04);
      harmGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

      noteGain.gain.setValueAtTime(0.001, now);
      noteGain.gain.exponentialRampToValueAtTime(0.45, now + 0.04);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);

      osc.connect(noteGain);
      noteGain.connect(this.masterGain);
      harmonic.connect(harmGain);
      harmGain.connect(this.masterGain);

      osc.start(now);
      harmonic.start(now);
      osc.stop(now + 1.4);
      harmonic.stop(now + 1.2);
    };

    triggerNote();
    this.synthTimer = window.setInterval(triggerNote, intervalMs);
  }

  async playAudioUrl(url: string, volume = 0.65): Promise<boolean> {
    this.stop();
    this.setVolume(volume);
    try {
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = this.currentVolume;
      this.htmlAudio = audio;
      this.isPlaying = true;
      await audio.play();
      return true;
    } catch {
      this.isPlaying = false;
      return false;
    }
  }

  playSfx(type: 'unwrap' | 'success' | 'error' | 'confetti') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const playTone = (freq: number, delay: number, duration: number, oscType: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = oscType;
      osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.16 * Math.max(0.2, this.currentVolume), now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + duration + 0.02);
    };

    if (type === 'unwrap') {
      playTone(523.25, 0, 0.35, 'triangle');
      playTone(659.25, 0.09, 0.4, 'triangle');
      playTone(783.99, 0.18, 0.5, 'triangle');
      playTone(1046.5, 0.28, 0.75, 'sine');
    } else if (type === 'success') {
      playTone(587.33, 0, 0.25, 'sine');
      playTone(880.0, 0.12, 0.45, 'sine');
    } else if (type === 'confetti') {
      playTone(659.25, 0, 0.2, 'triangle');
      playTone(987.77, 0.07, 0.35, 'triangle');
    } else if (type === 'error') {
      playTone(260, 0, 0.18, 'sine');
      playTone(220, 0.14, 0.24, 'sine');
    }
  }
}

export const audioEngine = new KeepsakeAudioEngine();
