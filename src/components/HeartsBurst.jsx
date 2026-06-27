// src/components/HeartsBurst.jsx
// Transient, visual-only success celebration: a subtle premium "bloom" of hearts
// at the action point. No state persistence, no counters, no reward/balance logic.
// Triggered by changing triggerKey to a new value. Ambient and non-blocking
// (pointer-events: none, aria-hidden). Component name + API kept for compatibility.

import { useEffect, useState } from 'react';

const PULSE_DURATION_MS = 900;

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
  const [activeKey, setActiveKey] = useState(null);

  useEffect(() => {
    if (triggerKey === undefined || triggerKey === null) return;
    if (triggerKey === activeKey) return;
    setActiveKey(triggerKey);
    const t = setTimeout(() => setActiveKey(null), PULSE_DURATION_MS);
    return () => clearTimeout(t);
  }, [triggerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (activeKey === null) return null;

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
      <div key={activeKey} style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}>
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
          .gm-bloom-item { animation: none !important; opacity: 0 !important; }
        }
      `}</style>
    </div>
  );
}
