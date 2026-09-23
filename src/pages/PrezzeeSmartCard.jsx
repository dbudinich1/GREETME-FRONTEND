// src/pages/PrezzeeSmartCard.jsx — Greet-Me Smart Card, powered by Prezzee
//
// PREZZEE DORMANT FRONTEND COMPLETION (2026-09-17). DORMANT: this page is not linked from any
// navigation, menu, or other page — see App.jsx's own comment at its route registration. The
// backend itself additionally refuses every call here (GET .../tiles, POST /prezzee-card,
// POST /prezzee-card/finalize) with 503 while LAUNCH_CONTROL.pauseGiftCards stays true, so even a
// direct visit renders nothing purchasable.
//
// EIGHT FIXED TILES ONLY, loaded from the server. No custom amount, no free-entry field, no
// client-authoritative pricing anywhere: the tile list, the face value, the fee and the total are
// all either server-supplied or a clearly-labeled PREVIEW of the server's own published formula —
// never a number the client can edit and have honored.
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../api/api';
import PrezzeeCardConfirmationModal from '../components/PrezzeeCardConfirmationModal';
import { Gift, AlertCircle, Loader, CheckCircle2 } from 'lucide-react';

// Preview-only mirror of the server's published formula (services/giftCatalog.js#
// calcPrezzeeCardFees) — 2.9% + $0.30. Used ONLY to show an estimate before a charge is
// attempted; the actual charge amount and the actual persisted fee always come from the server's
// own response, never from this function's return value.
function previewFee(amountCents) {
  const fee = Math.round(amountCents * 0.029) + 30;
  return { feeCents: fee, totalCents: amountCents + fee };
}

const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;

// Statuses at which the server has DEFINITIVELY not taken payment: auth/validation/mismatch
// refusals before Stripe (400/401/403/404), a declined or not-completed PaymentIntent (402), rate
// limiting (429), and the dormant pause gate (503). Anything else — a network failure (status 0),
// a 5xx, a missing status — may have happened after Stripe charged the card, so it is UNKNOWN.
const NOT_CHARGED_STATUSES = new Set([400, 401, 402, 403, 404, 429, 503]);
const OUTCOME_UNKNOWN_MESSAGE =
  'We could not confirm whether your payment went through. Please do not try again: contact support and we will check it for you.';

