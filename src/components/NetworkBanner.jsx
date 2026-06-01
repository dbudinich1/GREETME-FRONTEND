// src/components/NetworkBanner.jsx
// P.LAUNCH.NETWORK — graceful network-failure feedback.
// Listens for 'network:unavailable' (dispatched by api.js on fetch TypeError)
// and the browser 'online' event. Shows a toast banner; auto-hides after 5s
// or immediately on reconnect.
import { useEffect, useState, useRef } from 'react';

export default function NetworkBanner() {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    const showBanner = () => {
      setVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setVisible(false), 5000);
    };
    const hideBanner = () => {
      setVisible(false);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };

    window.addEventListener('network:unavailable', showBanner);
    window.addEventListener('online', hideBanner);

    return () => {
      window.removeEventListener('network:unavailable', showBanner);
      window.removeEventListener('online', hideBanner);
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
      Connection lost. Please check your network and try again.
    </div>
  );
}
