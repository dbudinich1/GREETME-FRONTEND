// src/components/RateLimitBanner.jsx
// P.LAUNCH.RATELIMIT — 429 user-facing feedback.
// Listens for 'rate-limit:active' (dispatched by api.js when an API call
// returns 429) and shows a fixed top toast with a live countdown until
// the server's Retry-After window elapses.
import { useEffect, useState, useRef } from 'react';

export default function RateLimitBanner() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    const onRateLimit = (event) => {
      const raw = Number(event?.detail?.retryAfter);
      const safe = Math.max(1, Math.min(300, Number.isFinite(raw) ? raw : 60));
      setSecondsLeft(safe);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    window.addEventListener('rate-limit:active', onRateLimit);
    return () => {
      window.removeEventListener('rate-limit:active', onRateLimit);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (secondsLeft <= 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        background: '#6b3a2a',
        color: '#fffdf8',
        textAlign: 'center',
        padding: '12px 16px',
        fontFamily: 'Georgia, serif',
        fontSize: '15px',
        letterSpacing: '0.4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      {`Too many requests. Please wait ${secondsLeft} second${secondsLeft === 1 ? '' : 's'} before trying again.`}
    </div>
  );
}
