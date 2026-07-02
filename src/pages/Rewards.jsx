// src/pages/Rewards.jsx
// Greet-Me Rewards™ - Full rewards page with balance, history, and redemption

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import cartService from '../services/cartService';
import api from '../api/api';
import { pushInApp } from '../utils/notify';
import { COMMS_EVENTS } from '../utils/commsCatalog';
// UX-HUB-3 Batch 2 — Hearts Hub presentational components (behavior-preserving extraction).
// Rewards.jsx remains the single owner of all state, effects, handlers, API calls, and
// navigation; these children render the same markup from props.
import { REDEEM_COST } from '../components/hub/hubConfig';
import HubBalanceCard from '../components/hub/HubBalanceCard';
import HubJourney from '../components/hub/HubJourney';
import HubWaysToEarn from '../components/hub/HubWaysToEarn';
import HubRedeemMarketplace from '../components/hub/HubRedeemMarketplace';
import HubHeroHearts from '../components/hub/HubHeroHearts';
import HubHeroHeartsModal from '../components/hub/HubHeroHeartsModal';
// UX-HUB-3 Batch 3 — new real-data cards (presentational; data owned by this page).
import HubHistory from '../components/hub/HubHistory';
import HubLifetime from '../components/hub/HubLifetime';
// UX-HUB-3 Batch 7 — Quick Actions (engagement band; real routes only).
import HubQuickActions from '../components/hub/HubQuickActions';
// UX-HUB-3 Batch 4 — premium layout grid + ring (presentation only; same data owner).
import './../components/hub/hub.css';

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

