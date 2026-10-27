// src/components/DashboardLayout.jsx
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { isFundraiserUiEnabled } from '../config/fundraiserGate.js'; // TEAM B — dark fundraising nav gate
import { isFounder } from '../utils/accountState.js'; // TEAM D — FE-GATE-1 founder nav gating
import { useAuth } from '../context/AuthContext';
import { Gift, ShoppingBag, Settings as SettingsIcon, LogOut, Users, ShoppingCart, Film, X, Image as ImageIcon, QrCode } from 'lucide-react';
import GreetMeLogo from './GreetMeLogo';
import G1G1Badge from './G1G1Badge';
import NotificationBell from './NotificationBell';
import cartService from '../services/cartService';
import imageCreditsService from '../services/imageCreditsService';
import api from '../api/api';
import GuidedSetupFlow, { shouldShowGuidedSetupForUser } from './GuidedSetupFlow';
import { SETUP_REVISIT_EVENT } from './setupRevisit';
import { isGuidedSetupExcludedRoute } from './guidedSetupRouteExclusion.js';
import { useAccountState } from '../hooks/useAccountState';
import { useFundraiserPartnerAccess } from '../hooks/useFundraiserPartnerAccess'; // TEAM B B3 — server-derived partner-nav visibility
import { capitalizeFirst } from '../utils/displayName.js';

// Founder 2026-10-27: Founder Central Command is reached from the account menu, not the main navigation. The page
// itself stays founder-gated (FounderCentralCommand isFounder) and the backend remains the authority.
const FOUNDER_MENU_ITEM = Object.freeze({ label: 'Founder Central Command', path: '/dashboard/founder/command' });

