// src/components/GuidedSetupFlow.jsx
// Guided first-time user setup flow - in-context actions, no navigation

import { useState, useRef, useEffect } from 'react';
import { X, Mic, Square, Play, Pause, Upload, Image as ImageIcon, Check, ArrowRight, Send, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { validateFile, validateAudioFile, validateEmail } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

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
  const { refreshProfile } = useAuth();
  // Steps: 0=DemoGreeting, 1=Voice, 2=Photo, 3=TestGreeting, 4=Sending, 5=Success
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

  // Demo stage state (Step 0 auto-advancing welcome/demo)
  const [demoStage, setDemoStage] = useState(0); // 0-4 (5 stages)
  const demoTimerRef = useRef(null);

  const isMobile = window.innerWidth <= 480;

  // Demo auto-advance timer — runs only while step === 0
  useEffect(() => {
    if (step !== 0) {
      if (demoTimerRef.current) clearInterval(demoTimerRef.current);
      return;
    }
    demoTimerRef.current = setInterval(() => {
      setDemoStage((prev) => {
        if (prev >= 4) {
          clearInterval(demoTimerRef.current);
          return 4;
        }
        return prev + 1;
      });
    }, 4000);
    return () => {
      if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    };
  }, [step]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (demoTimerRef.current) clearInterval(demoTimerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Fire confetti once when Success step appears
  const confettiFiredRef = useRef(false);
  useEffect(() => {
    if (step === 5 && !confettiFiredRef.current) {
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
      await api.uploadVoice(formData);

      // Write to localStorage so MediaLibrary (Your Presence) can read it immediately
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
    // Validate
    if (!greetingRecipient.trim()) {
      setGreetingError('Please enter a name');
      return;
    }
    if (!greetingEmail.trim()) {
      setGreetingError('Please enter an email');
      return;
    }
    if (!validateEmail(greetingEmail)) {
      setGreetingError('Please enter a valid email');
      return;
    }

    setGreetingError(null);
    setStep(4); // Go to sending state
    setSendingStatus('voice');

    try {
      // Simulate the sending process with status updates
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSendingStatus('video');
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSendingStatus('finalizing');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try to send via API
      try {
        await api.sendGreeting({
          recipientName: greetingRecipient.trim(),
          recipientEmail: greetingEmail.trim(),
          message: greetingMessage.trim() || 'Thinking of you',
          occasionKey: 'just_because',

          // === ONBOARDING DEMO PHOTOS (existing PhotoAlbum slideshow) ===
          photos: [
            'onboarding/photo-1-friends-sunset.jpeg',
            'onboarding/photo-2-friends-dinner.jpeg',
            'onboarding/photo-3-confetti-party.jpeg',
            'onboarding/photo-4-time-to-celebrate.jpeg',
          ],

          // === LAYOUT BUDGET (STATIC DEFAULT) ===
          layoutBudget: { introMaxChars: 280 },
        });
      } catch (err) {
        console.warn('Greeting send failed, continuing anyway:', err);
      }

      // Mark as complete
      updateSetupState({ firstGreetingSent: true });
      setSetupState(prev => ({ ...prev, firstGreetingSent: true }));
      setStep(5); // Go to success
    } catch (err) {
      setSendingError('Something went wrong. Please try again.');
      setStep(3); // Go back to test greeting
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
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.5rem',
        fontSize: '2.5rem',
      }}>
        👋
      </div>
      <h2 style={{
        fontSize: isMobile ? '1.5rem' : '1.75rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '0.5rem',
      }}>
        Welcome to Greet-Me™
      </h2>
      <p style={{
        fontSize: '1rem',
        color: 'var(--text-secondary)',
        marginBottom: '2rem',
        lineHeight: 1.6,
      }}>
        Where technology meets the moments that matter most.
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
        Begin
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
        Skip for now
      </button>
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

  // STEP 0: Welcome / Demo — auto-advancing 5-stage sequence
  const demoStages = [
    { label: 'Welcome to Greet-Me.', icon: '👋', color: 'var(--text-primary)' },
    { label: 'Envelope arrives', icon: '✉️', color: 'var(--text-secondary)' },
    { label: 'Card opens', icon: '💌', color: 'var(--text-secondary)' },
    { label: 'Hey — I just wanted to stop and say welcome to the neighborhood.', icon: '💬', color: 'var(--text-primary)' },
    { label: 'Your voice greeting plays here', icon: '🎙️', color: 'var(--text-secondary)' },
  ];

  const renderDemoGreeting = () => {
    const current = demoStages[demoStage];
    return (
      <div style={{ padding: isMobile ? '1.5rem' : '2rem', textAlign: 'center' }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1.5rem',
        }}>
          See How a Greet-Me Feels
        </h2>

        {/* Single active stage */}
        <div style={{
          maxWidth: '24rem',
          margin: '0 auto 1.5rem',
          minHeight: '8rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div
            key={demoStage}
            style={{
              padding: '1.5rem',
              background: 'var(--gray-50, #f9fafb)',
              borderRadius: 'var(--radius-md, 8px)',
              border: '1px solid var(--gray-200, #e5e7eb)',
              width: '100%',
              animation: 'demoStageFadeIn 0.5s ease-out',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{current.icon}</div>
            <p style={{
              margin: 0,
              fontSize: demoStage === 0 ? '1.15rem' : '0.95rem',
              fontWeight: demoStage === 0 ? 600 : 400,
              color: current.color,
              lineHeight: 1.5,
            }}>
              {current.label}
            </p>
          </div>
        </div>

        {/* Stage indicator */}
        <p style={{
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          marginBottom: '1.25rem',
          letterSpacing: '0.05em',
        }}>
          {demoStage + 1} / {demoStages.length}
        </p>

        {/* Inline keyframes for fade-in animation */}
        <style>{`
          @keyframes demoStageFadeIn {
            from { opacity: 0; transform: translateY(8px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>

        <button
          onClick={nextStep}
          style={{
            padding: '0.75rem 2rem',
            background: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Continue Onboarding
        </button>
      </div>
    );
  };

  // STEP 3: Record Voice
  const renderVoice = () => (
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
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            That's it — now let's make it real.
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

  // STEP 4: Test Greeting
  const renderTestGreeting = () => (
    <div style={{ padding: isMobile ? '1.5rem' : '2rem' }}>
      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: '0.75rem',
        textAlign: 'center',
      }}>
        Now, let's experience it.
      </h3>

      <p style={{
        fontSize: '0.9375rem',
        color: 'var(--text-secondary)',
        marginBottom: '1.5rem',
        textAlign: 'center',
        lineHeight: 1.6,
      }}>
        Enter your own email below to receive a greeting — or choose someone else to surprise.
      </p>

      {greetingError && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--error)', marginBottom: '1rem', textAlign: 'center' }}>
          {greetingError}
        </p>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
          Recipient Name
        </label>
        <input
          type="text"
          value={greetingRecipient}
          onChange={(e) => setGreetingRecipient(e.target.value)}
          placeholder="e.g., Mom, John, or yourself"
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
          Email Address
        </label>
        <input
          type="email"
          value={greetingEmail}
          onChange={(e) => setGreetingEmail(e.target.value)}
          placeholder="their@email.com (or your own)"
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
          Message (optional)
        </label>
        <textarea
          value={greetingMessage}
          onChange={(e) => setGreetingMessage(e.target.value)}
          placeholder="Add a personal note..."
          rows={3}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            resize: 'vertical',
          }}
        />
      </div>

      <button
        onClick={sendTestGreeting}
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
        Send my first Greet-Me™ greeting
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
        That's it! Your Greet-Me is ready!
      </h2>
      <p style={{
        fontSize: '0.9375rem',
        color: 'var(--text-secondary)',
        marginBottom: '1.5rem',
        lineHeight: 1.6,
      }}>
        You're set. From here on out, Greet-Me™ can show up for the moments that matter — in your voice, with your presence.
      </p>
      <p style={{
        fontSize: '1rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: '1.25rem',
      }}>
        What would you like to do next?
      </p>
      <button
        onClick={goToRecipientControls}
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
        Add Your First Recipient
      </button>
      <button
        onClick={goToDashboard}
        style={{
          width: '100%',
          padding: '1rem',
          background: 'white',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          fontSize: '1rem',
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: '0.75rem',
        }}
      >
        Go to Dashboard
      </button>
      <button
        onClick={goToPricing}
        style={{
          width: '100%',
          padding: '0.625rem',
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: 'none',
          fontSize: '0.875rem',
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
          textDecoration: 'underline',
        }}
      >
        Explore Plans &amp; Pricing
      </button>
    </div>
  );

  // Step content map
  const stepContent = {
    0: renderDemoGreeting,
    1: renderVoice,
    2: renderPhoto,
    3: renderTestGreeting,
    4: renderSending,
    5: renderSuccess,
  };

  // Calculate progress (steps 2-5 are the main progress steps)
  const getProgressWidth = () => {
    if (step === 0) return 20;
    if (step === 1) return 40;
    if (step === 2) return 60;
    if (step === 3) return 80;
    if (step >= 4) return 100;
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
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Progress bar (shown during demo/voice/photo/test greeting steps) */}
        {step >= 0 && step <= 3 && (
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

        {/* Close button (only on first step — DemoGreeting) */}
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
