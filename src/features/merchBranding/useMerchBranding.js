// src/features/merchBranding/useMerchBranding.js
// REPORT 153 — branding state for the Gift Place.
//
// While `enabled` is false (the switch is off) the hook is INERT: no API call, no state change, and
// every helper returns the "do nothing" answer, so Merch.jsx behaves exactly as before.
//
// The applied logo lives in a module-level session store, so it is RETAINED while the customer browses
// categories and opens products (Merch remounts keep it). Clear branding removes it here and on the
// server (retention default: "kept only while in use; Clear deletes" — Q3 open).
//
// 153C — signed-out handling. Branding needs an account (the logo is stored under the customer's id, so
// only they can see, replace or clear it). A signed-out customer who presses "Brand for My Company" gets
// a sign-in step instead of the upload; a sign-in that expires mid-session (any 401) drops the local
// branding and shows the same step with an "expired" line. Nothing is uploaded while signed out.
//
// 153E — founder-designated products only. "Brand for My Company" asks the server which products the
// founder has designated for customer logos. None (today) → a "not open yet" step pointing to the
// business team; nothing is uploaded. Once a logo is applied, the Brandable Goods view shows ONLY the
// designated products (assortmentCards); every other card, anywhere, stays exactly as it is today.

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { getBrandingApi } from './brandingApiProvider.js';
import { BRANDING_STRINGS as S } from './brandingStrings.js';

const POLL_MS = 15000;
// 153C: 40 polls x 15 s = 10 minutes. The server creates at most 2 mockup tasks a minute (Q8: the
// store's create-task header said 10/min on 2026-10-29; 2 is kept until confirmed), so 4 products'
// first variants are ready within ~2 minutes and all 9 variants within ~5.
const MAX_POLLS = 40;
const isAuthFailure = (r) => Boolean(r && r.status === 401);

// 153I: `approvals` = { [syncVariantId]: { approvalToken, logoId, mockupUrl } } — the signed artwork
// approvals for the CURRENT logo; a cart line carries one through the existing checkout.
const initial = () => ({ logo: null, previewSrc: null, catalog: [], mockups: {}, config: null, approvals: {} });
let session = initial();
const listeners = new Set();
function setSession(patch) {
  session = { ...session, ...(typeof patch === 'function' ? patch(session) : patch) };
  listeners.forEach((l) => l(session));
}
/** Test/preview seam: reset the module session. */
export function __resetBrandingSession() { session = initial(); listeners.forEach((l) => l(session)); }

function toPreviewSrc(file) {
  try { return URL.createObjectURL(file); } catch { return null; }
}

function approvalFor(syncVariantId) {
  const a = session.approvals && session.approvals[Number(syncVariantId)];
  return a && session.logo && a.logoId === session.logo.logoId ? a : null;
}

