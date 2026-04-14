// src/pages/AppInstall.jsx
// Branded PWA install landing page — route: /#/app
import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const PURPLE = '#4F2D7F';
const INSTALL_URL = 'https://greet-me.com/#/app';

export default function AppInstall() {
  const [qrUrl, setQrUrl] = useState(null);

  useEffect(() => {
    QRCode.toDataURL(INSTALL_URL, {
      width: 400, margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setQrUrl).catch(() => {});
  }, []);

  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(135deg, ${PURPLE} 0%, #2D1B4E 100%)`,
      color: 'white',
      fontFamily: FONT,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: '420px', width: '100%' }}>
        {/* Logo + Title */}
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 700,
          margin: '0 0 0.25rem',
          fontFamily: 'Georgia, serif',
        }}>
          Greet-Me™
        </h1>
        <p style={{
          fontSize: '0.9375rem',
          color: 'rgba(255,255,255,0.7)',
          fontStyle: 'italic',
          margin: '0 0 2rem',
          fontFamily: 'Georgia, serif',
        }}>
          Forget Them Not!™
        </p>

        {/* QR Code */}
        {qrUrl && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '1.25rem',
            display: 'inline-block',
            marginBottom: '2rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <img src={qrUrl} alt="Scan to install Greet-Me" style={{ width: '180px', height: '180px' }} />
          </div>
        )}

        <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '2rem' }}>
          Add Greet-Me to your home screen
        </p>

        {/* iPhone Instructions */}
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1rem',
          textAlign: 'left',
        }}>
          <p style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            iPhone (Safari)
          </p>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', lineHeight: 1.8 }}>
            <li>Open this page in <strong>Safari</strong></li>
            <li>Tap the <strong>Share</strong> button (square with arrow)</li>
            <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
            <li>Tap <strong>Add</strong></li>
          </ol>
        </div>

        {/* Android Instructions */}
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '2rem',
          textAlign: 'left',
        }}>
          <p style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Android (Chrome)
          </p>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', lineHeight: 1.8 }}>
            <li>Open this page in <strong>Chrome</strong></li>
            <li>Tap the <strong>⋮ menu</strong> (top right)</li>
            <li>Tap <strong>"Add to Home screen"</strong></li>
            <li>Tap <strong>Add</strong></li>
          </ol>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
          No app store needed. Works instantly.
        </p>
      </div>
    </div>
  );
}
