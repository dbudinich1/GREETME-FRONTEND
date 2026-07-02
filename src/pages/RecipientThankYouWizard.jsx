// src/pages/RecipientThankYouWizard.jsx
// Guided thank-you wizard for live recipients entering from CreditClaim QR.
// Steps: 0=Registration, 1=Voice, 2=Photo, 3=Confirm, 4=Sending, 5=Success

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import VoiceRecorder from '../components/VoiceRecorder';
import PhotoUpload from '../components/PhotoUpload';
import ShareTheLovePanel from '../components/ShareTheLovePanel';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export default function RecipientThankYouWizard() {
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId');
  const navigate = useNavigate();
  const { user, register, login, refreshProfile } = useAuth();

  // Step: 0=registration, 1=voice, 2=photo, 3=confirm, 4=sending, 5=success
  const [step, setStep] = useState(user ? 1 : 0);

  // Data
  const [prefill, setPrefill] = useState(null);
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Registration
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');

  // Voice/Photo tracking
  const [voiceAdded, setVoiceAdded] = useState(false);
  const [photoAdded, setPhotoAdded] = useState(false);

  // Send
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sentJobId, setSentJobId] = useState(null);

  // Prefill
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

  // If user becomes authenticated after mount (e.g., registered on step 0), advance
  useEffect(() => {
    if (user && step === 0) setStep(1);
  }, [user, step]);

  // ── Handlers ──

  const handleRegister = async () => {
    const name = prefill?.senderRecipientName || '';
    const email = prefill?.senderRecipientEmail || '';
    if (!email || !regPassword) {
      setRegError('Email and password are required.');
      return;
    }
    if (regPassword.length < 8) {
      setRegError('Password must be at least 8 characters.');
      return;
    }
    setRegistering(true);
    setRegError(null);
    const result = await register(name, email, regPassword);
    if (!result?.success) {
      if (result?.code === 'EMAIL_EXISTS') {
        setIsLoginMode(true);
        setRegError('Welcome back \u2014 enter your password to continue.');
      } else {
        setRegError(result?.error || 'Registration failed. Please try again.');
      }
      setRegistering(false);
      return;
    }
    await refreshProfile();
    setRegistering(false);
    setStep(1);
  };

  const handleLogin = async () => {
    const email = prefill?.senderRecipientEmail || '';
    if (!email || !loginPassword) {
      setRegError('Email and password are required.');
      return;
    }
    setRegistering(true);
    setRegError(null);
    const result = await login(email, loginPassword);
    if (!result?.success) {
      setRegError(result?.error || 'Login failed. Please try again.');
      setRegistering(false);
      return;
    }
    await refreshProfile();
    setRegistering(false);
    setStep(1);
  };

  const handleVoiceUpload = async (formData) => {
    try {
      await api.uploadVoice(formData);
      await refreshProfile();
      setVoiceAdded(true);
    } catch {
      // non-fatal — user can proceed without voice
    }
  };

  const handlePhotoUpload = async (formData) => {
    try {
      await api.uploadPhoto(formData);
      await refreshProfile();
      setPhotoAdded(true);
    } catch {
      // non-fatal — user can proceed without photo
    }
  };

  const doSend = async () => {
    setSending(true);
    setSendError(null);
    setStep(4);
    try {
      const result = await api.submitThankYouGreeting({
        recipientName: prefill.recipientName,
        recipientEmail: prefill.recipientEmail,
        occasion: prefill.occasion || 'thank-you',
        tone: prefill.tone || 'warm',
        script,
        sourceJobId: jobId,
      });
      if (result?.ok === false) {
        setSendError(result?.error || 'Send failed. Please try again.');
        setSending(false);
        setStep(3);
        return;
      }
      setSentJobId(result?.jobId || null);
      setSending(false);
      setStep(5);
    } catch (err) {
      setSendError(err?.message || 'Failed to send. Please try again.');
      setSending(false);
      setStep(3);
    }
  };


  // ── Loading / Error ──

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontFamily: FONT_STACK }}>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={{ textAlign: 'center', maxWidth: '440px', width: '100%' }}>
          <h2 style={{ color: '#fff', marginBottom: '1rem', fontFamily: 'Georgia, serif' }}>Something went wrong</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>{error}</p>
          <button onClick={() => navigate('/dashboard')} style={styles.ctaSecondary}>Go to Dashboard</button>
        </div>
      </div>
    );
  }

  const recipientFirst = (prefill?.recipientName || 'them').split(' ')[0];

  // ── Step Rendering ──

  // STEP 0 — Registration
  if (step === 0) {
    return (
      <div style={styles.page}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <div style={styles.icon}>🎁</div>
          <h1 style={styles.headline}>Create your account to continue</h1>
          <div style={styles.formCard}>
            {prefill?.senderRecipientName && (
              <div style={{ marginBottom: '0.5rem' }}>
                <p style={styles.label}>Name</p>
                <p style={styles.fieldValue}>{prefill.senderRecipientName}</p>
              </div>
            )}
            {prefill?.senderRecipientEmail && (
              <div style={{ marginBottom: '0.5rem' }}>
                <p style={styles.label}>Email</p>
                <p style={styles.fieldValue}>{prefill.senderRecipientEmail}</p>
              </div>
            )}
            <div>
              <p style={styles.label}>{isLoginMode ? 'Password' : 'Create a password'}</p>
              <input
                type="password"
                value={isLoginMode ? loginPassword : regPassword}
                onChange={(e) => isLoginMode ? setLoginPassword(e.target.value) : setRegPassword(e.target.value)}
                placeholder={isLoginMode ? 'Your password' : 'Choose a password'}
                minLength={isLoginMode ? 1 : 8}
                style={styles.input}
              />
            </div>
          </div>
          {regError && (
            <p style={{ color: '#fca5a5', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>{regError}</p>
          )}
          <button
            onClick={isLoginMode ? handleLogin : handleRegister}
            disabled={registering}
            style={{
              ...styles.cta,
              background: registering ? 'rgba(255,255,255,0.5)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              cursor: registering ? 'default' : 'pointer',
              marginBottom: '0.75rem',
            }}
          >
            {registering ? (isLoginMode ? 'Logging in...' : 'Creating account...') : 'Continue'}
          </button>
          {!isLoginMode && (
            <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.75rem' }}>
              Already have an account?{' '}
              <button type="button" onClick={() => { setIsLoginMode(true); setRegError(null); }}
                style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontWeight: 600, fontSize: '0.8125rem', padding: 0, fontFamily: 'inherit' }}>
                Log in
              </button>
            </p>
          )}
          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
        </div>
      </div>
    );
  }

  // STEP 1 — Voice
  if (step === 1) {
    return (
      <div style={styles.page}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <h1 style={styles.headline}>Add your voice</h1>
          <p style={styles.body}>
            Record a quick line so your thank-you sounds like you.
          </p>
          <div style={{ marginBottom: '1.5rem' }}>
            <VoiceRecorder onUpload={handleVoiceUpload} existingVoice={user?.voiceId || null} />
          </div>
          {voiceAdded && (
            <p style={{ color: '#10b981', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>&#10003; Voice recorded</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button onClick={() => setStep(2)} style={{ ...styles.cta, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', cursor: 'pointer' }}>
              Next
            </button>
            <button onClick={() => setStep(2)} style={styles.ctaSecondary}>
              Skip
            </button>
          </div>
          <p style={styles.progress}>Step 1 of 3</p>
        </div>
      </div>
    );
  }

  // STEP 2 — Photo
  if (step === 2) {
    return (
      <div style={styles.page}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <h1 style={styles.headline}>Add your photo</h1>
          <p style={styles.body}>
            Upload a photo to bring your Greet-Me to life.
          </p>
          <div style={{ marginBottom: '1.5rem' }}>
            <PhotoUpload onUpload={handlePhotoUpload} existingPhoto={user?.photoUrl || null} compact />
          </div>
          {photoAdded && (
            <p style={{ color: '#10b981', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>&#10003; Photo uploaded</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button onClick={() => setStep(3)} style={{ ...styles.cta, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', cursor: 'pointer' }}>
              Next
            </button>
            <button onClick={() => setStep(3)} style={styles.ctaSecondary}>
              Skip
            </button>
          </div>
          <p style={styles.progress}>Step 2 of 3</p>
        </div>
      </div>
    );
  }

  // STEP 3 — Confirm
  if (step === 3) {
    return (
      <div style={styles.page}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <h1 style={styles.headline}>Ready to send</h1>
          <div style={styles.formCard}>
            <div style={{ marginBottom: '0.75rem' }}>
              <p style={styles.label}>To</p>
              <p style={styles.fieldValue}>{recipientFirst}</p>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <p style={styles.label}>Message</p>
              <p style={{ ...styles.fieldValue, fontSize: '0.8125rem', lineHeight: 1.5 }}>
                {script.length > 120 ? script.substring(0, 120) + '\u2026' : script}
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <p style={styles.label}>Voice</p>
                <p style={{ ...styles.fieldValue, color: voiceAdded ? '#10b981' : 'rgba(255,255,255,0.4)' }}>
                  {voiceAdded ? '\u2713 Recorded' : '\u2014 Skipped'}
                </p>
              </div>
              <div>
                <p style={styles.label}>Photo</p>
                <p style={{ ...styles.fieldValue, color: photoAdded ? '#10b981' : 'rgba(255,255,255,0.4)' }}>
                  {photoAdded ? '\u2713 Uploaded' : '\u2014 Skipped'}
                </p>
              </div>
            </div>
          </div>
          {sendError && (
            <p style={{ color: '#fca5a5', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>{sendError}</p>
          )}
          <button
            onClick={doSend}
            disabled={sending}
            style={{
              ...styles.cta,
              background: sending ? 'rgba(255,255,255,0.5)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              cursor: sending ? 'default' : 'pointer',
            }}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
          <p style={styles.progress}>Step 3 of 3</p>
        </div>
      </div>
    );
  }

  // STEP 4 — Sending
  if (step === 4) {
    return (
      <div style={styles.page}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }}>&#10024;</div>
          <h1 style={styles.headline}>Sending your thank-you...</h1>
          <p style={styles.body}>This may take a moment.</p>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
        </div>
      </div>
    );
  }

  // STEP 5 — Success
  if (step === 5) {
    return (
      <div style={styles.page}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>&#10003;</div>
          <h1 style={styles.headline}>Your thank-you is on its way</h1>
          <p style={styles.body}>They&rsquo;ll know it landed.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sentJobId && (
              <button
                onClick={() => { window.location.href = `/#/g/${sentJobId}`; }}
                style={{ ...styles.cta, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', cursor: 'pointer' }}
              >
                View Greet-Me
              </button>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.25rem' }}>
              <ShareTheLovePanel
                jobId={sentJobId}
                shareUrl={sentJobId ? `${window.location.origin}/#/g/${sentJobId}` : window.location.origin}
                shareText="I just sent a Greet-Me — come see what I mean."
                defaultMode="broadcast"
              />
            </div>
            <button onClick={() => navigate('/dashboard')} style={styles.ctaSecondary}>
              Go to Dashboard
            </button>
          </div>
          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
        </div>
      </div>
    );
  }

  return null;
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(160deg, #1B2A4A 0%, #2d1b4e 40%, #1B2A4A 100%)',
    padding: '2rem 1.5rem',
    fontFamily: FONT_STACK,
  },
  icon: {
    width: '4.5rem', height: '4.5rem', borderRadius: '50%',
    background: 'rgba(16, 185, 129, 0.15)', border: '2px solid rgba(16, 185, 129, 0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 2rem', fontSize: '2rem',
  },
  headline: {
    fontSize: '1.75rem', fontWeight: 500, color: '#fff',
    lineHeight: 1.4, margin: '0 0 1rem', fontFamily: 'Georgia, serif',
  },
  body: {
    fontSize: '0.9375rem', color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.6, margin: '0 0 2rem',
  },
  cta: {
    display: 'inline-block', padding: '0.875rem 2.5rem',
    background: '#fff', color: '#1B2A4A', border: 'none', borderRadius: '2rem',
    fontSize: '1.0625rem', fontWeight: 600, fontFamily: 'Georgia, serif',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,255,255,0.15)',
    width: '100%',
  },
  ctaSecondary: {
    display: 'inline-block', padding: '0.875rem 2.5rem',
    background: 'transparent', color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.3)', borderRadius: '2rem',
    fontSize: '0.9375rem', fontWeight: 600, fontFamily: 'Georgia, serif',
    cursor: 'pointer', boxShadow: 'none',
    width: '100%',
  },
  formCard: {
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '1rem',
    marginBottom: '1.5rem',
    textAlign: 'left',
  },
  label: {
    fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)',
    margin: '0 0 0.125rem', fontWeight: 600,
  },
  fieldValue: {
    fontSize: '0.9375rem', color: '#fff', margin: 0,
  },
  input: {
    width: '100%', padding: '0.625rem 0.75rem',
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px', color: '#fff', fontSize: '0.9375rem',
    fontFamily: FONT_STACK, outline: 'none',
  },
  progress: {
    fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)',
    margin: '1.5rem 0 0',
  },
  footer: {
    fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', margin: '2rem 0 0',
  },
};
