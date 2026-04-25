// src/components/HeartsBurst.jsx
// Transient visual-only hearts burst. No state persistence, no counters,
// no reward logic. Triggered by changing triggerKey to a new value.

import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

const BURST_DURATION_MS = 1500;
const HEART_COUNT = 7;

export default function HeartsBurst({ triggerKey }) {
  const [activeKey, setActiveKey] = useState(null);

  useEffect(() => {
    if (triggerKey === undefined || triggerKey === null) return;
    if (triggerKey === activeKey) return;
    setActiveKey(triggerKey);
    const t = setTimeout(() => setActiveKey(null), BURST_DURATION_MS);
    return () => clearTimeout(t);
  }, [triggerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (activeKey === null) return null;

  const hearts = Array.from({ length: HEART_COUNT }, (_, i) => {
    const offset = (i - (HEART_COUNT - 1) / 2) * 32;
    const delay = i * 60;
    const size = 24 + (i % 3) * 6;
    return { offset, delay, size, key: i };
  });

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
      {hearts.map((h) => (
        <Heart
          key={`${activeKey}-${h.key}`}
          size={h.size}
          fill="#ec4899"
          color="#ec4899"
          style={{
            position: 'absolute',
            left: `${h.offset}px`,
            top: 0,
            opacity: 0,
            animation: `heartsBurst 1.4s ease-out ${h.delay}ms forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes heartsBurst {
          0%   { opacity: 0; transform: translateY(0) scale(0.5); }
          20%  { opacity: 1; transform: translateY(-20px) scale(1); }
          100% { opacity: 0; transform: translateY(-140px) scale(0.9); }
        }
      `}</style>
    </div>
  );
}
