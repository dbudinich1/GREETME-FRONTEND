// src/components/hub/HubPostVerification.jsx
// SOCIAL-C — Post URL Verification Lite intake. A single "Paste your post link" field that
// submits a link for MANUAL human review (stored pending_review server-side; never
// auto-verified). Self-contained + dormant: renders NOTHING while POST_VERIFICATION_ENABLED
// is false (matches the backend flag). No OAuth, no scraping — just a link + a review promise.

import { useState } from 'react';
import { LinkIcon, Check } from 'lucide-react';
import api from '../../api/api';
import { POST_VERIFICATION_ENABLED } from './hubConfig';

const looksLikeUrl = (s) => {
  try { const u = new URL(String(s).trim()); return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.'); }
  catch { return false; }
};

export default function HubPostVerification() {
  // Hooks must run unconditionally (rules-of-hooks) — declare before the dormant early-return.
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { type: 'success'|'error', message }

  if (!POST_VERIFICATION_ENABLED) return null; // dormant-first — hidden until founder enables

  const disabled = submitting || !looksLikeUrl(url);

  const submit = async () => {
    if (disabled) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.submitPostVerification(url.trim());
      if (res?.ok) {
        setResult({ type: 'success', message: 'Thanks! Your post is pending review — we’ll take it from here.' });
        setUrl('');
      } else {
        const msg = res?.reason === 'invalid_url' ? 'That doesn’t look like a valid post link.'
          : res?.reason === 'disabled' ? 'Post verification isn’t available right now.'
          : 'Could not submit right now. Please try again.';
        setResult({ type: 'error', message: msg });
      }
    } catch {
      setResult({ type: 'error', message: 'Could not submit right now. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hub-card" style={{
      background: 'var(--bg-primary)',
      borderRadius: 'var(--radius-xl)',
      padding: '1.75rem',
      marginBottom: '2rem',
      border: '1px solid var(--border)'
    }}>
      <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <LinkIcon size={20} style={{ color: '#8b5cf6' }} />
        Share a post
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1rem', lineHeight: 1.5 }}>
        Posted a Greet-Me somewhere? Paste the link and our team will review it.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="Paste your post link"
          aria-label="Paste your post link"
          style={{
            flex: 1,
            minWidth: '200px',
            padding: '0.75rem 0.875rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            fontFamily: 'inherit'
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className="hub-btn"
          style={{
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            background: disabled ? 'var(--gray-300)' : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
            color: 'white',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit'
          }}
        >
          {submitting ? 'Submitting…' : 'Submit for review'}
        </button>
      </div>
      {result ? (
        <p style={{
          marginTop: '0.75rem',
          marginBottom: 0,
          fontSize: '0.8125rem',
          fontWeight: 500,
          lineHeight: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: result.type === 'success' ? '#16a34a' : '#dc2626'
        }}>
          {result.type === 'success' ? <Check size={15} /> : null}
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
