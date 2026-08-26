// src/pages/Checkout.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CreditCard, Lock, ArrowLeft, CheckCircle, ShoppingBag, Truck, Shield } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import cartService from '../services/cartService';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { getErrorMessage } from '../utils/errorMessages';
import { getCurrentPriceMap, personalPlans } from '../config/plans';
// TEAM B — dormant Fundraiser attribution carrier. The opaque token (if captured at /#/f/:token) is
// attached as `fundraiserAttributionToken` ONLY for a personal subscription OR fundraiser merch AND
// ONLY while the Fundraiser UI flag is enabled (false by default). Never for gifts/QR Cash/G1G1/
// onboarding/other one-time checkouts.
import { fundraiserCheckoutField, clearToken as clearFundraiserToken } from './fundraiser/attributionCarrier.js';
// TEAM B (SALES S1) — salesperson attribution carrier. Attaches ONLY the opaque token, and
// ONLY to a personal subscription; the backend resolves it and is the sole identity authority.
import { salesCheckoutField, clearToken as clearSalesToken } from './sales/salesAttributionCarrier.js';
import { isFundraiserUiEnabled } from '../config/fundraiserGate.js';

// TEAM B — a checkout response counts as a SUCCESSFULLY CREATED Stripe Checkout Session only when it
// carries a non-empty redirect url. The transient fundraiser attribution token is cleared ONLY on this
// condition (never merely because fetch resolved, and never on a malformed/incomplete/failed response),
// so valid attribution survives network errors, non-2xx responses, and retries.
// eslint-disable-next-line react-refresh/only-export-components -- pure predicate exported for unit testing (not a component)
export const checkoutSessionCreated = (data) => !!(data && typeof data.url === 'string' && data.url.length > 0);

// Platform fee mirrors the backend rule (BUSINESS_SUBSCRIPTION_PRICE_IDS in
// routes/paymentRoutes.js): $19.99 for business subscription tiers, $4.99 otherwise.
// Prefer the cart item's platformFee if present, else fall back to the tier rule
// (cart items currently omit platformFee).
const BUSINESS_PLAN_TIERS = new Set(['small_business', 'medium_business', 'business_scale']);
const platformFeeFor = (item) =>
  item?.platformFee ?? (BUSINESS_PLAN_TIERS.has(item?.planTier) ? 19.99 : 4.99);

// G1G1 auto-mint is PERSONAL-only; business tiers use the annual-credit model.
const G1G1_PERSONAL_TIERS = new Set(['close_circle', 'social_butterfly', 'unforgettable']);

// Informational G1G1 value row for business tiers. Returns { label, value } or null.
// PRESENTATION ONLY: nets to $0; never touches totals, Stripe payloads, platform-fee
// math, or the credit-spend architecture.
function businessG1g1GiftRow(item) {
  if (!item) return null;
  if (item.planTier === 'business_scale') {
    return { label: 'G1G1 Impact Subscription', value: Number(item.price) || 0 };
  }
  if (item.planTier === 'medium_business') {
    const mode = item.pricingMode === 'standard' ? 'standard' : 'founders';
    const sb = (personalPlans[mode] || []).find((p) => p.planTier === 'social_butterfly');
    return { label: 'G1G1 Social Butterfly Subscription', value: Number(sb?.price) || 24.99 };
  }
  return null;
}

// US state list for the recipient shipping dropdown (Phase 3C Stage 3 founder refinement #6)
const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

