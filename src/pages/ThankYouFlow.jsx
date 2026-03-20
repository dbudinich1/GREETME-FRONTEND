// src/pages/ThankYouFlow.jsx
// Phase 1.5 — Prefilled thank-you greeting flow
// Route: /#/thank-you?jobId={jobId}
// Zero blank fields. Send enabled immediately. Auth redirect preserves prefill.

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import VoiceRecorder from '../components/VoiceRecorder';
import PhotoUpload from '../components/PhotoUpload';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export default function ThankYouFlow() {
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId');
  const { user, refreshProfile, register } = useAuth();

  // Inline registration state (guest send path)
  const [showInlineRegister, setShowInlineRegister] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState(null);
  const [registering, setRegistering] = useState(false);

  const [prefill, setPrefill] = useState(null);
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentAt, setSentAt] = useState(null);

  // Track whether user has added assets (refreshes after upload)
  const hasVoice = !!user?.voiceId;
  const hasPhoto = !!user?.photoUrl;
  const [addedVoiceThisSession, setAddedVoiceThisSession] = useState(false);
  const [addedPhotoThisSession, setAddedPhotoThisSession] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setError('Missing greeting reference.');
      setLoading(false);
      return;
    }
    api.getThankyouPrefill(jobId)
      .then((data) => {
        if (data?.ok && data.prefill) {
          setPrefill(data.prefill);
          setScript(data.prefill.script || '');
          // Pre-fill inline registration from greeting data
          if (data.prefill.senderRecipientEmail) setRegEmail(data.prefill.senderRecipientEmail);
          if (data.prefill.senderRecipientName) setRegName(data.prefill.senderRecipientName);
        } else {
          setError('Could not load greeting details.');
        }
      })
      .catch(() => setError('Could not load greeting details.'))
      .finally(() => setLoading(false));
  }, [jobId]);

  // Send: if authenticated → send directly. If not → show inline registration.
  const handleSend = async () => {
    if (!user) {
      setShowInlineRegister(true);
      return;
    }
    await doSend();
  };

  const doSend = async () => {
    setSending(true);
    setError(null);
    try {
      const result = await api.submitThankYouGreeting({
        recipientName: prefill.recipientName,
        recipientEmail: prefill.recipientEmail,
        occasion: prefill.occasion || 'thank-you',
        tone: prefill.tone || 'warm',
        script,
        sourceJobId: jobId,
      });
      if (result?.status === 401) {
        setShowInlineRegister(true);
        setSending(false);
        return;
      }
      if (result?.ok === false) {
        setError(result?.error || 'Something went wrong. Please try again.');
        return;
      }
      setSent(true);
      setSentAt(Date.now());
    } catch (err) {
      setError(err?.message || 'Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleInlineRegister = async (e) => {
    e.preventDefault();
    setRegError(null);
    setRegistering(true);
    try {
      const result = await register(regName.trim(), regEmail.trim().toLowerCase(), regPassword);
      if (!result?.success) {
        const isEmailExists = result?.code === 'EMAIL_EXISTS';
        setRegError(
          isEmailExists
            ? 'This email already has an account.'
            : (result?.error || 'Registration failed. Please try again.')
        );
        setRegistering(false);
        return;
      }
      // Registration succeeded — token is set, user is in context. Now send.
      setShowInlineRegister(false);
      setRegistering(false);
      await doSend();
    } catch (err) {
      setRegError(err?.message || 'Registration failed.');
      setRegistering(false);
    }
  };

  // Optional enhancement handlers (never block send)
  const handleVoiceUpload = async (formData) => {
    try {
      await api.uploadVoice(formData);
      await refreshProfile();
      setAddedVoiceThisSession(true);
    } catch { /* non-fatal */ }
  };

  const handlePhotoUpload = async (formData) => {
    try {
      await api.uploadPhoto(formData);
      await refreshProfile();
      setAddedPhotoThisSession(true);
    } catch { /* non-fatal */ }
  };

  // Fire EXPONENTIAL_MOMENT_SEEN once when sent becomes true
  useEffect(() => {
    if (!sent || !jobId) return;
    fetch('/api/events/exponential-moment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, action: 'seen' }),
    }).catch(() => {});
  }, [sent, jobId]);

  // Fire DISMISSED on browser back / tab close / navigate away (if moment is showing and not shared)
  useEffect(() => {
    if (!sent || !jobId || shared) return;
    const fireDismissed = () => {
      navigator.sendBeacon?.('/api/events/exponential-moment',
        new Blob([JSON.stringify({ jobId, action: 'dismissed' })], { type: 'application/json' }));
    };
    window.addEventListener('beforeunload', fireDismissed);
    window.addEventListener('hashchange', fireDismissed);
    return () => {
      window.removeEventListener('beforeunload', fireDismissed);
      window.removeEventListener('hashchange', fireDismissed);
    };
  }, [sent, jobId, shared]);

  const [shared, setShared] = useState(false);
  const [rewardResult, setRewardResult] = useState(null);

  const handleShare = async () => {
    // Fire share event log
    fetch('/api/events/exponential-moment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, action: 'share' }),
    }).catch(() => {});

    // Call reward unlock API (authenticated, idempotent, capped)
    try {
      const reward = await api.request('/api/events/share-reward', {
        method: 'POST',
        body: JSON.stringify({ sourceJobId: jobId }),
      });
      setRewardResult(reward);
    } catch { /* non-fatal — share still counts */ }

    setShared(true);

    // Native share or fallback
    const shareUrl = `${window.location.origin}/#/g/${jobId}`;
    if (navigator.share) {
      navigator.share({
        title: 'Greet-Me',
        text: 'I just sent a Greet-Me \u2014 and it started something. Come see what I mean.',
        url: shareUrl,
      }).catch(() => {});
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard?.writeText(
        `I just sent a Greet-Me \u2014 and it started something. Come see what I mean. ${shareUrl}`
      ).catch(() => {});
    }
  };

  const handleDismiss = () => {
    fetch('/api/events/exponential-moment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, action: 'dismissed' }),
    }).catch(() => {});
    window.location.href = '/#/dashboard';
  };

  // ---- Exponential Moment (post-send success) ----
  // Gate: only show within 90 minutes of send
  const EXPIRY_MS = 90 * 60 * 1000;
  const momentExpired = sentAt && (Date.now() - sentAt > EXPIRY_MS);

  if (sent && !momentExpired) {
    const isQrCash = prefill?.giftType === 'qrcash';
    const hasGiftContext = prefill?.hasGift;

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #1B2A4A 0%, #2d1b4e 40%, #1B2A4A 100%)',
        padding: '2rem 1.5rem',
        fontFamily: FONT_STACK,
      }}>
        <div style={{
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
        }}>
          {/* Success checkmark */}
          <div style={{
            width: '4.5rem',
            height: '4.5rem',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '2px solid rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 2rem',
            fontSize: '2rem',
            color: '#10b981',
          }}>
            &#10003;
          </div>

          {/* Sent confirmation */}
          <p style={{
            fontSize: '0.875rem',
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            margin: '0 0 0.75rem',
          }}>
            Sent
          </p>

          {/* Canonical line — exact, once only */}
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 500,
            color: '#fff',
            lineHeight: 1.5,
            margin: '0 0 2.5rem',
            fontFamily: 'Georgia, serif',
          }}>
            This is how Greet-Me &mdash; and you &mdash; make life&rsquo;s moments truly unforgettable.
          </h1>

          {/* Incentive copy */}
          {hasGiftContext && (
            <p style={{
              fontSize: '0.9375rem',
              color: 'rgba(255,255,255,0.7)',
              lineHeight: 1.6,
              margin: '0 0 2rem',
            }}>
              {isQrCash
                ? 'Share and we\u2019ll match your gift with up to $10 in Greet-Me credit.'
                : 'Share and we\u2019ll double your Greet-Me credit.'}
            </p>
          )}

          {/* Primary CTA / Shared confirmation */}
          {shared ? (
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#10b981', fontFamily: 'Georgia, serif' }}>
                &#10003; Shared
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.375rem' }}>
                {rewardResult?.rewardCreditCents > 0
                  ? `$${(rewardResult.rewardCreditCents / 100).toFixed(0)} credit unlocked \u2014 applied to your next subscription.`
                  : rewardResult?.duplicate
                    ? 'Reward already applied to your account.'
                    : 'Thanks for sharing.'}
              </p>
            </div>
          ) : (
            <button
              onClick={handleShare}
              style={{
                display: 'inline-block',
                padding: '0.875rem 2.5rem',
                background: '#fff',
                color: '#1B2A4A',
                border: 'none',
                borderRadius: '2rem',
                fontSize: '1.0625rem',
                fontWeight: 600,
                fontFamily: 'Georgia, serif',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(255,255,255,0.15)',
                marginBottom: '1.5rem',
              }}
            >
              Share the Moment
            </button>
          )}

          {/* Dismiss */}
          <div>
            <button
              onClick={handleDismiss}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.35)',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                fontFamily: FONT_STACK,
              }}
            >
              Continue to dashboard
            </button>
          </div>

          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', margin: '3rem 0 0' }}>
            &copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;
          </p>
        </div>
      </div>
    );
  }

  // ---- Loading ----
  if (loading) {
    return (
      <div style={styles.page}>
        <p style={{ color: '#6b7280', fontFamily: FONT_STACK }}>Loading your greeting...</p>
      </div>
    );
  }

  // ---- Error ----
  if (error || !prefill) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>Oops</h1>
          <p style={{ fontSize: '1rem', color: '#6b7280', margin: '0 0 1.5rem' }}>
            {error || 'Something went wrong.'}
          </p>
          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
        </div>
      </div>
    );
  }

  // ---- Main flow ----
  const recipientFirst = (prefill.recipientName || 'them').split(' ')[0];

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* A. Header block */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 0.5rem' }}>
            Your turn
          </p>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1f2937', margin: '0 0 0.75rem', fontFamily: 'Georgia, serif' }}>
            Send a Greet-Me back
          </h1>
          <p style={{ fontSize: '0.95rem', color: '#6b7280', lineHeight: 1.6, margin: 0, maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
            Say thanks to {recipientFirst} in seconds &mdash; then make it even more personal with your voice or photo.
          </p>
        </div>

        {/* B. Message card */}
        <div style={styles.section}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
            Your message
          </label>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={7}
            style={{
              width: '100%',
              padding: '1rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.75rem',
              fontSize: '0.95rem',
              fontFamily: 'Georgia, serif',
              lineHeight: 1.7,
              resize: 'vertical',
              boxSizing: 'border-box',
              background: '#fff',
            }}
          />
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0.5rem 0 0' }}>
            This is already written for you &mdash; edit anything you like.
          </p>
        </div>

        {/* C. Enhancement card — optional, above Send, shown to all users */}
        {(
          <div style={styles.enhanceCard}>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937', margin: '0 0 0.25rem' }}>
              Make it even more special
            </p>
            <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '0 0 1.25rem' }}>
              Optional, but highly recommended.
            </p>

            {user ? (
              <>
                {/* Voice row — always visible for authenticated users */}
                <div style={styles.enhanceRow}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', margin: '0 0 0.25rem' }}>
                      {addedVoiceThisSession ? 'Voice added' : hasVoice ? 'Your voice' : 'Add your voice'}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                      {addedVoiceThisSession
                        ? 'Your new voice recording will be used for this greeting.'
                        : hasVoice
                          ? 'Using your profile voice. Record a new one below to replace it.'
                          : 'Read a quick line so your thank-you feels unmistakably you.'}
                    </p>
                  </div>
                  {addedVoiceThisSession && (
                    <span style={{ ...styles.successChip, marginBottom: '0.5rem', display: 'inline-block' }}>&#10003; Voice added</span>
                  )}
                  <VoiceRecorder onUpload={handleVoiceUpload} existingVoice={user?.voiceId || null} />
                </div>

                {/* Photo row — always visible for authenticated users */}
                <div style={{ ...styles.enhanceRow, marginBottom: 0 }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', margin: '0 0 0.25rem' }}>
                      {addedPhotoThisSession ? 'Photo added' : hasPhoto ? 'Your photo' : 'Add a photo'}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                      {addedPhotoThisSession
                        ? 'Your new photo will be used for this greeting.'
                        : hasPhoto
                          ? 'Using your profile photo. Upload a new one below to replace it.'
                          : 'Use a selfie or upload a favorite photo to bring your Greet-Me to life.'}
                    </p>
                  </div>
                  {addedPhotoThisSession && (
                    <span style={{ ...styles.successChip, marginBottom: '0.5rem', display: 'inline-block' }}>&#10003; Photo added</span>
                  )}
                  <PhotoUpload onUpload={handlePhotoUpload} existingPhoto={user?.photoUrl || null} compact />
                </div>
              </>
            ) : (
              /* Guest — show sign-up prompt instead of non-functional upload controls */
              <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.6, margin: '0 0 0.75rem' }}>
                  Create your free account to add your voice and photo.
                </p>
                <a
                  href="/#/register"
                  onClick={() => localStorage.setItem('greetme_thankyou_prefill', JSON.stringify({ ...prefill, script, jobId }))}
                  style={{
                    display: 'inline-block',
                    padding: '0.5rem 1.25rem',
                    background: '#4F2D7F',
                    color: '#fff',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    fontFamily: FONT_STACK,
                  }}
                >
                  Create Account
                </a>
              </div>
            )}
          </div>
        )}

        {/* D. Error display */}
        {error && (
          <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fecaca', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#dc2626', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* E. Inline registration (guest path) */}
        {showInlineRegister && (
          <div style={styles.section}>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937', margin: '0 0 0.25rem' }}>
              Quick sign-up to send
            </p>
            <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '0 0 1rem' }}>
              Create your free account and your Greet-Me sends instantly.
            </p>
            {regError && (
              <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', borderRadius: '0.375rem', border: '1px solid #fecaca', marginBottom: '0.75rem' }}>
                <p style={{ fontSize: '0.8125rem', color: '#dc2626', margin: 0 }}>{regError}</p>
                {regError.includes('already has an account') && (
                  <a href="/#/login" style={{ fontSize: '0.8125rem', color: '#4F2D7F', fontWeight: 600, marginTop: '0.25rem', display: 'inline-block' }}>
                    Log in instead
                  </a>
                )}
              </div>
            )}
            <form onSubmit={handleInlineRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Name</label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Your name"
                  required
                  style={styles.input}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Email</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={styles.input}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Password</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Create a password"
                  required
                  minLength={8}
                  style={styles.input}
                />
              </div>
              <button
                type="submit"
                disabled={registering || sending}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  background: (registering || sending) ? '#d1d5db' : '#4F2D7F',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontSize: '1.0625rem',
                  fontWeight: 600,
                  fontFamily: 'Georgia, serif',
                  cursor: (registering || sending) ? 'not-allowed' : 'pointer',
                  boxShadow: (registering || sending) ? 'none' : '0 4px 14px rgba(79, 45, 127, 0.2)',
                }}
              >
                {registering ? 'Creating account...' : sending ? 'Sending...' : 'Create Account & Send'}
              </button>
            </form>
          </div>
        )}

        {/* F. Primary CTA — always available */}
        {!showInlineRegister && (
        <button
          onClick={handleSend}
          disabled={sending}
          style={{
            width: '100%',
            padding: '1rem',
            background: sending ? '#d1d5db' : '#4F2D7F',
            color: '#fff',
            border: 'none',
            borderRadius: '0.75rem',
            fontSize: '1.125rem',
            fontWeight: 600,
            fontFamily: 'Georgia, serif',
            cursor: sending ? 'not-allowed' : 'pointer',
            boxShadow: sending ? 'none' : '0 4px 14px rgba(79, 45, 127, 0.2)',
          }}
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
        )}

        <p style={{ ...styles.footer, textAlign: 'center' }}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 50%, #f5f3ff 100%)',
    padding: '3rem 1.5rem',
    fontFamily: FONT_STACK,
  },
  container: {
    maxWidth: '680px',
    width: '100%',
  },
  card: {
    maxWidth: '680px',
    width: '100%',
    background: '#fff',
    borderRadius: '1rem',
    padding: '2rem',
    textAlign: 'center',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  section: {
    background: '#fff',
    borderRadius: '1rem',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
    textAlign: 'left',
  },
  enhanceCard: {
    background: '#f9fafb',
    borderRadius: '1rem',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    border: '1px solid #e5e7eb',
    textAlign: 'left',
  },
  enhanceRow: {
    padding: '1rem',
    background: '#fff',
    borderRadius: '0.75rem',
    border: '1px solid #e5e7eb',
    marginBottom: '0.75rem',
  },
  chipRow: {
    marginBottom: '0.75rem',
  },
  successChip: {
    display: 'inline-block',
    padding: '0.375rem 0.75rem',
    background: '#ecfdf5',
    color: '#059669',
    borderRadius: '1rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
  },
  neutralChip: {
    display: 'inline-block',
    padding: '0.375rem 0.75rem',
    background: '#f3f4f6',
    color: '#6b7280',
    borderRadius: '1rem',
    fontSize: '0.8125rem',
    fontWeight: 500,
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '0.9375rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxSizing: 'border-box',
    outline: 'none',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1f2937',
    margin: '0 0 0.75rem',
  },
  footer: {
    fontSize: '0.75rem',
    color: '#b0b0b0',
    margin: '1.5rem 0 0',
  },
  successIcon: {
    width: '4rem',
    height: '4rem',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.25rem',
    fontSize: '2rem',
    color: '#fff',
  },
  linkBtn: {
    display: 'inline-block',
    padding: '0.625rem 1.5rem',
    background: '#4F2D7F',
    color: '#fff',
    borderRadius: '0.5rem',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: '0.9375rem',
  },
};
