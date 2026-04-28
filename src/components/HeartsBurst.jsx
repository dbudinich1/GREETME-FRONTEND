// src/components/HeartsBurst.jsx
// Transient visual-only success glow pulse. No state persistence, no counters,
// no reward logic. Triggered by changing triggerKey to a new value.
// (Internally a soft warm glow; component name kept for compatibility.)

import { useEffect, useState } from 'react';

const PULSE_DURATION_MS = 900;

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
      <div
        key={activeKey}
        className="gm-glow-pulse"
        style={{
          position: 'absolute',
          left: '-180px',
          top: '-180px',
          width: '360px',
          height: '360px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 215, 165, 0.45) 0%, rgba(255, 196, 156, 0.30) 35%, rgba(255, 196, 156, 0) 70%)',
          opacity: 0,
          animation: 'gmGlowPulse 900ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
        }}
      />
      <style>{`
        @keyframes gmGlowPulse {
          0%   { opacity: 0; transform: scale(0.6); }
          25%  { opacity: 1; transform: scale(1.0); }
          100% { opacity: 0; transform: scale(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gm-glow-pulse {
            animation: none;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