// TODO: VITE_STRIPE_PUBLISHABLE_KEY must be set in .env before Stripe checkout is functional
const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);

  // Referral credit from URL or localStorage
  const referralCode = new URLSearchParams(location.search).get('referral')
    || localStorage.getItem('greetme_referral_code')
    || null;

  // Phase 3D Batch A — A2.4: send-flow resume token. Passed through to the
  // backend so the Stripe success URL carries it back; consumed by
  // PaymentSuccess.jsx + SendGreeting.jsx on return.
  const sendDraftId = new URLSearchParams(location.search).get('sendDraftId') || null;

  // GIFTING-INTEGRITY: the recipient this attached purchase is for.
  //
  // Read from the send draft the greeting flow already wrote under this exact
  // token — no new storage, no new request, and no way for the two to drift,
  // because the draft token names the draft the contact came from. The backend
  // treats it as an untrusted pointer and re-proves it at send time: the paid
  // order's contact must equal the Greet-Me recipient's, or the send stops.
  //
  // Null for a standalone storefront checkout, which carries no draft token
  // and needs no contact.
  const sendDraftContactId = (() => {
    if (!sendDraftId) return null;
    try {
      const raw = localStorage.getItem(`greetme_send_resume_${sendDraftId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return typeof parsed?.contactId === 'string' && parsed.contactId ? parsed.contactId : null;
    } catch {
      return null;
    }
  })();

  // Credit: referral ($10 from gift) or courtesy ($5 from finale QR)
  const courtesyCredit = (() => {
    try {
      const stored = localStorage.getItem('greetme_courtesy_credit');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  })();
  const courtesyCreditCode = courtesyCredit?.creditCode || null;
  const creditAmount = referralCode ? 10 : (courtesyCredit?.amount || 0);

  const [total, setTotal] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 768);

  // Form state
  const [formData, setFormData] = useState({
    email: user?.email || '',
    firstName: user?.name?.split(' ')[0] || '',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    address: '',
    city: '',
    state: '',
    zipCode: ''
  });

  const [errors, setErrors] = useState({});

  // ===== Phase 3C Stage 3 — merch shipping state =====
  const cartHasMerch = cartItems.some((it) => !!it.printfulSyncVariantId);
  const [recipientName, setRecipientName] = useState('');
  const [shipForm, setShipForm] = useState({
    address1: '', city: '', state_code: '', zip: '',
  });
  const [shipping, setShipping] = useState({
    rateCents: null, label: null, loading: false, error: null,
  });
  const lastFetchKeyRef = useRef('');
  // ====================================================

  useEffect(() => {
    window.scrollTo(0, 0);
    loadCart();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-recalculate shipping when address materially changes (founder directive #2, 500ms debounce)
  useEffect(() => {
    if (!cartHasMerch) return;
    const ready = ['address1', 'city', 'state_code', 'zip']
      .every((f) => (shipForm[f] || '').trim().length > 0);
    if (!ready) {
      setShipping((s) => ({ ...s, rateCents: null, label: null, error: null }));
      return;
    }
    const key = JSON.stringify({
      ...shipForm,
      items: cartItems
        .filter((i) => i.printfulSyncVariantId)
        .map((i) => i.printfulSyncVariantId).sort(),
    });
    if (key === lastFetchKeyRef.current) return;
    lastFetchKeyRef.current = key;

    const handle = setTimeout(async () => {
      setShipping({ rateCents: null, label: null, loading: true, error: null });
      try {
        const items = cartItems
          .filter((i) => i.printfulSyncVariantId)
          .map((i) => ({ syncVariantId: i.printfulSyncVariantId, quantity: 1 }));
        const res = await api.post('/api/merch/shipping-rates', {
          items,
          recipient: {
            address1: shipForm.address1.trim(),
            city: shipForm.city.trim(),
            state_code: shipForm.state_code.trim().toUpperCase(),
            zip: shipForm.zip.trim(),
            country_code: 'US',
          },
        });
        setShipping({
          rateCents: res?.shipping?.rateCents ?? null,
          label: res?.shipping?.label || 'Standard Shipping',
          loading: false,
          error: null,
        });
      } catch (err) {
        setShipping({
          rateCents: null,
          label: null,
          loading: false,
          error:
            "We're having trouble calculating shipping right now. Please verify the shipping address or try again shortly.",
        });
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [cartHasMerch, shipForm.address1, shipForm.city, shipForm.state_code, shipForm.zip, cartItems]);

  const loadCart = () => {
    const items = cartService.getCart();
    if (items.length === 0) {
      navigate('/dashboard/cart');
      return;
    }
    setCartItems(items);
    setTotal(cartService.getTotal());
  };

  // Stripe Checkout — redirect to Stripe hosted checkout page
  const handleStripeCheckout = async () => {
    // ====== MERCH PATH (Phase 3C Stage 3) ======
    // Founder directive #1: subscription path untouched.
    // Founder refinement #3: cart is NOT cleared before redirect — only after success.
    if (cartHasMerch) {
      // Block on shipping failure (founder Q10)
      if (shipping.error || shipping.rateCents == null) {
        setErrors({
          submit:
            "We're having trouble calculating shipping right now. Please verify the shipping address or try again shortly.",
        });
        return;
      }
      if (!recipientName.trim()) {
        setErrors({ submit: 'Please enter the recipient name.' });
        return;
      }
      setIsProcessing(true);
      setErrors({});
      try {
        const items = cartItems
          .filter((i) => i.printfulSyncVariantId)
          .map((i) => ({ syncVariantId: i.printfulSyncVariantId }));
        const data = await api.post('/api/payments/create-checkout', {
          purchaseType: 'merch',
          items,
          recipientName: recipientName.trim(),
          shippingAddress: {
            address1: shipForm.address1.trim(),
            city: shipForm.city.trim(),
            state_code: shipForm.state_code.trim().toUpperCase(),
            zip: shipForm.zip.trim(),
            country_code: 'US',
          },
          // Phase 3D Batch A — A2.4: opaque send-flow resume token (when present)
          ...(sendDraftId && { sendDraftId }),
          // GIFTING-INTEGRITY: recipient pointer for an attached purchase.
          // Persisted on the order and carried through Stripe metadata, so the
          // binding survives the round trip and can be re-proved at send time.
          ...(sendDraftContactId && { contactId: sendDraftContactId }),
          // Dormant Fundraiser attribution — opaque token only, merch + flag-on only (else omitted).
          ...fundraiserCheckoutField({ purchaseType: 'merch', flagEnabled: isFundraiserUiEnabled() }),
        });
        // NOTE: do NOT clear the cart here — the success page is responsible for clearing
        // after Stripe confirms payment. Protects against canceled checkout / browser interruption.
        // Fundraiser token lifecycle (founder rule: one purchase per referral visit): clear the
        // attribution token ONLY after a checkout session was successfully created. A throw / failure /
        // no-url response falls through WITHOUT clearing, so a retry preserves attribution.
        if (checkoutSessionCreated(data)) clearFundraiserToken();
        window.location.href = data.url;
      } catch (error) {
        console.error('Stripe merch checkout error:', error);
        setErrors({ submit: getErrorMessage(error) });
        setIsProcessing(false);
      }
      return;
    }
    // ====== END MERCH PATH ======

    // Refresh stale cart priceIds against current plan definitions
    const priceMap = getCurrentPriceMap();
    const validatedItems = cartItems.map(item => {
      const current = priceMap[item.planId];
      if (current && item.priceId !== current.priceId) {
        console.warn(`CART_STALE: item "${item.planId}" had priceId "${item.priceId}", updated to "${current.priceId}"`);
        return { ...item, ...current };
      }
      return item;
    });

    const item = validatedItems.find(i => i.priceId);
    if (!item) {
      console.error('Cart items missing priceId:', validatedItems.map(i => ({ name: i.name, type: i.type, price: i.price, priceId: i.priceId })));
      setErrors({ submit: 'Payment configuration incomplete. No Stripe price ID found.' });
      return;
    }

    setIsProcessing(true);
    setErrors({});
    try {
      // Read G1G1 data from sessionStorage (set by Cart)
      const g1g1Raw = (() => { try { return JSON.parse(sessionStorage.getItem('greetme_g1g1_checkout') || 'null'); } catch { return null; } })();
      console.log('[Checkout] G1G1 data from session:', g1g1Raw);

      const data = await api.post('/api/payments/create-checkout', {
        priceId: item.priceId,
        purchaseType: item.purchaseType || 'subscription',
        quantity: item.quantity || 1,
        planTier: item.planTier,
        billingPeriod: item.billingPeriod || item.period,
        // SALES S1 — opaque salesperson token when a sales link began this journey.
        // Omitted entirely otherwise, so ordinary checkout is byte-identical.
        ...salesCheckoutField({ purchaseType: item.purchaseType || 'subscription' }),
        ...(referralCode && { referralCode }),
        ...(courtesyCreditCode && !referralCode && { courtesyCreditCode }),
        // G1G1 recipient data for fulfillment — PERSONAL tiers only (business uses annual credits)
        ...(g1g1Raw?.eligible && G1G1_PERSONAL_TIERS.has(item.planTier) && {
          g1g1Eligible: true,
          g1g1RecipientName: g1g1Raw.recipientName || '',
          g1g1RecipientEmail: g1g1Raw.recipientEmail || '',
          g1g1SendLater: !!g1g1Raw.sendLater,
        }),
        // Dormant Fundraiser attribution — opaque token only, subscription + flag-on only (else omitted).
        ...fundraiserCheckoutField({ purchaseType: item.purchaseType || 'subscription', flagEnabled: isFundraiserUiEnabled() }),
      });
      const creditEligible = item.planTier !== 'close_circle';
      if (creditAmount > 0 && creditEligible && !data.creditApplied) {
        localStorage.removeItem('greetme_courtesy_credit');
        localStorage.removeItem('greetme_referral_code');
        setErrors({ submit: 'Your credit could not be applied. Please try again or continue at full price.' });
        setIsProcessing(false);
        return;   // credit could not be applied → retryable; preserve any fundraiser attribution token
      }
      // Clear the transient fundraiser token ONLY on a successfully created session (valid redirect url),
      // so it survives network errors / non-2xx / malformed responses and remains available on retry.
      // SALES S1 — the checkout session now carries the server-resolved salesperson, so the
      // browser carrier has done its job. Cleared only on a definitively created session: a
      // failed or retried checkout preserves it, and renewals need no carrier at all.
      // Placed BEFORE the fundraiser clear so that clear stays immediately adjacent to the
      // redirect below — a locked invariant of the fundraiser viral-loop wiring.
      if (checkoutSessionCreated(data)) clearSalesToken();
      if (checkoutSessionCreated(data)) clearFundraiserToken();
      window.location.href = data.url;
    } catch (error) {
      console.error('Stripe checkout error:', error);
      setErrors({ submit: getErrorMessage(error) });
      setIsProcessing(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    // Format card number with spaces
    if (name === 'cardNumber') {
      formattedValue = value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim().slice(0, 19);
    }

    // Format expiry date
    if (name === 'expiryDate') {
      formattedValue = value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').slice(0, 5);
    }

    // Format CVV
    if (name === 'cvv') {
      formattedValue = value.replace(/\D/g, '').slice(0, 4);
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Order confirmation screen
  if (orderComplete) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1rem', textAlign: 'center' }}>
        <div style={{
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          borderRadius: '50%',
          width: '80px',
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem'
        }}>
          <CheckCircle size={40} style={{ color: 'white' }} />
        </div>

        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem'
        }}>Order Confirmed!</h1>

        <p style={{
          color: 'var(--text-secondary)',
          marginBottom: '1.5rem'
        }}>Thank you for your purchase</p>

        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.5rem'
          }}>Order Number</p>
          <p style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#667eea',
            fontFamily: 'monospace'
          }}>{orderId}</p>
        </div>

        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          marginBottom: '2rem'
        }}>
          A confirmation email has been sent to <strong>{formData.email}</strong>
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '0.875rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => navigate('/dashboard/gifts')}
            style={{
              padding: '0.875rem 1.5rem',
              background: 'white',
              color: '#667eea',
              border: '2px solid #667eea',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '0.375rem'
  };

  const errorStyle = {
    fontSize: '0.6875rem',
    color: '#ef4444',
    marginTop: '0.25rem'
  };

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Checkout Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem',
        color: 'white',
      }}>
        {/* Top row: Checkout left, Back to Cart right */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '0.75rem',
        }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'white' }}>
              Checkout
            </h1>
            <p style={{ fontSize: '0.875rem', margin: 0, color: 'rgba(255,255,255,0.75)' }}>
              Complete your purchase securely
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard/cart')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.5rem 1rem',
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <ArrowLeft size={14} />
            Back to Cart
          </button>
        </div>

        {/* Bottom row: Trust badges centered */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1.5rem',
          flexWrap: 'wrap',
          borderTop: '1px solid rgba(255,255,255,0.2)',
          paddingTop: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)' }}>
            <Lock size={13} />
            <span>Secure Checkout</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)' }}>
            <Shield size={13} />
            <span>Privacy Guaranteed</span>
          </div>
        </div>
      </div>

      {/* Value reinforcement panel */}
      <div style={{
        marginTop: '-0.5rem',
        marginBottom: '1.25rem',
        padding: '0.9rem 1.1rem',
        background: '#f8f7ff',
        border: '1px solid #e6e4ff',
        borderRadius: '10px',
        fontSize: '0.92rem',
        lineHeight: '1.4',
        color: '#333',
      }}>
        <div style={{ marginBottom: '0.45rem', fontWeight: 600 }}>
          Create and deliver your Greet-Me in minutes
        </div>
        <div>• Send instantly or schedule for any occasion</div>
        <div>• A fully animated Greet-Me experience — with or without a real-world gift</div>
        <div>• Greet One, Give One™ (send one to someone you love)</div>
      </div>

      {/* Non-submitting container — legacy <form onSubmit> removed by P.LAUNCH.LEGACY-CHECKOUT-FORM */}
      <div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isNarrow ? '1fr' : 'minmax(0, 1fr) minmax(480px, 520px)',
          gap: '2rem',
          alignItems: 'start',
        }}>
          {/* Left Column - Form */}
          <div>
            {/* ===== Phase 3C Stage 3 — Recipient Shipping Address (merch only) ===== */}
            {cartHasMerch && (
              <div style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.5rem',
                marginBottom: '1.5rem'
              }}>
                <h2 style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '1rem'
                }}>Recipient Shipping Address</h2>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>Recipient Name</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    autoComplete="off"
                    style={inputStyle}
                    placeholder="Who should we ship this to?"
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>Address</label>
                  <input
                    type="text"
                    value={shipForm.address1}
                    onChange={(e) => setShipForm((s) => ({ ...s, address1: e.target.value }))}
                    autoComplete="off"
                    style={inputStyle}
                    placeholder="123 Main Street"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input
                      type="text"
                      value={shipForm.city}
                      onChange={(e) => setShipForm((s) => ({ ...s, city: e.target.value }))}
                      autoComplete="off"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>State</label>
                    <select
                      value={shipForm.state_code}
                      onChange={(e) => setShipForm((s) => ({ ...s, state_code: e.target.value }))}
                      autoComplete="off"
                      style={inputStyle}
                    >
                      <option value="">Select…</option>
                      {US_STATES.map((s) => (
                        <option key={s.code} value={s.code}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>ZIP</label>
                    <input
                      type="text"
                      value={shipForm.zip}
                      onChange={(e) => setShipForm((s) => ({ ...s, zip: e.target.value }))}
                      autoComplete="off"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Country</label>
                  <input
                    type="text"
                    value="United States"
                    disabled
                    autoComplete="off"
                    style={{ ...inputStyle, background: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' }}
                  />
                </div>

                {shipping.loading && (
                  <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                    Calculating shipping…
                  </p>
                )}
                {shipping.error && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 'var(--radius-md)',
                    color: '#b91c1c',
                    fontSize: '0.8125rem'
                  }}>
                    {shipping.error}
                  </div>
                )}
              </div>
            )}

            {errors.submit && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)',
                color: '#ef4444',
                fontSize: '0.875rem'
              }}>
                {errors.submit}
              </div>
            )}
          </div>

          {/* Right Column - Order Summary */}
          <div style={{ position: isNarrow ? 'static' : 'sticky', top: '5rem' }}>
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '1rem 1.25rem',
                color: 'white'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShoppingBag size={18} />
                  <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Order Summary</h2>
                </div>
              </div>

              <div style={{ padding: '1.25rem 1.5rem' }}>
                {/* Items */}
                <div style={{ marginBottom: '1.25rem' }}>
                  {cartItems.map((item, index) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingBottom: index < cartItems.length - 1 ? '0.75rem' : 0,
                        marginBottom: index < cartItems.length - 1 ? '0.75rem' : 0,
                        borderBottom: index < cartItems.length - 1 ? '1px solid var(--border)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>{item.icon || '🎁'}</span>
                        <div>
                          <p style={{
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                            margin: 0
                          }}>{item.name}</p>
                          {item.category && (
                            <p style={{
                              fontSize: '0.6875rem',
                              color: 'var(--text-tertiary)',
                              margin: 0
                            }}>{item.category}</p>
                          )}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)'
                      }}>${item.price?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Totals — Phase 3C Stage 3: merch path renders Subtotal/Shipping/Total */}
                {cartHasMerch ? (() => {
                  const subtotalCents = cartItems.reduce(
                    (s, i) => s + (i.priceCents || Math.round((i.price || 0) * 100)),
                    0
                  );
                  const shippingCents = shipping.rateCents || 0;
                  const totalCents = subtotalCents + shippingCents;
                  return (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.625rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                        <span>Subtotal</span>
                        <span>${(subtotalCents / 100).toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.625rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                        <span>Shipping{shipping.label ? ` (${shipping.label})` : ''}</span>
                        <span>{shipping.rateCents != null ? `$${(shippingCents / 100).toFixed(2)}` : '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '2px solid var(--border)', fontSize: '1.25rem', fontWeight: 800 }}>
                        <span>Total</span>
                        <span style={{ color: '#667eea' }}>
                          {shipping.rateCents != null ? `$${(totalCents / 100).toFixed(2)}` : '—'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#777', marginTop: '0.5rem' }}>
                        🔒 Secure checkout
                      </div>
                    </div>
                  );
                })() : (() => {
                  const subscriptionItem = cartItems.find(i => i.type === 'subscription');
                  const planPrice = subscriptionItem?.price || total;
                  const hasReferralCredit = !!referralCode;
                  const g1g1Eligible = !!subscriptionItem && !hasReferralCredit && G1G1_PERSONAL_TIERS.has(subscriptionItem?.planTier);
                  const creditEligible = subscriptionItem?.planTier !== 'close_circle';
                  const effectiveCredit = creditEligible ? creditAmount : 0;
                  const techFee = platformFeeFor(subscriptionItem);
                  const finalTotal = Math.max(0, planPrice + techFee - effectiveCredit);

                  return (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                      {/* Plan */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.625rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                        <span>{subscriptionItem?.name || 'Subscription Plan'}</span>
                        <span>${planPrice.toFixed(2)}</span>
                      </div>

                      {/* G1G1 Gift Subscription (full value) */}
                      {g1g1Eligible && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.625rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                          <span>G1G1 Gift Subscription</span>
                          <span>${planPrice.toFixed(2)}</span>
                        </div>
                      )}

                      {/* G1G1 Discount */}
                      {g1g1Eligible && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.625rem', fontSize: '1rem', color: '#22c55e', fontWeight: 500 }}>
                          <span>G1G1 Discount</span>
                          <span>&ndash;${planPrice.toFixed(2)}</span>
                        </div>
                      )}

                      {/* G1G1 included-gift value rows (business tiers) — informational, net $0, never added to total */}
                      {(() => {
                        const giftRow = businessG1g1GiftRow(subscriptionItem);
                        if (!giftRow) return null;
                        return (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.625rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                              <span>{giftRow.label}</span>
                              <span>+${giftRow.value.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.625rem', fontSize: '1rem', color: '#22c55e', fontWeight: 500 }}>
                              <span>G1G1 Discount</span>
                              <span>&ndash;${giftRow.value.toFixed(2)}</span>
                            </div>
                          </>
                        );
                      })()}

                      {/* Credit Applied */}
                      {creditAmount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.625rem', fontSize: '1rem', color: creditEligible ? '#22c55e' : '#9ca3af', fontWeight: 500, fontStyle: creditEligible ? 'normal' : 'italic' }}>
                          <span>Credit Applied</span>
                          <span>{creditEligible ? `\u2013$${creditAmount.toFixed(2)}` : 'Not eligible for this plan'}</span>
                        </div>
                      )}

                      {/* One-Time Platform Fee */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                          <span>One-Time Platform Fee</span>
                          <span>${techFee.toFixed(2)}</span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: '0.25rem 0 0', fontStyle: 'italic' }}>
                          Covers setup for you and your G1G1 recipient
                        </p>
                      </div>

                      {/* Total */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '2px solid var(--border)', fontSize: '1.25rem', fontWeight: 800 }}>
                        <span>Total</span>
                        <span style={{ color: '#667eea' }}>${finalTotal.toFixed(2)}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#555', marginTop: '0.25rem' }}>
                        Includes 2 Greet-Me experiences
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#777', marginTop: '0.5rem' }}>
                        🔒 Secure checkout • Cancel anytime
                      </div>
                    </div>
                  );
                })()}

                {/* Submit Button — calls Stripe Checkout (not form submit) */}
                <button
                  type="button"
                  onClick={handleStripeCheckout}
                  disabled={isProcessing}
                  style={{
                    width: '100%',
                    marginTop: '1.5rem',
                    padding: '1rem',
                    background: isProcessing
                      ? '#e5e7eb'
                      : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    color: isProcessing ? '#9ca3af' : 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s',
                    boxShadow: isProcessing ? 'none' : '0 4px 12px rgba(34, 197, 94, 0.3)',
                    fontFamily: 'inherit'
                  }}
                >
                  {isProcessing ? (
                    <>
                      <div style={{
                        width: '18px',
                        height: '18px',
                        border: '2px solid #9ca3af',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Lock size={18} />
                      Complete Order
                    </>
                  )}
                </button>

                <p style={{
                  fontSize: '0.6875rem',
                  color: 'var(--text-tertiary)',
                  textAlign: 'center',
                  marginTop: '1rem'
                }}>
                  Your payment information is encrypted and secure
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
