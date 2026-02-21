// src/components/TutorialVideo.jsx
import { useState } from 'react';

export default function TutorialVideo({ variant = 'full' }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const isTeaser = variant === 'teaser';
  return (
    <div style={{
      background: '#F8F9FA',
      borderRadius: '12px',
      border: '1px solid #E0E0E0',
      padding: isTeaser ? '1rem' : '1.5rem',
      textAlign: 'center',
      position: 'relative',
    }}>
      <button onClick={() => setDismissed(true)} style={{
        position: 'absolute', top: '8px', right: '12px',
        background: 'none', border: 'none', fontSize: '1.2rem',
        cursor: 'pointer', color: '#AAA'
      }}>×</button>
      <div style={{
        background: '#1B2A4A',
        borderRadius: '8px',
        padding: isTeaser ? '2rem 1rem' : '3rem 2rem',
        color: '#FFF',
        marginBottom: '1rem',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>▶️</div>
        <p style={{ margin: 0, fontSize: isTeaser ? '0.85rem' : '1rem', opacity: 0.9 }}>
          {isTeaser
            ? 'See how Greet-Me™ works in 30 seconds'
            : 'Learn how to use Greet-Me™ in under 2 minutes'}
        </p>
      </div>
      <p style={{ fontSize: '0.8rem', color: '#999', margin: 0 }}>
        Video coming soon — finishing touches in progress!
      </p>
    </div>
  );
}
