import React, { useRef, useEffect } from 'react';

// How fast the rings move per status
const SPEED_MAP = {
  idle: 0.2,
  connecting: 0.9,
  active: 0.5,
  listening: 1.4,
  speaking: 1.1,
  processing: 1.6,
  error: 0.15,
};

// Overall brightness/intensity per status
const INTENSITY_MAP = {
  idle: 0.22,
  connecting: 0.55,
  active: 0.65,
  listening: 1.0,
  speaking: 0.95,
  processing: 0.85,
  error: 0.28,
};

// [radius, lineWidth, color, rotationSpeed, baseFraction, phaseOffset]
const RINGS = [
  [54,  4.0, '#00F0FF',  0.55, 0.68, 0.00],
  [66,  3.0, '#7000FF', -0.38, 0.52, 1.05],
  [78,  2.5, '#00FF94',  0.62, 0.44, 2.10],
  [90,  2.0, '#00F0FF', -0.28, 0.58, 3.15],
  [102, 1.5, '#7000FF',  0.42, 0.38, 4.20],
  [114, 1.2, '#00FF94', -0.22, 0.32, 5.25],
  [126, 0.8, '#00F0FF',  0.18, 0.24, 0.70],
];

const SIZE = 320;

/**
 * FluidCircle — Canvas-based animated fluid ring symbol.
 * Multiple arc segments rotate at different speeds with sinusoidally
 * varying lengths and opacities, giving a flowing liquid-light effect.
 */
export function FluidCircle({ status }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const tRef      = useRef(0);
  const statusRef = useRef(status);

  // Keep statusRef current without restarting the draw loop
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const DPR = window.devicePixelRatio || 1;
    canvas.width  = SIZE * DPR;
    canvas.height = SIZE * DPR;
    canvas.style.width  = `${SIZE}px`;
    canvas.style.height = `${SIZE}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    const cx = SIZE / 2;
    const cy = SIZE / 2;

    const draw = () => {
      const st        = statusRef.current;
      const speed     = SPEED_MAP[st]     ?? 0.5;
      const intensity = INTENSITY_MAP[st] ?? 0.5;

      tRef.current += 0.016 * speed;
      const t = tRef.current;

      ctx.clearRect(0, 0, SIZE, SIZE);

      RINGS.forEach(([r, lw, color, rotSpeed, baseFrac, phase]) => {
        // Sinusoidally modulate arc length for a fluid, breathing feel
        const fraction = Math.max(0.04, baseFrac + 0.18 * Math.sin(t * 1.8 + phase));
        // Sinusoidally modulate opacity
        const alpha = Math.max(0.04, (0.42 + 0.35 * Math.sin(t * 2.2 + phase)) * intensity);
        const rot = t * rotSpeed;

        ctx.save();
        ctx.strokeStyle    = color;
        ctx.lineWidth      = lw;
        ctx.lineCap        = 'round';
        ctx.globalAlpha    = alpha;
        ctx.shadowColor    = color;
        ctx.shadowBlur     = 16 * intensity;

        ctx.beginPath();
        ctx.arc(cx, cy, r, rot, rot + Math.PI * 2 * fraction);
        ctx.stroke();

        ctx.restore();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []); // draw loop starts once; status changes flow through statusRef

  return (
    <canvas
      ref={canvasRef}
      data-testid="fluid-circle-canvas"
      style={{ position: 'absolute', pointerEvents: 'none', zIndex: 0 }}
    />
  );
}
