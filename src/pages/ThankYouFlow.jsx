// src/pages/ThankYouFlow.jsx
// Phase 1.5 — Prefilled thank-you greeting flow
// Route: /#/thank-you?jobId={jobId}
// Zero blank fields. Send enabled immediately. Auth redirect preserves prefill.

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import VoiceRecorder from '../components/VoiceRecorder';
import PhotoUpload from '../components/PhotoUpload';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export default function ThankYouFlow() {
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId');
  const navigate = useNavigate();
  const { isAuthenticated, user, refreshProfile } = useAuth();

  // Check if stored JWT is expired (prevents stale-auth false positive)
  const isTokenValid = () => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  };
  const effectivelyAuthenticated = isAuthenticated && isTokenValid();

  const [prefill, setPrefill] = useState(null);
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Progressive onboarding state
  const [showSetup, setShowSetup] = useState(false);
  const [setupStep, setSetupStep] = useState('voice'); // 'voice' | 'photo' | 'done'

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
        } else {
          setError('Could not load greeting details.');
        }
      })
      .catch(() => setError('Could not load greeting details.'))
      .finally(() => setLoading(false));
  }, [jobId]);

  const needsSetup = effectivelyAuthenticated && (!user?.voiceId || !user?.photoUrl);

  const proceedToSend = async () => {
    setSending(true);
    try {
      const result = await api.submitThankYouGreeting({
        recipientName: prefill.recipientName,
        recipientEmail: prefill.recipientEmail,
        occasion: prefill.occasion || 'thank-you',
        tone: prefill.tone || 'warm',
        script,
        sourceJobId: jobId,
      });
      // Handle silent 401 (api.request returns { ok:false, status:401 } without throwing)
      if (result?.status === 401 || result?.ok === false) {
        localStorage.setItem('greetme_thankyou_prefill', JSON.stringify({ ...prefill, script, jobId }));
        navigate('/register');
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (!effectivelyAuthenticated) {
      localStorage.setItem('greetme_thankyou_prefill', JSON.stringify({ ...prefill, script, jobId }));
      navigate('/register');
      return;
    }

    // Show progressive onboarding if voice or photo missing
    if (needsSetup && !showSetup) {
      setSetupStep(!user?.voiceId ? 'voice' : 'photo');
      setShowSetup(true);
      return;
    }

    await proceedToSend();
  };

  const handleSetupComplete = async () => {
    setShowSetup(false);
    await refreshProfile();
    await proceedToSend();
  };

  const handleVoiceUpload = async (formData) => {
    await api.uploadVoice(formData);
    await refreshProfile();
    // Advance to photo step if also missing
    if (!user?.photoUrl) {
      setSetupStep('photo');
    } else {
      await handleSetupComplete();
    }
  };

  const handlePhotoUpload = async (formData) => {
    await api.uploadPhoto(formData);
    await handleSetupComplete();
  };

  const handleSkipStep = () => {
    if (setupStep === 'voice' && !user?.photoUrl) {
      setSetupStep('photo');
    } else {
      handleSetupComplete();
    }
  };

  // ---- Sent confirmation ----
  if (sent) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.successIcon}>&#10003;</div>
          <h1 style={styles.title}>Sent!</h1>
          <p style={{ fontSize: '1rem', color: '#6b7280', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            Your thank-you Greet-Me is on its way. The loop is complete.
          </p>
          <a href="/#/dashboard" style={styles.linkBtn}>Go to Dashboard</a>
          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
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

  // ---- Progressive onboarding (voice/photo) ----
  if (showSetup) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', letterSpacing: '0.05em', margin: '0 0 0.75rem' }}>
            <span style={{ fontWeight: 600 }}>Greet-Me&trade;</span>
            <span style={{ margin: '0 0.4rem', opacity: 0.4 }}>&middot;</span>
            <span style={{ fontStyle: 'italic' }}>Your Turn</span>
          </p>

          <h1 style={{ ...styles.title, fontSize: '1.375rem' }}>
            Greet-Me like a pro
          </h1>

          {setupStep === 'voice' && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.95rem', color: '#4b5563', lineHeight: 1.6, margin: '0 0 1.25rem' }}>
                Tap record and read a quick line &mdash; your voice makes it personal.
              </p>
              <VoiceRecorder
                onUpload={handleVoiceUpload}
                existingVoice={user?.voiceId || null}
              />
              <p
                onClick={handleSkipStep}
                style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '1rem', cursor: 'pointer' }}
              >
                Skip for now
              </p>
            </div>
          )}

          {setupStep === 'photo' && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.95rem', color: '#4b5563', lineHeight: 1.6, margin: '0 0 1.25rem' }}>
                Add a photo to bring your greeting to life.
              </p>
              <PhotoUpload
                onUpload={handlePhotoUpload}
                existingPhoto={user?.photoUrl || null}
              />
              <p
                onClick={handleSkipStep}
                style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '1rem', cursor: 'pointer' }}
              >
                Skip for now
              </p>
            </div>
          )}

          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
        </div>
      </div>
    );
  }

  // ---- Main flow ----
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <p style={{ fontSize: '0.8rem', color: '#9ca3af', letterSpacing: '0.05em', margin: '0 0 1rem' }}>
          <span style={{ fontWeight: 600 }}>Greet-Me&trade;</span>
          <span style={{ margin: '0 0.4rem', opacity: 0.4 }}>&middot;</span>
          <span style={{ fontStyle: 'italic' }}>Your Turn</span>
        </p>

        <h1 style={{ ...styles.title, fontSize: '1.625rem' }}>
          Send one back to {(prefill.recipientName || 'them').split(' ')[0]}
        </h1>

        <p style={{ fontSize: '0.95rem', color: '#6b7280', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
          We&rsquo;ve started it for you. Edit if you want, or send as-is.
        </p>

        {/* Recipient (read-only) */}
        <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
          <label style={styles.label}>To</label>
          <div style={{
            padding: '0.75rem',
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            color: '#374151',
          }}>
            {prefill.recipientName || 'Recipient'}
          </div>
        </div>

        {/* Occasion badge */}
        <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
          <label style={styles.label}>Occasion</label>
          <span style={{
            display: 'inline-block',
            padding: '0.375rem 0.75rem',
            background: '#ede9fe',
            color: '#5b21b6',
            borderRadius: '1rem',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}>
            Thank You
          </span>
        </div>

        {/* Script textarea */}
        <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
          <label style={styles.label}>Your message</label>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={7}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '0.95rem',
              fontFamily: 'Georgia, serif',
              lineHeight: 1.6,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Send button — ALWAYS enabled */}
        <button
          onClick={handleSend}
          disabled={sending}
          style={{
            width: '100%',
            padding: '0.875rem',
            background: sending ? '#d1d5db' : '#4F2D7F',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '1.0625rem',
            fontWeight: 600,
            fontFamily: 'Georgia, serif',
            cursor: sending ? 'not-allowed' : 'pointer',
          }}
        >
          {sending ? 'Sending...' : effectivelyAuthenticated ? 'Send Your Greet-Me' : 'Sign Up & Send'}
        </button>

        {!effectivelyAuthenticated && (
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '0.75rem 0 0', lineHeight: 1.5 }}>
            Quick sign-up required to send. Your message is saved.
          </p>
        )}

        <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 50%, #f5f3ff 100%)',
    padding: '1.5rem',
    fontFamily: FONT_STACK,
  },
  card: {
    maxWidth: '480px',
    width: '100%',
    background: '#fff',
    borderRadius: '1rem',
    padding: '2rem',
    textAlign: 'center',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1f2937',
    margin: '0 0 0.75rem',
  },
  label: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '0.375rem',
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
