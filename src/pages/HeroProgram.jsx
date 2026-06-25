// src/pages/HeroProgram.jsx
// HERO MVP-B2 — truthful, read-only Hero experience backed entirely by GET /api/hero/me.
// The page answers: Who am I? · What have I done? · What impact have I made? · What
// recognition have I earned? — via five sections. The backend returns already-rendered
// label/detail strings, so this page is a dumb renderer: NO client-side math, NO derived
// statistics, NO fabricated values. Hero Hearts purchase CTA is retained (real cart path);
// its copy presents Hearts as the single Greet-Me Rewards currency (no "double"/bonus).
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Check, ArrowRight, Award, Trophy, Clock, Star, Lock,
  Building2, Gift, ShoppingBag, Sparkles, Megaphone, Layers, Briefcase, Users, DollarSign } from 'lucide-react';
import cartService from '../services/cartService';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../api/api';

// Display labels for the impact bySource breakdown (the backend supplies labels for
// activity rows; bySource is keyed, so we map the three known sources here). Not data —
// purely the human label for a count.
const SOURCE_LABELS = {
  subscription: 'Business Subscriptions',
  g1g1: 'Gifted Subscription Bundles',
  hero_hearts: 'Hero Hearts Purchases',
};

// Visual accent per Hero Status level (no logic — presentation only).
const STATUS_ACCENT = {
  none: '#64748b',     // slate — Hero Ready
  partner: '#667eea',  // indigo — Hero Partner
  active: '#16a34a',   // green — Hero Active
  legacy: '#b45309',   // amber — Hero Legacy
};

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

// Hero Hearts bundles — price tiers kept intact (payment untouched: priceId/purchaseType
// drive the real charge). Copy reframed: Hearts add to the single Rewards balance and
// support the Hero mission. No "bonus"/"double"/per-dollar/second-currency framing.
const HERO_HEARTS_BUNDLES = [
  { id: 'bundle-100', name: 'Starter', price: 100, hearts: 1200, popular: false,
    priceId: 'price_1T4eJxCf7KAA6aLaHqH2clKw', purchaseType: 'hero_hearts' },
  { id: 'bundle-250', name: 'Growth', price: 250, hearts: 3250, popular: true,
    priceId: 'price_1T4eJyCf7KAA6aLaJjJLgVTK', purchaseType: 'hero_hearts' },
  { id: 'bundle-500', name: 'Hero', price: 500, hearts: 7000, popular: false, bestValue: true,
    priceId: 'price_1T4eJzCf7KAA6aLagx468kzk', purchaseType: 'hero_hearts' },
];

const card = {
  background: 'var(--bg-primary)',
  borderRadius: 'var(--radius-xl)',
  border: '1px solid var(--border)',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
};
const sectionTitle = {
  fontSize: '1.25rem',
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginBottom: '1rem',
};

