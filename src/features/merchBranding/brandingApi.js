// src/features/merchBranding/brandingApi.js
// REPORT 153 — the feature's API seam. Two implementations with one interface:
//   createHttpBrandingApi()     — /api/merch/branding/* on Greet-Me's own server (never Printful directly);
//   createInMemoryBrandingApi() — the double used by tests and the local preview.
// Nothing here runs while the feature switch is off: the hook never calls it.

import GOLDEN from './placementGolden.json';
import { computePlacement } from './placementEngine.js';

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || '';

function authHeaders() {
  let token = null;
  try { token = localStorage.getItem('token'); } catch { /* storage blocked */ }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function call(path, init = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/merch/branding${path}`, { ...init, headers: { ...authHeaders(), ...(init.headers || {}) } });
  } catch {
    return { ok: false, status: 0 };
  }
  let data = {};
  try { data = await res.json(); } catch { /* no body */ }
  return { ...data, ok: res.ok && data.ok !== false, status: res.status };
}

export function createHttpBrandingApi() {
  const send = (path, file) => {
    const fd = new FormData();
    fd.append('logo', file);
    return call(path, { method: 'POST', body: fd }); // no Content-Type: the browser sets the boundary
  };
  return {
    kind: 'http',
    getConfig: () => call('/config'),
    getEligibility: () => call('/eligibility'),
    uploadLogo: (file) => send('/logo', file),
    replaceLogo: (logoId, file) => send(`/logo/${encodeURIComponent(logoId)}/replace`, file),
    clearLogo: (logoId) => call(`/logo/${encodeURIComponent(logoId)}`, { method: 'DELETE' }),
    getMockups: (logoId) => call(`/logo/${encodeURIComponent(logoId)}/mockups`),
    approve: (body) => call('/approvals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  };
}

const RIGHTS = Object.freeze({
  version: 'proposed-2026-10-29',
  approved: false,
  text: 'I confirm I own this logo or have permission to use it on these products, and that it doesn’t infringe anyone’s trademark or other rights. Greet-Me may cancel and refund an order whose artwork breaches this.',
});

const SUBJECT = { notebook: 'This notebook', laptop_sleeve: 'This laptop sleeve', mug: 'This mug', canvas: 'This canvas' };
const fmt = (n) => Number(n).toLocaleString('en-US');

/**
 * The branded catalog the server would return, computed from the shared golden specs.
 * 153E: only founder-designated products (`eligible`, syncProductIds) appear — default none.
 */
export function catalogFromSpecs(logo, specs = GOLDEN.specs, eligible = []) {
  return Object.entries(specs).filter(([syncProductId]) => eligible.map(Number).includes(Number(syncProductId))).map(([syncProductId, p]) => ({
    syncProductId: Number(syncProductId),
    supported: true,
    productKey: p.productKey,
    variants: Object.entries(p.variants).map(([syncVariantId, v]) => {
      const r = computePlacement({ area: v.area, box: v.box, requiredDpi: v.requiredDpi }, logo);
      return {
        syncVariantId: Number(syncVariantId),
        supported: true,
        placement: v.placement,
        position: r.position,
        printedInches: r.printedInches,
        ok: r.ok,
        problems: r.problemCodes.map((code) => ({
          code,
          message: code === 'RESOLUTION_TOO_LOW'
            ? `${SUBJECT[p.productKey] || 'This product'} needs a logo at least ${fmt(r.minLogoPx.width)} px wide for a sharp print; yours is ${fmt(logo.widthPx)} px. Upload a larger PNG or JPG.`
            : code,
        })),
        specConfirmed: v.confirmed === true,
        placementApproved: false,
      };
    }),
  }));
}

/**
 * The double. `measure(file)` returns the logo's pixel size (the server reads it from the bytes);
 * `mockupFor(syncVariantId)` returns a mockup image URL or null ("preparing"); `failFor` lists
 * variants whose mockup is "unavailable".
 */
export function createInMemoryBrandingApi({ measure, mockupFor = () => null, failFor = [], specs = GOLDEN.specs, eligible = () => [] } = {}) {
  const eligibleNow = () => (typeof eligible === 'function' ? eligible() : eligible) || [];
  const logos = new Map();
  const calls = [];
  let n = 0;
  const accept = async (file) => {
    const type = file && file.type;
    if (type === 'image/svg+xml') return { ok: false, status: 400, code: 'LOGO_SVG_NOT_ACCEPTED', error: 'SVG logos aren’t accepted yet. Upload a PNG or JPG version of your logo.' };
    if (type !== 'image/png' && type !== 'image/jpeg') return { ok: false, status: 400, code: 'LOGO_WRONG_TYPE', error: 'Upload your logo as a PNG or JPG file.' };
    if (file.size > 10 * 1024 * 1024) return { ok: false, status: 400, code: 'LOGO_TOO_LARGE', error: 'This file is larger than 10 MB. Upload a smaller PNG or JPG.' };
    const dims = measure ? await measure(file) : { widthPx: 1000, heightPx: 1000 };
    n += 1;
    const logo = { logoId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, type, ...dims, bytes: file.size };
    logos.set(logo.logoId, logo);
    return { ok: true, status: 201, logo, catalog: catalogFromSpecs(logo, specs, eligibleNow()) };
  };
  return {
    kind: 'memory',
    calls,
    async getEligibility() { calls.push('getEligibility'); return { ok: true, eligible: eligibleNow().map(Number).filter((id) => specs[String(id)]) }; },
    async getConfig() { calls.push('getConfig'); return { ok: true, acceptedTypes: ['image/png', 'image/jpeg'], maxBytes: 10 * 1024 * 1024, rightsWording: RIGHTS }; },
    async uploadLogo(file) { calls.push('uploadLogo'); return accept(file); },
    async replaceLogo(logoId, file) {
      calls.push('replaceLogo');
      const r = await accept(file);
      if (r.ok) logos.delete(logoId);
      return r.ok ? { ...r, replaced: logoId } : r;
    },
    async clearLogo(logoId) { calls.push('clearLogo'); const had = logos.delete(logoId); return had ? { ok: true, cleared: true } : { ok: false, status: 404 }; },
    async getMockups(logoId) {
      calls.push('getMockups');
      if (!logos.has(logoId)) return { ok: false, status: 404 };
      const ids = Object.entries(specs).filter(([pid]) => eligibleNow().map(Number).includes(Number(pid))).flatMap(([, p]) => Object.keys(p.variants)).map(Number);
      return { ok: true, mockups: ids.map((id) => (failFor.includes(id) ? { syncVariantId: id, status: 'unavailable' } : mockupFor(id) ? { syncVariantId: id, status: 'ready', mockupUrl: mockupFor(id) } : { syncVariantId: id, status: 'preparing' })) };
    },
    async approve() { calls.push('approve'); return { ok: false, status: 409, code: 'BRANDING_PLACEMENT_NOT_APPROVED', error: 'This product’s logo placement hasn’t been approved yet.' }; },
    _logos: logos,
  };
}

export const SPECS = GOLDEN.specs;
