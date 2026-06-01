// src/components/ServerErrorBanner.jsx
// P.LAUNCH.SERVER-ERROR-FEEDBACK — 5xx user-facing feedback.
// Listens for 'server-error:active' (dispatched by api.js on 5xx responses)
// and shows a fixed top toast for 5 seconds.
import { useEffect, useState, useRef } from 'react';

export default function ServerErrorBanner() {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    const showBanner = () => {
      setVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setVisible(false), 5000);
    };

    window.addEventListener('server-error:active', showBanner);
    return () => {
      window.removeEventListener('server-error:active', showBanner);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
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
      Server error. Please try again in a moment.
    </div>
  );
}