function failure(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export default function PrezzeeSmartCard() {
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'dormant' | 'error'
  const [product, setProduct] = useState(null);
  const [tiles, setTiles] = useState([]);
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [charging, setCharging] = useState(false);
  const [chargeError, setChargeError] = useState(null);
  const [successGift, setSuccessGift] = useState(null);
  // FIX 2026-09-23 (Team C, Prezzee fulfilment failure safety correction): a real production
  // purchase showed "Smart Card purchased" for an order whose vendor fulfilment had actually
  // failed — finalizePrezzeeCardOrder() always returns the order, regardless of vendor outcome.
  // The server now reports `fulfillmentStatus` ("failed"/"pending") whenever it is anything
  // other than confirmed; `successGift` is set ONLY for a genuinely confirmed purchase, and this
  // state renders a distinct, truthful "not purchased yet" screen for every other case.
  const [fulfillmentIssue, setFulfillmentIssue] = useState(null); // { status: 'failed'|'pending', gift, message }
  const giftRequestIdRef = useRef(crypto.randomUUID());
  // A PaymentIntent that 3DS has already SUCCEEDED for. While set, a retry only re-finalizes it
  // (idempotent by paymentIntentId server-side) and never starts a second charge.
  const paidPaymentIntentIdRef = useRef(null);
  // Set when a charge failed in a way that may already have taken payment. Retry is then refused.
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [awaitingFinalize, setAwaitingFinalize] = useState(false); // mirrors paidPaymentIntentIdRef for rendering

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // api.js's request() throws for any non-2xx response except 401/404 — a 503 (dormant)
        // response is a thrown Error with .status, never a resolved {status:503}.
        const res = await api.getPrezzeeCardTiles();
        if (cancelled) return;
        if (!res.ok || !Array.isArray(res.tiles)) {
          setLoadState('error');
          return;
        }
        setProduct(res.product || null);
        setTiles(res.tiles);
        setLoadState('ready');
      } catch (err) {
        if (cancelled) return;
        if (err?.status === 503) {
          setLoadState('dormant');
          return;
        }
        setLoadState('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedTile = useMemo(
    () => tiles.find((t) => t.id === selectedTileId) || null,
    [tiles, selectedTileId],
  );
  const preview = useMemo(
    () => (selectedTile ? previewFee(selectedTile.amountCents) : null),
    [selectedTile],
  );

  const canContinue = Boolean(selectedTile) && recipientEmail.trim() && recipientName.trim() && !charging && !outcomeUnknown;

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    setChargeError(null);
    setIsConfirmOpen(true);
  }, [canContinue]);

  // Duplicate-submission guard: `charging` gates BOTH the modal's own confirm button (passed
  // through as a prop) and this handler's own re-entry — a second click while a request is
  // already in flight is a no-op, not a second charge.
  const handleConfirm = useCallback(async (paymentMethodId, stripeInstance) => {
    if (charging || outcomeUnknown || !selectedTile) return;
    setCharging(true);
    setChargeError(null);

    // FIX 2026-09-23: returns the full { gift, fulfillmentStatus, fulfillmentMessage } outcome —
    // not just `gift` — so a confirmed-vendor-fulfilment purchase can be told apart from one that
    // is merely paid-and-ordered. `fulfillmentStatus` is absent (undefined) for a genuinely
    // confirmed purchase, by the server's own contract (see buildPrezzeeCardOrderResponse).
    const finalizePaid = async (paymentIntentId) => {
      let finalizeResult = null;
      try {
        finalizeResult = await api.finalizePrezzeeCard({ paymentIntentId, recipientEmail, recipientName });
      } catch { /* thrown non-2xx — handled as not finalized below */ }
      if (!finalizeResult?.ok || !finalizeResult.gift) {
        throw new Error(
          'Your payment went through, but we could not finish setting up the Smart Card. '
          + 'Please try again — you will not be charged again.',
        );
      }
      return { gift: finalizeResult.gift, fulfillmentStatus: finalizeResult.fulfillmentStatus, fulfillmentMessage: finalizeResult.error };
    };

    try {
      let outcome;
      if (paidPaymentIntentIdRef.current) {
        // 3DS already succeeded on an earlier attempt: finish THAT payment, never charge again.
        outcome = await finalizePaid(paidPaymentIntentIdRef.current);
      } else {
        // ONLY the tile id is submitted — never an amount, fee, total, product code, currency, or
        // provider. Every one of those is resolved server-side from the tile id alone.
        let chargeResult;
        try {
          chargeResult = await api.chargePrezzeeCard({
            tileId: selectedTile.id,
            recipientEmail,
            recipientName,
            paymentMethodId,
            giftRequestId: giftRequestIdRef.current,
          });
        } catch (err) {
          // Never surface a raw provider/payment error object — only the server's own safe message.
          throw failure(err?.message || 'Smart Card purchase failed.', err?.status);
        }

        if (chargeResult?.requiresAction && chargeResult.clientSecret) {
          if (!stripeInstance) throw failure('Payment authentication failed. Please try again.', 402);
          const { error: confirmError, paymentIntent } = await stripeInstance.confirmCardPayment(
            chargeResult.clientSecret,
          );
          if (confirmError) throw failure(confirmError.message || 'Card authentication failed.', 402);
          if (paymentIntent?.status !== 'succeeded') {
            throw failure('Payment was not completed after authentication.', 402);
          }
          paidPaymentIntentIdRef.current = chargeResult.paymentIntentId;
          setAwaitingFinalize(true);
          outcome = await finalizePaid(chargeResult.paymentIntentId);
        } else if (chargeResult?.ok && chargeResult.gift) {
          outcome = { gift: chargeResult.gift, fulfillmentStatus: chargeResult.fulfillmentStatus, fulfillmentMessage: chargeResult.error };
        } else {
          throw failure(chargeResult?.error || 'Smart Card purchase failed.', chargeResult?.status);
        }
      }

      paidPaymentIntentIdRef.current = null;
      setAwaitingFinalize(false);
      setIsConfirmOpen(false);
      setSelectedTileId(null);
      // "Smart Card purchased" is shown ONLY for a genuinely confirmed vendor fulfilment — a
      // "failed" or "pending" disposition renders the distinct, truthful screen instead.
      if (outcome.fulfillmentStatus === 'failed' || outcome.fulfillmentStatus === 'pending') {
        setFulfillmentIssue({ status: outcome.fulfillmentStatus, gift: outcome.gift, message: outcome.fulfillmentMessage });
      } else {
        setSuccessGift(outcome.gift); // server-returned values — authoritative, shown as-is
      }
    } catch (error) {
      if (paidPaymentIntentIdRef.current) {
        // Paid but not finalized: keep the key and the PaymentIntent; the next attempt re-finalizes.
        setChargeError(error?.message);
      } else if (NOT_CHARGED_STATUSES.has(error?.status)) {
        setChargeError(error?.message || 'Failed to purchase the Smart Card. Please try again.');
        // Definitively not charged: a fresh key lets a new card/attempt through Stripe's
        // idempotency-key reuse rules — the existing QR Cash retry behavior.
        giftRequestIdRef.current = crypto.randomUUID();
      } else {
        // May already be charged. Keep the key, refuse any further attempt from this page.
        setOutcomeUnknown(true);
        setChargeError(OUTCOME_UNKNOWN_MESSAGE);
      }
    } finally {
      setCharging(false);
    }
  }, [charging, outcomeUnknown, selectedTile, recipientEmail, recipientName]);

  if (loadState === 'loading') {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary, #6b7280)' }}>
        <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <p>Loading Smart Card options…</p>
      </div>
    );
  }

  if (loadState === 'dormant') {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', maxWidth: '32rem', margin: '0 auto' }}>
        <AlertCircle size={32} style={{ color: '#d97706' }} />
        <p style={{ color: '#92400e', fontSize: '0.9375rem' }}>
          The Greet-Me Smart Card is not available yet.
        </p>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', maxWidth: '32rem', margin: '0 auto' }}>
        <AlertCircle size={32} style={{ color: '#dc2626' }} />
        <p style={{ color: '#991b1b', fontSize: '0.9375rem' }}>
          Something went wrong loading the Smart Card. Please try again later.
        </p>
      </div>
    );
  }

  if (fulfillmentIssue) {
    const isFailed = fulfillmentIssue.status === 'failed';
    return (
      <div style={{ padding: '3rem', textAlign: 'center', maxWidth: '32rem', margin: '0 auto' }}>
        <AlertCircle size={40} style={{ color: isFailed ? '#dc2626' : '#d97706' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.75rem 0 0.5rem' }}>
          {isFailed ? 'We could not issue your Smart Card' : 'Confirming your Smart Card'}
        </h2>
        <p style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '0.9375rem' }}>
          {fulfillmentIssue.message || (isFailed
            ? 'Your payment was received, but we could not issue your Smart Card. Contact support for help.'
            : "Your payment was received. We're still confirming your Smart Card — check back shortly, or contact support if this persists.")}
        </p>
        {fulfillmentIssue.gift && (
          <p style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
            Face value {fmt(fulfillmentIssue.gift.giftAmountCents)} · Fee {fmt(fulfillmentIssue.gift.feeCents)} · Total charged {fmt(fulfillmentIssue.gift.totalCents)}
          </p>
        )}
      </div>
    );
  }

  if (successGift) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', maxWidth: '32rem', margin: '0 auto' }}>
        <CheckCircle2 size={40} style={{ color: '#059669' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.75rem 0 0.5rem' }}>Smart Card purchased</h2>
        {/* Server-returned values, shown exactly as returned — never re-derived on the client. */}
        <p style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '0.9375rem' }}>
          Face value {fmt(successGift.giftAmountCents)} · Fee {fmt(successGift.feeCents)} · Total charged {fmt(successGift.totalCents)}
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Gift size={22} />
          {product?.name || 'Greet-Me Smart Card, powered by Prezzee'}
        </h1>
        {product?.poweredBy && (
          <p style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '0.8125rem', margin: 0 }}>
            Powered by {product.poweredBy}
          </p>
        )}
      </header>

      <div
        role="radiogroup"
        aria-label="Smart Card amount"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}
      >
        {tiles.map((tile) => {
          const selected = tile.id === selectedTileId;
          return (
            <button
              key={tile.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-tile-id={tile.id}
              onClick={() => setSelectedTileId(tile.id)}
              disabled={charging || outcomeUnknown || awaitingFinalize}
              style={{
                padding: '1rem 0.5rem',
                borderRadius: '0.75rem',
                border: selected ? '2px solid #059669' : '1px solid #d1d5db',
                background: selected ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' : '#fff',
                color: selected ? '#065f46' : '#1f2937',
                fontSize: '1.0625rem',
                fontWeight: 700,
                cursor: (charging || outcomeUnknown || awaitingFinalize) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {tile.displayAmount}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
          Recipient name
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            disabled={charging}
            style={{ display: 'block', width: '100%', marginTop: '0.375rem', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', fontFamily: 'inherit', fontSize: '0.9375rem' }}
          />
        </label>
        <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
          Recipient email
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            disabled={charging}
            style={{ display: 'block', width: '100%', marginTop: '0.375rem', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', fontFamily: 'inherit', fontSize: '0.9375rem' }}
          />
        </label>
      </div>

      {selectedTile && preview && (
        <div style={{
          padding: '1rem 1.25rem', borderRadius: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', marginBottom: '1.25rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.375rem' }}>
            <span>Smart Card value</span><span>{fmt(selectedTile.amountCents)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.375rem' }}>
            <span>Processing fee (estimated)</span><span>{fmt(preview.feeCents)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, color: '#111827', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
            <span>Estimated total</span><span>{fmt(preview.totalCents)}</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.5rem 0 0' }}>
            The exact fee and total charged are confirmed by the server at checkout.
          </p>
        </div>
      )}

      {chargeError && (
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', background: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fecaca', marginBottom: '1rem' }}>
          <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: '0.125rem' }} />
          <span style={{ fontSize: '0.875rem', color: '#dc2626' }}>{chargeError}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!canContinue}
        style={{
          width: '100%', padding: '0.875rem 1rem', borderRadius: '0.5rem', border: 'none',
          background: canContinue ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#9ca3af',
          color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: canContinue ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
        }}
      >
        {charging ? 'Processing…' : 'Continue to payment'}
      </button>

      {selectedTile && preview && (
        <PrezzeeCardConfirmationModal
          isOpen={isConfirmOpen}
          onClose={() => { if (!charging) setIsConfirmOpen(false); }}
          onConfirm={handleConfirm}
          displayAmount={selectedTile.displayAmount}
          giftAmountCents={selectedTile.amountCents}
          feeCents={preview.feeCents}
          totalCents={preview.totalCents}
          charging={charging}
          chargeError={chargeError}
        />
      )}
    </div>
  );
}
