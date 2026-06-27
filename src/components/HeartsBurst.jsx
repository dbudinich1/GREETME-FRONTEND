// src/components/HeartsBurst.jsx
// Transient, visual-only success celebration: a premium "bloom" of hearts that
// then flies to the persistent Hearts balance — the C3 "find their home" moment.
// No state persistence, no counters, no reward/balance logic. Triggered by
// changing triggerKey. Ambient and non-blocking (pointer-events: none, aria-hidden).
//
// C3 synchronized timing (shared with the chrome-balance count-up in
// DashboardLayout): the bloom appears, travels TRAVEL_MS toward the balance, and
// dissolves as it arrives; the balance count-up completes at TRAVEL_MS + ~100ms so
// it never outruns the arriving Hearts. prefers-reduced-motion disables ALL motion
// (no bloom, no fly). The destination is found at trigger time from the persistent
// balance ([data-gm-hearts-balance]); with no target on screen it blooms in place.

import { useEffect, useState } from 'react';

const TRAVEL_MS = 720;          // travel toward the balance — "inevitable, not fast"
const PULSE_DURATION_MS = 900;  // mount lifetime (>= travel; the bloom has dissolved by TRAVEL_MS)

// Organic, upward-biased spread for an elegant (not perfectly symmetric) bloom.
const BLOOM_HEARTS = [
  { tx: '-46px', ty: '-58px', rot: '-12deg', size: 22, delay: 0 },
  { tx: '50px', ty: '-50px', rot: '14deg', size: 18, delay: 30 },
  { tx: '-66px', ty: '-8px', rot: '-8deg', size: 16, delay: 60 },
  { tx: '64px', ty: '-2px', rot: '10deg', size: 20, delay: 20 },
  { tx: '-34px', ty: '46px', rot: '-14deg', size: 15, delay: 80 },
  { tx: '40px', ty: '52px', rot: '12deg', size: 17, delay: 50 },
];

export default function HeartsBurst({ triggerKey }) {
  // active = { key, dx, dy } — dx/dy is the travel delta to the balance (0,0 = in place).
  const [active, setActive] = useState(null);

  useEffect(() => {
    if (triggerKey === undefined || triggerKey === null) return;
    if (active && active.key === triggerKey) return;
    // Compute the destination delta: from the bloom origin (the fixed 40% / 50% of
    // the viewport) to the persistent Hearts balance, if it is on screen. Falls back
    // to an in-place bloom (0,0) when no target is found — never throws.
    let dx = 0;
    let dy = 0;
    try {
      const target = document.querySelector('[data-gm-hearts-balance]');
      if (target) {
        const r = target.getBoundingClientRect();
        dx = (r.left + r.width / 2) - (window.innerWidth * 0.5);
        dy = (r.top + r.height / 2) - (window.innerHeight * 0.4);
      }
    } catch { /* non-fatal — in-place bloom */ }
    setActive({ key: triggerKey, dx, dy });
    const t = setTimeout(() => setActive(null), PULSE_DURATION_MS);
    return () => clearTimeout(t);
  }, [triggerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (active === null) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 9999,
        width: 0,
        height: 0,
      }}
    >
      {/* The cluster: blooms at the origin, then glides to the balance and converges. */}
      <div
        key={active.key}
        className="gm-bloom-fly"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          ['--gm-fly-x']: `${active.dx}px`,
          ['--gm-fly-y']: `${active.dy}px`,
          willChange: 'transform, opacity',
          animation: `gmFlyHome ${TRAVEL_MS}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
        }}
      >
        {/* Soft premium halo — gentle warmth, far subtler than a full radial glow */}
        <div
          className="gm-bloom-item"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(244,63,94,0.28) 0%, rgba(244,63,94,0.12) 40%, rgba(244,63,94,0) 70%)',
            opacity: 0,
            animation: 'gmSoftHalo 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
          }}
        />
        {/* Central lead heart — a soft pop */}
        <span
          className="gm-bloom-item"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            fontSize: '30px',
            lineHeight: 1,
            opacity: 0,
            filter: 'drop-shadow(0 2px 3px rgba(190,18,60,0.35))',
            willChange: 'transform, opacity',
            animation: 'gmHeartPop 760ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
          }}
        >
          ❤️
        </span>
        {/* Blooming hearts */}
        {BLOOM_HEARTS.map((h, i) => (
          <span
            key={i}
            className="gm-bloom-item"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              fontSize: `${h.size}px`,
              lineHeight: 1,
              opacity: 0,
              filter: 'drop-shadow(0 1px 2px rgba(190,18,60,0.30))',
              willChange: 'transform, opacity',
              ['--tx']: h.tx,
              ['--ty']: h.ty,
              ['--rot']: h.rot,
              animation: `gmHeartBloom 820ms cubic-bezier(0.22, 1, 0.36, 1) ${h.delay}ms forwards`,
            }}
          >
            ❤️
          </span>
        ))}
      </div>
      <style>{`
        @keyframes gmFlyHome {
          0%   { transform: translate(0px, 0px) scale(1); opacity: 1; }
          16%  { transform: translate(0px, 0px) scale(1); opacity: 1; }
          100% { transform: translate(var(--gm-fly-x), var(--gm-fly-y)) scale(0.28); opacity: 0; }
        }
        @keyframes gmHeartBloom {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.2) rotate(0deg); }
          18%  { opacity: 1; transform: translate(calc(-50% + (var(--tx) * 0.45)), calc(-50% + (var(--ty) * 0.45))) scale(1.05) rotate(var(--rot)); }
          100% { opacity: 0; transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.85) rotate(var(--rot)); }
        }
        @keyframes gmHeartPop {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
          25%  { opacity: 1; transform: translate(-50%, -50%) scale(1.18); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.0); }
        }
        @keyframes gmSoftHalo {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          22%  { opacity: 0.55; transform: translate(-50%, -50%) scale(1.0); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.25); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gm-bloom-fly { animation: none !important; opacity: 0 !important; }
          .gm-bloom-item { animation: none !important; opacity: 0 !important; }
        }
      `}</style>
    </div>
  );
}
