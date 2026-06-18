// src/components/BusinessGiftCreditsPanel.jsx
// Business-only panel for the annual G1G1 gift-credit model. Reads
// GET /api/gifts/g1g1/credits and renders nothing for personal / ineligible
// tiers (giftTier null or annualG1G1Credits 0). "Send Gift Membership" spends
// one credit via POST /api/gifts/g1g1/create, which reuses the existing G1G1
// gift record, email, and claim flow.
import { useState, useEffect } from 'react';
import { Gift } from 'lucide-react';
import api from '../api/api';

const GIFT_TIER_LABELS = {
  social_butterfly: 'Social Butterfly membership',
  business_scale: 'Impact membership',
  close_circle: 'Close Circle membership',
  unforgettable: 'Legend membership',
};

export default function BusinessGiftCreditsPanel({ isNarrow = false }) {
  const [state, setState] = useState({ loaded: false, annual: 0, remaining: 0, giftTier: null });
  const [showForm, setShowForm] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendLater, setSendLater] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { ok, claimUrl } | { error }

  useEffect(() => {
    let active = true;
    api.get('/api/gifts/g1g1/credits')
      .then((d) => {
        if (!active) return;
        if (d?.ok) {
          setState({ loaded: true, annual: d.annualG1G1Credits || 0, remaining: d.remainingG1G1Credits || 0, giftTier: d.giftTier || null });
        } else {
          setState((s) => ({ ...s, loaded: true }));
        }
      })
      .catch(() => { if (active) setState((s) => ({ ...s, loaded: true })); });
    return () => { active = false; };
  }, []);

  // Render nothing until loaded, and never for personal / ineligible tiers.
  if (!state.loaded || !state.giftTier || state.annual <= 0) return null;

  const tierLabel = GIFT_TIER_LABELS[state.giftTier] || 'membership';
  const canSend = state.remaining > 0;

  const openForm = () => {
    setResult(null);
    setRecipientName('');
    setRecipientEmail('');
    setSendLater(false);
    setRequestId(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));
    setShowForm(true);
  };

  const submit = async () => {
    if (submitting) return;
    if (!sendLater && !recipientEmail.trim()) {
      setResult({ error: "Enter a recipient email or choose 'Send later'." });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const d = await api.post('/api/gifts/g1g1/create', {
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim(),
        sendLater,
        clientRequestId: requestId,
      });
      if (d?.ok) {
        setState((s) => ({
          ...s,
          remaining: typeof d.remainingG1G1Credits === 'number' ? d.remainingG1G1Credits : Math.max(0, s.remaining - 1),
        }));
        setResult({ ok: true, claimUrl: d.claimUrl });
        setShowForm(false);
      } else {
        setResult({ error: d?.error || 'Could not send gift.' });
      }
    } catch (e) {
      setResult({ error: e?.message || 'Could not send gift.' });
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.625rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(255,255,255,0.4)',
    background: 'rgba(255,255,255,0.95)',
    color: '#0f172a',
    fontSize: '0.9375rem',
    fontFamily: 'inherit',
    marginBottom: '0.5rem',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #6b3a2a 0%, #8a4a33 100%)',
      borderRadius: 'var(--radius-lg)',
      padding: isNarrow ? '1rem' : '1.25rem',
      marginBottom: '1rem',
      color: 'white',
      boxShadow: '0 2px 8px rgba(107, 58, 42, 0.25)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <Gift size={20} />
        <h3 style={{ fontSize: isNarrow ? '1.125rem' : '1.375rem', fontWeight: 700, margin: 0 }}>
          Gift Memberships
        </h3>
      </div>
      <p style={{ fontSize: isNarrow ? '0.8125rem' : '0.9375rem', fontWeight: 600, opacity: 0.95, margin: '0 0 0.75rem' }}>
        {state.remaining} of {state.annual} Remaining &mdash; each gift grants a {tierLabel}.
      </p>

      {result?.ok && (
        <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--radius-md)', padding: '0.625rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.8125rem' }}>
          Gift created. {result.claimUrl ? <>Share this claim link: <span style={{ wordBreak: 'break-all', fontWeight: 600 }}>{result.claimUrl}</span></> : 'A claim link has been emailed.'}
        </div>
      )}
      {result?.error && (
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', padding: '0.625rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.8125rem' }}>
          {result.error}
        </div>
      )}

      {!showForm ? (
        <button
          onClick={openForm}
          disabled={!canSend}
          style={{
            padding: '0.5rem 0.875rem',
            background: canSend ? 'white' : 'rgba(255,255,255,0.4)',
            color: canSend ? '#6b3a2a' : 'rgba(255,255,255,0.8)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.9375rem',
            fontWeight: 700,
            cursor: canSend ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}
        >
          {canSend ? 'Send Gift Membership' : 'No gifts remaining'}
        </button>
      ) : (
        <div>
          <input style={inputStyle} type="text" placeholder="Recipient name (optional)" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
          <input style={inputStyle} type="email" placeholder="Recipient email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} disabled={sendLater} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={sendLater} onChange={(e) => setSendLater(e.target.checked)} />
            Send later (email the claim link to me instead)
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={submit}
              disabled={submitting}
              style={{ padding: '0.5rem 0.875rem', background: 'white', color: '#6b3a2a', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.9375rem', fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit' }}
            >
              {submitting ? 'Sending…' : 'Send Gift'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              disabled={submitting}
              style={{ padding: '0.5rem 0.875rem', background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 'var(--radius-md)', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
