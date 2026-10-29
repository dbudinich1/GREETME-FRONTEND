// src/features/merchBranding/MerchBrandingLayer.jsx
// REPORT 153 — the branded catalog's dialogs: the focused logo-upload step, the placement view and the
// artwork approval inside the existing purchase journey. Rendered by Merch.jsx ONLY when the feature
// switch is on; renders nothing otherwise.
//
// No designer controls (founder D6): Replace logo and Clear branding are the only controls. The
// "Placement proposal" is a drawing of the product's real print area with the logo at its stored
// position — explicitly NOT a photo of the product. The "Product preview" is Printful's own mockup.

import { useEffect, useRef, useState } from 'react';
import { BRANDING_STRINGS as S } from './brandingStrings.js';
import { SPECS } from './brandingApi.js';

// The branded cart line is not wired into checkout yet (Checkout.jsx / paymentRoutes.js are shared files;
// Team 6 merges). Until it is, approval can never add a branded item to the cart. Q1 (prices) is also open.
export const BRANDED_CHECKOUT_CONNECTED = false;

const overlay = { position: 'fixed', inset: 0, background: 'rgba(17,12,30,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', boxSizing: 'border-box' };
const panel = { background: '#fff', borderRadius: '1rem', width: '100%', maxWidth: 560, maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto', boxShadow: '0 24px 48px -16px rgba(44,29,70,.45)', boxSizing: 'border-box', fontFamily: 'inherit', color: '#2C1D46' };
const btnPrimary = { padding: '0.625rem 1.1rem', borderRadius: '9999px', border: 'none', background: '#2C1D46', color: '#fff', fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit', cursor: 'pointer' };
const btnGhost = { padding: '0.625rem 1.1rem', borderRadius: '9999px', border: '1px solid #d9d0e6', background: '#fff', color: '#2C1D46', fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit', cursor: 'pointer' };

function Dialog({ title, onClose, children, testId }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div style={overlay} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} data-testid={testId} style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '1.125rem 1.25rem 0.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontFamily: '"Playfair Display", Georgia, serif', fontSize: '1.25rem', lineHeight: 1.25 }}>{title}</h2>
          <button type="button" aria-label={S.close} onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.375rem', lineHeight: 1, cursor: 'pointer', color: '#6B6079', padding: '0.125rem 0.25rem', minHeight: 0 }}>×</button>
        </div>
        <div style={{ padding: '0.25rem 1.25rem 1.25rem' }}>{children}</div>
      </div>
    </div>
  );
}

function LogoStep({ branding }) {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const close = () => branding.setStep(null);
  return (
    <Dialog title={S.stepTitle} onClose={close} testId="branding-logo-step">
      <p style={{ margin: '0 0 1rem', fontSize: '0.9375rem', lineHeight: 1.5, color: '#4b4060' }}>{S.stepIntro}</p>
      <label data-testid="branding-file-drop" style={{ display: 'block', border: '2px dashed #cfc3e2', borderRadius: '0.875rem', padding: '1.25rem', textAlign: 'center', cursor: 'pointer', background: '#faf8fd' }}>
        <input ref={input} data-testid="branding-file-input" type="file" accept="image/png,image/jpeg" style={{ display: 'none' }}
          onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.9375rem' }}>{file ? file.name : S.chooseFile}</span>
        <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.8125rem', color: '#6B6079' }}>{S.fileHint}</span>
      </label>
      {branding.error ? <p role="alert" data-testid="branding-error" style={{ margin: '0.75rem 0 0', color: '#b4232f', fontSize: '0.875rem', fontWeight: 600 }}>{branding.error}</p> : null}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <button type="button" style={btnGhost} onClick={close}>{S.cancel}</button>
        <button type="button" data-testid="branding-apply" style={{ ...btnPrimary, opacity: file && !branding.busy ? 1 : 0.5, cursor: file && !branding.busy ? 'pointer' : 'not-allowed' }}
          disabled={!file || branding.busy} onClick={() => branding.applyFile(file)}>{branding.busy ? S.uploading : S.applyLogo}</button>
      </div>
    </Dialog>
  );
}

/** The local placement proposal: the product's print area (to scale) with the logo at its stored position. */
export function PlacementProposal({ variantSpec, position, logoSrc, productKey }) {
  if (!position || !variantSpec) return null;
  const { area_width: W, area_height: H } = position;
  const b = variantSpec.box;
  const stroke = Math.max(W, H) / 220;
  return (
    <figure style={{ margin: 0 }} data-testid="branding-placement-proposal">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={S.placementProposal} style={{ width: '100%', height: 'auto', display: 'block', background: '#f4f1f8', borderRadius: '0.5rem' }}>
        <rect x={stroke / 2} y={stroke / 2} width={W - stroke} height={H - stroke} fill="#ffffff" stroke="#9a8db0" strokeWidth={stroke} />
        {productKey === 'mug' ? <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="#cfc3e2" strokeWidth={stroke} strokeDasharray={`${stroke * 4} ${stroke * 3}`} /> : null}
        {b ? <rect x={b.left * W} y={b.top * H} width={b.width * W} height={b.height * H} fill="none" stroke="#b4232f" strokeWidth={stroke} strokeDasharray={`${stroke * 5} ${stroke * 3}`} /> : null}
        {logoSrc ? <image href={logoSrc} x={position.left} y={position.top} width={position.width} height={position.height} preserveAspectRatio="xMidYMid meet" /> : <rect x={position.left} y={position.top} width={position.width} height={position.height} fill="#2C1D46" opacity="0.15" />}
      </svg>
    </figure>
  );
}

function PlacementOrApproval({ branding, products, mode }) {
  const { syncProductId, syncVariantId } = branding.step;
  const entry = branding.catalogById[String(syncProductId)];
  const spec = SPECS[String(syncProductId)];
  const product = (products || []).find((p) => String(p.syncProductId) === String(syncProductId));
  const [variantId, setVariantId] = useState(syncVariantId);
  const [rights, setRights] = useState(false);
  if (!entry || !spec) return null;
  const v = entry.variants.find((x) => x.syncVariantId === Number(variantId)) || entry.variants[0];
  const vSpec = spec.variants[String(v.syncVariantId)];
  const m = branding.mockups[v.syncVariantId];
  const ready = m && m.status === 'ready' && m.mockupUrl;
  const name = product ? product.name : 'This product';
  const close = () => branding.setStep(null);
  const approvalBlocked = !BRANDED_CHECKOUT_CONNECTED || !ready || !v.ok || !rights;
  const wording = branding.config && branding.config.rightsWording ? branding.config.rightsWording.text : null;
  const variantLabel = (id) => {
    const pv = product && Array.isArray(product.variants) ? product.variants.find((x) => String(x.syncVariantId) === String(id)) : null;
    return pv ? pv.label : String(id);
  };

  return (
    <Dialog title={mode === 'approval' ? S.approveTitle : S.placementTitle(name)} onClose={close} testId={mode === 'approval' ? 'branding-approval' : 'branding-placement'}>
      {mode === 'approval' ? <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#4b4060' }}>{name} — {variantLabel(v.syncVariantId)}. {S.approveIntro}</p> : null}
      {mode !== 'approval' && entry.variants.length > 1 ? (
        <div role="group" style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {entry.variants.map((x) => (
            <button key={x.syncVariantId} type="button" onClick={() => setVariantId(x.syncVariantId)} aria-pressed={x.syncVariantId === v.syncVariantId}
              style={{ ...btnGhost, padding: '0.3125rem 0.75rem', fontSize: '0.8125rem', background: x.syncVariantId === v.syncVariantId ? '#2C1D46' : '#fff', color: x.syncVariantId === v.syncVariantId ? '#fff' : '#2C1D46' }}>{variantLabel(x.syncVariantId)}</button>
          ))}
        </div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <section>
          <h3 style={{ margin: '0 0 0.375rem', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6079' }}>{S.productPreview}</h3>
          {ready
            ? <img data-testid="branding-mockup" src={m.mockupUrl} alt={`${name} with your logo`} style={{ width: '100%', display: 'block', borderRadius: '0.5rem', background: '#f8fafc' }} />
            : <div data-testid="branding-mockup-pending" style={{ aspectRatio: '1 / 1', borderRadius: '0.5rem', background: '#f4f1f8', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '1rem', fontSize: '0.8125rem', color: '#6B6079' }}>
                {m && m.status === 'unavailable'
                  ? <span>{S.previewUnavailable} <button type="button" onClick={() => branding.refreshMockups(branding.logo.logoId)} style={{ border: 'none', background: 'none', color: '#2C1D46', textDecoration: 'underline', fontWeight: 700, cursor: 'pointer', padding: 0, font: 'inherit' }}>{S.tryAgain}</button></span>
                  : S.previewPreparing}
              </div>}
        </section>
        <section>
          <h3 style={{ margin: '0 0 0.375rem', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6079' }}>{S.placementProposal}</h3>
          <PlacementProposal variantSpec={vSpec} position={v.position} logoSrc={branding.previewSrc} productKey={entry.productKey} />
          <p style={{ margin: '0.375rem 0 0', fontSize: '0.75rem', lineHeight: 1.4, color: '#6B6079' }}>{S.proposalCaption}</p>
        </section>
      </div>
      {v.printedInches ? <p data-testid="branding-printed-size" style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', fontWeight: 600 }}>{S.printedSize(v.printedInches.width, v.printedInches.height)}</p> : null}
      {!v.ok ? <p role="alert" data-testid="branding-unsuitable" style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#b4232f', fontWeight: 600 }}>{v.problems.map((p) => p.message).join(' ')}</p> : null}
      {mode === 'approval' ? (
        <>
          {wording ? (
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginTop: '0.875rem', fontSize: '0.8125rem', lineHeight: 1.45, color: '#4b4060' }}>
              <input type="checkbox" data-testid="branding-rights" checked={rights} onChange={(e) => setRights(e.target.checked)} style={{ marginTop: '0.2rem', width: 16, height: 16, minHeight: 0, flex: 'none', padding: 0 }} />
              <span>{wording}</span>
            </label>
          ) : null}
          {!BRANDED_CHECKOUT_CONNECTED ? <p data-testid="branding-not-open" style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: '#b45309', fontWeight: 600 }}>{S.notOpenYet}</p>
            : !ready ? <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: '#b45309', fontWeight: 600 }}>{S.waitForPreview}</p> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button type="button" style={btnGhost} onClick={close}>{S.backToProducts}</button>
            <button type="button" data-testid="branding-approve" disabled={approvalBlocked} style={{ ...btnPrimary, opacity: approvalBlocked ? 0.5 : 1, cursor: approvalBlocked ? 'not-allowed' : 'pointer' }}>{S.approveButton}</button>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

export default function MerchBrandingLayer({ branding, products }) {
  if (!branding || !branding.enabled || !branding.step) return null;
  if (branding.step.type === 'logo') return <LogoStep branding={branding} />;
  if (branding.step.type === 'preview') return <PlacementOrApproval key={`p-${branding.step.syncProductId}`} branding={branding} products={products} mode="preview" />;
  if (branding.step.type === 'approval') return <PlacementOrApproval key={`a-${branding.step.syncVariantId}`} branding={branding} products={products} mode="approval" />;
  return null;
}

/** Replace logo / Clear branding — the only two controls (no designer controls). */
export function BrandingControls({ branding, isNarrow }) {
  if (!branding || !branding.enabled || !branding.logo) return null;
  const link = { border: 'none', background: 'none', padding: 0, minHeight: 0, color: '#1e3a8a', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'inherit', textDecoration: 'underline', cursor: 'pointer', whiteSpace: 'nowrap' };
  return (
    <div data-testid="branding-controls" style={{ flex: '1 1 100%', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.375rem 0.75rem', margin: isNarrow ? '0.375rem 0 0.5rem' : '0 0 0.625rem', fontSize: '0.75rem', color: '#2C1D46' }}>
      {branding.previewSrc ? <img src={branding.previewSrc} alt="" style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 4, background: '#fff', border: '1px solid #e7e0f0' }} /> : null}
      <span style={{ fontWeight: 600 }}>{S.logoApplied}</span>
      <button type="button" data-testid="branding-replace" style={link} onClick={branding.openBrandingStep}>{S.replaceLogo}</button>
      <button type="button" data-testid="branding-clear" style={link} onClick={branding.clear}>{S.clearBranding}</button>
    </div>
  );
}