export function useMerchBranding({ enabled = false, signedIn = true, api: apiOverride = null } = {}) {
  const [state, setState] = useState(session);
  const [step, setStep] = useState(null); // null | {type:'logo'} | {type:'preview'|'approval', syncProductId, syncVariantId}
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const polls = useRef(0);
  const api = enabled ? (apiOverride || getBrandingApi()) : null;

  useEffect(() => {
    if (!enabled) return undefined;
    const l = (s) => setState(s);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, [enabled]);

  // A 401 means the sign-in ended: forget the local branding and ask the customer to sign in again.
  const signInAgain = useCallback(() => {
    setSession(initial());
    setStep({ type: 'signin', expired: true });
  }, []);

  const refreshMockups = useCallback(async (logoId) => {
    if (!api || !logoId) return;
    const r = await api.getMockups(logoId);
    if (isAuthFailure(r)) { signInAgain(); return; }
    if (!r || !r.ok || !Array.isArray(r.mockups)) return;
    setSession((s) => (s.logo && s.logo.logoId === logoId
      ? { mockups: Object.fromEntries(r.mockups.map((m) => [m.syncVariantId, m])) }
      : {}));
  }, [api, signInAgain]);

  // Poll while any mockup is still being prepared (browsing never waits on it).
  useEffect(() => {
    if (!enabled || !state.logo) return undefined;
    const pending = Object.values(state.mockups).some((m) => m.status === 'preparing' || m.status === 'queued');
    if (Object.keys(state.mockups).length && !pending) return undefined;
    if (polls.current >= MAX_POLLS) return undefined;
    const t = setTimeout(() => { polls.current += 1; refreshMockups(state.logo.logoId); }, Object.keys(state.mockups).length ? POLL_MS : 0);
    return () => clearTimeout(t);
  }, [enabled, state.logo, state.mockups, refreshMockups]);

  const applyFile = useCallback(async (file, opts = {}) => {
    if (!api) return { ok: false };
    setBusy(true); setError(null);
    try {
      const current = session.logo;
      const remember = { remember: opts.remember === true };
      const r = current ? await api.replaceLogo(current.logoId, file, remember) : await api.uploadLogo(file, remember);
      if (isAuthFailure(r)) { signInAgain(); return { ok: false }; }
      if (!r || !r.ok) { setError((r && r.error) || S.uploadFailed); return { ok: false }; }
      const cfg = session.config || (await api.getConfig().catch(() => null));
      polls.current = 0;
      setSession({ logo: r.logo, previewSrc: toPreviewSrc(file), catalog: r.catalog || [], mockups: {}, approvals: {}, config: cfg && cfg.ok ? cfg : session.config });
      setStep(null);
      return { ok: true };
    } finally {
      setBusy(false);
    }
  }, [api, signInAgain]);

  // 153E: which products the founder designated (fresh each time the step opens). Fail closed: any
  // failure counts as "none".
  const openBrandingStep = useCallback(async () => {
    if (!enabled) return;
    setError(null);
    if (!signedIn) { setStep({ type: 'signin', expired: false }); return; }
    let r = null;
    try { r = api ? await api.getEligibility() : null; } catch { r = null; }
    if (isAuthFailure(r)) { signInAgain(); return; }
    const eligible = r && r.ok && Array.isArray(r.eligible) ? r.eligible : [];
    setStep(eligible.length ? { type: 'logo' } : { type: 'none-eligible' });
  }, [enabled, signedIn, api, signInAgain]);

  // "Remember my logo": the saved logo offered in the logo step (null = none / not loaded).
  const [saved, setSaved] = useState(null);
  const loadSavedLogo = useCallback(async () => {
    if (!api || typeof api.getSavedLogo !== 'function') return;
    let r = null;
    try { r = await api.getSavedLogo(); } catch { r = null; }
    if (isAuthFailure(r)) { signInAgain(); return; }
    setSaved(r && r.ok && r.logo ? r : null);
  }, [api, signInAgain]);
  const applySavedLogo = useCallback(async () => {
    if (!saved || !api) return;
    const cfg = session.config || (await api.getConfig().catch(() => null));
    polls.current = 0;
    setSession({ logo: saved.logo, previewSrc: saved.previewUrl || null, catalog: saved.catalog || [], mockups: {}, approvals: {}, config: cfg && cfg.ok ? cfg : session.config });
    setStep(null);
  }, [api, saved]);
  const deleteSavedLogo = useCallback(async () => {
    if (!saved || !api) return;
    const id = saved.logo.logoId;
    setSaved(null);
    if (session.logo && session.logo.logoId === id) setSession(initial());
    await api.clearLogo(id, { forget: true });
  }, [api, saved]);

  const clear = useCallback(async () => {
    if (!api || !session.logo) return;
    const id = session.logo.logoId;
    setSession(initial());
    setStep(null);
    await api.clearLogo(id);
  }, [api]);

  const catalogById = useMemo(() => Object.fromEntries((state.catalog || []).map((p) => [String(p.syncProductId), p])), [state.catalog]);

  /** What a catalog card shows while branding is applied. null = unchanged card. */
  const cardBranding = useCallback((card) => {
    if (!enabled || !state.logo || !card || card.source !== 'catalog') return null;
    const entry = catalogById[String(card.id)];
    if (!entry) return null; // 153E: not founder-designated — the card is exactly as it is today
    if (!entry.supported) return { label: S.cardUnsupported, tone: 'muted' };
    const v0 = entry.variants.find((v) => v.supported) || null;
    if (!v0) return { label: S.cardUnsupported, tone: 'muted' };
    const open = () => setStep({ type: 'preview', syncProductId: entry.syncProductId, syncVariantId: v0.syncVariantId });
    if (!v0.ok) return { label: S.cardNeedsLarger, tone: 'warn', onOpen: open };
    const m = state.mockups[v0.syncVariantId];
    if (m && m.status === 'ready' && m.mockupUrl) return { label: S.cardYourLogo, tone: 'brand', imageUrl: m.mockupUrl, onOpen: open };
    if (m && m.status === 'unavailable') return { label: S.cardUnavailable, tone: 'warn', onOpen: () => refreshMockups(state.logo.logoId) };
    return { label: S.cardPreparing, tone: 'pending', onOpen: open };
  }, [enabled, state.logo, state.mockups, catalogById, refreshMockups]);

  /**
   * 153E: while a logo is applied, the Brandable Goods view shows ONLY the founder-designated products
   * (the ones in the branded catalog). Every other view, and every view with no logo, is unchanged.
   */
  const assortmentCards = useCallback((cards, inBrandableView) => {
    if (!enabled || !state.logo || !inBrandableView || !Array.isArray(cards)) return cards;
    return cards.filter((c) => c && c.source === 'catalog' && catalogById[String(c.id)]);
  }, [enabled, state.logo, catalogById]);

  /**
   * Called before a catalog variant is added to the cart. With branding applied and the product
   * supported, the artwork-approval step opens instead (returns true). Otherwise returns false and
   * the existing add-to-cart runs unchanged.
   */
  const interceptVariant = useCallback((product, variant) => {
    if (!enabled || !session.logo || !product || !variant) return false;
    const entry = catalogById[String(product.syncProductId)];
    if (!entry || !entry.supported) return false;
    // 153I: an approved variant goes straight to the existing add-to-cart, carrying its approval.
    if (approvalFor(variant.syncVariantId)) return false;
    setStep({ type: 'approval', syncProductId: entry.syncProductId, syncVariantId: Number(variant.syncVariantId) });
    return true;
  }, [enabled, catalogById]);

  /**
   * 153I — artwork approval inside the existing purchase journey. Asks the server to sign the approval
   * (it re-checks rights, the real mockup, the placement and the designation); on success the approval
   * is kept for this variant and the EXISTING add-to-cart (Merch.jsx addVariantToCart) is run again.
   */
  const approve = useCallback(async ({ product, variant, rightsAccepted, onApproved }) => {
    if (!api || !session.logo || !product || !variant) return { ok: false };
    setBusy(true); setError(null);
    try {
      const r = await api.approve({
        logoId: session.logo.logoId,
        syncVariantId: Number(variant.syncVariantId),
        rightsAccepted: rightsAccepted === true,
        rightsWordingVersion: session.config && session.config.rightsWording ? session.config.rightsWording.version : null,
      });
      if (isAuthFailure(r)) { signInAgain(); return { ok: false }; }
      if (!r || !r.ok || !r.approvalToken) { setError((r && r.error) || S.approveFailed); return { ok: false }; }
      const m = session.mockups[Number(variant.syncVariantId)];
      setSession((s) => ({ approvals: { ...s.approvals, [Number(variant.syncVariantId)]: { approvalToken: r.approvalToken, logoId: s.logo.logoId, mockupUrl: m && m.mockupUrl ? m.mockupUrl : null } } }));
      setStep(null);
      if (typeof onApproved === 'function') onApproved(product, variant);
      return { ok: true };
    } finally {
      setBusy(false);
    }
  }, [api, signInAgain]);

  /** The extra fields an approved variant's cart line carries (null = an ordinary line). */
  const cartFields = useCallback((product, variant) => {
    const a = approvalFor(variant && variant.syncVariantId);
    if (!enabled || !a || !product) return null;
    return {
      // The cart/checkout row keeps the EXISTING name (a longer name clips the existing phone cart row);
      // "with your logo" rides the existing small category line instead (display only).
      item: { branding: { approvalToken: a.approvalToken, logoId: a.logoId }, category: `Merch · ${S.cartWithLogo}` },
      confirmationName: `${product.name} — ${variant.label} · ${S.cartWithLogo}`,
      imageUrl: a.mockupUrl,
    };
  }, [enabled]);

  return {
    enabled,
    logo: enabled ? state.logo : null,
    previewSrc: enabled ? state.previewSrc : null,
    config: state.config,
    catalogById,
    mockups: state.mockups,
    step: enabled ? step : null,
    busy,
    error,
    setStep: enabled ? setStep : () => {},
    openBrandingStep,
    assortmentCards,
    applyFile,
    clear,
    saved,
    loadSavedLogo,
    applySavedLogo,
    deleteSavedLogo,
    cardBranding,
    interceptVariant,
    approve,
    cartFields,
    refreshMockups,
    api,
  };
}
