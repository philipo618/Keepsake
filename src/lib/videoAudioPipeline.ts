import { LICENSED_MUSIC_LIBRARY } from './audioEngine';
import type { MusicConfig } from './types';

export interface RenderedAudioResult {
  buffer: AudioBuffer | null;
  warning?: string;
}

const SAMPLE_RATE = 44100;

function getAudioContextClass(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

function getOfflineAudioContextClass(): typeof OfflineAudioContext | null {
  if (typeof window === 'undefined') return null;
  return (
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext ||
    null
  );
}

function applyFadeEnvelope(
  gainNode: GainNode,
  totalDurationSec: number,
  targetVolume: number,
  fadeInSec: number,
  fadeOutSec: number
) {
  const safeVol = Math.max(0.0001, Math.min(1, targetVolume));
  const clampedFadeIn = Math.min(fadeInSec, totalDurationSec * 0.4);
  const clampedFadeOut = Math.min(fadeOutSec, totalDurationSec * 0.4);

  if (clampedFadeIn > 0.05) {
    gainNode.gain.setValueAtTime(0.0001, 0);
    gainNode.gain.linearRampToValueAtTime(safeVol, clampedFadeIn);
  } else {
    gainNode.gain.setValueAtTime(safeVol, 0);
  }

  const fadeOutStart = Math.max(clampedFadeIn, totalDurationSec - clampedFadeOut);
  if (clampedFadeOut > 0.05 && fadeOutStart < totalDurationSec) {
    gainNode.gain.setValueAtTime(safeVol, fadeOutStart);
    gainNode.gain.linearRampToValueAtTime(0.0001, Math.max(fadeOutStart + 0.05, totalDurationSec - 0.02));
  }
}

export async function renderMusicToAudioBuffer(
  musicConfig: MusicConfig | undefined,
  audioOptions: { fadeInSec: number; fadeOutSec: number },
  totalDurationSec: number
): Promise<RenderedAudioResult> {
  if (!musicConfig?.enabled || musicConfig.sourceType === 'none') {
    return { buffer: null };
  }

  const OfflineCtx = getOfflineAudioContextClass();
  const OnlineCtx = getAudioContextClass();
  if (!OfflineCtx || !OnlineCtx) {
    return {
      buffer: null,
      warning: 'Web Audio API is unavailable in this browser; exporting video without audio track.',
    };
  }

  const safeDuration = Math.max(1, totalDurationSec);
  const frameCount = Math.ceil(safeDuration * SAMPLE_RATE);

  // Uploaded / external audio path
  if (musicConfig.sourceType === 'uploaded' && musicConfig.audioUrl) {
    try {
      const resp = await fetch(musicConfig.audioUrl, { mode: 'cors' });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const rawBytes = await resp.arrayBuffer();
      const tempCtx = new OnlineCtx();
      let decoded: AudioBuffer;
      try {
        decoded = await tempCtx.decodeAudioData(rawBytes);
      } finally {
        await tempCtx.close().catch(() => {});
      }

      const offline = new OfflineCtx(2, frameCount, SAMPLE_RATE);
      const masterGain = offline.createGain();
      applyFadeEnvelope(
        masterGain,
        safeDuration,
        musicConfig.volume ?? 0.65,
        audioOptions.fadeInSec,
        audioOptions.fadeOutSec
      );
      masterGain.connect(offline.destination);

      const srcDuration = Math.max(0.25, decoded.duration);
      let cursor = 0;
      while (cursor < safeDuration) {
        const srcNode = offline.createBufferSource();
        srcNode.buffer = decoded;
        const segmentGain = offline.createGain();
        const remaining = safeDuration - cursor;
        const playLen = Math.min(srcDuration, remaining);
        // Subtle 20ms cross-boundary de-click envelope
        segmentGain.gain.setValueAtTime(0.001, cursor);
        segmentGain.gain.linearRampToValueAtTime(1, Math.min(cursor + 0.03, safeDuration));
        if (cursor + playLen > cursor + 0.05) {
          segmentGain.gain.setValueAtTime(1, cursor + playLen - 0.03);
          segmentGain.gain.linearRampToValueAtTime(0.001, cursor + playLen);
        }
        srcNode.connect(segmentGain);
        segmentGain.connect(masterGain);
        srcNode.start(cursor, 0, playLen);
        cursor += srcDuration;
      }

      const rendered = await offline.startRendering();
      return { buffer: rendered };
    } catch {
      return {
        buffer: null,
        warning:
          'Uploaded/external audio could not be decoded (possibly CORS-restricted or unsupported codec). Video will export silently.',
      };
    }
  }

  // Studio synth track offline arrangement
  const track =
    LICENSED_MUSIC_LIBRARY.find((t) => t.id === musicConfig.trackId) || LICENSED_MUSIC_LIBRARY[0];

  try {
    const offline = new OfflineCtx(2, frameCount, SAMPLE_RATE);
    const masterGain = offline.createGain();
    applyFadeEnvelope(
      masterGain,
      safeDuration,
      (musicConfig.volume ?? 0.65) * 0.45,
      audioOptions.fadeInSec,
      audioOptions.fadeOutSec
    );
    masterGain.connect(offline.destination);

    const stepSec = Math.max(0.35, (60 / track.bpm) * 0.75);
    let t = 0;
    let idx = 0;

    while (t < safeDuration) {
      const freq = track.notes[idx % track.notes.length];
      const noteDuration = Math.min(1.35, safeDuration - t + 0.05);

      const osc = offline.createOscillator();
      const noteGain = offline.createGain();
      osc.type = track.waveform;
      osc.frequency.setValueAtTime(freq, t);

      noteGain.gain.setValueAtTime(0.0001, t);
      noteGain.gain.linearRampToValueAtTime(0.45, t + 0.035);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.12, noteDuration));

      osc.connect(noteGain);
      noteGain.connect(masterGain);
      osc.start(t);
      osc.stop(t + noteDuration + 0.02);

      // Warm octave harmonic shimmer
      const harmonic = offline.createOscillator();
      const harmGain = offline.createGain();
      harmonic.type = 'sine';
      harmonic.frequency.setValueAtTime(freq * 2, t);
      harmGain.gain.setValueAtTime(0.0001, t);
      harmGain.gain.linearRampToValueAtTime(0.08, t + 0.04);
      harmGain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.1, noteDuration * 0.85));
      harmonic.connect(harmGain);
      harmGain.connect(masterGain);
      harmonic.start(t);
      harmonic.stop(t + noteDuration);

      // Soft warm bass pad every 4 notes
      if (idx % 4 === 0) {
        const padOsc = offline.createOscillator();
        const padGain = offline.createGain();
        const padDur = Math.min(stepSec * 3.8, safeDuration - t + 0.05);
        padOsc.type = 'sine';
        padOsc.frequency.setValueAtTime(freq * 0.5, t);
        padGain.gain.setValueAtTime(0.0001, t);
        padGain.gain.linearRampToValueAtTime(0.16, t + 0.15);
        padGain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.2, padDur));
        padOsc.connect(padGain);
        padGain.connect(masterGain);
        padOsc.start(t);
        padOsc.stop(t + padDur);
      }

      t += stepSec;
      idx += 1;
    }

    const rendered = await offline.startRendering();
    return { buffer: rendered };
  } catch {
    return {
      buffer: null,
      warning: 'Studio audio synthesis encountered an error; video will export without audio.',
    };
  }
}

export class StudioAudioSyncPlayer {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private buffer: AudioBuffer | null = null;

  setBuffer(buffer: AudioBuffer | null) {
    this.stop();
    this.buffer = buffer;
  }

  async playFrom(offsetSec: number, volume = 0.85) {
    this.stop();
    if (!this.buffer) return;
    const Ctx = getAudioContextClass();
    if (!Ctx) return;

    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new Ctx();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }

    const clampedOffset = Math.max(0, Math.min(offsetSec, Math.max(0, this.buffer.duration - 0.05)));
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;

    const gain = this.ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));

    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(0, clampedOffset);

    this.source = source;
    this.gainNode = gain;
  }

  setVolume(volume: number) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime, 0.03);
    }
  }

  stop() {
    if (this.source) {
      try {
        this.source.stop();
        this.source.disconnect();
      } catch {
        // Ignore already stopped
      }
      this.source = null;
    }
  }

  dispose() {
    this.stop();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.buffer = null;
  }
}
