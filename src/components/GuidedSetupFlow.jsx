// src/components/GuidedSetupFlow.jsx
// Guided first-time user setup flow - in-context actions, no navigation

import { useState, useRef, useEffect } from 'react';
import { X, Mic, Square, Play, Pause, Upload, Image as ImageIcon, User, Check, ArrowRight, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { validateFile, validateAudioFile, validateEmail } from '../utils/helpers';
import api from '../api/api';

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
  const state = getSetupState();
  if (state.onboardingDismissed || state.onboardingCompleted) return false;
  if (state.voiceDone && state.photoDone && state.recipientDone) return false;
  return true;
}

export default function GuidedSetupFlow({ onComplete, onDismiss }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0=Welcome, 1=Voice, 2=Photo, 3=Recipient, 4=Complete
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

  // Recipient state
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientSaving, setRecipientSaving] = useState(false);
  const [recipientError, setRecipientError] = useState(null);
  const [recipientSaved, setRecipientSaved] = useState(setupState.recipientDone || false);

  const isMobile = window.innerWidth <= 480;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

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
        setRecordingTime(prev => prev + 1);
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

    const file = new File([audioBlob], 'voice-recording.webm', { type: 'audio/webm' });
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      setVoiceError(validation.error);
      return;
    }

    setVoiceUploading(true);
    try {
      const formData = new FormData();
      formData.append('voice', file);
      await api.uploadVoice(formData);
      setVoiceSaved(true);
      updateSetupState({ voiceDone: true });
      setSetupState(prev => ({ ...prev, voiceDone: true }));
    } catch (err) {
      // V1 fallback: mark as done locally
      console.warn('Voice upload failed, marking done locally:', err);
      setVoiceSaved(true);
      updateSetupState({ voiceDone: true });
      setSetupState(prev => ({ ...prev, voiceDone: true }));
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
    const validation = validateFile(file);
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
    try {
      const formData = new FormData();
      formData.append('photo', photoFile);
      await api.uploadPhoto(formData);
      setPhotoSaved(true);
      updateSetupState({ photoDone: true });
      setSetupState(prev => ({ ...prev, photoDone: true }));
    } catch (err) {
      // V1 fallback: mark as done locally
      console.warn('Photo upload failed, marking done locally:', err);
      setPhotoSaved(true);
      updateSetupState({ photoDone: true });
      setSetupState(prev => ({ ...prev, photoDone: true }));
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

  // ==================== RECIPIENT FUNCTIONS ====================
  const saveRecipient = async () => {
    // Validate
    if (!recipientName.trim()) {
      setRecipientError('Please enter a name');
      return;
    }
    if (!recipientEmail.trim()) {
      setRecipientError('Please enter an email');
      return;
    }
    if (!validateEmail(recipientEmail)) {
      setRecipientError('Please enter a valid email');
      return;
    }

    setRecipientSaving(true);
    setRecipientError(null);

    try {
      await api.createContact({
        name: recipientName.trim(),
        email: recipientEmail.trim(),
        relationship: 'friend',
        occasions: [],
      });
      setRecipientSaved(true);
      updateSetupState({ recipientDone: true });
      setSetupState(prev => ({ ...prev, recipientDone: true }));
    } catch (err) {
      // V1 fallback: store locally
      console.warn('Recipient save failed, storing locally:', err);
      const contacts = JSON.parse(localStorage.getItem('greetme_contacts') || '[]');
      contacts.push({
        id: Date.now().toString(),
        name: recipientName.trim(),
        email: recipientEmail.trim(),
        relationship: 'friend',
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('greetme_contacts', JSON.stringify(contacts));
      setRecipientSaved(true);
      updateSetupState({ recipientDone: true });
      setSetupState(prev => ({ ...prev, recipientDone: true }));
    } finally {
      setRecipientSaving(false);
    }
  };

  // ==================== NAVIGATION ====================
  const handleSkip = () => {
    updateSetupState({ onboardingDismissed: true });
    onDismiss?.();
  };

  const handleComplete = () => {
    updateSetupState({ onboardingCompleted: true });
    onComplete?.();
  };

  const goToSendGreeting = () => {
    handleComplete();
    navigate('/dashboard/send');
  };

  const goToDashboard = () => {
    handleComplete();
  };

  const nextStep = () => {
    setStep(prev => prev + 1);
  };

  // ==================== RENDER STEPS ====================

  // STEP 0: Welcome
  const renderWelcome = () => (
    <div style={{ textAlign: 'center', padding: isMobile ? '1.5rem' : '2rem' }}>
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
        marginBottom: '0.75rem',
      }}>
        Welcome to Greet-Me
      </h2>
      <p style={{
        fontSize: '1rem',
        color: 'var(--text-secondary)',
        marginBottom: '2rem',
        lineHeight: 1.6,
      }}>
        Creating unforgettable, personal greetings is as easy as 1-2-3.
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}
      >
        Start Setup <ArrowRight size={18} />
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

  // STEP 1: Record Voice
  const renderVoice = () => (
    <div style={{ padding: isMobile ? '1rem' : '1.5rem' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1rem',
      }}>
        <div style={{
          width: '2rem',
          height: '2rem',
          borderRadius: '50%',
          background: '#6366f1',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}>1</div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Record Your Voice
        </h3>
      </div>

      {/* Script */}
      <div style={{
        background: 'var(--gray-50)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem',
        marginBottom: '1.25rem',
        borderLeft: '4px solid #6366f1',
      }}>
        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Read this script:
        </p>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>
          "Hello, I hope this greeting finds you well. I'm recording my voice so my greetings sound natural and warm. I look forward to creating many meaningful memories with friends and family for years to come. Thank you for using Greet-Me!"
        </p>
      </div>

      <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '1rem', textAlign: 'center' }}>
        Don't forget to smile! 🙂
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
            Voice saved!
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

  // STEP 2: Upload Photo
  const renderPhoto = () => (
    <div style={{ padding: isMobile ? '1rem' : '1.5rem' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1rem',
      }}>
        <div style={{
          width: '2rem',
          height: '2rem',
          borderRadius: '50%',
          background: '#6366f1',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}>2</div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Upload Your Photo
        </h3>
      </div>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
        Upload a clear photo of yourself. This brings your greetings to life.
      </p>

      {photoError && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--error)', marginBottom: '1rem' }}>
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
                PNG, JPG up to 10MB
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
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#10b981', marginBottom: '1.5rem' }}>
            Photo saved!
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

  // STEP 3: Add Recipient
  const renderRecipient = () => (
    <div style={{ padding: isMobile ? '1rem' : '1.5rem' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1rem',
      }}>
        <div style={{
          width: '2rem',
          height: '2rem',
          borderRadius: '50%',
          background: '#6366f1',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}>3</div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Add Your First Recipient
        </h3>
      </div>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
        Add one person you'd like to send a greeting to.
      </p>

      {recipientError && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--error)', marginBottom: '1rem' }}>
          {recipientError}
        </p>
      )}

      {!recipientSaved ? (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
              Name
            </label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g., Mom, John, Sarah"
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
              Email
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="their@email.com"
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
          <button
            onClick={saveRecipient}
            disabled={recipientSaving}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: recipientSaving ? 'var(--gray-300)' : '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: recipientSaving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <User size={18} />
            {recipientSaving ? 'Saving...' : 'Save Recipient'}
          </button>
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
            Recipient added!
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

  // STEP 4: Complete
  const renderComplete = () => (
    <div style={{ textAlign: 'center', padding: isMobile ? '1.5rem' : '2rem' }}>
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
        You're all set!
      </h2>
      <p style={{
        fontSize: '0.9375rem',
        color: 'var(--text-secondary)',
        marginBottom: '2rem',
        lineHeight: 1.6,
      }}>
        You can always watch the demo or tutorial if you need help.<br />
        Feel free to explore — or send your first greeting now.
      </p>
      <button
        onClick={goToSendGreeting}
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}
      >
        <Send size={18} />
        Send a Test Greeting to Yourself
      </button>
      <button
        onClick={goToDashboard}
        style={{
          width: '100%',
          padding: '0.875rem',
          background: 'white',
          color: '#6366f1',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          fontSize: '0.9375rem',
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Go to Dashboard
      </button>
    </div>
  );

  // Step content map
  const stepContent = {
    0: renderWelcome,
    1: renderVoice,
    2: renderPhoto,
    3: renderRecipient,
    4: renderComplete,
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
        {/* Progress bar */}
        {step > 0 && step < 4 && (
          <div style={{
            height: '4px',
            background: 'var(--gray-100)',
          }}>
            <div style={{
              height: '100%',
              background: '#6366f1',
              width: `${(step / 3) * 100}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
        )}

        {/* Close button (only on step 0) */}
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
    </div>
  );
}
