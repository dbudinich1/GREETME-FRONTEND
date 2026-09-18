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
  const giftRequestIdRef = useRef(crypto.randomUUID());

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

  const canContinue = Boolean(selectedTile) && recipientEmail.trim() && recipientName.trim() && !charging;

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    setChargeError(null);
    setIsConfirmOpen(true);
  }, [canContinue]);

  // Duplicate-submission guard: `charging` gates BOTH the modal's own confirm button (passed
  // through as a prop) and this handler's own re-entry — a second click while a request is
  // already in flight is a no-op, not a second charge.
  const handleConfirm = useCallback(async (paymentMethodId, stripeInstance) => {
    if (charging || !selectedTile) return;
    setCharging(true);
    setChargeError(null);

    try {
      // ONLY the tile id is submitted — never an amount, fee, total, product code, currency, or
      // provider. Every one of those is resolved server-side from the tile id alone.
      const chargeResult = await api.chargePrezzeeCard({
        tileId: selectedTile.id,
        recipientEmail,
        recipientName,
        paymentMethodId,
        giftRequestId: giftRequestIdRef.current,
      });

      let gift;
      if (chargeResult.requiresAction && chargeResult.clientSecret) {
        if (!stripeInstance) throw new Error('Payment authentication failed. Please try again.');
        const { error: confirmError, paymentIntent } = await stripeInstance.confirmCardPayment(
          chargeResult.clientSecret,
        );
        if (confirmError) throw new Error(confirmError.message || 'Card authentication failed.');
        if (paymentIntent.status !== 'succeeded') throw new Error('Payment was not completed after authentication.');

        const finalizeResult = await api.finalizePrezzeeCard({
          paymentIntentId: chargeResult.paymentIntentId,
          recipientEmail,
          recipientName,
        });
        if (!finalizeResult.ok || !finalizeResult.gift) {
          throw new Error(finalizeResult.error || 'Smart Card purchase could not be finalized.');
        }
        gift = finalizeResult.gift;
      } else if (chargeResult.ok && chargeResult.gift) {
        gift = chargeResult.gift;
      } else {
        // Never surface a raw provider/payment error object — only the server's own safe message.
        throw new Error(chargeResult.error || 'Smart Card purchase failed.');
      }

      setIsConfirmOpen(false);
      setSuccessGift(gift); // server-returned values — authoritative, shown as-is
      setSelectedTileId(null);
    } catch (error) {
      setChargeError(error?.message || 'Failed to purchase the Smart Card. Please try again.');
      // Fresh idempotency key so a genuinely new attempt isn't blocked by Stripe's own
      // idempotency-key reuse rules — mirrors the existing QR Cash retry behavior exactly.
      giftRequestIdRef.current = crypto.randomUUID();
    } finally {
      setCharging(false);
    }
  }, [charging, selectedTile, recipientEmail, recipientName]);

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
              disabled={charging}
              style={{
                padding: '1rem 0.5rem',
                borderRadius: '0.75rem',
                border: selected ? '2px solid #059669' : '1px solid #d1d5db',
                background: selected ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' : '#fff',
                color: selected ? '#065f46' : '#1f2937',
                fontSize: '1.0625rem',
                fontWeight: 700,
                cursor: charging ? 'not-allowed' : 'pointer',
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
