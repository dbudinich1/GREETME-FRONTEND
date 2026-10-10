// src/components/GiftEntitlementCautionModal.jsx — TEAM 1: gift/entitlement safety.
//
// Shown ONLY when the authoritative server-side preflight says the sender is at risk of a gift
// proceeding without its paired Greet-Me — never for an ordinary, sufficient-sends sender. Opening
// this modal charges, orders, sends, or discards nothing by itself; every action it can take is an
// explicit click.
//
// "Continue with Gift Only" requires its OWN second, explicit confirmation screen inside this same
// modal — the founder's requirement that this choice never be one click away from the caution.
// Confirming there calls onContinueGiftOnly, which the caller wires to first request a real,
// server-issued, single-use Gift Only authorization (api.requestGiftOnlyAuthorization) and only
// then proceeds with the actual charge/order, carrying that token — this component itself never
// talks to the backend.

import { useState } from 'react';
import Modal from './Modal';
import { AlertTriangle, TrendingUp, Wallet, Gift, Mail } from 'lucide-react';
import {
  freePlanBlockCopy, shouldOfferTopUp, isEmailConfirmationBlock, EMAIL_UNCONFIRMED_MESSAGE,
} from '../utils/sendGating';

const styles = {
  triangleWrap: {
    display: 'flex', justifyContent: 'center', marginBottom: '1rem',
  },
  triangle: {
    width: 64, height: 64, color: '#b45309',
  },
  headline: {
    fontSize: '1.25rem', fontWeight: 700, textAlign: 'center', margin: '0 0 .75rem', color: '#1f2937',
  },
  body: {
    fontSize: '.95rem', lineHeight: 1.5, textAlign: 'center', color: '#4b5563', margin: '0 0 1rem',
  },
  remaining: {
    textAlign: 'center', fontSize: '.85rem', color: '#6b7280', margin: '0 0 1.25rem',
    background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '.6rem .8rem',
  },
  choiceButton: {
    display: 'flex', alignItems: 'center', gap: '.6rem', width: '100%',
    padding: '.75rem 1rem', marginBottom: '.6rem', borderRadius: 10,
    border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer',
    fontSize: '.95rem', fontWeight: 600, textAlign: 'left', color: '#1f2937',
  },
  giftOnlyButton: {
    display: 'flex', alignItems: 'center', gap: '.6rem', width: '100%',
    padding: '.75rem 1rem', marginBottom: '.6rem', borderRadius: 10,
    border: '1px dashed #b45309', background: '#fffbeb', cursor: 'pointer',
    fontSize: '.9rem', fontWeight: 600, textAlign: 'left', color: '#92400e',
  },
  cancelButton: {
    width: '100%', padding: '.65rem 1rem', marginTop: '.4rem', borderRadius: 10,
    border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: '.88rem', color: '#6b7280', textAlign: 'center',
  },
  confirmBox: {
    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '1rem', marginBottom: '1rem',
  },
  confirmText: { fontSize: '.9rem', color: '#991b1b', lineHeight: 1.5, margin: 0 },
  confirmActions: { display: 'flex', gap: '.6rem', marginTop: '.9rem' },
  confirmGo: {
    flex: 1, padding: '.65rem 1rem', borderRadius: 10, border: 'none',
    background: '#b91c1c', color: '#fff', fontWeight: 700, cursor: 'pointer',
  },
  confirmBack: {
    flex: 1, padding: '.65rem 1rem', borderRadius: 10, border: '1px solid #d1d5db',
    background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer',
  },
};

function remainingCopy(preflight) {
  if (!preflight) return null;
  if (preflight.reasonCode === 'TRIAL_EXPIRED') return 'Your free trial has ended.';
  if (preflight.reasonCode === 'LIMIT_EXCEEDED') return "You've used all your Greet-Mes for this period.";
  if (preflight.reasonCode === 'WALLET_EXHAUSTED') return "You've used all your available Greet-Mes.";
  if (typeof preflight.remaining === 'number') return `You have ${preflight.remaining} Greet-Me${preflight.remaining === 1 ? '' : 's'} remaining.`;
  return null;
}

/**
 * @param {boolean} isOpen
 * @param {() => void} onClose - Cancel, X, or Escape. Must be lossless — no side effect here.
 * @param {object} preflight - the client-safe result from GET /api/entitlements/send-preflight
 * @param {() => void} onTopUp - open the existing top-up pathway; must not place the gift.
 * @param {() => void} onUpgrade - open the existing upgrade pathway; must not place the gift.
 * @param {() => (void|Promise<void>)} onContinueGiftOnly - called ONLY after the second, explicit
 *   confirmation below. The caller is responsible for requesting a real Gift Only authorization
 *   token and completing the purchase with it — this component does not call the backend itself.
 */
