// src/pages/ThankYouFlow.jsx
// Phase 1.5 — Prefilled thank-you greeting flow
// Route: /#/thank-you?jobId={jobId}
// Zero blank fields. Send enabled immediately. Auth redirect preserves prefill.

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { safeSet } from '../utils/safeStorage';
import { formatPersonName } from '../utils/formatPersonName';
import VoiceRecorder from '../components/VoiceRecorder';
import PhotoUpload from '../components/PhotoUpload';
import HeartsBurst from '../components/HeartsBurst';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

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
  container: { maxWidth: '680px', width: '100%' },
  card: {
    maxWidth: '680px', width: '100%', background: '#fff', borderRadius: '1rem',
    padding: '2rem', textAlign: 'center',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  section: {
    background: '#fff', borderRadius: '1rem', padding: '1.5rem',
    marginBottom: '1.5rem', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)', textAlign: 'left',
  },
  enhanceCard: {
    background: '#f9fafb', borderRadius: '1rem', padding: '1.5rem',
    marginBottom: '1.5rem', border: '1px solid #e5e7eb', textAlign: 'left',
  },
  enhanceRow: {
    padding: '1rem', background: '#fff', borderRadius: '0.75rem',
    border: '1px solid #e5e7eb', marginBottom: '0.875rem',
  },
  chipRow: { marginBottom: '0.75rem' },
  successChip: {
    display: 'inline-block', padding: '0.375rem 0.75rem', background: '#ecfdf5',
    color: '#059669', borderRadius: '1rem', fontSize: '0.8125rem', fontWeight: 600,
  },
  neutralChip: {
    display: 'inline-block', padding: '0.375rem 0.75rem', background: '#f3f4f6',
    color: '#6b7280', borderRadius: '1rem', fontSize: '0.8125rem', fontWeight: 500,
  },
  input: {
    width: '100%', padding: '0.75rem', border: '1px solid #d1d5db',
    borderRadius: '0.5rem', fontSize: '0.9375rem', fontFamily: FONT_STACK,
    boxSizing: 'border-box', outline: 'none',
  },
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', margin: '0 0 0.75rem' },
  footer: { fontSize: '0.75rem', color: '#b0b0b0', margin: '1.5rem 0 0' },
  successIcon: {
    width: '4rem', height: '4rem', borderRadius: '50%',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 1.25rem', fontSize: '2rem', color: '#fff',
  },
  linkBtn: {
    display: 'inline-block', padding: '0.625rem 1.5rem', background: '#4F2D7F',
    color: '#fff', borderRadius: '0.5rem', fontWeight: 600,
    textDecoration: 'none', fontSize: '0.9375rem',
  },
};

