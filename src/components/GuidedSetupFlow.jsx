// src/components/GuidedSetupFlow.jsx
// Guided first-time user setup flow - in-context actions, no navigation

import { useState, useRef, useEffect } from 'react';
import { X, Mic, Square, Play, Pause, Upload, Image as ImageIcon, Check, ArrowRight, Send, Loader, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { validateFile, validateAudioFile, validateEmail } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { addToMediaLibrary } from '../utils/mediaLibrary';

// Onboarding illustration from public folder
const onboardingExplainer = '/assets/onboarding/onboarding-explainer.png';

// Setup state keys
const SETUP_STATE_KEY = 'greetme_setup_state';

// Get setup state from localStorage
export function getSetupState() {
  try {
    return JSON.parse(localStorage.getItem(SETUP_STATE_KEY) || '{}');
  } catch {
    return {};
  }
}

// Update setup state
export function updateSetupState(updates) {
  const current = getSetupState();
  const updated = { ...current, ...updates };
  localStorage.setItem(SETUP_STATE_KEY, JSON.stringify(updated));
  return updated;
}

// Check if guided setup should show
export function shouldShowGuidedSetup() {
  // Flag-based: VITE_FORCE_ONBOARDING=true forces onboarding on every login
  // Disable by setting VITE_FORCE_ONBOARDING=false or removing the env var
  const forceOnboarding = import.meta.env.VITE_FORCE_ONBOARDING === 'true';

  if (forceOnboarding) {
    return true;
  }

  const state = getSetupState();
  if (state.onboardingDismissed || state.onboardingCompleted) return false;
  if (state.voiceDone && state.photoDone && state.firstGreetingSent) return false;
  return true;
}

export default function GuidedSetupFlow({ onComplete, onDismiss }) {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  // Steps: 0=Welcome, 1=QuickStart, 2=Voice, 3=Photo, 4=Recipient, 5=SendPrep, 6=Sending, 7=Success, 8=GiftReveal
  const [step, setStep] = useState(0);
  const [setupState, setSetupState] = useState(getSetupState());

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [voiceSaved, setVoiceSaved] = useState(setupState.voiceDone || false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPlayerRef = useRef(null);
  const timerRef = useRef(null);

  // Photo upload state
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const [photoSaved, setPhotoSaved] = useState(setupState.photoDone || false);
  const fileInputRef = useRef(null);

  // Test greeting state
  const [greetingRecipient, setGreetingRecipient] = useState('');
  const [greetingEmail, setGreetingEmail] = useState('');
  const [greetingMessage, setGreetingMessage] = useState('');
  const [greetingError, setGreetingError] = useState(null);

  // Sending state
  const [sendingStatus, setSendingStatus] = useState(''); // 'voice', 'video', 'finalizing'
  const [sendingError, setSendingError] = useState(null);

  const isMobile = window.innerWidth <= 480;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Fire confetti once when Success step appears
  const confettiFiredRef = useRef(false);
  useEffect(() => {
    if (step === 7 && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      (async () => {
        try {
          const confetti = (await import('canvas-confetti')).default;
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        } catch { /* silently ignore if confetti fails */ }
      })();
    }
  }, [step]);

  // ==================== VOICE FUNCTIONS ====================
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      setVoiceError(null);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev + 1 >= 30) {
            // Auto-stop at 30 seconds
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
              setIsRecording(false);
              clearInterval(timerRef.current);
            }
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      setVoiceError('Could not access microphone. Please grant permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const playAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    }
  };

  const resetRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const uploadVoice = async () => {
    if (!audioBlob) return;

    if (recordingTime < 10) {
      setVoiceError('Please record at least 10 seconds.');
      return;
    }
    if (recordingTime > 30) {
      setVoiceError('Recording must be under 30 seconds. Please re-record.');
      return;
    }

    const file = new File([audioBlob], 'voice-recording.webm', { type: 'audio/webm' });
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      setVoiceError(validation.error);
      return;
    }

    setVoiceUploading(true);
    setVoiceError(null);
    try {
      const formData = new FormData();
      formData.append('voice', file);
      const result = await api.uploadVoice(formData);

      // Add the server-returned voice URL to media library (blob URL is safe to store)
      if (result?.voiceUrl) {
        addToMediaLibrary(result.voiceUrl, 'user-voice');
      }

      // Write base64 to localStorage for immediate playback in Your Presence
      const reader = new FileReader();
      await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          localStorage.setItem('greetme_voice_file', reader.result);
          resolve();
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      setVoiceSaved(true);
      updateSetupState({ voiceDone: true });
      setSetupState(prev => ({ ...prev, voiceDone: true }));
    } catch (err) {
      console.error('Voice upload failed:', err);
      setVoiceError('Voice upload failed. Please try again.');
    } finally {
      setVoiceUploading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ==================== PHOTO FUNCTIONS ====================
  const handlePhotoSelect = (file) => {
    const validation = validateFile(file, { maxSize: 5 * 1024 * 1024 });
    if (!validation.valid) {
      setPhotoError(validation.error);
      return;
    }

    setPhotoFile(file);
    setPhotoError(null);

    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) handlePhotoSelect(file);
  };

  const uploadPhoto = async () => {
    if (!photoFile) return;

    setPhotoUploading(true);
    setPhotoError(null);
    try {
      const formData = new FormData();
      formData.append('photo', photoFile);
      await api.uploadPhoto(formData);

      // Refresh AuthContext so MediaLibrary (Your Presence) sees updated user.photoUrl immediately
      await refreshProfile();

      setPhotoSaved(true);
      updateSetupState({ photoDone: true });
      setSetupState(prev => ({ ...prev, photoDone: true }));
    } catch (err) {
      console.error('Photo upload failed:', err);
      setPhotoError('Photo upload failed. Please try again.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const removePhoto = () => {
    setPhotoPreview(null);
    setPhotoFile(null);
    setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ==================== TEST GREETING FUNCTIONS ====================
  const sendTestGreeting = async () => {
    // Use prefilled user values if fields are empty (onboarding auto-send)
    const recipientName = greetingRecipient.trim() || user?.name || 'there';
    const recipientEmail = greetingEmail.trim() || user?.email || '';

    if (!recipientName) {
      setGreetingError('Please enter a name');
      return;
    }
    if (!recipientEmail || !validateEmail(recipientEmail)) {
      setGreetingError('Please enter a valid email');
      return;
    }

    setGreetingError(null);
    setStep(6); // Go to sending state
    setSendingStatus('voice');

    // Fire API call immediately (runs in background)
    // First test send uses pre-written welcome content (demoContent override)
    const sendPromise = api.sendGreeting({
      recipientName,
      recipientEmail,
      message: greetingMessage.trim() || 'Welcome to Greet-Me',
      occasionKey: 'just_because',
      tone: 'warm',
      photos: [
        `${window.location.origin}/assets/onboarding/memory-1-beach-toast.jpeg`,
        `${window.location.origin}/assets/onboarding/memory-2-european-walk.jpeg`,
        `${window.location.origin}/assets/onboarding/memory-3-mountain-family.jpeg`,
        `${window.location.origin}/assets/onboarding/memory-4-festival-night.jpeg`,
        `${window.location.origin}/assets/onboarding/memory-5-thinking-of-you.jpeg`,
      ],
      layoutBudget: { introMaxChars: 280 },
      isOnboardingTestSend: true,
      demoContent: {
        writtenIntroText: `Welcome!\n\nHope this message finds you well. Just wanted to take a moment to say welcome to the neighborhood. We hope you loved receiving your Greet-Me as much as we loved sending it. From our family to yours \u2014 welcome!`,
        videoScriptText: `These are the moments that matter \u2014 the people, the places, the laughter\u2026 but most of all, the personal connection. Showing up means more than you know. So let\u2019s make it extra special. I put together a little memory photo album I hope you\u2019ll love. And don\u2019t forget to check the back of the card \u2014 I added something just for you.`,
        poemText: `Some forget occasions, some forget names.\nSome meant to stop by while time passed with shame!\nSo here\u2019s to the ones that time forgot \u2014\nthe love you intended \u2014 forget them not!`,
        finaleText: `Once again, welcome.\n\nWe\u2019re looking forward to creating meaningful memories for all of life\u2019s special occasions. Be sure to collect your gift.\n\nForget them not.`,
      },
    }).then(result => {
      if (result?.jobId) localStorage.setItem('greetme_onboarding_test_jobId', result.jobId);
      return result;
    }).catch(err => {
      console.warn('Greeting send failed, continuing anyway:', err);
      return null;
    });

    try {
      // Animate progress stages while API runs in parallel
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSendingStatus('video');
      await new Promise(resolve => setTimeout(resolve, 3000));
      setSendingStatus('finalizing');

      // Wait for API to finish (may already be done)
      await sendPromise;

      // Brief pause on "finalizing" so it doesn't flash
      await new Promise(resolve => setTimeout(resolve, 800));

      // Mark as complete and advance
      updateSetupState({ firstGreetingSent: true });
      setSetupState(prev => ({ ...prev, firstGreetingSent: true }));
      setStep(7); // Go to success
    } catch (err) {
      setSendingError('Something went wrong. Please try again.');
      setStep(5); // Go back to send-prep on error
    }
  };

  // ==================== NAVIGATION ====================
  const handleSkip = () => {
    updateSetupState({ onboardingDismissed: true });
    onDismiss?.();
  };

  const handleComplete = () => {
    // Fire-and-forget: call backend to send onboarding email (idempotent)
    api.completeOnboarding().catch((err) => {
      console.warn('Onboarding completion email failed:', err);
    });
    updateSetupState({ onboardingCompleted: true });
    onComplete?.();
  };

  const goToRecipientControls = () => {
    handleComplete();
    navigate('/dashboard/contacts');
  };

  const goToDashboard = () => {
    handleComplete();
  };

  const goToPricing = () => {
    handleComplete();
    navigate('/pricing');
  };

  const nextStep = () => {
    setStep(prev => prev + 1);
  };

  // ==================== RENDER STEPS ====================

  // STEP 0: Welcome
  const renderWelcome = () => (
    <div style={{ textAlign: 'center', padding: isMobile ? '2rem 1.5rem' : '2.5rem 2rem' }}>
      <div style={{
        width: '5rem',
        height: '5rem',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.5rem',
        fontSize: '2.5rem',
      }}>
        🎉
      </div>
      <h2 style={{
        fontSize: isMobile ? '1.375rem' : '1.625rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '1.25rem',
        lineHeight: 1.35,
      }}>
        Congratulations{user?.name ? `, ${user.name.split(' ')[0]}` : ''} &mdash; welcome to Greet-Me.
      </h2>
      <p style={{
        fontSize: '1rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
        marginBottom: '1.5rem',
        maxWidth: '24rem',
        margin: '0 auto 1.5rem',
      }}>
        You&rsquo;ve earned ❤️ 25 hearts and received 3 free sends &mdash; our gift to you.
      </p>
      <p style={{
        fontSize: '1.0625rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: '2rem',
      }}>
        Let&rsquo;s create your first Greet-Me.
      </p>
      <button
        onClick={nextStep}
        style={{
          width: '100%',
          padding: '1rem',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: '0.75rem',
        }}
      >
        Let&rsquo;s go
      </button>
      <p style={{
        fontSize: '0.75rem',
        color: 'var(--text-tertiary)',
        fontStyle: 'italic',
        margin: 0,
      }}>
        Your first test Greet-Me is on us &mdash; it won&rsquo;t count toward your 3 sends.
      </p>
    </div>
  );

  // STEP 1: Teaching Screen (Locked - Upload → Automate → Delight)
  const renderTeachingScreen = () => (
    <div style={{ textAlign: 'center', padding: isMobile ? '1.5rem 1rem' : '2rem 1.5rem' }}>
      {/* Onboarding Illustration - 3-panel explainer */}
      <img
        src={onboardingExplainer}
        alt="Upload once, send greetings automatically, delight recipients"
        style={{
          width: '100%',
          maxWidth: '100%',
          height: 'auto',
          marginBottom: '1.5rem',
        }}
      />

      {/* Locked Copy - DO NOT EDIT */}
      <div style={{
        fontSize: isMobile ? '0.9375rem' : '1rem',
        color: 'var(--text-primary)',
        lineHeight: 1.8,
        marginBottom: '2rem',
        textAlign: 'left',
        maxWidth: '340px',
        margin: '0 auto 2rem',
      }}>
        <p style={{ marginBottom: '0.5rem' }}>Upload once.</p>
        <p style={{ marginBottom: '0.5rem' }}>Add who matters.</p>
        <p style={{ marginBottom: '0.5rem' }}>Set your can't-miss moments.</p>
        <p style={{ marginBottom: 0 }}>Enjoy automatic animated greetings — with thoughtful gifts they'll never forget.</p>
      </div>

      {/* Single Primary CTA */}
      <button
        onClick={nextStep}
        style={{
          width: '100%',
          padding: '1rem',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Let's set this up
      </button>
    </div>
  );

  // STEP 1: Quick-start 3-step panel (replaced full demo video)
  const renderDemoGreeting = () => (
    <div style={{ padding: isMobile ? '1.5rem' : '2rem', textAlign: 'center' }}>
      <div style={{
        width: '4rem',
        height: '4rem',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.25rem',
        fontSize: '1.75rem',
      }}>
        ✨
      </div>
      <h2 style={{
        fontSize: isMobile ? '1.25rem' : '1.5rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '0.5rem',
      }}>
        This is exciting.
      </h2>
      <p style={{
        fontSize: '1rem',
        color: 'var(--text-secondary)',
        marginBottom: '2rem',
        lineHeight: 1.6,
      }}>
        You&rsquo;re about to create your first Greet-Me.
      </p>

      {/* 3-step quick start */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxWidth: '280px',
        margin: '0 auto 2rem',
        textAlign: 'left',
      }}>
        {[
          { icon: <Mic size={20} />, label: 'Record your voice' },
          { icon: <Camera size={20} />, label: 'Add your photo' },
          { icon: <Send size={20} />, label: 'Choose your recipient' },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.875rem',
          }}>
            <div style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6366f1',
              flexShrink: 0,
            }}>
              {item.icon}
            </div>
            <span style={{
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <p style={{
        fontSize: '0.8125rem',
        color: 'var(--text-tertiary)',
        marginBottom: '1.5rem',
        fontStyle: 'italic',
      }}>
        Takes less than a minute.
      </p>

      <button
        onClick={nextStep}
        style={{
          width: '100%',
          padding: '1rem',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: '0.75rem',
        }}
      >
        Let&rsquo;s go
      </button>
      <button
        onClick={handleSkip}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-tertiary)',
          fontSize: '0.875rem',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        I&rsquo;ll set up later
      </button>
    </div>
  );

  // STEP 3: Record Voice
  const [voicePrepSeen, setVoicePrepSeen] = useState(true); // Quick-start panel now covers this

  const renderVoice = () => {
    // Bridge / prep screen before voice recording
    if (!voicePrepSeen && !voiceSaved) {
      return (
        <div style={{ padding: isMobile ? '1.5rem' : '2rem', textAlign: 'center' }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            fontSize: '1.75rem',
          }}>
            ✨
          </div>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '1rem',
          }}>
            This is exciting.
          </h3>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            marginBottom: '2rem',
            maxWidth: '22rem',
            margin: '0 auto 2rem',
          }}>
            You&rsquo;re about to create your first Greet-Me.
            Record your voice, add a photo that&rsquo;s unmistakably you, and tap send.
            Then check your inbox for your first Greet-Me.
          </p>
          <button
            onClick={() => setVoicePrepSeen(true)}
            style={{
              width: '100%',
              padding: '1rem',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Let&rsquo;s go
          </button>
        </div>
      );
    }

    return (
    <div style={{ padding: isMobile ? '1.5rem' : '2rem' }}>
      <h3 style={{
        fontSize: '1.125rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: '0.75rem',
        textAlign: 'center',
      }}>
        Record your voice so your greetings sound like you.
      </h3>

      {/* Script */}
      <div style={{
        background: 'var(--gray-50)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem',
        marginBottom: '1rem',
        borderLeft: '4px solid #6366f1',
      }}>
        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Read this script:
        </p>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>
          "Hello, I hope this greeting finds you well. I'm recording my voice so my greetings sound natural and warm. I look forward to creating many meaningful memories with friends and family for years to come. Thank you for using Greet-Me™."
        </p>
      </div>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem', textAlign: 'center' }}>
        A short message is perfect.
      </p>

      {voiceError && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--error)', marginBottom: '1rem', textAlign: 'center' }}>
          {voiceError}
        </p>
      )}

      {/* Recording UI */}
      {!voiceSaved ? (
        <div style={{ textAlign: 'center' }}>
          {!audioBlob ? (
            <>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                style={{
                  width: '5rem',
                  height: '5rem',
                  borderRadius: '50%',
                  background: '#ef4444',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  boxShadow: isRecording ? '0 0 0 8px rgba(239, 68, 68, 0.2)' : 'none',
                  animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                }}
              >
                {isRecording ? <Square size={32} color="white" /> : <Mic size={32} color="white" />}
              </button>
              {isRecording && (
                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>
                  {formatTime(recordingTime)}
                </p>
              )}
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {isRecording ? 'Click to stop' : 'Click to start recording'}
              </p>
            </>
          ) : (
            <>
              <audio ref={audioPlayerRef} src={audioUrl} onEnded={() => setIsPlaying(false)} style={{ display: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <button
                  onClick={isPlaying ? pauseAudio : playAudio}
                  style={{
                    width: '3.5rem',
                    height: '3.5rem',
                    borderRadius: '50%',
                    background: '#6366f1',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isPlaying ? <Pause size={24} color="white" /> : <Play size={24} color="white" />}
                </button>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Duration: {formatTime(recordingTime)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button
                  onClick={resetRecording}
                  style={{
                    padding: '0.625rem 1rem',
                    background: 'var(--gray-100)',
                    color: 'var(--text-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Re-record
                </button>
                <button
                  onClick={uploadVoice}
                  disabled={voiceUploading}
                  style={{
                    padding: '0.625rem 1rem',
                    background: voiceUploading ? 'var(--gray-300)' : '#6366f1',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: voiceUploading ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                >
                  <Upload size={16} />
                  {voiceUploading ? 'Saving...' : 'Save Voice'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '50%',
            background: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <Check size={32} color="white" />
          </div>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#10b981', marginBottom: '1.5rem' }}>
            Voice saved
          </p>
          <button
            onClick={nextStep}
            style={{
              padding: '0.875rem 2rem',
              background: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            Continue <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
  };

  // STEP 3: Upload Photo
  const renderPhoto = () => (
    <div style={{ padding: isMobile ? '1.5rem' : '2rem' }}>
      <h3 style={{
        fontSize: '1.125rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: '0.75rem',
        textAlign: 'center',
      }}>
        Upload a photo so your greetings look like you.
      </h3>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem', textAlign: 'center' }}>
        This image will be used for your animated greeting.
      </p>

      {photoError && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--error)', marginBottom: '1rem', textAlign: 'center' }}>
          {photoError}
        </p>
      )}

      {!photoSaved ? (
        <div style={{ textAlign: 'center' }}>
          {!photoPreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                cursor: 'pointer',
                marginBottom: '1rem',
              }}
            >
              <ImageIcon size={48} style={{ color: 'var(--text-tertiary)', marginBottom: '0.75rem' }} />
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Click to upload
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                PNG, JPG up to 5MB
              </p>
            </div>
          ) : (
            <div style={{ marginBottom: '1rem' }}>
              <img
                src={photoPreview}
                alt="Preview"
                style={{
                  width: '10rem',
                  height: '10rem',
                  objectFit: 'cover',
                  borderRadius: 'var(--radius-lg)',
                  marginBottom: '1rem',
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button
                  onClick={removePhoto}
                  style={{
                    padding: '0.625rem 1rem',
                    background: 'var(--gray-100)',
                    color: 'var(--text-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Change
                </button>
                <button
                  onClick={uploadPhoto}
                  disabled={photoUploading}
                  style={{
                    padding: '0.625rem 1rem',
                    background: photoUploading ? 'var(--gray-300)' : '#6366f1',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: photoUploading ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                >
                  <Upload size={16} />
                  {photoUploading ? 'Saving...' : 'Save Photo'}
                </button>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={handlePhotoChange}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '50%',
            background: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <Check size={32} color="white" />
          </div>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#10b981', marginBottom: '0.75rem' }}>
            Photo saved
          </p>
          <button
            onClick={nextStep}
            style={{
              padding: '0.875rem 2rem',
              background: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            Continue <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );

  // STEP 4: Recipient (standalone)
  const userName = user?.name || 'there';
  const userEmail = user?.email || '';

  const renderRecipient = () => (
    <div style={{ padding: isMobile ? '1.5rem' : '2rem', textAlign: 'center' }}>
      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: '0.75rem',
      }}>
        Add your first recipient.
      </h3>
      <p style={{
        fontSize: '0.9375rem',
        color: 'var(--text-secondary)',
        marginBottom: '1.5rem',
        lineHeight: 1.6,
      }}>
        We&rsquo;ve prefilled your details so you can experience your first Greet-Me firsthand.
      </p>

      <div style={{
        background: 'var(--gray-50, #f9fafb)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '1px solid var(--gray-200, #e5e7eb)',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        textAlign: 'left',
      }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', margin: '0 0 0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Your test recipient
        </p>
        <p style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', margin: '0 0 0.25rem', fontWeight: 500 }}>
          {userName}
        </p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
          {userEmail}
        </p>
      </div>

      <button
        onClick={nextStep}
        style={{
          width: '100%',
          padding: '1rem',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Continue
      </button>
    </div>
  );

  // STEP 5: Send Prep (trigger moment)
  const renderSendPrep = () => (
    <div style={{ padding: isMobile ? '1.5rem' : '2rem', textAlign: 'center' }}>
      <div style={{
        width: '4rem',
        height: '4rem',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.25rem',
        fontSize: '1.75rem',
      }}>
        🚀
      </div>
      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '0.5rem',
      }}>
        You&rsquo;re all set.
      </h3>
      <p style={{
        fontSize: '1rem',
        color: 'var(--text-secondary)',
        marginBottom: '0.75rem',
        lineHeight: 1.7,
      }}>
        This is where your Greet-Me comes to life.
      </p>
      <p style={{
        fontSize: '0.9375rem',
        color: 'var(--text-secondary)',
        marginBottom: '1.5rem',
        lineHeight: 1.6,
      }}>
        Click send and we&rsquo;ll deliver your first Greet-Me to your inbox.
      </p>
      <p style={{
        fontSize: '0.75rem',
        color: '#10b981',
        marginBottom: '1.5rem',
      }}>
        Your first test Greet-Me is on us &mdash; it won&rsquo;t count toward your 3 sends.
      </p>
      <button
        onClick={() => {
          setGreetingRecipient(userName);
          setGreetingEmail(userEmail);
          sendTestGreeting();
        }}
        style={{
          width: '100%',
          padding: '1rem',
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)',
        }}
      >
        <Send size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
        Send My First Greet-Me
      </button>
    </div>
  );

  // STEP 6: Test Greeting (legacy — now bypassed by SendPrep direct send)

  const renderTestGreeting = () => (
    <div style={{ padding: isMobile ? '1.5rem' : '2rem', textAlign: 'center' }}>
      <p style={{
        fontSize: '1rem',
        fontWeight: 500,
        color: '#6366f1',
        marginBottom: '0.5rem',
        fontStyle: 'italic',
      }}>
        Now for the fun part
      </p>

      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: '0.75rem',
      }}>
        Send your first Greet-Me
      </h3>

      <p style={{
        fontSize: '0.9375rem',
        color: 'var(--text-secondary)',
        marginBottom: '1.5rem',
        lineHeight: 1.6,
      }}>
        Your first personalized greeting is ready.
        We&rsquo;ll send it to you so you can experience it exactly as your recipients will.
      </p>

      {/* Prefilled info display (not editable) */}
      <div style={{
        background: 'var(--gray-50, #f9fafb)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '1px solid var(--gray-200, #e5e7eb)',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        textAlign: 'left',
      }}>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>
          <strong>To:</strong> {userName} ({userEmail})
        </p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
          <strong>Occasion:</strong> Just Because
        </p>
      </div>

      {greetingError && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--error)', marginBottom: '1rem' }}>
          {greetingError}
        </p>
      )}

      <button
        onClick={() => {
          // Prefill and send
          setGreetingRecipient(userName);
          setGreetingEmail(userEmail);
          sendTestGreeting();
        }}
        style={{
          width: '100%',
          padding: '1rem',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}
      >
        <Send size={18} />
        Send My First Greet-Me
      </button>
    </div>
  );

  // STEP 5: Sending State
  const renderSending = () => (
    <div style={{ textAlign: 'center', padding: isMobile ? '2rem 1.5rem' : '2.5rem 2rem' }}>
      <div style={{
        width: '5rem',
        height: '5rem',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.5rem',
        animation: 'pulse 1.5s infinite',
      }}>
        <Loader size={32} color="white" style={{ animation: 'spin 1s linear infinite' }} />
      </div>

      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: '1.5rem',
      }}>
        Creating your greeting…
      </h3>

      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}>
          <div style={{
            width: '1.25rem',
            height: '1.25rem',
            borderRadius: '50%',
            background: sendingStatus === 'voice' || sendingStatus === 'video' || sendingStatus === 'finalizing' ? '#10b981' : 'var(--gray-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {(sendingStatus === 'video' || sendingStatus === 'finalizing') ? (
              <Check size={12} color="white" />
            ) : sendingStatus === 'voice' ? (
              <Loader size={12} color="white" style={{ animation: 'spin 1s linear infinite' }} />
            ) : null}
          </div>
          <span style={{
            fontSize: '0.875rem',
            color: sendingStatus === 'voice' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: sendingStatus === 'voice' ? 600 : 400,
          }}>
            Generating voice
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}>
          <div style={{
            width: '1.25rem',
            height: '1.25rem',
            borderRadius: '50%',
            background: sendingStatus === 'video' || sendingStatus === 'finalizing' ? '#10b981' : 'var(--gray-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {sendingStatus === 'finalizing' ? (
              <Check size={12} color="white" />
            ) : sendingStatus === 'video' ? (
              <Loader size={12} color="white" style={{ animation: 'spin 1s linear infinite' }} />
            ) : null}
          </div>
          <span style={{
            fontSize: '0.875rem',
            color: sendingStatus === 'video' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: sendingStatus === 'video' ? 600 : 400,
          }}>
            Creating video
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}>
          <div style={{
            width: '1.25rem',
            height: '1.25rem',
            borderRadius: '50%',
            background: sendingStatus === 'finalizing' ? '#10b981' : 'var(--gray-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {sendingStatus === 'finalizing' ? (
              <Loader size={12} color="white" style={{ animation: 'spin 1s linear infinite' }} />
            ) : null}
          </div>
          <span style={{
            fontSize: '0.875rem',
            color: sendingStatus === 'finalizing' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: sendingStatus === 'finalizing' ? 600 : 400,
          }}>
            Finalizing
          </span>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );

  // STEP 6: Success
  const renderSuccess = () => (
    <div style={{ textAlign: 'center', padding: isMobile ? '2rem 1.5rem' : '2.5rem 2rem' }}>
      <div style={{
        width: '5rem',
        height: '5rem',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.5rem',
      }}>
        <Check size={40} color="white" />
      </div>
      <h2 style={{
        fontSize: isMobile ? '1.5rem' : '1.75rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '0.75rem',
      }}>
        Congratulations! Your Greet-Me is on its way!
      </h2>

      {/* First-send reward */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.5rem 1rem',
        background: '#fef3c7',
        borderRadius: '2rem',
        fontSize: '0.9375rem',
        fontWeight: 600,
        color: '#92400e',
        marginBottom: '1.25rem',
      }}>
        ❤️ +25 hearts for your first send
      </div>

      <p style={{
        fontSize: '0.9375rem',
        color: 'var(--text-secondary)',
        marginBottom: '0.75rem',
        lineHeight: 1.6,
      }}>
        We just sent you a test Greet-Me so you can experience what your recipients will receive.
      </p>
      <p style={{
        fontSize: '0.8125rem',
        color: '#10b981',
        marginBottom: '1.5rem',
      }}>
        This test send is free and does not count against your 3 free sends.
      </p>
      <p style={{
        fontSize: '0.9375rem',
        color: 'var(--text-secondary)',
        marginBottom: '1.5rem',
        lineHeight: 1.6,
      }}>
        But first &mdash; we have something for you.
      </p>
      <button
        onClick={() => setStep(8)}
        style={{
          width: '100%',
          padding: '1rem',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        See Your Gift
      </button>
    </div>
  );

  // ==================== STEP 7: GIFT REVEAL ====================
  const renderGiftReveal = () => (
    <div style={{ textAlign: 'center', padding: isMobile ? '2rem 1.5rem' : '2.5rem 2rem' }}>
      <div style={{
        width: '5rem', height: '5rem', borderRadius: '50%',
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 1.5rem', fontSize: '2.5rem',
      }}>
        🎁
      </div>
      <h2 style={{
        fontSize: isMobile ? '1.5rem' : '1.75rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '0.75rem',
        fontFamily: 'Georgia, serif',
      }}>
        G1G1 &mdash; Greet One. Gift One.&trade;
      </h2>
      <p style={{
        fontSize: '0.9375rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
        marginBottom: '1.25rem',
      }}>
        Because we believe in giving first, we&rsquo;ve included a little something to share.
      </p>
      <div style={{
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        border: '1px solid #f59e0b33',
      }}>
        <p style={{
          fontSize: '1.125rem',
          fontWeight: 700,
          color: '#92400e',
          marginBottom: '0.5rem',
          fontFamily: 'Georgia, serif',
        }}>
          🎁 Greet One. Gift One.&trade;
        </p>
        <p style={{
          fontSize: '0.875rem',
          color: '#78350f',
          lineHeight: 1.6,
          margin: 0,
        }}>
          Every Greet-Me subscription comes with one of equal value to share with a friend or loved one.
        </p>
      </div>
      {/* $5 credit apply moment */}
      <div style={{
        background: '#f0fdf4',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem',
        marginBottom: '1.25rem',
        border: '1px solid #bbf7d0',
      }}>
        <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#166534', margin: '0 0 0.25rem' }}>
          You&rsquo;ve got $5 waiting.
        </p>
        <p style={{ fontSize: '0.8125rem', color: '#15803d', margin: 0, lineHeight: 1.5 }}>
          Apply it to your first subscription &mdash; and share the Greet-Me experience with someone you love.
        </p>
      </div>

      {/* Primary CTA — view the generated greeting */}
      <button
        onClick={() => {
          const jobId = localStorage.getItem('greetme_onboarding_test_jobId');
          if (jobId) {
            window.location.href = `/#/g/${jobId}`;
          } else {
            goToPricing();
          }
        }}
        style={{
          width: '100%', padding: '1rem',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          color: 'white', border: 'none', borderRadius: 'var(--radius-lg)',
          fontSize: '1rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          marginBottom: '0.75rem',
        }}
      >
        View My Greet-Me
      </button>
      {/* Secondary CTA */}
      <button
        onClick={goToPricing}
        style={{
          width: '100%', padding: '0.75rem',
          background: 'transparent', color: 'var(--text-primary)',
          border: '1px solid var(--border, #e5e7eb)', borderRadius: 'var(--radius-lg)',
          fontSize: '0.9375rem', fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit',
          marginBottom: '0.75rem',
        }}
      >
        Explore Plans
      </button>
      {/* Tertiary link */}
      <div
        onClick={goToDashboard}
        style={{
          fontSize: '0.8125rem', color: 'var(--text-tertiary, #9ca3af)',
          cursor: 'pointer', textAlign: 'center', marginTop: '0.25rem',
        }}
      >
        Go to Dashboard
      </div>
    </div>
  );

  // Step content map
  const stepContent = {
    0: renderWelcome,
    1: renderDemoGreeting,
    2: renderVoice,
    3: renderPhoto,
    4: renderRecipient,
    5: renderSendPrep,
    6: renderSending,
    7: renderSuccess,
    8: renderGiftReveal,
  };

  // Calculate progress (steps 0-6)
  const getProgressWidth = () => {
    if (step === 0) return 6;
    if (step === 1) return 16;
    if (step === 2) return 28;
    if (step === 3) return 40;
    if (step === 4) return 52;
    if (step === 5) return 64;
    if (step === 6) return 76;
    if (step === 7) return 90;
    if (step >= 8) return 100;
    return 0;
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isMobile ? '1rem' : '2rem',
    }}>
      {/* Backdrop */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
      }} />

      {/* Modal */}
      <div style={{
        position: 'relative',
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        width: '100%',
        maxWidth: '440px',
        overflow: 'visible',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Progress bar (shown during welcome/demo/voice/photo/test greeting steps) */}
        {step >= 0 && step <= 5 && (
          <div style={{
            height: '4px',
            background: 'var(--gray-100)',
          }}>
            <div style={{
              height: '100%',
              background: '#6366f1',
              width: `${getProgressWidth()}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
        )}

        {/* Close button (only on first step — Welcome) */}
        {step === 0 && (
          <button
            onClick={handleSkip}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              width: '2rem',
              height: '2rem',
              borderRadius: '50%',
              background: 'var(--gray-100)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-tertiary)',
            }}
          >
            <X size={16} />
          </button>
        )}

        {/* Step content */}
        {stepContent[step]?.()}
      </div>

      {/* Global animation styles */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
