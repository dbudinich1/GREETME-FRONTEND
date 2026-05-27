// src/components/EmailVerificationModal.jsx
//
// 🔒 PROTECTED SUBSYSTEM — Locked Viral Loop + Verification Gate
//
// This component is the warm checkpoint shown to unverified users at the moment
// of their first REAL outbound send (not onboarding test, not thank-you reply).
// Any change to this file MUST:
//   1. Declare affected locked milestones (commit SHAs)
//   2. Declare potential regressions
//   3. Pass scripts/verify-creditclaim-viral-loop-lock.mjs
//   4. Fail build if guard violates
// Last reviewed: 2026-05-27 (Stage 3 implementation)
//
// Tone: warm, emotional, non-operational. Avoid operational/security language
// or lock/shield iconography. The regression guard enforces this.

import { useEffect, useState, useRef } from 'react';

const COOLDOWN_SECONDS = 60;

export default function EmailVerificationModal({
  open,
  email,
  onResend,
  onContinueAfterVerify,
}) {
  const [phase, setPhase] = useState('idle');
  // 'idle' | 'sending' | 'sent' | 'cooldown' | 'verifyPending' | 'resendError' | 'checking'
  const [cooldown, setCooldown] = useState(0);
  const [hasSentOnce, setHasSentOnce] = useState(false);
  const cooldownRef = useRef(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
      if (phase === 'cooldown') setPhase('sent');
      return;
    }
  }, [cooldown, phase]);

  if (!open) return null;

  const startCooldown = () => {
    setCooldown(COOLDOWN_SECONDS);
    setPhase('cooldown');
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((s) => Math.max(0, s - 1));
    }, 1000);
  };

  const handleSend = async () => {
    setPhase('sending');
    try {
      await onResend();
      setHasSentOnce(true);
      startCooldown();
    } catch {
      setPhase('resendError');
    }
  };

  const handleContinue = async () => {
    setPhase('checking');
    try {
      const verifiedNow = await onContinueAfterVerify();
      if (!verifiedNow) {
        setPhase('verifyPending');
      }
    } catch {
      setPhase('verifyPending');
    }
  };

  const isResendDisabled = phase === 'sending' || phase === 'cooldown' || phase === 'checking';
  const isContinueDisabled = phase === 'sending' || phase === 'checking';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-verify-heading"
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
          maxWidth: '480px',
          backgroundColor: '#fffdf8',
          borderRadius: '14px',
          padding: '28px',
          boxShadow: '0 16px 48px rgba(74,71,67,0.25)',
          boxSizing: 'border-box',
        }}
      >
        <h2
          id="email-verify-heading"
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '22px',
            lineHeight: 1.3,
            color: '#3a2a1f',
            margin: '0 0 12px 0',
            fontWeight: 600,
          }}
        >
          Before your Greet-Me is delivered
        </h2>

        <p
          style={{
            fontSize: '15px',
            lineHeight: 1.6,
            color: '#7b6a59',
            margin: '0 0 10px 0',
          }}
        >
          Please verify your email address so we can confirm where to send delivery updates.
        </p>

        <p
          style={{
            fontSize: '15px',
            lineHeight: 1.6,
            color: '#7b6a59',
            margin: '0 0 22px 0',
          }}
        >
          We sent a verification link to{' '}
          <strong style={{ color: '#3a2a1f' }}>{email}</strong>.
        </p>

        {phase === 'sent' && (
          <p
            style={{
              fontSize: '14px',
              lineHeight: 1.5,
              color: '#3a2a1f',
              margin: '0 0 18px 0',
              padding: '12px 14px',
              backgroundColor: '#f7efe2',
              borderRadius: '8px',
            }}
          >
            Sent to <strong>{email}</strong>. Check your inbox — and your spam folder, just in case.
          </p>
        )}

        {phase === 'cooldown' && (
          <p
            style={{
              fontSize: '14px',
              lineHeight: 1.5,
              color: '#7b6a59',
              margin: '0 0 18px 0',
              padding: '12px 14px',
              backgroundColor: '#f7efe2',
              borderRadius: '8px',
            }}
          >
            Sent to <strong>{email}</strong>. You can resend in <strong>{cooldown}s</strong>.
          </p>
        )}

        {phase === 'verifyPending' && (
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
            We&rsquo;re still not seeing verification yet. Please open the email and click the link, then continue.
          </p>
        )}

        {phase === 'resendError' && (
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
            Couldn&rsquo;t resend right now. Please wait a minute and try again.
          </p>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginTop: '8px',
          }}
        >
          <button
            type="button"
            onClick={handleContinue}
            disabled={isContinueDisabled}
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '14px',
              border: 'none',
              backgroundColor: isContinueDisabled ? '#a98a76' : '#6b3a2a',
              color: '#ffffff',
              fontFamily: 'Georgia, serif',
              fontSize: '16px',
              fontWeight: 600,
              cursor: isContinueDisabled ? 'wait' : 'pointer',
              transition: 'background-color 0.18s ease',
            }}
          >
            {phase === 'checking' ? 'Checking…' : 'I’ve Verified — Continue'}
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={isResendDisabled}
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '14px',
              border: '1px solid #6b3a2a',
              backgroundColor: 'transparent',
              color: isResendDisabled ? '#a98a76' : '#6b3a2a',
              fontFamily: 'Georgia, serif',
              fontSize: '16px',
              fontWeight: 600,
              cursor: isResendDisabled ? 'wait' : 'pointer',
              transition: 'opacity 0.18s ease',
              opacity: isResendDisabled ? 0.75 : 1,
            }}
          >
            {phase === 'sending'
              ? 'Sending…'
              : phase === 'cooldown'
              ? `Resend in ${cooldown}s`
              : hasSentOnce
              ? 'Resend Verification Email'
              : 'Send Verification Email'}
          </button>
        </div>
      </div>
    </div>
  );
}