export default function Rewards() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  // J1 — holds the J0 progress facts verbatim (server truth). null until loaded /
  // on failure → every step reads as not-yet-reached. No local Journey state.
  const [journey, setJourney] = useState(null);
  // WS-5 (T5.2) — the backend 4-chapter/state model (server truth). null until loaded /
  // on failure → HubJourney falls back to a single Getting Started chapter from the facts.
  const [chapters, setChapters] = useState(null);

  // UX-HUB-3 Batch 3 — real-data card state (server-owned; honest defaults until loaded /
  // on failure). This page is the SINGLE data owner; the cards are presentational (props only).
  const [amounts, setAmounts] = useState([]);          // GET /api/hearts/amounts → [{behavior,amount}]
  const [history, setHistory] = useState([]);          // GET /api/hearts/history → [{occurredAt,behavior,amount}]
  const [lifetime, setLifetime] = useState(0);         // GET /api/hearts/lifetime → number

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

  // Marketplace Stage 6 — redeem flow (server-authoritative; only shows for items the server
  // marks structurally `redeemable`, which is false while marketplaceRedemptionEnabled is off).
  const [mktConfirmId, setMktConfirmId] = useState(null);   // item awaiting a confirm click
  const [mktRedeemingId, setMktRedeemingId] = useState(null); // request in flight
  const [mktOutcome, setMktOutcome] = useState({});         // { [itemId]: { type, message } }

  const handleMarketplaceRedeem = async (item) => {
    if (mktRedeemingId) return;
    setMktConfirmId(null);
    setMktRedeemingId(item.id);
    setMktOutcome((o) => ({ ...o, [item.id]: null }));
    try {
      const requestId = makeRedemptionRequestId();
      const res = await api.redeemMarketplaceItem(item.id, requestId);
      if (res?.ok) {
        setMktOutcome((o) => ({ ...o, [item.id]: { type: 'success', message: 'Redeemed — your discount applies to your next invoice.' } }));
        loadRewardsData(); // refresh server Hearts balance
      } else {
        const messages = {
          ineligible: 'Available to active subscribers only.',
          insufficient: 'You don’t have enough Hearts yet.',
          velocity: 'You can redeem again tomorrow.',
          disabled: 'Redemption isn’t available right now.',
          class_unavailable: 'This reward isn’t redeemable yet.',
          no_cost: 'This reward isn’t redeemable yet.',
          not_found: 'This reward is no longer available.',
          grant_failed: 'Something went wrong — your Hearts were not charged.',
        };
        setMktOutcome((o) => ({ ...o, [item.id]: { type: 'error', message: messages[res?.reason] || 'Could not redeem right now.' } }));
      }
    } catch {
      setMktOutcome((o) => ({ ...o, [item.id]: { type: 'error', message: 'Could not redeem right now.' } }));
    } finally {
      setMktRedeemingId(null);
    }
  };

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
      setChapters(Array.isArray(jr?.chapters) ? jr.chapters : null);
    } catch {
      setJourney(null);
      setChapters(null);
    }
    // UX-HUB-3 Batch 3 — real-data card reads. PARALLEL + ERROR-ISOLATED: each settles
    // independently and falls to its honest default, so one failing endpoint never blanks
    // the others or the rest of the Hub. Hearts are displayed as Hearts only (no $).
    await Promise.allSettled([
      api.getHeartsAmounts()
        .then((r) => setAmounts(Array.isArray(r?.amounts) ? r.amounts : []))
        .catch(() => setAmounts([])),
      api.getHeartsHistory()
        .then((r) => setHistory(Array.isArray(r?.history) ? r.history : []))
        .catch(() => setHistory([])),
      api.getLifetimeEarned()
        .then((r) => setLifetime(Number(r?.lifetimeEarned) || 0))
        .catch(() => setLifetime(0)),
    ]);
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
        setRedeemOutcome({ type: 'paused', message: 'Redemption is temporarily unavailable — please try again shortly.' });
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

  // UX-HUB-3 Batch 4 — "View Heart History" scrolls to the on-page History card (Row 6).
  // No new route; smooth in-page scroll only.
  const scrollToHistory = () => {
    try {
      document.getElementById('hub-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch { /* non-fatal */ }
  };

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden' }}>
      {/* Background Frame for Page Body */}
      <div className="hearts-hub" style={{
        background: '#f8fafc',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid #e2e8f0',
        padding: '2rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        {/* UX-HUB-4C — top "Hearts Hub" banner removed; the Premium Hero is now the first
            section directly beneath the dashboard navigation. */}
        {/* UX-HUB-3 Batch 7 — concept-faithful row order.
            ROW 1: full-width Premium Hearts Hero (balance only; Hero Hearts moved to Row 4). */}
        <HubBalanceCard
          balance={balance}
          setShowHeroHeartsModal={setShowHeroHeartsModal}
          onViewHistory={scrollToHistory}
        />

        {/* ROW 2: Your Hearts Journey (3-zone band → roadmap → checklist → Continue CTA). */}
        <HubJourney journey={journey} chapters={chapters} navigate={navigate} />

        {/* Layout Refinement — Row 1: Ways to Earn (narrow) | Hearts Marketplace unified catalog
            (wide). The marketplace merges Redeem + Marketplace and carries the "All Rewards"
            full-catalog affordance. AVAILABLE/LOCKED only; real items only; no "Coming Soon". */}
        <div className="hub-row-earn-market">
          <HubWaysToEarn amounts={amounts} />
          <HubRedeemMarketplace
            balance={balance}
            redemptionPaused={redemptionPaused}
            redeemOpen={redeemOpen}
            redeemSubmitting={redeemSubmitting}
            redeemOutcome={redeemOutcome}
            openRedeemIntent={openRedeemIntent}
            cancelRedeemIntent={cancelRedeemIntent}
            confirmRedeemIntent={confirmRedeemIntent}
            marketplaceItems={marketplaceItems}
            mktConfirmId={mktConfirmId}
            mktRedeemingId={mktRedeemingId}
            mktOutcome={mktOutcome}
            handleMarketplaceRedeem={handleMarketplaceRedeem}
            setMktConfirmId={setMktConfirmId}
          />
        </div>

        {/* Row 2: Greet-Me Hero Hearts | Quick Actions | Lifetime Earned (3 columns). */}
        <div className="hub-row-3col">
          <HubHeroHearts setShowHeroHeartsModal={setShowHeroHeartsModal} />
          <HubQuickActions navigate={navigate} setShowHeroHeartsModal={setShowHeroHeartsModal} />
          <HubLifetime lifetimeEarned={lifetime} />
        </div>

        {/* Row 3: full-width Heart History (5 visible, scrollable panel, "View all history"). */}
        <div id="hub-history">
          <HubHistory history={history} />
        </div>

        <HubHeroHeartsModal
          open={showHeroHeartsModal}
          selectedHeroBundle={selectedHeroBundle}
          setSelectedHeroBundle={setSelectedHeroBundle}
          heroHeartsStep={heroHeartsStep}
          lastAddedHeroBundle={lastAddedHeroBundle}
          handleAddToCart={handleAddToCart}
          resetHeroHeartsModal={resetHeroHeartsModal}
          navigate={navigate}
        />
      </div>
    </div>
  );
}
