// src/components/VoiceMissingModal.jsx
//
// 🔒 PROTECTED SUBSYSTEM — Locked Viral Loop + Verification Gate + Voice Integrity
//
// Warm recovery modal shown when the user's voice recording is no longer
// reachable. This is the moment of "your voice needs help." It must feel
// like a friend's nudge — calm, parchment palette, no technical language,
// no alarm icons.
//
// Tone (founder directive, 2026-05-27):
//   - Emotional, warm, non-technical
//   - Avoid: technical jargon, system-error language, alarm visuals
//   - Use: "fresh recording", "sounds like you", inviting tone
//
// Draft preservation contract:
//   - Sibling-rendered to SendGreeting form (never inside its tree)
//   - "Save my draft for later" → caller persists draft + routes elsewhere
//   - "Re-record my voice" → embedded recorder opens IN this modal (no
//     navigation away). On successful upload, caller's onRerecordSuccess
//     fires and the parent retries the pending send.
//
// Any change to this file MUST:
//   1. Declare affected locked milestones (commit SHAs)
//   2. Declare potential regressions
//   3. Pass scripts/verify-creditclaim-viral-loop-lock.mjs (FRONTEND)
//   4. Fail build if guard violates
// Last reviewed: 2026-05-27 (Stage 3 implementation).

import { useState, useRef, useEffect } from 'react';
import VoiceRecorder from './VoiceRecorder';
import api from '../api/api';

export default function VoiceMissingModal({
  open,
  voiceUrl,
  onRerecordSuccess,
  onSaveDraft,
}) {
  const [phase, setPhase] = useState('idle');
  // 'idle' | 'playing' | 'recording' | 'uploading' | 'softError'
  const [softMessage, setSoftMessage] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setPhase('idle');
      setSoftMessage(null);
    }
  }, [open]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => setPhase('idle');
    el.addEventListener('ended', onEnded);
    return () => el.removeEventListener('ended', onEnded);
  }, [phase]);

  if (!open) return null;

  const handlePlayLast = () => {
    if (!voiceUrl || !audioRef.current) return;
    if (phase === 'playing') {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPhase('idle');
      return;
    }
    audioRef.current.play().then(() => setPhase('playing')).catch(() => setPhase('idle'));
  };

  const handleStartRerecord = () => {
    if (audioRef.current && phase === 'playing') {
      audioRef.current.pause();
    }
    setPhase('recording');
    setSoftMessage(null);
  };

  const handleCancelRerecord = () => {
    setPhase('idle');
    setSoftMessage(null);
  };

  const handleRecorderUpload = async (formData) => {
    setPhase('uploading');
    setSoftMessage(null);
    try {
      const result = await api.uploadVoice(formData);
      if (result?.ok === false) {
        setPhase('softError');
        setSoftMessage("We couldn't save that recording. Please try once more.");
        return;
      }
      // Successful re-record — parent will refresh profile, retry pending send, and close us
      await onRerecordSuccess?.();
    } catch {
      setPhase('softError');
      setSoftMessage("We couldn't save that recording. Please try once more.");
    }
  };

  const isRecording = phase === 'recording' || phase === 'uploading';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-missing-heading"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(74, 71, 67, 0.55)',
          zIndex: 10050,
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 10051,
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#fffdf8',
          borderRadius: '14px',
          padding: '28px',
          boxShadow: '0 16px 48px rgba(74,71,67,0.25)',
          boxSizing: 'border-box',
        }}
      >
        <h2
          id="voice-missing-heading"
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '22px',
            lineHeight: 1.3,
            color: '#3a2a1f',
            margin: '0 0 12px 0',
            fontWeight: 600,
          }}
        >
          Your voice needs a fresh recording
        </h2>

        <p style={{ fontSize: '15px', lineHeight: 1.6, color: '#7b6a59', margin: '0 0 12px 0' }}>
          We&rsquo;re not able to reach the voice you recorded earlier. Let&rsquo;s record it again so your Greet-Me sounds like you.
        </p>

        {voiceUrl && !isRecording && (
          <p style={{ fontSize: '15px', lineHeight: 1.6, color: '#7b6a59', margin: '0 0 18px 0' }}>
            Your last recording is saved if you&rsquo;d like to hear it first.
          </p>
        )}

        {voiceUrl && <audio ref={audioRef} src={voiceUrl} preload="metadata" />}

        {softMessage && (
          <p
            style={{
              fontSize: '14px',
              lineHeight: 1.5,
              color: '#7b6a59',
              margin: '0 0 18px 0',
              padding: '12px 14px',
              backgroundColor: '#faf3e8',
              borderRadius: '8px',
              borderLeft: '3px solid #c8a06b',
            }}
          >
            {softMessage}
          </p>
        )}

        {!isRecording ? (
          <>
            {voiceUrl && (
              <button
                type="button"
                onClick={handlePlayLast}
                style={{
                  width: '100%',
                  height: '44px',
                  marginBottom: '10px',
                  borderRadius: '14px',
                  border: '1px solid #d4c5b3',
                  backgroundColor: 'transparent',
                  color: '#6b3a2a',
                  fontFamily: 'Georgia, serif',
                  fontSize: '15px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {phase === 'playing' ? '⏸  Stop' : '▶  Hear my last recording'}
              </button>
            )}

            <button
              type="button"
              onClick={handleStartRerecord}
              style={{
                width: '100%',
                height: '48px',
                marginBottom: '10px',
                borderRadius: '14px',
                border: 'none',
                backgroundColor: '#6b3a2a',
                color: '#ffffff',
                fontFamily: 'Georgia, serif',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.18s ease',
              }}
            >
              Re-record my voice
            </button>

            <button
              type="button"
              onClick={onSaveDraft}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '14px',
                border: '1px solid #6b3a2a',
                backgroundColor: 'transparent',
                color: '#6b3a2a',
                fontFamily: 'Georgia, serif',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Save my draft for later
            </button>
          </>
        ) : (
          <>
            <div style={{ marginTop: '4px', marginBottom: '16px' }}>
              <VoiceRecorder onUpload={handleRecorderUpload} existingVoice={null} />
            </div>
            {phase !== 'uploading' && (
              <button
                type="button"
                onClick={handleCancelRerecord}
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: '14px',
                  border: '1px solid #d4c5b3',
                  backgroundColor: 'transparent',
                  color: '#7b6a59',
                  fontFamily: 'Georgia, serif',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
