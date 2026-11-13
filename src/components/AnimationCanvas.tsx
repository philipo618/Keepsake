import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import type { AnimationEffectId } from '../lib/types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  rotation: number;
  vRot: number;
  kind: 'petal' | 'heart' | 'balloon' | 'sparkle' | 'glow' | 'butterfly' | 'firework';
  life?: number;
  maxLife?: number;
}

export function triggerConfettiCelebration(accentColor = '#BE123C') {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try {
    confetti({
      particleCount: 70,
      spread: 70,
      origin: { y: 0.6 },
      colors: [accentColor, '#F59E0B', '#FB7185', '#FFFFFF', '#38BDF8'],
    });
  } catch {
    // Non-fatal
  }
}

export function AnimationCanvas({
  effects,
  intensity = 'balanced',
  accentColor = '#BE123C',
  active = true,
}: {
  effects: AnimationEffectId[];
  intensity?: 'gentle' | 'balanced' | 'festive';
  accentColor?: string;
  active?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active || effects.length === 0) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = (canvas.width = canvas.offsetWidth || window.innerWidth);
    let height = (canvas.height = canvas.offsetHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth || window.innerWidth;
      height = canvas.height = canvas.offsetHeight || window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const countMultiplier = intensity === 'gentle' ? 0.55 : intensity === 'festive' ? 1.5 : 1;
    const particles: Particle[] = [];

    const has = (id: AnimationEffectId) => effects.includes(id);

    const spawnParticles = (kind: Particle['kind'], count: number) => {
      const palette = [accentColor, '#F59E0B', '#FB7185', '#FDA4AF', '#38BDF8', '#E2E8F0'];
      for (let i = 0; i < Math.round(count * countMultiplier); i++) {
        const isUpward = kind === 'heart' || kind === 'balloon';
        particles.push({
          x: Math.random() * width,
          y: isUpward ? height + Math.random() * 140 : Math.random() * height,
          vx: (Math.random() - 0.5) * (kind === 'butterfly' ? 1.8 : 0.8),
          vy: isUpward ? -(0.6 + Math.random() * 1.1) : 0.45 + Math.random() * 1.0,
          size:
            kind === 'balloon'
              ? 16 + Math.random() * 12
              : kind === 'sparkle' || kind === 'glow'
              ? 2 + Math.random() * 3.5
              : 7 + Math.random() * 8,
          color: palette[Math.floor(Math.random() * palette.length)],
          alpha: 0.45 + Math.random() * 0.5,
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.03,
          kind,
        });
      }
    };

    if (has('falling-flowers')) spawnParticles('petal', 20);
    if (has('floating-hearts')) spawnParticles('heart', 16);
    if (has('balloons')) spawnParticles('balloon', 10);
    if (has('glowing-particles')) spawnParticles('glow', 26);
    if (has('sparkles')) spawnParticles('sparkle', 28);
    if (has('butterflies')) spawnParticles('butterfly', 8);

    let fireworkTimer = 0;
    const spawnFireworkBurst = () => {
      const cx = width * (0.2 + Math.random() * 0.6);
      const cy = height * (0.15 + Math.random() * 0.45);
      const colors = ['#F59E0B', '#FB7185', '#38BDF8', '#A78BFA', '#FFFFFF'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      for (let i = 0; i < 24; i++) {
        const angle = (Math.PI * 2 * i) / 24;
        const speed = 1.4 + Math.random() * 2.2;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2.5,
          color,
          alpha: 1,
          rotation: 0,
          vRot: 0,
          kind: 'firework',
          life: 0,
          maxLife: 52 + Math.random() * 20,
        });
      }
    };

    if (has('confetti')) {
      triggerConfettiCelebration(accentColor);
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (has('fireworks')) {
        fireworkTimer += 1;
        if (fireworkTimer % 75 === 1) {
          spawnFireworkBurst();
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx + (p.kind === 'petal' || p.kind === 'butterfly' ? Math.sin(Date.now() * 0.002 + i) * 0.45 : 0);
        p.y += p.vy;
        p.rotation += p.vRot;

        if (p.kind === 'firework') {
          p.vy += 0.03;
          p.life = (p.life || 0) + 1;
          p.alpha = Math.max(0, 1 - p.life / (p.maxLife || 60));
          if (p.life >= (p.maxLife || 60)) {
            particles.splice(i, 1);
            continue;
          }
        } else {
          if (p.vy > 0 && p.y > height + 40) {
            p.y = -20;
            p.x = Math.random() * width;
          } else if (p.vy < 0 && p.y < -50) {
            p.y = height + 40;
            p.x = Math.random() * width;
          }
          if (p.x < -30) p.x = width + 20;
          if (p.x > width + 30) p.x = -20;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.kind === 'petal') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.7, p.size * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'heart') {
          ctx.fillStyle = p.color;
          const s = p.size * 0.55;
          ctx.beginPath();
          ctx.moveTo(0, s * 0.4);
          ctx.bezierCurveTo(-s, -s * 0.4, -s * 1.4, s * 0.7, 0, s * 1.5);
          ctx.bezierCurveTo(s * 1.4, s * 0.7, s, -s * 0.4, 0, s * 0.4);
          ctx.fill();
        } else if (p.kind === 'balloon') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.72, p.size * 0.9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, p.size * 0.9);
          ctx.quadraticCurveTo(4, p.size * 1.5, -2, p.size * 2.1);
          ctx.stroke();
        } else if (p.kind === 'butterfly') {
          const wingFlap = 0.55 + Math.abs(Math.sin(Date.now() * 0.012 + i)) * 0.45;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(-p.size * 0.45 * wingFlap, -2, p.size * 0.55 * wingFlap, p.size * 0.38, -0.3, 0, Math.PI * 2);
          ctx.ellipse(p.size * 0.45 * wingFlap, -2, p.size * 0.55 * wingFlap, p.size * 0.38, 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'sparkle') {
          const pulse = 0.6 + Math.abs(Math.sin(Date.now() * 0.005 + i)) * 0.4;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * pulse, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      animId = window.requestAnimationFrame(render);
    };

    animId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [effects, intensity, accentColor, active]);

  if (!active || effects.length === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full z-10"
      aria-hidden="true"
    />
  );
}
