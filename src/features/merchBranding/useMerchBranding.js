// src/features/merchBranding/useMerchBranding.js
// REPORT 153 — branding state for the Gift Place.
//
// While `enabled` is false (the switch is off) the hook is INERT: no API call, no state change, and
// every helper returns the "do nothing" answer, so Merch.jsx behaves exactly as before.
//
// The applied logo lives in a module-level session store, so it is RETAINED while the customer browses
// categories and opens products (Merch remounts keep it). Clear branding removes it here and on the
// server (retention default: "kept only while in use; Clear deletes" — Q3 open).

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { getBrandingApi } from './brandingApiProvider.js';
import { BRANDING_STRINGS as S } from './brandingStrings.js';

const POLL_MS = 15000;
const MAX_POLLS = 12;

const initial = () => ({ logo: null, previewSrc: null, catalog: [], mockups: {}, config: null });
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

export function useMerchBranding({ enabled = false, api: apiOverride = null } = {}) {
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

  const refreshMockups = useCallback(async (logoId) => {
    if (!api || !logoId) return;
    const r = await api.getMockups(logoId);
    if (!r || !r.ok || !Array.isArray(r.mockups)) return;
    setSession((s) => (s.logo && s.logo.logoId === logoId
      ? { mockups: Object.fromEntries(r.mockups.map((m) => [m.syncVariantId, m])) }
      : {}));
  }, [api]);

  // Poll while any mockup is still being prepared (browsing never waits on it).
  useEffect(() => {
    if (!enabled || !state.logo) return undefined;
    const pending = Object.values(state.mockups).some((m) => m.status === 'preparing' || m.status === 'queued');
    if (Object.keys(state.mockups).length && !pending) return undefined;
    if (polls.current >= MAX_POLLS) return undefined;
    const t = setTimeout(() => { polls.current += 1; refreshMockups(state.logo.logoId); }, Object.keys(state.mockups).length ? POLL_MS : 0);
    return () => clearTimeout(t);
  }, [enabled, state.logo, state.mockups, refreshMockups]);

  const applyFile = useCallback(async (file) => {
    if (!api) return { ok: false };
    setBusy(true); setError(null);
    try {
      const current = session.logo;
      const r = current ? await api.replaceLogo(current.logoId, file) : await api.uploadLogo(file);
      if (!r || !r.ok) { setError((r && r.error) || S.uploadFailed); return { ok: false }; }
      const cfg = session.config || (await api.getConfig().catch(() => null));
      polls.current = 0;
      setSession({ logo: r.logo, previewSrc: toPreviewSrc(file), catalog: r.catalog || [], mockups: {}, config: cfg && cfg.ok ? cfg : session.config });
      setStep(null);
      return { ok: true };
    } finally {
      setBusy(false);
    }
  }, [api]);

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
    if (!entry || !entry.supported) return { label: S.cardUnsupported, tone: 'muted' };
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
   * Called before a catalog variant is added to the cart. With branding applied and the product
   * supported, the artwork-approval step opens instead (returns true). Otherwise returns false and
   * the existing add-to-cart runs unchanged.
   */
  const interceptVariant = useCallback((product, variant) => {
    if (!enabled || !session.logo || !product || !variant) return false;
    const entry = catalogById[String(product.syncProductId)];
    if (!entry || !entry.supported) return false;
    setStep({ type: 'approval', syncProductId: entry.syncProductId, syncVariantId: Number(variant.syncVariantId) });
    return true;
  }, [enabled, catalogById]);

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
    openBrandingStep: () => { if (enabled) { setError(null); setStep({ type: 'logo' }); } },
    applyFile,
    clear,
    cardBranding,
    interceptVariant,
    refreshMockups,
    api,
  };
}
