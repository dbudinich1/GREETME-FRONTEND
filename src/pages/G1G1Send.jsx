// src/pages/G1G1Send.jsx
// Sender-facing page for a G1G1 gift: the subscriber emails a BRANDED Greet-Me
// invitation to a recipient (primary), or copies the claim link (secondary).
// Route: /gift/g1g1/:giftCode/send  (distinct from the recipient claim route).
// This page NEVER claims the gift and never calls the claim endpoint.

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import GreetMeLogo from '../components/GreetMeLogo';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export default function G1G1Send() {
  const { giftCode } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [gift, setGift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientFirstName, setRecipientFirstName] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');

  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [copied, setCopied] = useState(false);

  const claimUrl = `${window.location.origin}/#/gift/g1g1/${giftCode}`;

  useEffect(() => {
    if (!giftCode) { setLoadError('No gift code provided'); setLoading(false); return; }
    api.getG1G1Gift(giftCode)
      .then((res) => {
        if (res?.ok && res.gift) setGift(res.gift);
        else setLoadError(res?.error || 'Gift not found');
      })
      .catch(() => setLoadError('Unable to load gift details'))
      .finally(() => setLoading(false));
  }, [giftCode]);

  const handleSend = async () => {
    setSendError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
      setSendError('Please enter a valid recipient email.');
      return;
    }
    setSending(true);
    try {
      const res = await api.sendG1G1Gift(giftCode, {
        recipientEmail: recipientEmail.trim(),
        recipientFirstName: recipientFirstName.trim(),
        personalMessage: personalMessage.trim(),
      });
      if (res?.ok) {
        setSentTo(recipientEmail.trim());
      } else {
        setSendError(res?.error || 'Could not send the gift. Please try again.');
      }
    } catch (err) {
      if (err?.status === 401) setSendError('Please sign in to send your gift.');
      else if (err?.status === 403) setSendError("This gift isn't yours to send.");
      else if (err?.status === 409) setSendError('This gift has already been claimed.');
      else if (err?.status === 429) setSendError("You've reached the maximum number of sends for this gift.");
      else if (err?.status === 400) setSendError('Please enter a valid recipient email.');
      else setSendError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(claimUrl)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {});
  };

  // ---- Render ----
  if (loading) {
    return <Shell><p style={styles.loadingText}>Loading your gift…</p></Shell>;
  }
  if (loadError && !gift) {
    return (
      <Shell>
        <h1 style={styles.title}>Gift Not Found</h1>
        <p style={styles.subtitle}>{loadError}</p>
        <button onClick={() => navigate('/')} style={styles.secondaryBtn}>Go to Greet-Me</button>
      </Shell>
    );
  }
  if (gift?.status === 'claimed') {
    return (
      <Shell>
        <div style={styles.emoji}>🎉</div>
        <h1 style={styles.title}>This gift has already been claimed.</h1>
        <p style={styles.subtitle}>Your recipient has activated their free membership.</p>
        <button onClick={() => navigate('/dashboard')} style={styles.primaryBtn}>Go to Dashboard</button>
      </Shell>
    );
  }
  if (sentTo) {
    return (
      <Shell>
        <div style={styles.emoji}>📨</div>
        <h1 style={styles.title}>Your gift is on its way!</h1>
        <p style={styles.subtitle}>We emailed a branded Greet-Me invitation to <strong>{sentTo}</strong>.</p>
        <button onClick={() => { setSentTo(null); setRecipientEmail(''); setRecipientFirstName(''); setPersonalMessage(''); }} style={styles.secondaryBtn}>
          Send to someone else
        </button>
        <button onClick={() => navigate('/dashboard')} style={{ ...styles.primaryBtn, marginTop: '0.75rem' }}>Go to Dashboard</button>
      </Shell>
    );
  }

  const planName = gift?.planName || 'Greet-Me';

  return (
    <Shell>
      <div style={styles.badge}>YOUR GIFT TO GIVE</div>
      <h1 style={styles.title}>Send Your Greet-Me Gift</h1>
      <p style={styles.subtitle}>
        Your plan includes a free <strong>{planName}</strong> membership to give away.
        Send a branded invitation straight to your recipient&rsquo;s inbox.
      </p>

      {!isAuthenticated ? (
        <>
          <div style={styles.infoBox}>Please sign in to send your gift, then return to this page.</div>
          <button onClick={() => navigate('/login')} style={styles.primaryBtn}>Sign In</button>
        </>
      ) : (
        <>
          {sendError && <div style={styles.errorBox}>{sendError}</div>}

          <label style={styles.label}>Recipient email</label>
          <input style={styles.input} type="email" placeholder="them@example.com"
            value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />

          <label style={styles.label}>Recipient first name <span style={styles.optional}>(optional)</span></label>
          <input style={styles.input} type="text" placeholder="First name"
            value={recipientFirstName} onChange={(e) => setRecipientFirstName(e.target.value)} />

          <label style={styles.label}>Personal message <span style={styles.optional}>(optional)</span></label>
          <textarea style={{ ...styles.input, minHeight: '72px', resize: 'vertical' }} placeholder="Add a short note…"
            value={personalMessage} onChange={(e) => setPersonalMessage(e.target.value)} maxLength={500} />

          <button onClick={handleSend} disabled={sending}
            style={{ ...styles.primaryBtn, ...(sending ? styles.disabledBtn : {}) }}>
            {sending ? 'Sending…' : 'Send Gift Email'}
          </button>

          <div style={styles.divider} />
          <p style={styles.fallbackLabel}>Prefer to share it yourself?</p>
          <div style={styles.linkBox}>
            <span style={styles.linkText}>{claimUrl}</span>
          </div>
          <button onClick={copyLink} style={styles.secondaryBtn}>{copied ? 'Copied!' : 'Copy Gift Link'}</button>
        </>
      )}

      <p style={styles.footer}>Greet One, Give One&trade; — included with full memberships.</p>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <GreetMeLogo size="medium" clickable={false} />
        {children}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: FONT_STACK },
  card: { background: 'white', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' },
  badge: { display: 'inline-block', marginTop: '1rem', padding: '4px 14px', background: '#f5f3ff', color: '#7c3aed', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' },
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', margin: '0.75rem 0 0.5rem', lineHeight: 1.3 },
  subtitle: { fontSize: '0.9375rem', color: '#4b5563', lineHeight: 1.6, margin: '0 0 1.25rem' },
  label: { display: 'block', textAlign: 'left', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0.75rem 0 0.375rem' },
  optional: { color: '#9ca3af', fontWeight: 400 },
  input: { width: '100%', padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '1rem', fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff' },
  primaryBtn: { width: '100%', marginTop: '1rem', padding: '0.875rem', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', fontFamily: FONT_STACK, minHeight: '48px' },
  secondaryBtn: { width: '100%', marginTop: '0.75rem', padding: '0.75rem', background: 'transparent', color: '#6366f1', border: '2px solid #6366f1', borderRadius: '12px', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', fontFamily: FONT_STACK },
  disabledBtn: { background: '#d1d5db', cursor: 'not-allowed' },
  divider: { height: '1px', background: '#e5e7eb', margin: '1.5rem 0 1rem' },
  fallbackLabel: { fontSize: '0.8125rem', color: '#6b7280', margin: '0 0 0.5rem' },
  linkBox: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.625rem 0.75rem', textAlign: 'left' },
  linkText: { fontSize: '0.8125rem', color: '#4F2D7F', wordBreak: 'break-all' },
  infoBox: { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.875rem', textAlign: 'left' },
  emoji: { fontSize: '3rem', margin: '1rem 0 0', lineHeight: 1 },
  loadingText: { fontSize: '1rem', color: '#6b7280', marginTop: '1rem' },
  footer: { marginTop: '1.5rem', fontSize: '0.8125rem', color: '#9ca3af' },
};