export default function GiftEntitlementCautionModal({
  isOpen, onClose, preflight, onTopUp, onUpgrade, onContinueGiftOnly, unsubscribed = false,
  onResendConfirmation = null,
}) {
  // LANE E3 (2026-10-10) — an unconfirmed email blocks every gift checkout. Confirming the email is
  // the only remedy, so Top Up / Upgrade / Gift-only are never offered for this reason.
  const emailBlock = isEmailConfirmationBlock(preflight);
  const [resendState, setResendState] = useState('idle'); // idle | sending | sent | verified | error
  // LANE E2 (2026-10-10) — an expired trial / free-plan account is told the REAL reason in plain
  // words, and is never offered "Purchase Additional Sends" (packs can never unblock a free-plan
  // send). Subscribed accounts see exactly the copy and choices they saw before.
  const freePlanCopy = freePlanBlockCopy(preflight, { unsubscribed });
  const offerTopUp = shouldOfferTopUp(preflight, { unsubscribed });
  const [confirmingGiftOnly, setConfirmingGiftOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return; // lossless, but don't abandon an in-flight explicit confirmation
    setConfirmingGiftOnly(false);
    setResendState('idle');
    onClose();
  };

  const handleConfirmGiftOnly = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onContinueGiftOnly();
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!onResendConfirmation || resendState === 'sending') return;
    setResendState('sending');
    try {
      const res = await onResendConfirmation();
      setResendState(res && res.ok === false ? 'error' : 'sent');
    } catch (err) {
      // POST /api/auth/resend-verification answers 400 when the email is already confirmed.
      setResendState(err?.status === 400 ? 'verified' : 'error');
    }
  };

  if (emailBlock) {
    return (
      <Modal isOpen={isOpen} onClose={close} title="" size="sm">
        <div data-testid="gift-entitlement-caution">
          <div style={styles.triangleWrap}>
            <Mail style={styles.triangle} strokeWidth={2.25} aria-hidden="true" data-testid="caution-email-icon" />
          </div>
          <p style={styles.body} data-testid="caution-email-unconfirmed">
            {(typeof preflight?.message === 'string' && preflight.message.trim()) || EMAIL_UNCONFIRMED_MESSAGE}
          </p>
          {onResendConfirmation ? (
            <button
              type="button" style={styles.choiceButton} data-testid="caution-resend-confirmation"
              onClick={handleResend} disabled={resendState === 'sending'}
            >
              <Mail size={18} /> {resendState === 'sending' ? 'Sending…' : 'Resend confirmation email'}
            </button>
          ) : null}
          {resendState === 'sent' ? (
            <p style={styles.remaining} data-testid="caution-resend-sent">Confirmation email sent. Check your inbox.</p>
          ) : null}
          {resendState === 'verified' ? (
            <p style={styles.remaining} data-testid="caution-resend-verified">Your email is already confirmed. Close this and try again.</p>
          ) : null}
          {resendState === 'error' ? (
            <p style={styles.remaining} data-testid="caution-resend-error">Couldn’t resend right now. Please wait a minute and try again.</p>
          ) : null}
          <button type="button" style={styles.cancelButton} data-testid="caution-cancel" onClick={close}>
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={close} title="" size="sm">
      {!confirmingGiftOnly ? (
        <div data-testid="gift-entitlement-caution">
          <div style={styles.triangleWrap}>
            <AlertTriangle style={styles.triangle} strokeWidth={2.25} aria-hidden="true" data-testid="caution-triangle" />
          </div>
          {freePlanCopy ? (
            <>
              <h2 style={styles.headline} data-testid="caution-free-plan-headline">{freePlanCopy.headline}</h2>
              <p style={styles.body}>{freePlanCopy.body}</p>
            </>
          ) : (
            <>
              <h2 style={styles.headline}>Your gift may arrive without its Greet-Me</h2>
              <p style={styles.body}>
                Before we place your gift order, make sure you have a Greet-Me send available so your
                greeting can arrive with your gift and make the moment unforgettable.
              </p>
              {remainingCopy(preflight) ? (
                <p style={styles.remaining} data-testid="caution-remaining">{remainingCopy(preflight)}</p>
              ) : null}
            </>
          )}

          {/* FOUNDER-APPROVED LABEL CORRECTION (2026-09-30) — was "Top Up"/"Upgrade". Same
              handlers, same testids, same destinations; copy only. */}
          {offerTopUp ? (
            <button type="button" style={styles.choiceButton} data-testid="caution-topup" onClick={onTopUp}>
              <Wallet size={18} /> Purchase Additional Sends
            </button>
          ) : null}
          <button type="button" style={styles.choiceButton} data-testid="caution-upgrade" onClick={onUpgrade}>
            <TrendingUp size={18} /> {freePlanCopy ? 'Upgrade to send' : 'Upgrade Plan'}
          </button>
          <button
            type="button" style={styles.giftOnlyButton} data-testid="caution-gift-only"
            onClick={() => setConfirmingGiftOnly(true)}
          >
            <Gift size={18} /> Continue with Gift Only
          </button>
          <button type="button" style={styles.cancelButton} data-testid="caution-cancel" onClick={close}>
            Cancel
          </button>
        </div>
      ) : (
        <div data-testid="gift-only-second-confirmation">
          <div style={styles.confirmBox}>
            <p style={styles.confirmText}>
              Your gift may arrive without a Greet-Me. The greeting message you wrote will not be
              sent unless you {offerTopUp ? 'top up or upgrade' : 'upgrade'} later. Are you sure you want
              to continue with the gift only?
            </p>
          </div>
          <div style={styles.confirmActions}>
            <button
              type="button" style={styles.confirmBack} data-testid="gift-only-back"
              onClick={() => setConfirmingGiftOnly(false)} disabled={submitting}
            >
              Back
            </button>
            <button
              type="button" style={styles.confirmGo} data-testid="gift-only-confirm"
              onClick={handleConfirmGiftOnly} disabled={submitting}
            >
              {submitting ? 'Continuing…' : 'Yes, continue without a Greet-Me'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