export default function HeroProgram() {
  const navigate = useNavigate();

  // ---- Hero summary data (single read-only fetch) ----
  const [hero, setHero] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.getHeroMe();
        if (active) setHero(res?.hero || null);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // ---- Hero Hearts purchase modal (retained; cart path unchanged) ----
  const [showHeroHeartsModal, setShowHeroHeartsModal] = useState(false);
  const [selectedHeroBundle, setSelectedHeroBundle] = useState(null);
  const [heroHeartsStep, setHeroHeartsStep] = useState('selection');
  const [lastAddedHeroBundle, setLastAddedHeroBundle] = useState(null);

  const handleAddToCart = (bundle) => {
    cartService.addItem({
      type: 'hero-hearts',
      name: `Hero Hearts - ${bundle.name}`,
      price: bundle.price,
      quantity: 1,
      hearts: bundle.hearts,
      bundleId: bundle.id,
      icon: '❤️',
      ...(bundle.priceId && { priceId: bundle.priceId }),
      ...(bundle.purchaseType && { purchaseType: bundle.purchaseType }),
    });
    window.dispatchEvent(new Event('cartUpdated'));
    setLastAddedHeroBundle(bundle);
    setHeroHeartsStep('confirmation');
  };

  const resetHeroHeartsModal = () => {
    setShowHeroHeartsModal(false);
    setSelectedHeroBundle(null);
    setHeroHeartsStep('selection');
    setLastAddedHeroBundle(null);
  };

  // Honest zero-shape fallback so sections always render an empty (never crash) state.
  const data = hero || {
    status: { level: 'none', label: 'Hero Ready', since: null, isLegacy: false },
    impact: {
      business: { totalActivities: 0, bySource: {}, firstActivityAt: null, lastActivityAt: null },
      community: { totalActivities: 0, bySource: {} },
    },
    recentActivity: [],
    history: [],
    recognition: { earned: [], future: [] },
  };

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden', padding: '0 1rem' }}>
      <div style={{ ...card, padding: '1.5rem', marginBottom: '1rem' }}>

        {/* ---- Header (mission framing; no donation stat, no scroll hacks) ---- */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.75rem 2rem',
          marginBottom: '1.5rem',
          color: '#ffffff',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: '#ffffff' }}>
            Greet-Me™ Hero™
          </h1>
          <p style={{ fontSize: '0.9375rem', lineHeight: 1.5, color: '#ffffff', maxWidth: '640px', margin: '0 auto 1rem' }}>
            Appreciation with a purpose — recognition for the businesses making an impact through Greet-Me.
          </p>
          <button
            onClick={() => setShowHeroHeartsModal(true)}
            style={{
              padding: '0.625rem 1.5rem',
              background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
              color: '#ffffff', border: 'none', borderRadius: 'var(--radius-lg)',
              fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(236, 72, 153, 0.4)',
            }}
          >
            <Heart size={18} /> Contribute Hero Hearts
          </button>
        </div>

        {loading && <LoadingSpinner size="md" text="Loading your Hero summary…" />}

        {!loading && error && (
          <div style={{ ...card, padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
              We couldn’t load your Hero summary right now. Please refresh to try again.
            </p>
          </div>
        )}

        {!loading && !error && (
          <>
            <WaysToParticipateSection
              navigate={navigate}
              onOpenHeroHearts={() => setShowHeroHeartsModal(true)}
            />
            <StatusSection status={data.status} />
            <ActivitySection items={data.recentActivity} />
            <HistorySection items={data.history} />
            <ImpactSection impact={data.impact} />
            <RecognitionSection recognition={data.recognition} />
          </>
        )}
      </div>

      {/* ---- Hero Hearts purchase modal (retained; copy fixed) ---- */}
      {showHeroHeartsModal && (
        <HeroHeartsModal
          step={heroHeartsStep}
          selected={selectedHeroBundle}
          setSelected={setSelectedHeroBundle}
          lastAdded={lastAddedHeroBundle}
          onAdd={handleAddToCart}
          onClose={resetHeroHeartsModal}
          onCheckout={() => { resetHeroHeartsModal(); navigate('/dashboard/cart'); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// §1 — Hero Status (Who am I?)
// ============================================================================
function StatusSection({ status }) {
  const accent = STATUS_ACCENT[status?.level] || STATUS_ACCENT.none;
  const since = formatDate(status?.since);
  return (
    <section style={{ marginBottom: '1.5rem' }}>
      <h2 style={sectionTitle}>Hero Status</h2>
      <div style={{ ...card, padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: '3.5rem', height: '3.5rem', borderRadius: '50%',
          background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {status?.isLegacy ? <Trophy size={26} color="#fff" /> : <Award size={26} color="#fff" />}
        </div>
        <div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {status?.label || 'Hero Ready'}
          </div>
          {since
            ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Hero since {since}</div>
            : <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Your Hero journey begins with your next qualifying activity.
              </div>}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// §2 — Your Hero Activity (What have I done?)
// ============================================================================
function ActivitySection({ items }) {
  return (
    <section style={{ marginBottom: '1.5rem' }}>
      <h2 style={sectionTitle}>Your Hero Activity</h2>
      {(!items || items.length === 0) ? (
        <EmptyNote text="No Hero activity yet. Your qualifying activities will appear here." />
      ) : (
        <div style={{ ...card, overflow: 'hidden' }}>
          {items.map((it, i) => (
            <div key={it.id || i} style={{
              display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem',
              borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{
                width: '2.25rem', height: '2.25rem', borderRadius: '50%', flexShrink: 0,
                background: 'rgba(102, 126, 234, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Star size={18} color="#667eea" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {it.label}{it.detail ? <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> · {it.detail}</span> : null}
                </div>
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {formatDate(it.occurredAt) || ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// §3 — Your Hero History (chronological timeline)
// ============================================================================
function HistorySection({ items }) {
  return (
    <section style={{ marginBottom: '1.5rem' }}>
      <h2 style={sectionTitle}>Your Hero History</h2>
      {(!items || items.length === 0) ? (
        <EmptyNote text="Your Hero history will build over time as you participate." />
      ) : (
        <div style={{ ...card, padding: '1.25rem 1.5rem' }}>
          {items.map((it, i) => {
            const isMilestone = it.kind === 'milestone';
            return (
              <div key={i} style={{ display: 'flex', gap: '0.875rem', position: 'relative', paddingBottom: i < items.length - 1 ? '1.25rem' : 0 }}>
                {/* connector line */}
                {i < items.length - 1 && (
                  <div style={{ position: 'absolute', left: '0.5rem', top: '1.25rem', bottom: 0, width: '2px', background: 'var(--border)' }} />
                )}
                <div style={{
                  width: '1.05rem', height: '1.05rem', borderRadius: '50%', marginTop: '0.15rem', flexShrink: 0, zIndex: 1,
                  background: isMilestone ? '#667eea' : 'var(--bg-primary)',
                  border: isMilestone ? '2px solid #667eea' : '2px solid var(--border)',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: isMilestone ? 700 : 600, color: 'var(--text-primary)' }}>
                    {it.label}{it.detail ? <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> · {it.detail}</span> : null}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{formatDate(it.occurredAt) || ''}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// §4 — Your Impact Through Greet-Me (counts only; no dollars/participants/score)
// ============================================================================
function ImpactSection({ impact }) {
  const business = impact?.business || { totalActivities: 0, bySource: {} };
  const community = impact?.community || { totalActivities: 0, bySource: {} };
  const by = business.bySource || {};
  const breakdown = ['subscription', 'g1g1', 'hero_hearts']
    .map((k) => ({ key: k, label: SOURCE_LABELS[k], count: Number(by[k]) || 0 }));

  return (
    <section style={{ marginBottom: '1.5rem' }}>
      <h2 style={sectionTitle}>Your Impact Through Greet-Me</h2>
      <div style={{ ...card, padding: '1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '2.75rem', fontWeight: 800, color: '#667eea', lineHeight: 1 }}>
            {Number(business.totalActivities) || 0}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '0.25rem' }}>
            Total Hero activities
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
          {breakdown.map((b) => (
            <div key={b.key} style={{
              padding: '0.875rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{b.count}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{b.label}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '1.25rem', marginBottom: 0 }}>
          Across the Greet-Me Hero community: {Number(community.totalActivities) || 0} Hero activities.
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// §5 — Recognition (earned + future opportunities; no Hall implementation)
// ============================================================================
function RecognitionSection({ recognition }) {
  const earned = recognition?.earned || [];
  const future = recognition?.future || [];
  return (
    <section style={{ marginBottom: '0.5rem' }}>
      <h2 style={sectionTitle}>Recognition</h2>
      <div style={{ ...card, padding: '1.5rem' }}>
        {earned.length === 0 ? (
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem' }}>
            You haven’t earned Hero recognition yet — it appears here as you participate.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {earned.map((r) => (
              <div key={r.key} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.875rem', borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', color: '#000',
              }}>
                <Award size={16} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{r.label}</span>
                {r.earnedAt ? <span style={{ fontSize: '0.6875rem', opacity: 0.8 }}>· {formatDate(r.earnedAt)}</span> : null}
              </div>
            ))}
          </div>
        )}

        {future.length > 0 && (
          <>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.625rem' }}>
              Future recognition opportunities
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {future.map((r) => (
                <div key={r.key} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.875rem', borderRadius: 'var(--radius-lg)',
                  border: '1px dashed var(--border)', color: 'var(--text-secondary)',
                }}>
                  <Lock size={14} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{r.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Ways to Participate — every corporate Hero participation vector, honestly classified.
// Live self-serve → real route / existing modal. Corporate/managed (not self-serve) →
// "Learn More" to /business (the corporate offerings page; the safest real destination —
// no dedicated sales route exists; /support is the general alternative). Coming-soon →
// status chip only, NO CTA (never launches a paused/unbuilt flow). No fake data, no
// alert(), no dead links.
//
// CHIPS: available (green) · learn (slate) · soon (amber).
const PARTICIPATION_GROUPS = [
  {
    heading: 'Self-serve',
    cards: [
      { key: 'business_subscriptions', title: 'Business Subscriptions', icon: Building2,
        desc: 'Subscribe your business and recognize the people who matter most.',
        chip: 'available', cta: { kind: 'link', to: '/pricing', label: 'View Plans' } },
      { key: 'gifted_bundles', title: 'Gifted Subscription Bundles', icon: Gift,
        desc: 'Gift Greet-Me memberships to your team, clients, or community.',
        chip: 'available', cta: { kind: 'link', to: '/dashboard/gifts', label: 'Open Gifts' } },
      { key: 'hero_hearts', title: 'Hero Hearts', icon: Heart,
        desc: 'Contribute Hero Hearts to support the Hero mission.',
        chip: 'available', cta: { kind: 'modal', label: 'Contribute' } },
      { key: 'marketplace', title: 'Greet-Me Gifts & Marketplace', icon: ShoppingBag,
        desc: 'Send curated gifts and branded merch through Greet-Me.',
        chip: 'available', cta: { kind: 'link', to: '/dashboard/gifts', label: 'Browse' } },
    ],
  },
  {
    heading: 'Corporate & managed programs',
    cards: [
      { key: 'white_label', title: 'White Label Services', icon: Sparkles,
        desc: 'Fully branded, concierge-managed Greet-Me experiences.',
        chip: 'learn', cta: { kind: 'learn', to: '/business', label: 'Learn More' } },
      { key: 'corporate_appreciation', title: 'Corporate Appreciation Programs', icon: Award,
        desc: 'Recognize employees and clients at scale with a managed program.',
        chip: 'learn', cta: { kind: 'learn', to: '/business', label: 'Learn More' } },
      { key: 'managed_campaigns', title: 'Managed Gift Campaigns', icon: Megaphone,
        desc: 'Hands-on campaign setup and delivery, run with our team.',
        chip: 'learn', cta: { kind: 'learn', to: '/business', label: 'Learn More' } },
      { key: 'bulk_enterprise', title: 'Bulk / Enterprise Subscription Bundles', icon: Layers,
        desc: 'High-volume subscription bundles for large organizations.',
        chip: 'learn', cta: { kind: 'learn', to: '/business', label: 'Learn More' } },
      { key: 'marketplace_partners', title: 'Marketplace Partner Programs', icon: Briefcase,
        desc: 'Become a curated vendor partner in the Greet-Me marketplace.',
        chip: 'learn', cta: { kind: 'learn', to: '/business', label: 'Learn More' } },
      { key: 'custom_recognition', title: 'Custom Corporate Recognition Programs', icon: Users,
        desc: 'Tailored recognition programs designed around your brand.',
        chip: 'learn', cta: { kind: 'learn', to: '/business', label: 'Learn More' } },
    ],
  },
  {
    heading: 'Coming soon',
    cards: [
      { key: 'qr_cash', title: 'QR Cash', icon: DollarSign,
        desc: 'Send cash gifts by QR — launching soon.', chip: 'soon', cta: { kind: 'none' } },
      { key: 'hall_of_honor', title: 'Hall of Honor', icon: Trophy,
        desc: 'A recognition leaderboard for top sponsors — coming soon.', chip: 'soon', cta: { kind: 'none' } },
      { key: 'hall_of_heroes', title: 'Hall of Heroes', icon: Star,
        desc: 'Permanent recognition for high-impact sponsors — coming soon.', chip: 'soon', cta: { kind: 'none' } },
    ],
  },
];

const CHIP_STYLE = {
  available: { background: 'rgba(22, 163, 74, 0.12)', color: '#16a34a', label: 'Available' },
  learn: { background: 'rgba(100, 116, 139, 0.14)', color: '#475569', label: 'Learn More' },
  soon: { background: 'rgba(245, 158, 11, 0.14)', color: '#b45309', label: 'Coming Soon' },
};

function WaysToParticipateSection({ navigate, onOpenHeroHearts }) {
  const onCta = (cta) => {
    if (!cta) return;
    if (cta.kind === 'modal') return onOpenHeroHearts();
    if (cta.kind === 'link' || cta.kind === 'learn') return navigate(cta.to);
  };
  return (
    <section style={{ marginTop: '0.5rem' }}>
      <h2 style={sectionTitle}>Ways to Participate</h2>
      {PARTICIPATION_GROUPS.map((group) => (
        <div key={group.heading} style={{ marginBottom: '1.25rem' }}>
          <div style={{
            fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--text-secondary)', marginBottom: '0.625rem',
          }}>
            {group.heading}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {group.cards.map((c) => <ParticipationCard key={c.key} item={c} onCta={onCta} />)}
          </div>
        </div>
      ))}
    </section>
  );
}

function ParticipationCard({ item, onCta }) {
  const Icon = item.icon;
  const chip = CHIP_STYLE[item.chip];
  const hasCta = item.cta && item.cta.kind !== 'none';
  return (
    <div style={{ ...card, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{
          width: '2.5rem', height: '2.5rem', borderRadius: '50%', flexShrink: 0,
          background: 'rgba(102, 126, 234, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color="#667eea" />
        </div>
        <span style={{
          fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: 'var(--radius-md)',
          background: chip.background, color: chip.color, whiteSpace: 'nowrap',
        }}>
          {chip.label}
        </span>
      </div>
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
          {item.title}
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          {item.desc}
        </p>
      </div>
      {hasCta && (
        <button
          onClick={() => onCta(item.cta)}
          style={{
            marginTop: 'auto', alignSelf: 'flex-start', padding: '0.5rem 0.875rem',
            background: item.cta.kind === 'learn' ? 'transparent' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: item.cta.kind === 'learn' ? '#667eea' : 'white',
            border: item.cta.kind === 'learn' ? '1px solid #667eea' : 'none',
            borderRadius: 'var(--radius-lg)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
          }}
        >
          {item.cta.label} <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}

// Compact, theme-consistent empty note (avoids the Tailwind EmptyState card clashing
// with the page's design-token styling).
function EmptyNote({ text }) {
  return (
    <div style={{ ...card, padding: '1.5rem', textAlign: 'center' }}>
      <Clock size={22} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }} />
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>{text}</p>
    </div>
  );
}

// ============================================================================
// Hero Hearts purchase modal — retained working cart path; copy corrected (Hearts add
// to the single Greet-Me Rewards balance and support the Hero mission; no "double"/bonus).
// ============================================================================
function HeroHeartsModal({ step, selected, setSelected, lastAdded, onAdd, onClose, onCheckout }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'white', borderRadius: '1rem', width: '90%', maxWidth: '760px', maxHeight: '90vh',
        zIndex: 1001, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{
          position: 'absolute', top: 12, right: 12, background: '#f3f4f6', border: 'none', borderRadius: '50%',
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 9999,
        }}>
          <span style={{ fontSize: 24, fontWeight: 'bold', color: '#374151', lineHeight: 1 }}>×</span>
        </button>

        <div style={{ padding: '2rem', paddingTop: '2.5rem', overflowY: 'auto', flex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              width: '4rem', height: '4rem', borderRadius: '50%', margin: '0 auto 1rem',
              background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Heart size={28} color="#fff" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Greet-Me Hero Hearts™
            </h2>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '520px', margin: '0 auto' }}>
              Hearts are the Greet-Me Rewards currency. Hero Hearts purchases add Hearts to your Rewards
              balance and support the Hero mission.
            </p>
          </div>

          {step === 'selection' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {HERO_HEARTS_BUNDLES.map((bundle) => {
                  const isSel = selected === bundle.id;
                  return (
                    <div key={bundle.id} onClick={() => setSelected(bundle.id)} style={{
                      position: 'relative', cursor: 'pointer', borderRadius: 'var(--radius-xl)', padding: '1.5rem',
                      background: isSel ? 'rgba(236, 72, 153, 0.06)' : 'white',
                      border: isSel || bundle.popular ? '2px solid #ec4899' : '2px solid var(--border)',
                      transition: 'all 0.2s', transform: isSel ? 'scale(1.02)' : 'scale(1)',
                    }}>
                      {bundle.popular && <Ribbon text="Most Popular" bg="linear-gradient(135deg, #ec4899 0%, #be185d 100%)" />}
                      {bundle.bestValue && <Ribbon text="Best Value" bg="linear-gradient(135deg, #D4AF37 0%, #8B6914 100%)" />}
                      <div style={{
                        position: 'absolute', top: '1rem', right: '1rem', width: '1.5rem', height: '1.5rem', borderRadius: '50%',
                        border: isSel ? '2px solid #ec4899' : '2px solid var(--border)', background: isSel ? '#ec4899' : 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSel && <Check size={14} color="#fff" />}
                      </div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', paddingRight: '2rem' }}>
                        {bundle.name}
                      </h3>
                      <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ec4899', marginBottom: '0.5rem' }}>
                        ${bundle.price}
                      </div>
                      <div style={{
                        background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)', padding: '0.625rem 0.75rem',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Hearts</span>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#ec4899' }}>
                          {bundle.hearts.toLocaleString()} ❤️
                        </span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '0.625rem', marginBottom: 0 }}>
                        Added to your Greet-Me Rewards balance
                      </p>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between' }}>
                <button onClick={onClose} style={btnSecondary}>Cancel</button>
                <button
                  onClick={() => { const b = HERO_HEARTS_BUNDLES.find((x) => x.id === selected); if (b) onAdd(b); }}
                  disabled={!selected}
                  style={{
                    ...btnPrimaryPink,
                    background: selected ? 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)' : 'var(--gray-200)',
                    color: selected ? 'white' : 'var(--text-secondary)',
                    cursor: selected ? 'pointer' : 'not-allowed',
                  }}
                >
                  <ShoppingCart size={18} /> Add to Cart
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '1rem', fontStyle: 'italic' }}>
                Hearts are added to your Greet-Me Rewards balance after purchase. Hero Hearts purchases support the Hero mission.
              </p>
            </>
          )}

          {step === 'confirmation' && lastAdded && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{
                width: '5rem', height: '5rem', borderRadius: '50%', margin: '0 auto 1.5rem',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={40} color="#fff" />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Added to Cart!</h3>
              <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                {lastAdded.name} · {lastAdded.hearts.toLocaleString()} ❤️
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', maxWidth: '400px', margin: '0 auto' }}>
                <button onClick={onClose} style={{ ...btnSecondary, flex: 1, color: '#667eea', borderColor: '#667eea' }}>
                  <ShoppingCart size={18} /> Continue Shopping
                </button>
                <button onClick={onCheckout} style={{ ...btnPrimaryIndigo, flex: 1 }}>
                  Checkout <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Ribbon({ text, bg }) {
  return (
    <div style={{
      position: 'absolute', top: '-0.75rem', left: '50%', transform: 'translateX(-50%)',
      background: bg, color: 'white', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-md)',
      fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
    }}>{text}</div>
  );
}

const btnSecondary = {
  padding: '0.875rem 1.5rem', background: 'white', color: 'var(--text-primary)',
  border: '2px solid var(--border)', borderRadius: 'var(--radius-lg)', fontSize: '0.9375rem',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
};
const btnPrimaryPink = {
  padding: '0.875rem 2rem', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: '0.9375rem',
  fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.5rem',
};
const btnPrimaryIndigo = {
  padding: '0.875rem 1.5rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white',
  border: 'none', borderRadius: 'var(--radius-lg)', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
  fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
};
