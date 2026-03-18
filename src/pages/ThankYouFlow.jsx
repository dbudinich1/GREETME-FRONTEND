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

  // Track whether user has added assets (refreshes after upload)
  const hasVoice = !!user?.voiceId;
  const hasPhoto = !!user?.photoUrl;

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

  // Send always proceeds — auth checked by backend, not frontend gate
  const handleSend = async () => {
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
      // 401 = not logged in or expired token → redirect to register
      if (result?.status === 401) {
        localStorage.setItem('greetme_thankyou_prefill', JSON.stringify({ ...prefill, script, jobId }));
        navigate('/register');
        return;
      }
      if (result?.ok === false) {
        setError(result?.error || 'Something went wrong. Please try again.');
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Optional enhancement handlers (never block send)
  const handleVoiceUpload = async (formData) => {
    try {
      await api.uploadVoice(formData);
      await refreshProfile();
    } catch { /* non-fatal */ }
  };

  const handlePhotoUpload = async (formData) => {
    try {
      await api.uploadPhoto(formData);
      await refreshProfile();
    } catch { /* non-fatal */ }
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

        {/* Error display */}
        {error && (
          <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fecaca', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#dc2626', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* C. Primary CTA block */}
        <div style={{ marginBottom: '1.5rem' }}>
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
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center', margin: '0.625rem 0 0', lineHeight: 1.5 }}>
            You can send now, or add your voice and photo below.
          </p>
        </div>

        {/* D. Enhancement card — optional, never blocking */}
        {effectivelyAuthenticated && (
          <div style={styles.enhanceCard}>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937', margin: '0 0 0.25rem' }}>
              Make it even more special
            </p>
            <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '0 0 1.25rem' }}>
              Optional, but highly recommended.
            </p>

            {/* Voice row */}
            {!hasVoice ? (
              <div style={styles.enhanceRow}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', margin: '0 0 0.25rem' }}>
                    Add your voice
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                    Read a quick line so your thank-you feels unmistakably you.
                  </p>
                </div>
                <VoiceRecorder onUpload={handleVoiceUpload} existingVoice={null} />
              </div>
            ) : (
              <div style={styles.chipRow}>
                <span style={styles.successChip}>&#10003; Voice added</span>
              </div>
            )}

            {/* Photo row */}
            {!hasPhoto ? (
              <div style={{ ...styles.enhanceRow, marginBottom: 0 }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', margin: '0 0 0.25rem' }}>
                    Add a photo
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                    Use a selfie or upload a favorite photo to bring your Greet-Me to life.
                  </p>
                </div>
                <PhotoUpload onUpload={handlePhotoUpload} existingPhoto={null} />
              </div>
            ) : (
              <div style={styles.chipRow}>
                <span style={styles.successChip}>&#10003; Photo added</span>
              </div>
            )}
          </div>
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