export default function ThankYouFlow() {
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId');
  const creditCode = searchParams.get('creditCode');
  const { user, refreshProfile, register } = useAuth();

  // Inline registration state (guest send path)
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
  const [sentJobId, setSentJobId] = useState(null);

  // Track whether user has added assets (refreshes after upload)
  const hasVoice = !!user?.voiceId;
  const hasPhoto = !!user?.photoUrl;
  const [addedVoiceThisSession, setAddedVoiceThisSession] = useState(false);
  const [addedPhotoThisSession, setAddedPhotoThisSession] = useState(false);
  const [pendingVoice, setPendingVoice] = useState(null);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [uploadWarning, setUploadWarning] = useState(null);
  const [shared, setShared] = useState(false);
  const [rewardResult, setRewardResult] = useState(null);
  const [heartsBurstKey, setHeartsBurstKey] = useState(0);

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
        setError('Session expired. Please refresh and try again.');
        setSending(false);
        return;
      }
      if (result?.ok === false) {
        setError(result?.error || 'Send failed. Please try again.');
        return;
      }
      setSent(true);
      setSentAt(Date.now());
      setSentJobId(result?.jobId || null);
      setTimeout(() => setHeartsBurstKey((k) => k + 1), 150);
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
      // Retry guard: if already registered (e.g. retry after upload failure), skip registration
      if (!user) {
        const result = await register(regName.trim(), regEmail.trim().toLowerCase(), regPassword);
        if (!result?.success) {
          const isEmailExists = result?.code === 'EMAIL_EXISTS';
          const isServerError = result?.status >= 500 || result?.code === 'SERVER_ERROR';
          if (isEmailExists) {
            setRegError('This email already has an account. Please try again or refresh the page.');
          } else {
            setRegError(
              isServerError
                ? 'Our server had a hiccup. Please try again in a moment.'
                : (result?.error || 'Registration failed. Please try again.')
            );
          }
          setRegistering(false);
          return;
        }
      }
      // Registered — token is set, user is in context.
      // Claim courtesy credit if routed from QR
      if (creditCode) {
        try {
          const claimResult = await api.request(`/api/credits/${creditCode}/claim`, { method: 'POST' });
          if (claimResult?.ok) {
            safeSet('greetme_courtesy_credit', JSON.stringify({
              creditCode,
              amount: (claimResult.amountCents || 500) / 100,
              source: 'courtesy',
              claimedAt: new Date().toISOString(),
            }));
          }
        } catch (e) {
          // Non-blocking — credit claim failure shouldn't prevent send
          console.warn('Credit claim failed:', e?.message);
        }
      }
      // Upload pending voice/photo now that auth exists
      if (pendingVoice) {
        try {
          await api.uploadVoice(pendingVoice);
        } catch (e) {
          setRegError('Voice upload failed. Please try again.');
          setRegistering(false);
          return;
        }
      }
      if (pendingPhoto) {
        try {
          await api.uploadPhoto(pendingPhoto);
        } catch (e) {
          setRegError('Photo upload failed. Please try again.');
          setRegistering(false);
          return;
        }
      }
      if (pendingVoice || pendingPhoto) {
        await refreshProfile();
      }
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
      setUploadWarning(null);
    } catch {
      setUploadWarning('Voice upload didn\u2019t go through \u2014 your greeting will still send without it.');
      setTimeout(() => setUploadWarning(null), 5000);
    }
  };

  const handlePhotoUpload = async (formData) => {
    try {
      await api.uploadPhoto(formData);
      await refreshProfile();
      setAddedPhotoThisSession(true);
      setUploadWarning(null);
    } catch {
      setUploadWarning('Photo upload didn\u2019t go through \u2014 your greeting will still send without it.');
      setTimeout(() => setUploadWarning(null), 5000);
    }
  };

  // Guest handlers: store FormData locally (no API call, no auth needed)
  const handleGuestVoiceUpload = async (formData) => {
    setPendingVoice(formData);
    setAddedVoiceThisSession(true);
  };

  const handleGuestPhotoUpload = async (formData) => {
    setPendingPhoto(formData);
    setAddedPhotoThisSession(true);
  };

  // Fire EXPONENTIAL_MOMENT_SEEN once when sent becomes true
  useEffect(() => {
    if (!sent || !jobId) return;
    api.request('/api/events/exponential-moment', {
      method: 'POST',
      body: JSON.stringify({ jobId, action: 'seen' }),
    }).catch(() => {});
  }, [sent, jobId]);

  // Fire DISMISSED on browser back / tab close / navigate away (if moment is showing and not shared)
  useEffect(() => {
    if (!sent || !jobId || shared) return;
    const beaconUrl = `${import.meta.env.VITE_API_BASE}/api/events/exponential-moment`;
    const fireDismissed = () => {
      navigator.sendBeacon?.(beaconUrl,
        new Blob([JSON.stringify({ jobId, action: 'dismissed' })], { type: 'application/json' }));
    };
    window.addEventListener('beforeunload', fireDismissed);
    window.addEventListener('hashchange', fireDismissed);
    return () => {
      window.removeEventListener('beforeunload', fireDismissed);
      window.removeEventListener('hashchange', fireDismissed);
    };
  }, [sent, jobId, shared]);

  // In-app share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareName, setShareName] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareError, setShareError] = useState(null);
  const [shareSending, setShareSending] = useState(false);

  const handleInAppShare = async () => {
    if (!shareName.trim()) { setShareError('Please enter their name.'); return; }
    if (!shareEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shareEmail.trim())) {
      setShareError('Please enter a valid email.'); return;
    }
    setShareError(null);
    setShareSending(true);

    // Fire share event log (fire-and-forget)
    api.request('/api/events/exponential-moment', {
      method: 'POST',
      body: JSON.stringify({ jobId, action: 'share' }),
    }).catch(() => {});

    // Step 1: mint/reuse share credit
    let creditCode = null;
    try {
      const reward = await api.request('/api/events/share-reward', {
        method: 'POST',
        body: JSON.stringify({ sourceJobId: jobId }),
      });
      creditCode = reward?.creditCode || null;
    } catch {
      setShareError('Could not prepare share credit. Please try again.');
      setShareSending(false);
      return;
    }

    if (!creditCode) {
      setShareError('Could not prepare share credit. Please try again.');
      setShareSending(false);
      return;
    }

    // Step 2: send share invite email (backend verifies credit)
    try {
      const result = await api.request('/api/events/share-invite', {
        method: 'POST',
        body: JSON.stringify({
          sourceJobId: jobId,
          recipientName: shareName.trim(),
          recipientEmail: shareEmail.trim().toLowerCase(),
          creditCode,
        }),
      });
      if (result?.ok) {
        setShowShareModal(false);
        setShared(true);
        setTimeout(() => setHeartsBurstKey((k) => k + 1), 150);
      } else {
        setShareError(result?.error || 'Could not send share email. Please try again.');
      }
    } catch (err) {
      setShareError(err?.message || 'Could not send share email. Please try again.');
    } finally {
      setShareSending(false);
    }
  };

  const fireDismissEvent = () => {
    api.request('/api/events/exponential-moment', {
      method: 'POST',
      body: JSON.stringify({ jobId, action: 'dismissed' }),
    }).catch(() => {});
  };

  const handleDismiss = () => {
    fireDismissEvent();
    window.location.href = '/#/dashboard';
  };

  // Derive recipient first name (used in success screen and main flow)
  const hasRecipientName = !!prefill?.recipientName;
  const recipientFirst = hasRecipientName
    ? formatPersonName(prefill.recipientName).split(' ')[0]
    : 'them';

  // ---- Exponential Moment (post-send success) ----
  // Gate: only show within 90 minutes of send
  const EXPIRY_MS = 90 * 60 * 1000;
  const momentExpired = sentAt && (Date.now() - sentAt > EXPIRY_MS);

  if (sent && !momentExpired) {
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
        <HeartsBurst triggerKey={heartsBurstKey} />
        {/* In-app share modal */}
        {showShareModal && !shared && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '1rem',
          }}>
            <div style={{
              maxWidth: '400px', width: '100%', background: '#fff',
              borderRadius: '1rem', padding: '2rem', textAlign: 'center',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
              maxHeight: '90vh', overflowY: 'auto',
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', margin: '0 0 0.5rem', fontFamily: 'Georgia, serif' }}>
                Share this moment
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
                Send them your Greet-Me &mdash; they&rsquo;ll get $5 to start their own.
              </p>
              {shareError && (
                <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', borderRadius: '0.375rem', border: '1px solid #fecaca', marginBottom: '0.75rem' }}>
                  <p style={{ fontSize: '0.8125rem', color: '#dc2626', margin: 0 }}>{shareError}</p>
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); handleInAppShare(); }} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Their name</label>
                  <input
                    type="text"
                    value={shareName}
                    onChange={(e) => setShareName(e.target.value)}
                    placeholder="Jamie Smith"
                    required
                    autoComplete="name"
                    autoFocus
                    style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.9375rem', fontFamily: FONT_STACK, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Their email</label>
                  <input
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="jamie@example.com"
                    required
                    autoComplete="email"
                    style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.9375rem', fontFamily: FONT_STACK, boxSizing: 'border-box' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={shareSending}
                  style={{
                    width: '100%', padding: '0.75rem', background: shareSending ? '#d1d5db' : '#4F2D7F',
                    color: '#fff', border: 'none', borderRadius: '0.75rem', fontSize: '1rem',
                    fontWeight: 600, fontFamily: 'Georgia, serif',
                    cursor: shareSending ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  }}
                >
                  {shareSending && (
                    <span style={{
                      width: '0.875rem', height: '0.875rem',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'thankyouSpin 0.6s linear infinite',
                    }} />
                  )}
                  {shareSending ? 'Sending\u2026' : 'Send'}
                </button>
              </form>
              <button
                onClick={() => { setShowShareModal(false); setShareError(null); }}
                style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.8125rem', cursor: 'pointer', marginTop: '0.75rem', fontFamily: FONT_STACK }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
          animation: 'fadeInUp 0.6s ease-out',
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

          {/* Pre-share: sent confirmation header */}
          {!shared && (
            <>
              <p style={{
                fontSize: '0.875rem',
                color: 'rgba(255,255,255,0.5)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                margin: '0 0 0.75rem',
              }}>
                Sent
              </p>

              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 500,
                color: '#fff',
                lineHeight: 1.5,
                margin: '0 0 1rem',
                fontFamily: 'Georgia, serif',
              }}>
                Your thank-you is on its way to {recipientFirst}.
              </h1>
              <p style={{
                fontSize: '0.9375rem',
                color: 'rgba(255,255,255,0.45)',
                lineHeight: 1.6,
                margin: '0 0 2.5rem',
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
              }}>
                This is how we make life&rsquo;s moments unforgettable.
              </p>

              {hasGiftContext && (
                <p style={{
                  fontSize: '0.9375rem',
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.6,
                  margin: '0 0 2rem',
                }}>
                  Pass the feeling forward &mdash; share this moment with someone who matters.
                </p>
              )}
            </>
          )}

          {/* Post-share: completion screen */}
          {shared ? (
            <>
              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 500,
                color: '#fff',
                lineHeight: 1.5,
                margin: '0 0 1rem',
                fontFamily: 'Georgia, serif',
              }}>
                That was a beautiful move.
              </h1>
              <p style={{
                fontSize: '0.9375rem',
                color: 'rgba(255,255,255,0.7)',
                lineHeight: 1.6,
                margin: '0 0 1rem',
              }}>
                You just shared the moment.
              </p>
              <p style={{
                fontSize: '0.8125rem',
                color: 'rgba(255,255,255,0.5)',
                lineHeight: 1.5,
                margin: '0 0 2.5rem',
              }}>
                When you&rsquo;re ready, your $5 credit will be waiting for you at checkout.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  onClick={() => { window.location.href = '/#/pricing'; }}
                  style={{
                    display: 'inline-block',
                    padding: '0.75rem 2rem',
                    background: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '2rem',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    fontFamily: 'Georgia, serif',
                    cursor: 'pointer',
                  }}
                >
                  View Plans &amp; Pricing
                </button>
                <button
                  onClick={handleDismiss}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    fontFamily: FONT_STACK,
                  }}
                >
                  Go to Dashboard
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Pre-share: share CTA + exit options */}
              <button
                onClick={() => setShowShareModal(true)}
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
                  transition: 'background 0.2s',
                }}
              >
                Share the Moment
              </button>
              <p style={{
                fontSize: '0.8125rem',
                color: 'rgba(255,255,255,0.55)',
                fontStyle: 'italic',
                margin: '0 auto 1.5rem',
                maxWidth: '320px',
                lineHeight: 1.5,
              }}>
                We&rsquo;ll include a little surprise for the person you share it with.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                {sentJobId && (
                  <button
                    onClick={() => {
                      fireDismissEvent();
                      window.location.href = `/#/g/${sentJobId}`;
                    }}
                    style={{
                      display: 'inline-block',
                      padding: '0.75rem 2rem',
                      background: 'rgba(255,255,255,0.15)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '2rem',
                      fontSize: '0.9375rem',
                      fontWeight: 500,
                      fontFamily: 'Georgia, serif',
                      cursor: 'pointer',
                    }}
                  >
                    View Greet-Me
                  </button>
                )}
                <button
                  onClick={handleDismiss}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    fontFamily: FONT_STACK,
                  }}
                >
                  Go to Dashboard
                </button>
              </div>
            </>
          )}

          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', margin: '3rem 0 0' }}>
            &copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;
          </p>
        </div>
      </div>
    );
  }

  // ---- Exponential moment expired ----
  if (sent && momentExpired) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 50%, #f5f3ff 100%)',
        padding: '2rem 1.5rem',
        fontFamily: FONT_STACK,
      }}>
        <div style={{
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
        }}>
          <div style={styles.successIcon}>&#10003;</div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1f2937', margin: '0 0 0.75rem', fontFamily: 'Georgia, serif' }}>
            Your thank-you was sent
          </h1>
          <p style={{ fontSize: '0.9375rem', color: '#6b7280', lineHeight: 1.6, margin: '0 0 2rem' }}>
            {recipientFirst !== 'them'
              ? `${recipientFirst} should have it by now.`
              : 'Your recipient should have it by now.'}
          </p>
          <a
            href="/#/dashboard/send"
            style={{
              ...styles.linkBtn,
              display: 'inline-block',
              marginBottom: '0.75rem',
            }}
          >
            Send your own Greet-Me
          </a>
          <br />
          <a href="/#/dashboard" style={{ color: '#6b7280', fontSize: '0.8125rem', textDecoration: 'none' }}>
            Go to dashboard
          </a>
          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
        </div>
      </div>
    );
  }

  // ---- Loading ----
  if (loading) {
    return (
      <div style={styles.page}>
        <p style={{ color: '#6b7280', fontFamily: FONT_STACK }}>Loading your thank-you...</p>
      </div>
    );
  }

  // ---- Error / missing prefill ----
  if (error || !prefill) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>We couldn&rsquo;t find this greeting</h1>
          <p style={{ fontSize: '1rem', color: '#6b7280', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
            The link may have expired or the greeting is no longer available.
            If someone sent you a Greet-Me, ask them to resend the link.
          </p>
          <a href="/#/dashboard/send" style={{ color: '#4F2D7F', textDecoration: 'underline', fontSize: '0.9rem' }}>
            Send a greeting instead
          </a>
          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
        </div>
      </div>
    );
  }

  // ---- Main flow ----

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* A. Header block */}
        <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 0.5rem' }}>
            Your turn
          </p>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1f2937', margin: '0 0 0.75rem', fontFamily: 'Georgia, serif', lineHeight: 1.3 }}>
            Say thanks in seconds
          </h1>
          <p style={{ fontSize: '0.95rem', color: '#6b7280', lineHeight: 1.65, margin: 0, maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
            Make it personal in just a few words.
          </p>
        </div>

        {/* B. Message card */}
        <div style={styles.section}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.625rem' }}>
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
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0.625rem 0 0' }}>
            This is already written for you &mdash; edit anything you like.
          </p>
        </div>

        {/* C. Enhancement card — optional, above Send, shown to all users */}
        <div style={styles.enhanceCard}>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937', margin: '0 0 0.25rem' }}>
            Make it even more special
          </p>
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '0 0 1.25rem' }}>
            Optional, but highly recommended.
          </p>

          {user ? (
            <>
              {/* Voice row — authenticated users get full controls */}
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

              {/* Photo row — authenticated users get full controls */}
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
            <>
              {/* Guest — real controls, files stored locally until registration */}
              <div style={styles.enhanceRow}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', margin: '0 0 0.25rem' }}>
                    {addedVoiceThisSession ? 'Voice added' : 'Add your voice'}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                    {addedVoiceThisSession
                      ? 'Your voice recording will be uploaded when you sign up below.'
                      : 'Read a quick line so your thank-you feels unmistakably you.'}
                  </p>
                </div>
                {addedVoiceThisSession && (
                  <span style={{ ...styles.successChip, marginBottom: '0.5rem', display: 'inline-block' }}>&#10003; Voice added</span>
                )}
                <VoiceRecorder onUpload={handleGuestVoiceUpload} existingVoice={null} />
              </div>
              <div style={{ ...styles.enhanceRow, marginBottom: 0 }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', margin: '0 0 0.25rem' }}>
                    {addedPhotoThisSession ? 'Photo added' : 'Add a photo'}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                    {addedPhotoThisSession
                      ? 'Your photo will be uploaded when you sign up below.'
                      : 'Use a selfie or upload a favorite photo to bring your Greet-Me to life.'}
                  </p>
                </div>
                {addedPhotoThisSession && (
                  <span style={{ ...styles.successChip, marginBottom: '0.5rem', display: 'inline-block' }}>&#10003; Photo added</span>
                )}
                <PhotoUpload onUpload={handleGuestPhotoUpload} existingPhoto={null} compact />
              </div>
            </>
          )}
        </div>

        {/* Upload warning — non-blocking, auto-clears */}
        {uploadWarning && (
          <div style={{
            padding: '0.625rem 0.875rem',
            background: '#fffbeb',
            borderRadius: '0.5rem',
            border: '1px solid #fde68a',
            marginBottom: '1rem',
          }}>
            <p style={{ fontSize: '0.8125rem', color: '#92400e', margin: 0 }}>{uploadWarning}</p>
          </div>
        )}

        {/* D. Error display */}
        {error && (
          <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fecaca', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#dc2626', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* E. Guest: quick registration + Sign Up & Send (always visible) */}
        {!user && (
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
              </div>
            )}
            <form onSubmit={handleInlineRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Name</label>
                <p style={{
                  ...styles.input,
                  margin: 0,
                  background: '#f9fafb',
                  color: '#374151',
                }}>{regName || 'Your name'}</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Email</label>
                <p style={{
                  ...styles.input,
                  margin: 0,
                  background: '#f9fafb',
                  color: '#374151',
                }}>{regEmail || 'your@email.com'}</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Create a password</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Choose a password"
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
                {registering
                  ? 'Creating account...'
                  : sending
                    ? 'Sending\u2026'
                    : hasRecipientName
                      ? `Sign up & send ${recipientFirst} a thank-you Greet-Me`
                      : 'Sign up & send a thank-you Greet-Me'}
              </button>
            </form>
          </div>
        )}

        {/* F. Authenticated edge case: simple Send button */}
        {user && (
          <button
            onClick={doSend}
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            {sending && (
              <span style={{
                width: '1rem',
                height: '1rem',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'thankyouSpin 0.6s linear infinite',
              }} />
            )}
            {sending
              ? 'Sending\u2026'
              : hasRecipientName
                ? `Send ${recipientFirst} a thank-you Greet-Me`
                : 'Send a thank-you Greet-Me'}
          </button>
        )}

        <p style={{ ...styles.footer, textAlign: 'center' }}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>

        {/* Keyframes for send spinner and success entrance */}
        <style>{`
          @keyframes thankyouSpin {
            to { transform: rotate(360deg); }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}