export default function DashboardLayout({ children }) {
  const { user, logout, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Defensive display-name fallbacks: avatar/greeting must never collapse to
  // a bare 'U' when `name` is briefly absent (e.g. login payload omits it).
  const displayName = user?.name || user?.email || 'User';
  // Walkthrough revision 2026-10-24: the displayed first name starts with a capital; the other letters are kept as typed.
  const firstName = capitalizeFirst(user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'User');
  const avatarInitial = (displayName.charAt(0) || 'U').toUpperCase();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(null); // NAV-02 — desktop nested submenu (For Business)
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 768);
  // Report 136: on phones the full logo stays on one line and scales down only as far as its space needs
  // (the narrowest phones, below about 375px); desktop never renders this.
  const logoColRef = useRef(null);
  const logoRef = useRef(null);
  const [logoScale, setLogoScale] = useState(1);
  // TEAM B B3 — server-derived partner-administrator signal for nav visibility only. Probes once per
  // mount, only when authenticated AND the fundraiser gate is on; fails closed; nothing persisted.
  // Re-probes exactly once per authentication transition; auth loss hides the entry immediately.
  const isPartnerAdmin = useFundraiserPartnerAccess(isAuthenticated, !authLoading);

  const [imageCredits, setImageCredits] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  // C2 — transient display-only copy of the server Hearts balance (see effect below).
  const [heartsBalance, setHeartsBalance] = useState(0);
  // C3 — animated display value for the live count-up. `heartsBalance` holds the
  // server-confirmed value (source of truth + aria); `displayBalance` is the number
  // that counts up to it. The two are equal except during the count-up animation.
  const [displayBalance, setDisplayBalance] = useState(0);
  const displayBalanceRef = useRef(0);
  const countRafRef = useRef(null);
  // Phase 3D Batch D D5-R1 — account-state-aware gate for GuidedSetupFlow.
  // Wires the existing shouldShowGuidedSetupForUser helper into the modal's
  // visibility gate so subscribed users no longer see the welcome modal after
  // registration/login. Free users and unsubscribed new users see no change.
  const accountState = useAccountState();
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowGuidedSetupForUser(accountState));
  // Handles the AuthContext hydration race: if subscriptionStatus arrives from
  // /api/profile after mount, hide the modal. Never auto-shows — a dismissed
  // modal stays dismissed, and a newly-subscribed mid-session user is not
  // re-shown the modal.
  useEffect(() => {
    if (showOnboarding && !shouldShowGuidedSetupForUser(accountState)) {
      setShowOnboarding(false);
    }
  }, [accountState.isAuthenticated, accountState.isSubscribed, accountState.isOnboardingComplete, showOnboarding]);

  // Dashboard "Re-record" / "Revisit setup · voice & photo": opens GuidedSetupFlow in REVISIT mode (Voice, then
  // Photo, then closes). Opened only on request; it never changes the first-run gate above.
  const [showSetupRevisit, setShowSetupRevisit] = useState(false);
  useEffect(() => {
    const open = () => setShowSetupRevisit(true);
    window.addEventListener(SETUP_REVISIT_EVENT, open);
    return () => window.removeEventListener(SETUP_REVISIT_EVENT, open);
  }, []);

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Report 136: fit the phone logo to its column (re-fit when fonts arrive and whenever the column changes size,
  // e.g. the Hearts count growing).
  useLayoutEffect(() => {
    if (!isNarrow) return undefined;
    const fit = () => {
      const col = logoColRef.current; const logo = logoRef.current;
      if (!col || !logo || !logo.offsetWidth) return;
      setLogoScale(Math.min(1, col.clientWidth / logo.offsetWidth));
    };
    fit();
    let live = true;
    document.fonts?.ready?.then(() => { if (live) fit(); });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (ro && logoColRef.current) ro.observe(logoColRef.current);
    return () => { live = false; if (ro) ro.disconnect(); };
  }, [isNarrow]);

  useEffect(() => {
    // Update cart count on mount and when window regains focus
    const updateCartCount = () => {
      setCartCount(cartService.getCount());
    };

    // Update image credits count
    const updateImageCredits = () => {
      setImageCredits(imageCreditsService.getCount());
    };

    updateCartCount();
    updateImageCredits();
    window.addEventListener('focus', updateCartCount);
    window.addEventListener('focus', updateImageCredits);

    // Custom events for updates
    window.addEventListener('cartUpdated', updateCartCount);
    window.addEventListener('imageCreditsUpdated', updateImageCredits);

    return () => {
      window.removeEventListener('focus', updateCartCount);
      window.removeEventListener('focus', updateImageCredits);
      window.removeEventListener('cartUpdated', updateCartCount);
      window.removeEventListener('imageCreditsUpdated', updateImageCredits);
    };
  }, []);

  // C2 — Persistent Hearts balance in the chrome. Read-only display of the
  // server-authoritative balance (GET /api/hearts/balance), refetched on mount
  // and on window focus, mirroring the cart/imageCredits pattern above. The
  // server stays the single source of truth — no caching, no persistence.
  useEffect(() => {
    const loadHeartsBalance = async () => {
      try {
        const r = await api.getHeartsBalance();
        const bal = r?.balance ?? 0;
        setHeartsBalance(bal);
        setDisplayBalance(bal);          // snap on fetch (no animation on focus refresh)
        displayBalanceRef.current = bal;
      } catch {
        setHeartsBalance(0);
        setDisplayBalance(0);
        displayBalanceRef.current = 0;
      }
    };
    loadHeartsBalance();
    window.addEventListener('focus', loadHeartsBalance);
    return () => window.removeEventListener('focus', loadHeartsBalance);
  }, []);

  // C3 — live balance count-up. On a server-confirmed earn (gm:hearts-earned,
  // dispatched by the send flow), animate the displayed balance up to the server
  // value, completing as the flying Hearts settle (~720ms travel + ~100ms settle)
  // so the count never outruns them. The end value is always the server-confirmed
  // number — no fabrication. prefers-reduced-motion snaps with no animation.
  useEffect(() => {
    const COUNT_MS = 820; // travel (720) + settle (100): completes as the Hearts settle
    const onEarned = (e) => {
      const to = Number(e?.detail?.to);
      if (!Number.isFinite(to)) return;
      setHeartsBalance(to); // server-confirmed value — source of truth + aria
      const reduce = typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const from = displayBalanceRef.current;
      if (countRafRef.current) cancelAnimationFrame(countRafRef.current);
      if (reduce || to <= from) {
        setDisplayBalance(to);
        displayBalanceRef.current = to;
        return;
      }
      // C4 — real increment + motion allowed: authorize the bloom now so the fly
      // and this count-up start together and stay inseparable. Below this line we
      // are committed to animating from `from` up to the server value `to`, so the
      // fly can never play without a matching count (and vice-versa).
      try { window.dispatchEvent(new CustomEvent('gm:hearts-celebrate')); } catch { /* non-fatal */ }
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - start) / COUNT_MS); // linear — never outruns the Hearts
        const v = p < 1 ? Math.round(from + (to - from) * p) : to;
        setDisplayBalance(v);
        displayBalanceRef.current = v;
        if (p < 1) countRafRef.current = requestAnimationFrame(tick);
      };
      countRafRef.current = requestAnimationFrame(tick);
    };
    window.addEventListener('gm:hearts-earned', onEarned);
    return () => {
      window.removeEventListener('gm:hearts-earned', onEarned);
      if (countRafRef.current) cancelAnimationFrame(countRafRef.current);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Walkthrough revision 2026-10-24 (founder): the main navigation reads Home / Celebrations / Gift Place / For Business /
  // Fundraisers / Plans & Pricing / Hero / Hearts (Founder Central Command moved to the account menu, 2026-10-27). Order and visible labels only: every
  // path and every gate below is unchanged. The standalone founder Fundraising and Salespeople links were removed
  // (founder 2026-10-24); both remain inside Founder Central Command. The public Fundraisers link stays.
  const navigation = [
    { name: 'Home', path: '/dashboard', icon: null },
    { name: 'Celebrations', path: '/dashboard/contacts', icon: Users }, // Report 135: the Recipients page, renamed (people and their occasions)
    { name: 'Gift Place', path: '/dashboard/gifts', icon: Gift }, // was 'Greet-Me Gifts'
    // NAV-02 — FOR BUSINESS carries a nested submenu → Corporate Campaign Dashboard (Team B's
    // canonical evolving surface at /dashboard/campaigns). The parent link to the marketing page is kept.
    { name: 'For Business', path: '/business', icon: null, children: [
      { name: 'Corporate Campaign Dashboard', path: '/dashboard/campaigns' },
    ] },
    // NAV-02 — Greet-Me Fundraise: VISIBLE primary header → Partner Admin home.
    // Destination + backend still enforce the fundraiser gate/auth (401/403/503). NEVER Founder Admin.
    // Media Library relocated into the avatar/profile dropdown (see the user menu below).
    // TEAM B B3 — visibility is now SERVER-DERIVED: shown only when the dark gate is ON and
    // GET /api/fundraiser/partner/orgs returns 200 with >= 1 approved organization the caller
    // administers (persisted adminUserIds). Replaces the FE-GATE-1 founder predicate, which pointed
    // the PARTNER home at founders only and left real partner administrators with no entry.
    // Display-only: it grants no route or backend authorization, and no client role is trusted.
    // Report 87 A7 (rev 6) — ONE item changed: "Fundraisers" opens the public Fundraisers page for
    // everyone while the dark gate is ON (gate semantics unchanged: OFF ⇒ no fundraiser navigation).
    // Authorized partner administrators — the SAME server-derived check as before — also get a caret
    // with "Partner Dashboard" (/dashboard/fundraiser). Display-only; grants no access.
    ...(isFundraiserUiEnabled() ? [{ name: 'Fundraisers', path: '/fundraisers', icon: null,
      ...(isPartnerAdmin ? { children: [{ name: 'Partner Dashboard', path: '/dashboard/fundraiser' }] } : {}) }] : []),
    { name: 'Plans & Pricing', path: '/pricing', icon: null },
    { name: 'Hero', path: '/dashboard/hero', icon: null }, // was '🥇 Greet-Me™ Hero™'
    { name: 'Hearts', path: '/dashboard/rewards', icon: null }, // was '❤️ Hearts Hub'
    // Founder 2026-10-27: Founder Central Command moved out of the main navigation into the account menu (the
    // user-icon menu on desktop, the account area of the hamburger menu on phones), founder-only (FOUNDER_MENU_ITEM).
  ];

  return (
    <div className="gm-min-h-screen" style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        // Phase 3D Batch B — B.3.1: protect sticky header from iOS notch /
        // Dynamic Island. env() returns 0px on non-notched devices and in
        // landscape, so desktop and Android visual rhythm is preserved.
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}>
        
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: isNarrow ? '0 0.75rem' : '0 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          // Walkthrough 2026-10-24 compact pass (founder's 75% reference at normal zoom): 7rem -> 5rem on desktop.
          height: isNarrow ? '4rem' : '5rem',
          gap: isNarrow ? '0.375rem' : '1rem'
        }}>
          {/* Hamburger Menu Button - Mobile Only */}
          {isNarrow && (
            <div style={{ minWidth: '2.75rem', flexShrink: 0 }}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                width: '2.75rem',
                height: '2.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: mobileMenuOpen ? 'var(--gray-200)' : 'var(--gray-100)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                flexShrink: 0,
                padding: 0
              }}
            >
              {mobileMenuOpen ? (
                <X size={18} style={{ color: '#111827' }} />
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <span style={{ width: '14px', height: '2px', background: '#111827', borderRadius: '1px' }} />
                  <span style={{ width: '14px', height: '2px', background: '#111827', borderRadius: '1px' }} />
                  <span style={{ width: '14px', height: '2px', background: '#111827', borderRadius: '1px' }} />
                </div>
              )}
            </button>
            </div>
          )}

          {/* G1G1: compact control with its explanation on hover, keyboard focus and tap (replaces the gold seal).
              Phones (where the seal was hidden): the dashboard home shows the same control in its welcome card. */}
          {!isNarrow && (
            <div style={{ width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexShrink: 0 }}>
              <G1G1Badge />
            </div>
          )}

          {/* Centered Logo and Tagline */}
          <div ref={logoColRef} style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center',
            minWidth: 0
          }}>
            {isNarrow ? (
              <div ref={logoRef} data-testid="phone-header-logo" style={{ width: 'max-content', whiteSpace: 'nowrap', transform: logoScale < 1 ? `scale(${logoScale})` : undefined, transformOrigin: 'center' }}>
                <GreetMeLogo size="small" clickable={true} />
              </div>
            ) : (
              <GreetMeLogo size="large" clickable={true} />
            )}
          </div>

          {/* Right side - Image Bank, Cart, User icon (equal spacing) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isNarrow ? '0.25rem' : '1rem', justifyContent: 'flex-end', flexShrink: 0, minWidth: isNarrow ? '6rem' : '120px' }}>
            {/* Persistent Hearts balance (C2 + C3) — the destination the celebration
                flies to and counts up into. Value is server-driven (aria reflects the
                server-confirmed `heartsBalance`); only the visible number animates. */}
            <div
              data-gm-hearts-balance
              title="Your Hearts"
              aria-label={`${heartsBalance} Hearts`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                height: '3.25rem',
                padding: isNarrow ? '0 0.125rem' : '0 0.5rem',
                fontSize: isNarrow ? '0.9375rem' : '1.0625rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                userSelect: 'none',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: isNarrow ? '1rem' : '1.125rem' }}>❤️</span>
              <span>{displayBalance}</span>
            </div>
            {/* Image Bank - for tracking images */}
            <button
              onClick={() => navigate('/dashboard/animations')}
              style={{
                width: isNarrow ? '2.75rem' : '3.25rem',
                height: isNarrow ? '2.75rem' : '3.25rem',
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                position: 'relative',
                padding: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--gray-100)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              title="Image Bank"
            >
              {/* Custom Bank Icon with $ */}
              <svg
                width={isNarrow ? 22 : 26}
                height={isNarrow ? 22 : 26}
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-secondary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Roof/Triangle */}
                <path d="M3 21h18" />
                <path d="M3 10h18" />
                <path d="M5 6l7-3 7 3" />
                {/* Pillars */}
                <path d="M4 10v11" />
                <path d="M20 10v11" />
                <path d="M8 10v11" />
                <path d="M16 10v11" />
                {/* Dollar sign in center */}
                <path d="M12 12v6" />
                <path d="M10 14h4c.5 0 1 .5 1 1s-.5 1-1 1h-2c-.5 0-1 .5-1 1s.5 1 1 1h4" style={{ strokeWidth: 1.5 }} />
              </svg>
              {imageCredits > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '0',
                  right: '0',
                  background: '#22c55e',
                  color: 'white',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  minWidth: '1rem',
                  height: '1rem',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--bg-primary)'
                }}>
                  {imageCredits > 9 ? '9+' : imageCredits}
                </span>
              )}
            </button>

            {/* Shopping Cart Icon */}
            <button
              onClick={() => navigate('/dashboard/cart')}
              style={{
                width: isNarrow ? '2.75rem' : '3.25rem',
                height: isNarrow ? '2.75rem' : '3.25rem',
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                position: 'relative',
                padding: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--gray-100)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              title="Shopping Cart"
            >
              <ShoppingCart size={isNarrow ? 22 : 26} style={{ color: 'var(--text-secondary)' }} />
              {cartCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '0',
                  right: '0',
                  background: '#ef4444',
                  color: 'white',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  minWidth: '1rem',
                  height: '1rem',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--bg-primary)'
                }}>
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>

            {/* User Icon with Dropdown — Report 136: desktop only; on phones its account actions are in the hamburger menu */}
            {!isNarrow && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{
                  width: isNarrow ? '2.75rem' : '3.25rem',
                  height: isNarrow ? '2.75rem' : '3.25rem',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: isNarrow ? '1.125rem' : '1.25rem',
                  padding: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title={displayName}
              >
                {avatarInitial}
              </button>

              {/* User Dropdown */}
              {userMenuOpen && (
                <>
                  <div
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 10
                    }}
                    onClick={() => setUserMenuOpen(false)}
                  ></div>
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    marginTop: '0.5rem',
                    width: '12rem',
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                    border: '1px solid var(--border)',
                    padding: '0.5rem',
                    zIndex: 20
                  }}>
                    <div style={{
                      padding: '0.75rem',
                      borderBottom: '1px solid var(--border)',
                      marginBottom: '0.5rem'
                    }}>
                      <p style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        margin: 0
                      }}>{displayName}</p>
                      <p style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-tertiary)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>{user?.email || 'user@example.com'}</p>
                    </div>
                    {/* Founder 2026-10-27: Founder Central Command, founder-only, first in the account menu. */}
                    {isFounder(user) ? (
                      <button
                        data-testid="usermenu-founder-command"
                        onClick={() => { setUserMenuOpen(false); navigate(FOUNDER_MENU_ITEM.path); }}
                        style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.75rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-100)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Users size={16} /><span>{FOUNDER_MENU_ITEM.label}</span>
                      </button>
                    ) : null}
                    {/* NAV-02 — Media Library relocated here from the primary nav (same dropdown styling). */}
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/dashboard/media'); }}
                      style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-100)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <ImageIcon size={16} /><span>Media Library</span>
                    </button>
                    {/* NAV-01 — account items moved from top nav into the user menu */}
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/dashboard/merch/orders'); }}
                      style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-100)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <ShoppingBag size={16} /><span>My Orders</span>
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/dashboard/settings'); }}
                      style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-100)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <SettingsIcon size={16} /><span>Settings</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.625rem 0.75rem',
                        fontSize: '0.875rem',
                        color: 'var(--error)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fef2f2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                  </div>
                </>
              )}
            </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Slide-out Menu */}
      {isNarrow && mobileMenuOpen && (
        <>
          {/* Overlay — Phase 3D Batch B Slice 3 I4: bumped from z=40 to z=55
              so it stays below the drawer (z=60) while remaining above the
              sticky header (z=50) and all in-chrome elements. */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 55
            }}
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Slide-out Menu — Phase 3D Batch B Slice 3 I4: z=60 breaks the tie
              with the sticky header (z=50). paddingTop with env(safe-area-inset-top)
              prevents drawer content from sliding under the iPhone notch /
              Dynamic Island. Other drawer behavior preserved verbatim. */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: '280px',
            background: 'var(--bg-primary)',
            zIndex: 60,
            paddingTop: 'env(safe-area-inset-top, 0px)',
            boxShadow: '4px 0 20px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Menu Header */}
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <GreetMeLogo size="small" clickable={false} />
              <button
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  width: '2.75rem',
                  height: '2.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            {/* User Info — Report 136: carries the header's user icon on phones */}
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border)',
              background: 'var(--gray-50)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <span aria-hidden="true" title={displayName} style={{ width: '2.75rem', height: '2.75rem', borderRadius: '50%', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: '1.125rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{avatarInitial}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0
                }}>Welcome, {firstName}!</p>
                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary)',
                  margin: '0.25rem 0 0 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>{user?.email || ''}</p>
              </div>
            </div>

            {/* Navigation Links */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              {navigation.map((item) => (
                <div key={item.path}>
                  {/* NAV-03 REGRESSION FIX — label navigates to the original destination; a SEPARATE
                     caret button expands/collapses the submenu (the whole row is never expand-only). */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/dashboard'}
                      onClick={() => setMobileMenuOpen(false)}
                      style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.875rem 1rem',
                        textDecoration: 'none',
                        fontSize: '0.9375rem',
                        fontWeight: isActive ? 600 : 500,
                        borderRadius: 'var(--radius-md)',
                        background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        color: isActive ? 'var(--primary)' : 'var(--text-primary)',
                        marginBottom: '0.25rem',
                        flex: 1
                      })}
                    >
                      {item.icon && <item.icon size={18} />}
                      <span>{item.name}</span>
                    </NavLink>
                    {item.children && (
                      <button
                        type="button"
                        aria-haspopup="true"
                        aria-expanded={openSubmenu === item.name}
                        aria-label={openSubmenu === item.name ? `Close ${item.name} menu` : `Open ${item.name} menu`}
                        onClick={() => setOpenSubmenu(openSubmenu === item.name ? null : item.name)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setOpenSubmenu(null); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.5rem 0.9rem',
                          marginBottom: '0.25rem',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          color: 'var(--text-secondary)',
                          fontFamily: 'inherit',
                          fontSize: '0.8rem'
                        }}
                      >
                        <span aria-hidden="true">{openSubmenu === item.name ? '▴' : '▾'}</span>
                      </button>
                    )}
                  </div>
                  {/* Children revealed only when this row's caret is expanded */}
                  {item.children && openSubmenu === item.name && item.children.map((child) => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      onClick={() => setMobileMenuOpen(false)}
                      style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem 0.75rem 2.75rem',
                        textDecoration: 'none',
                        fontSize: '0.875rem',
                        fontWeight: isActive ? 600 : 500,
                        borderRadius: 'var(--radius-md)',
                        background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                        marginBottom: '0.25rem'
                      })}
                    >
                      <span>{child.name}</span>
                    </NavLink>
                  ))}
                </div>
              ))}
              {/* Report 136: the header user menu's account actions, for phones (the header has no user icon there) */}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.25rem', paddingTop: '0.5rem' }}>
                {[
                  // Founder 2026-10-27: Founder Central Command lives in the phone account area too, founder-only.
                  ...(isFounder(user) ? [{ label: FOUNDER_MENU_ITEM.label, icon: Users, path: FOUNDER_MENU_ITEM.path, testid: 'mobilemenu-founder-command' }] : []),
                  { label: 'Media Library', icon: ImageIcon, path: '/dashboard/media' },
                  { label: 'My Orders', icon: ShoppingBag, path: '/dashboard/merch/orders' },
                  { label: 'Settings', icon: SettingsIcon, path: '/dashboard/settings' },
                ].map((item) => (
                  <button
                    key={item.path}
                    data-testid={item.testid}
                    onClick={() => { setMobileMenuOpen(false); navigate(item.path); }}
                    style={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start', padding: '0.875rem 1rem', marginBottom: '0.25rem', fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Footer */}
            <div style={{
              padding: '1rem',
              borderTop: '1px solid var(--border)'
            }}>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  color: 'var(--error)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
              <a
                href="#/support"
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'block',
                  padding: '0.5rem 1rem',
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  marginTop: '0.25rem'
                }}
              >
                Support
              </a>
            </div>
          </div>
        </>
      )}

      {/* Horizontal Navigation Bar - Desktop Only */}
      {!isNarrow && (
      <nav style={{
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
        padding: '0 2rem',
        overflowX: 'visible',
        WebkitOverflowScrolling: 'touch',
        position: 'sticky',
        top: '5rem', // follows the compact desktop header height above
        zIndex: 49
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-evenly',
          alignItems: 'center',
          // Walkthrough 2026-10-24: never a sideways scroll. The full founder nav fits on one row at 1280 and 1440
          // (measured, Report 138); narrower desktop windows wrap it onto a second row instead of widening the page.
          flexWrap: 'wrap'
        }}>
          {navigation.map((item) => (
            item.children ? (
              /* NAV-02 — desktop nested submenu (reuses the avatar-menu dropdown pattern; no new system) */
              /* NAV-03 REGRESSION FIX — split control: the LABEL is a NavLink to the original
                 destination (For Business → /business), and a SEPARATE caret button toggles the
                 submenu. Clicking the words navigates; clicking the caret only opens/closes. */
              <div key={item.path} style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                <NavLink
                  to={item.path}
                  end={item.path === '/dashboard'}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.7rem 0.25rem 0.7rem 0.7rem',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                    borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap'
                  })}
                  onMouseEnter={(e) => { if (!e.currentTarget.getAttribute('aria-current')) e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { if (!e.currentTarget.getAttribute('aria-current')) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <span>{item.name}</span>
                </NavLink>
                <button
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={openSubmenu === item.name}
                  aria-label={openSubmenu === item.name ? `Close ${item.name} menu` : `Open ${item.name} menu`}
                  onClick={() => setOpenSubmenu(openSubmenu === item.name ? null : item.name)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setOpenSubmenu(null); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.7rem 0.6rem 0.7rem 0.15rem',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    fontFamily: 'inherit',
                    color: 'var(--text-secondary)'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { if (openSubmenu !== item.name) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <span aria-hidden="true">▾</span>
                </button>
                {openSubmenu === item.name && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpenSubmenu(null)} />
                    <div
                      role="menu"
                      style={{
                        position: 'absolute',
                        left: 0,
                        marginTop: '0.25rem',
                        minWidth: '15rem',
                        background: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                        border: '1px solid var(--border)',
                        padding: '0.5rem',
                        zIndex: 20
                      }}
                    >
                      {item.children.map((child) => (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          role="menuitem"
                          onClick={() => setOpenSubmenu(null)}
                          style={({ isActive }) => ({
                            display: 'block',
                            padding: '0.625rem 0.75rem',
                            fontSize: '0.9375rem',
                            textDecoration: 'none',
                            borderRadius: 'var(--radius-md)',
                            color: isActive ? 'var(--primary)' : 'var(--text-primary)',
                            background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent'
                          })}
                          onMouseEnter={(e) => { if (!e.currentTarget.getAttribute('aria-current')) e.currentTarget.style.background = 'var(--gray-100)'; }}
                          onMouseLeave={(e) => { if (!e.currentTarget.getAttribute('aria-current')) e.currentTarget.style.background = 'transparent'; }}
                        >
                          {child.name}
                        </NavLink>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/dashboard'}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.7rem 0.7rem',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  position: 'relative',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                })}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.getAttribute('aria-current')) {
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.getAttribute('aria-current')) {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                {({ isActive }) => (
                  <>
                    {item.icon && (
                      <item.icon
                        size={16}
                        style={{ color: isActive ? 'var(--primary)' : 'currentColor' }}
                      />
                    )}
                    <span>{item.name}</span>
                  </>
                )}
              </NavLink>
            )
          ))}
        </div>
      </nav>
      )}

      {/* Main Content */}
      {/* Home: no page-level greeting; the dashboard's welcome card starts right under the navigation. */}
      <main style={{ flex: 1, padding: isNarrow ? (location.pathname === '/dashboard' ? '0.5rem 1rem 1rem' : '1rem') : (location.pathname === '/dashboard' ? '0.75rem 2rem 2rem' : '2rem'), overflowY: 'auto', overflowX: 'hidden', background: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {children || <Outlet />}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: isNarrow ? '1rem' : '1.25rem 2rem',
        textAlign: 'center',
        fontSize: '0.8125rem',
        color: 'var(--text-tertiary)',
      }}>
        <span>&copy; 2026 Greet-Me&trade;</span>
        <span style={{ margin: '0 0.5rem' }}>&middot;</span>
        <a href="#/legal" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Terms &amp; Privacy</a>
        <span style={{ margin: '0 0.5rem' }}>&middot;</span>
        <a href="#/support" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Support</a>
      </footer>

      {/* Guided Setup Flow — rendered outside <main> to escape its stacking context */}
      {/* Report 87 A7 — the welcome popup is not shown on the public Fundraisers page ONLY (route
          exclusion; the gate itself, its rules and every other page are unchanged). */}
      {showOnboarding && !isGuidedSetupExcludedRoute(location.pathname) && (
        <GuidedSetupFlow
          onComplete={() => setShowOnboarding(false)}
          onDismiss={() => setShowOnboarding(false)}
        />
      )}
      {showSetupRevisit && !showOnboarding && (
        <GuidedSetupFlow
          revisit
          onComplete={() => setShowSetupRevisit(false)}
          onDismiss={() => setShowSetupRevisit(false)}
        />
      )}

    </div>
  );
}
