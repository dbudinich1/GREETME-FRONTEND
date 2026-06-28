// src/pages/Rewards.jsx
// Greet-Me Rewards™ - Full rewards page with balance, history, and redemption

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Heart, Clock, Star, Trophy, Sparkles, Send, ExternalLink, ShoppingCart, X, Check, ArrowRight } from 'lucide-react';
import cartService from '../services/cartService';
import api from '../api/api';
import { pushInApp } from '../utils/notify';
import { COMMS_EVENTS } from '../utils/commsCatalog';

// H7: locked launch redemption — 40 Hearts → 1 Anytime Greet-Me (in-kind only).
const REDEEM_COST = 40;

// Correction #6 — one id per redemption *intent*, reused across retries (double-click,
// confirm retry, transient network failure, same-dialog re-submit). Generated when the
// intent opens; cleared when it completes or is cancelled.
function makeRedemptionRequestId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* fall through to non-crypto id */ }
  return `rdm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// J1 — frontend-owned Journey MEANING (labels + order only). TRUTH (the booleans)
// comes solely from J0 (GET /api/journey/progress); the frontend never computes,
// aggregates, or persists Journey state. Each step maps to exactly one J0 fact.
const JOURNEY_STEPS = [
  { key: 'hasCompletedOnboarding', label: 'Set up your voice & photo' },
  { key: 'hasSentFirstGreeting', label: 'Send your first Greet-Me' },
  { key: 'hasEarnedFirstHeart', label: 'Earn your first Heart' },
  { key: 'hasSentGiftGreeting', label: 'Send a Greet-Me with a gift' },
];

export default function Rewards() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  // J1 — holds the J0 progress facts verbatim (server truth). null until loaded /
  // on failure → every step reads as not-yet-reached. No local Journey state.
  const [journey, setJourney] = useState(null);
  const [showHeroHeartsModal, setShowHeroHeartsModal] = useState(false);
  const [selectedHeroBundle, setSelectedHeroBundle] = useState(null);
  const [heroHeartsStep, setHeroHeartsStep] = useState('selection'); // 'selection' | 'confirmation'
  const [lastAddedHeroBundle, setLastAddedHeroBundle] = useState(null);

  // H7 B5 — Free Greeting redemption UI state (server-authoritative; dormant until B7).
  const [redeemOpen, setRedeemOpen] = useState(false);            // confirmation step shown
  const [redeemRequestId, setRedeemRequestId] = useState(null);   // one per intent (Correction #6)
  const [redeemSubmitting, setRedeemSubmitting] = useState(false);// request in flight
  const [redeemOutcome, setRedeemOutcome] = useState(null);       // { type, message }
  const [redemptionPaused, setRedemptionPaused] = useState(false);// learned-paused (503) → disable

  // M0 — read-only Hearts Marketplace catalog (class/state facts). Empty while dormant.
  const [marketplaceItems, setMarketplaceItems] = useState([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(true);

  // Hero Hearts Bundles - price tiers with bonus hearts
  const HERO_HEARTS_BUNDLES = [
    {
      id: 'bundle-100',
      name: 'Starter Bundle',
      price: 100,
      hearts: 1000,
      bonusHearts: 200,
      totalHearts: 1200,
      perDollar: 12,
      popular: false,
      description: 'Perfect for getting started with Hero Hearts',
      priceId: 'price_1T4eJxCf7KAA6aLaHqH2clKw',
      purchaseType: 'hero_hearts',
    },
    {
      id: 'bundle-250',
      name: 'Growth Bundle',
      price: 250,
      hearts: 2500,
      bonusHearts: 750,
      totalHearts: 3250,
      perDollar: 13,
      popular: true,
      description: 'Most popular choice - best value for regular gifters',
      priceId: 'price_1T4eJyCf7KAA6aLaJjJLgVTK',
      purchaseType: 'hero_hearts',
    },
    {
      id: 'bundle-500',
      name: 'Hero Bundle',
      price: 500,
      hearts: 5000,
      bonusHearts: 2000,
      totalHearts: 7000,
      perDollar: 14,
      popular: false,
      bestValue: true,
      description: 'Maximum impact - double your rewards balance',
      priceId: 'price_1T4eJzCf7KAA6aLagx468kzk',
      purchaseType: 'hero_hearts',
    }
  ];

  const handleAddToCart = (bundle) => {
    const cartItem = {
      type: 'hero-hearts',
      name: `Hero Hearts - ${bundle.name}`,
      price: bundle.price,
      quantity: 1,
      hearts: bundle.totalHearts,
      bundleId: bundle.id,
      icon: '❤️',
      ...(bundle.priceId && { priceId: bundle.priceId }),
      ...(bundle.purchaseType && { purchaseType: bundle.purchaseType }),
    };

    // Use cartService instead of direct localStorage
    cartService.addItem(cartItem);

    // Trigger cart badge update in DashboardLayout
    window.dispatchEvent(new Event('cartUpdated'));

    // Store the added bundle and transition to confirmation state
    setLastAddedHeroBundle(bundle);
    setHeroHeartsStep('confirmation');
  };

  // Reset Hero Hearts modal to initial state
  const resetHeroHeartsModal = () => {
    setShowHeroHeartsModal(false);
    setSelectedHeroBundle(null);
    setHeroHeartsStep('selection');
    setLastAddedHeroBundle(null);
  };

  // H6a: one-time, idempotent, non-fatal cleanup of legacy Hearts localStorage keys
  // (the localStorage Hearts economy was removed; the server is authoritative).
  useEffect(() => {
    try {
      localStorage.removeItem('greetme_rewards_balance');
      localStorage.removeItem('greetme_rewards_history');
      localStorage.removeItem('greetme_daily_greeting_hearts');
      localStorage.removeItem('greetme_dm_tag_claims');
      localStorage.removeItem('greetme_hero_member');
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    loadRewardsData();
  }, []);

  const loadRewardsData = async () => {
    try {
      const res = await api.getHeartsBalance();
      setBalance(res?.balance ?? 0);
    } catch {
      setBalance(0);
    }
    // J1 — read-only Journey facts from J0. Held verbatim; on any failure we fall
    // back to null → all steps render as not-yet-reached (honest, never fabricated).
    try {
      const jr = await api.getJourneyProgress();
      setJourney(jr?.progress ?? null);
    } catch {
      setJourney(null);
    }
  };

  // Correction #6 — refresh server balance when the window regains focus.
  useEffect(() => {
    const onFocus = () => { loadRewardsData(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // M0 — fetch the read-only Hearts Marketplace catalog on mount (empty while dormant).
  // Standalone effect — separate from loadRewardsData / the J1 journey read. Display-only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getMarketplaceCatalog();
        if (!cancelled) setMarketplaceItems(Array.isArray(res?.items) ? res.items : []);
      } catch {
        if (!cancelled) setMarketplaceItems([]);
      } finally {
        if (!cancelled) setMarketplaceLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Open the redemption intent: generate ONE requestId, reused across retries within this
  // intent. If an id already exists (re-open without cancel), keep it.
  const openRedeemIntent = () => {
    setRedeemOutcome(null);
    setRedeemRequestId((prev) => prev || makeRedemptionRequestId());
    setRedeemOpen(true);
  };

  // Cancel/close the intent → next intent gets a fresh id.
  const cancelRedeemIntent = () => {
    if (redeemSubmitting) return;
    setRedeemOpen(false);
    setRedeemRequestId(null);
    setRedeemOutcome(null);
  };

  const confirmRedeemIntent = async () => {
    if (redeemSubmitting) return;              // double-click / in-flight guard
    const reqId = redeemRequestId;
    if (!reqId) {                              // required request state missing
      setRedeemOutcome({ type: 'error', message: 'Could not start redemption. Please try again.' });
      return;
    }
    setRedeemSubmitting(true);
    setRedeemOutcome(null);
    try {
      const res = await api.redeemHearts('free_greeting', reqId);
      if (res && res.ok && (res.reason === 'applied' || res.reason === 'duplicate')) {
        // success (duplicate is treated as success — idempotent re-submit of same intent)
        setRedeemOutcome({ type: 'success', message: '🎉 Redeemed! 1 Anytime Greet-Me has been added to your account.' });
        setRedeemOpen(false);
        setRedeemRequestId(null);              // intent completed
        try { pushInApp(COMMS_EVENTS?.REWARDS_REDEEMED, { cost: REDEEM_COST }); } catch { /* non-fatal */ }
      } else if (res && res.ok === false && res.networkError) {
        // keep the dialog + requestId so a retry reuses the same id
        setRedeemOutcome({ type: 'error', message: 'Network error — please try again.' });
      } else if (res && res.ok === false && res.status === 401) {
        setRedeemOutcome({ type: 'error', message: 'Please sign in again to redeem.' });
      } else {
        setRedeemOutcome({ type: 'error', message: 'Could not complete redemption. Please try again.' });
      }
    } catch (err) {
      const status = err?.status;
      if (status === 503) {
        // paused — honest: redemption is not available yet (backend pauseHeartsRedemption=true)
        setRedemptionPaused(true);
        setRedeemOpen(false);
        setRedeemRequestId(null);
        setRedeemOutcome({ type: 'paused', message: 'Redemption is coming soon — keep earning Hearts and you’ll be able to redeem them shortly.' });
      } else if (status === 429) {
        setRedeemOutcome({ type: 'velocity', message: 'You can redeem once per day. Please try again later.' });
      } else if (status === 400) {
        setRedeemOutcome({ type: 'insufficient', message: 'You don’t have enough Hearts to redeem yet.' });
      } else {
        setRedeemOutcome({ type: 'error', message: 'Could not complete redemption. Please try again.' });
      }
    } finally {
      setRedeemSubmitting(false);
      loadRewardsData();                       // refresh server balance after success AND failure
    }
  };

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden' }}>
      {/* Background Frame for Page Body */}
      <div style={{
        background: '#f8fafc',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid #e2e8f0',
        padding: '2rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        {/* Banner Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '3rem 1.5rem',
          marginBottom: '1.5rem',
          color: 'white',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
        }}>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            margin: 0,
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '2rem' }}>❤️</span> Hearts Hub
          </h1>
          <p style={{
            fontSize: '1rem',
            opacity: 0.9,
            fontStyle: 'italic',
            margin: 0
          }}>
            Earn Hearts for every Greet-Me™ you send and more.
          </p>
        </div>

      {/* Balance Card */}
      <div style={{
        background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem 1.5rem',
        marginBottom: '1.5rem',
        color: 'white',
        boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <p style={{
              fontSize: '0.875rem',
              opacity: 0.9,
              marginBottom: '0.5rem'
            }}>Your Balance</p>
            <div style={{
              fontSize: '3.5rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              lineHeight: 1
            }}>
              {balance} <span style={{ fontSize: '2.5rem' }}>❤️</span>
            </div>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '0.75rem'
          }}>
            <button
              onClick={() => setShowHeroHeartsModal(true)}
              style={{
                background: 'white',
                color: '#be185d',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                padding: '0.75rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'scale(1.05)';
                e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
              }}
            >
              ❤️ Greet-Me™ Hero™ Hearts™
            </button>
          </div>
        </div>
      </div>

      {/* Journey (J1) — first frontend consumer of the J0 truth layer
          (GET /api/journey/progress). Sits directly beneath the Hearts Balance,
          above Ways to Earn. Renders the four objective server facts with
          Hearts-themed status treatments (filled vs awaiting heart) — NOT a
          checkmark checklist; the treatment is intentionally elevatable later.
          No frontend Journey state/calculation: each row reflects exactly one
          server boolean. Read-only. */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        marginBottom: '2rem',
        border: '1px solid var(--border)'
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Heart size={20} style={{ color: '#ec4899' }} fill="#ec4899" />
          Your Journey
        </h2>
        <p style={{
          fontSize: '0.95rem',
          color: 'var(--text-secondary)',
          margin: '0 0 1.25rem',
          lineHeight: 1.5
        }}>
          Welcome to your Greet-Me journey. Every heartfelt moment you create writes
          another chapter — here&apos;s the story you&apos;re building, one Heart at a time.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {JOURNEY_STEPS.map((step) => {
            const reached = Boolean(journey && journey[step.key]);
            return (
              <div key={step.key} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                padding: '0.875rem 1rem',
                borderRadius: 'var(--radius-lg)',
                background: reached ? 'rgba(236, 72, 153, 0.08)' : 'var(--bg-secondary)',
                border: reached ? '1px solid rgba(236, 72, 153, 0.25)' : '1px solid var(--border)'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: reached ? 'rgba(236, 72, 153, 0.15)' : 'transparent'
                }}>
                  <Heart
                    size={18}
                    style={{
                      color: reached ? '#ec4899' : 'var(--text-secondary)',
                      opacity: reached ? 1 : 0.4
                    }}
                    fill={reached ? '#ec4899' : 'none'}
                  />
                </span>
                <span style={{
                  fontSize: '0.95rem',
                  fontWeight: reached ? 600 : 500,
                  color: reached ? 'var(--text-primary)' : 'var(--text-secondary)'
                }}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* J2 — "Your next chapter": a gentle guide derived (statelessly, at render)
            from the FIRST not-yet-reached J0 fact in the existing Journey order.
            Pure meaning over J0 truth — no progress count/percent/bar/phase, no
            milestone, no stored Journey state, no new API call. When every fact is
            reached, a warm acknowledgment replaces it (never a reward/unlock). */}
        {(() => {
          const next = JOURNEY_STEPS.find((s) => !(journey && journey[s.key]));
          if (!next) {
            return (
              <div style={{
                marginTop: '1.25rem',
                padding: '1rem 1.125rem',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(236, 72, 153, 0.08)',
                border: '1px solid rgba(236, 72, 153, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem'
              }}>
                <Heart size={18} style={{ color: '#ec4899' }} fill="#ec4899" />
                <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  You&apos;ve begun your story beautifully — every chapter so far is written in Hearts.
                </span>
              </div>
            );
          }
          const dest = next.key === 'hasCompletedOnboarding' ? '/dashboard/profile' : '/dashboard/send';
          return (
            <div style={{
              marginTop: '1.25rem',
              padding: '1.125rem 1.25rem',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)'
            }}>
              <p style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                margin: '0 0 0.375rem'
              }}>
                Your next chapter
              </p>
              <p style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: '0 0 0.875rem'
              }}>
                {next.label}
              </p>
              <button
                onClick={() => navigate(dest)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#ec4899',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                <Heart size={16} fill="white" style={{ color: 'white' }} />
                Continue your journey
              </button>
            </div>
          );
        })()}
      </div>

      {/* M0 — Hearts Marketplace (read-only, DISPLAY-ONLY). Renders ONLY when items exist;
          dormant/empty while marketplaceReadEnabled is off → Hub stays unchanged. Reads
          class/state facts (state drives an honest label; class consumed via data attr).
          NO checkout/redeem CTA — Stage 1 is read-side only. */}
      {marketplaceItems.length > 0 && (
        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-xl)',
          padding: '1.5rem',
          marginBottom: '2rem',
          border: '1px solid var(--border)'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            Hearts Marketplace
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1rem'
          }}>
            {marketplaceItems.map((item) => {
              const img = (Array.isArray(item.images) && item.images[0]?.url) ? item.images[0].url : null;
              return (
                <div
                  key={item.id}
                  data-reward-class={item.class || 'uncategorized'}
                  style={{
                    background: 'var(--gray-50)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{
                    width: '100%',
                    height: '140px',
                    background: img ? `url(${img}) center/cover no-repeat` : 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2.5rem'
                  }}>
                    {!img && '🎁'}
                  </div>
                  <div style={{ padding: '0.75rem' }}>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.title}
                    </div>
                    {item.vendor ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: '0.125rem' }}>
                        Made by {item.vendor}
                      </div>
                    ) : null}
                    {/* Vendor FIAT display price only (parity w/ display-only catalog). NOT a Hearts cost. */}
                    {item.priceCents != null ? (
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.25rem' }}>
                        {(item.currency && item.currency !== 'USD') ? '' : '$'}
                        {(item.priceCents / 100).toFixed(item.priceCents % 100 === 0 ? 0 : 2)}
                        {(item.currency && item.currency !== 'USD') ? ` ${item.currency}` : ''}
                      </div>
                    ) : null}
                    {item.state && item.state !== 'available' ? (
                      <div style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginTop: '0.375rem'
                      }}>
                        {item.state}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* How to Earn Section */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        marginBottom: '2rem',
        border: '1px solid var(--border)'
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Sparkles size={20} style={{ color: '#ec4899' }} />
          Ways to Earn Hearts
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          {[
            'Send a Thank-You Greet-Me',
            'Send your first independent Greet-Me',
            'Schedule an occasion',
            'Reach 5 delivered recipients',
            'Reach 10 delivered recipients',
            'Send a gift with your Greet-Me',
            'Share a Greet-Me',
            'Earn when your shared friend joins',
            'Subscribe',
            'Upgrade'
          ].map((label) => (
            <div
              key={label}
              style={{
                padding: '1rem',
                background: 'var(--gray-50)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                fontWeight: 500
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Redemption — coming soon (H6a: legacy redemption removed) */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        marginBottom: '2rem',
        border: '1px solid var(--border)'
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Gift size={20} style={{ color: '#ec4899' }} />
          Spend Your Hearts
        </h2>
        {redemptionPaused ? (
          <p style={{
            fontSize: '0.9375rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            margin: 0
          }}>
            Redemption is coming soon — keep earning Hearts and you'll be able to redeem them shortly.
          </p>
        ) : (
          <>
            {/* Single launch redemption option */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '1rem',
              background: 'var(--gray-50)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              marginBottom: '1rem'
            }}>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Free Greeting
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                  Redeem {REDEEM_COST} Hearts for 1 Anytime Greet-Me
                </div>
              </div>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#ec4899', whiteSpace: 'nowrap' }}>
                {REDEEM_COST} ❤️
              </span>
            </div>

            {!redeemOpen ? (
              <button
                onClick={openRedeemIntent}
                disabled={balance < REDEEM_COST || redeemSubmitting}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: balance < REDEEM_COST ? 'var(--gray-300)' : '#ec4899',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: balance < REDEEM_COST ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                {balance < REDEEM_COST
                  ? `Need ${REDEEM_COST - balance} more Hearts`
                  : `Redeem ${REDEEM_COST} Hearts`}
              </button>
            ) : (
              <div style={{
                padding: '1rem',
                background: 'var(--gray-50)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)'
              }}>
                <p style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', margin: '0 0 0.875rem' }}>
                  Spend <strong>{REDEEM_COST} Hearts</strong> for <strong>1 Anytime Greet-Me</strong>?
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={cancelRedeemIntent}
                    disabled={redeemSubmitting}
                    style={{
                      flex: 1,
                      padding: '0.625rem',
                      background: 'var(--gray-100)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: redeemSubmitting ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmRedeemIntent}
                    disabled={redeemSubmitting || balance < REDEEM_COST}
                    style={{
                      flex: 1,
                      padding: '0.625rem',
                      background: (redeemSubmitting || balance < REDEEM_COST) ? 'var(--gray-300)' : '#ec4899',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: (redeemSubmitting || balance < REDEEM_COST) ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit'
                    }}
                  >
                    {redeemSubmitting ? 'Redeeming…' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}

            {redeemOutcome && (
              <p style={{
                marginTop: '0.75rem',
                marginBottom: 0,
                fontSize: '0.875rem',
                lineHeight: 1.5,
                fontWeight: 500,
                color: redeemOutcome.type === 'success'
                  ? '#16a34a'
                  : (redeemOutcome.type === 'paused' ? 'var(--text-secondary)' : '#dc2626')
              }}>
                {redeemOutcome.message}
              </p>
            )}
          </>
        )}
      </div>

      {/* Hero Hearts — dedicated Hub section (H1 refinement #2). Reuses the EXISTING
          entry point (opens the existing Hero Hearts modal). Modal + purchase flow,
          economics, donation copy, and APIs are all unchanged. */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        marginBottom: '2rem',
        border: '1px solid var(--border)'
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Heart size={20} style={{ color: '#ec4899' }} />
          Greet-Me™ Hero™ Hearts™
        </h2>
        <p style={{
          fontSize: '0.9375rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          margin: '0 0 1rem'
        }}>
          Your home for Greet-Me™ Hero™ Hearts™.
        </p>
        <button
          onClick={() => setShowHeroHeartsModal(true)}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#ec4899',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          Open Hero Hearts
        </button>
      </div>

      {/* Hero Hearts Pricing Modal */}
      {showHeroHeartsModal && (
        <>
          {/* Backdrop */}
          <div
            onClick={resetHeroHeartsModal}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000
            }}
          />
          {/* Modal */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            borderRadius: '1rem',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            zIndex: 1001,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Close Button - Fixed to modal frame */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetHeroHeartsModal();
              }}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                zIndex: 9999,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
              }}
            >
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#374151', lineHeight: 1 }}>×</span>
            </button>

            {/* Scrollable Content */}
            <div style={{ padding: '2rem', paddingTop: '3rem', overflowY: 'auto', flex: 1 }}>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '4rem',
                height: '4rem',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <Heart size={28} style={{ color: 'white' }} />
              </div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem'
              }}>
                Greet-Me Hero Hearts™
              </h2>
              <p style={{
                fontSize: '0.9375rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5
              }}>
                Double your Rewards balance and support veterans & first responders
              </p>
              <div style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #D4AF37 0%, #8B6914 100%)',
                color: 'white',
                padding: '0.375rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.75rem',
                fontWeight: 600,
                marginTop: '0.75rem'
              }}>
                🏅 10% of proceeds donated
              </div>
            </div>

            {/* STATE 1: Selection */}
            {heroHeartsStep === 'selection' && (
              <>
                {/* Pricing Cards Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  {HERO_HEARTS_BUNDLES.map((bundle) => (
                    <div
                      key={bundle.id}
                      onClick={() => setSelectedHeroBundle(bundle.id)}
                      style={{
                        position: 'relative',
                        background: selectedHeroBundle === bundle.id
                          ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(190, 24, 93, 0.05) 100%)'
                          : 'white',
                        border: selectedHeroBundle === bundle.id
                          ? '2px solid #ec4899'
                          : bundle.popular
                            ? '2px solid #ec4899'
                            : '2px solid var(--border)',
                        borderRadius: 'var(--radius-xl)',
                        padding: '1.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        transform: selectedHeroBundle === bundle.id ? 'scale(1.02)' : 'scale(1)'
                      }}
                    >
                      {/* Popular Badge */}
                      {bundle.popular && (
                        <div style={{
                          position: 'absolute',
                          top: '-0.75rem',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Most Popular
                        </div>
                      )}

                      {/* Best Value Badge */}
                      {bundle.bestValue && (
                        <div style={{
                          position: 'absolute',
                          top: '-0.75rem',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'linear-gradient(135deg, #D4AF37 0%, #8B6914 100%)',
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Best Value
                        </div>
                      )}

                      {/* Selection Indicator */}
                      <div style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        width: '1.5rem',
                        height: '1.5rem',
                        borderRadius: '50%',
                        border: selectedHeroBundle === bundle.id ? '2px solid #ec4899' : '2px solid var(--border)',
                        background: selectedHeroBundle === bundle.id ? '#ec4899' : 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}>
                        {selectedHeroBundle === bundle.id && (
                          <Check size={14} style={{ color: 'white' }} />
                        )}
                      </div>

                      {/* Bundle Name */}
                      <h3 style={{
                        fontSize: '1.125rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: '0.5rem',
                        paddingRight: '2rem'
                      }}>
                        {bundle.name}
                      </h3>

                      {/* Price */}
                      <div style={{
                        fontSize: '2rem',
                        fontWeight: 800,
                        color: '#ec4899',
                        marginBottom: '0.5rem'
                      }}>
                        ${bundle.price}
                      </div>

                      {/* Hearts Breakdown */}
                      <div style={{
                        background: 'var(--gray-50)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '0.75rem',
                        marginBottom: '0.75rem'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8125rem',
                          color: 'var(--text-secondary)',
                          marginBottom: '0.25rem'
                        }}>
                          <span>Base Hearts:</span>
                          <span>{bundle.hearts.toLocaleString()} ❤️</span>
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8125rem',
                          color: '#22c55e',
                          fontWeight: 600,
                          marginBottom: '0.25rem'
                        }}>
                          <span>Bonus Hearts:</span>
                          <span>+{bundle.bonusHearts.toLocaleString()} ❤️</span>
                        </div>
                        <div style={{
                          borderTop: '1px solid var(--border)',
                          paddingTop: '0.5rem',
                          marginTop: '0.25rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.9375rem',
                          fontWeight: 700,
                          color: '#ec4899'
                        }}>
                          <span>Total:</span>
                          <span>{bundle.totalHearts.toLocaleString()} ❤️</span>
                        </div>
                      </div>

                      {/* Per Dollar Value */}
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        textAlign: 'center',
                        marginBottom: '0.75rem'
                      }}>
                        {bundle.perDollar} Hearts per dollar
                      </div>

                      {/* Description */}
                      <p style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                        textAlign: 'center'
                      }}>
                        {bundle.description}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Selection State Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'space-between'
                }}>
                  {/* Cancel - Secondary (outline) - LEFT */}
                  <button
                    onClick={resetHeroHeartsModal}
                    style={{
                      padding: '0.875rem 1.5rem',
                      background: 'white',
                      color: 'var(--text-primary)',
                      border: '2px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit'
                    }}
                  >
                    Cancel
                  </button>

                  {/* Add to Cart - Primary (solid) - RIGHT */}
                  <button
                    onClick={() => {
                      const bundle = HERO_HEARTS_BUNDLES.find(b => b.id === selectedHeroBundle);
                      if (bundle) {
                        handleAddToCart(bundle);
                      }
                    }}
                    disabled={!selectedHeroBundle}
                    style={{
                      padding: '0.875rem 2rem',
                      background: selectedHeroBundle
                        ? 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)'
                        : 'var(--gray-200)',
                      color: selectedHeroBundle ? 'white' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      cursor: selectedHeroBundle ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: selectedHeroBundle ? '0 4px 12px rgba(236, 72, 153, 0.3)' : 'none'
                    }}
                  >
                    <ShoppingCart size={18} />
                    Add to Cart
                  </button>
                </div>

                {/* Info Note */}
                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                  marginTop: '1rem',
                  fontStyle: 'italic'
                }}>
                  Hearts are added to your Rewards balance immediately after purchase. 10% of all Hero Hearts purchases support veterans and first responders.
                </p>
              </>
            )}

            {/* STATE 2: Confirmation */}
            {heroHeartsStep === 'confirmation' && lastAddedHeroBundle && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                {/* Success Icon */}
                <div style={{
                  width: '5rem',
                  height: '5rem',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                }}>
                  <Check size={40} style={{ color: 'white' }} />
                </div>

                {/* Confirmation Message */}
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  Added to Cart!
                </h3>

                <p style={{
                  fontSize: '1rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1.5rem'
                }}>
                  {lastAddedHeroBundle.name} ({lastAddedHeroBundle.totalHearts.toLocaleString()} ❤️)
                </p>

                {/* Item Summary */}
                <div style={{
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem',
                  marginBottom: '0.75rem',
                  maxWidth: '320px',
                  margin: '0 auto 1.5rem'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem'
                  }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Hero Hearts - {lastAddedHeroBundle.name}</span>
                    <span style={{ fontWeight: 600, color: '#ec4899' }}>${lastAddedHeroBundle.price}</span>
                  </div>
                  <div style={{
                    borderTop: '1px solid var(--border)',
                    paddingTop: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)'
                  }}>
                    {cartService.getCount()} {cartService.getCount() === 1 ? 'item' : 'items'} in cart
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'center',
                  maxWidth: '400px',
                  margin: '0 auto'
                }}>
                  {/* Continue Shopping - Secondary (outline) */}
                  <button
                    onClick={resetHeroHeartsModal}
                    style={{
                      flex: 1,
                      padding: '0.875rem 1.5rem',
                      background: 'white',
                      color: '#667eea',
                      border: '2px solid #667eea',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <ShoppingCart size={18} />
                    Continue Shopping
                  </button>

                  {/* Checkout - Primary (solid) */}
                  <button
                    onClick={() => {
                      resetHeroHeartsModal();
                      navigate('/dashboard/cart');
                    }}
                    style={{
                      flex: 1,
                      padding: '0.875rem 1.5rem',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    Checkout
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
