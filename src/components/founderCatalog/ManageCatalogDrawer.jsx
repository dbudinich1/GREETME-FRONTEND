// src/components/founderCatalog/ManageCatalogDrawer.jsx
//
// CHECKPOINT 2 — the founder-only Manage Catalog drawer.
//
// It opens OVER /dashboard/gifts. There is no second route, no second page and no second
// marketplace: the customer surface underneath is untouched and keeps rendering exactly as it did.
//
// WHAT IT IS NOT
//   • Not authorization. Visibility is cosmetic; the backend 403s a non-founder on every call.
//   • Not a vendor client. It contacts the Greet-Me backend only, and it does not even REQUEST a
//     dormant provider — a disabled provider is presented as disabled, not as an empty result,
//     because an empty list would imply a vendor was asked and had nothing.
//   • Not a bulk tool. One product becomes one draft, through one explicit action.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Lock, AlertTriangle, Plus, Check } from 'lucide-react';
import founderCatalogApi from '../../api/founderCatalog';
import {
  CATEGORY_LABELS, REFUSAL_COPY, SECTIONS, STORABLE_CATEGORY_IDS, toggleCategoryId,
  lifecycleBadge, formatMoney, previewImageUrl,
  emptyProductForm, validateProductForm, buildProductPayload,
} from './catalogDrawerModel';
import MerchCurationSection from './MerchCurationSection.jsx';
import MerchStagingSection from './MerchStagingSection.jsx';

// Re-exported so the component remains the single import site for callers that already have it.
export { STORABLE_CATEGORY_IDS, CATEGORY_LABELS, SECTIONS };

// What each lifecycle action DID, in the founder's words. A confirmation that only said "done"
// would leave the most important question — is it visible to customers now? — unanswered.
const LIFECYCLE_DONE = Object.freeze({
  publish: 'published and visible to customers',
  unpublish: 'unpublished and hidden from customers',
  retire: 'retired and removed from the catalog',
  reactivate: 'reactivated as a draft, still hidden from customers',
});

const BADGE_TONE = Object.freeze({
  draft: { bg: '#fffbeb', border: '#f59e0b', color: '#92400e' },
  published: { bg: '#ecfdf5', border: '#10b981', color: '#065f46' },
  live: { bg: '#ecfdf5', border: '#10b981', color: '#065f46' },
  warn: { bg: '#fff7ed', border: '#fb923c', color: '#9a3412' },
  muted: { bg: 'var(--bg-secondary, #f3f4f6)', border: 'var(--border)', color: 'var(--text-tertiary)' },
});

const field = {
  width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.625rem', marginTop: '0.25rem',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontFamily: 'inherit', fontSize: '0.875rem',
};
const fieldLabel = { display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' };
const fieldError = { margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600 };

const panel = {
  position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1000,
  width: 'min(560px, 100%)', maxWidth: '100%', boxSizing: 'border-box',
  background: 'var(--bg-primary)', borderLeft: '1px solid var(--border)',
  boxShadow: '-8px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column',
};

export default function ManageCatalogDrawer({ open, onClose, client = founderCatalogApi }) {
  const [section, setSection] = useState('draft');
  const [items, setItems] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [query, setQuery] = useState('');
  const [success, setSuccess] = useState(null);

  // ADD-PRODUCT FORM (Founder addendum 2026-09-21). One product, one record: the same single-item
  // create the API already exposes, given a form instead of a curl command. It adds no capability.
  const [form, setForm] = useState(null);          // null = closed
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const isProviders = section === 'providers';
  const isMerch = section === 'merch';
  const [merchDirty, setMerchDirty] = useState(false);
  const [stagingDirty, setStagingDirty] = useState(false);


  // Unsaved merch edits must not vanish silently on close or a section switch. The guard is a
  // confirm rather than a block: the founder stays in control, but is never surprised.
  const confirmDiscard = () => !(merchDirty || stagingDirty)
    || (typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm('You have unsaved merch changes. Discard them?') : true);
  const guardedClose = () => { if (confirmDiscard()) { setMerchDirty(false); onClose(); } };
  const guardedSection = (id) => { if (id === section || confirmDiscard()) { setMerchDirty(false); setSection(id); } };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isMerch) { return; }
      if (isProviders) {
        const res = await client.listProviders();
        setProviders(res?.providers || []);
      } else {
        const res = await client.listItems({ state: section, q: query || undefined });
        setItems(res?.items || []);
      }
    } catch (e) {
      setError(e?.message || 'Could not load the catalog.');
    } finally {
      setLoading(false);
    }
  }, [client, section, query, isProviders, isMerch]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const openForm = async () => {
    setNotice(null); setSuccess(null); setFormErrors({});
    setForm(emptyProductForm());
    // The provider list supplies the DISPLAY LABEL for the fixed source; fetched only when the
    // form is opened, so an ordinary section switch still costs one call rather than two.
    if (providers.length === 0) {
      try { const res = await client.listProviders(); setProviders(res?.providers || []); } catch { /* the label falls back to the identifier */ }
    }
  };
  const closeForm = () => { setForm(null); setFormErrors({}); };
  const editForm = (patch) => setForm((f) => ({ ...f, ...patch }));

  const saveNewProduct = async () => {
    const verdict = validateProductForm(form);
    setFormErrors(verdict.errors);
    if (!verdict.ok) return;
    setSaving(true); setNotice(null); setSuccess(null);
    try {
      const res = await client.createDraft(buildProductPayload(form));
      closeForm();
      // A new record is always a DRAFT, so the founder is taken to where it actually is.
      setSuccess(`Saved “${res?.item?.display?.title || form.title}” as a draft. Customers cannot see it.`);
      setSection('draft');
      await load();
    } catch (e) {
      const code = e?.body?.error || e?.error || e?.message;
      setNotice(REFUSAL_COPY[code] || `Could not save: ${code || 'unknown reason'}`);
    } finally {
      setSaving(false);
    }
  };

  const applyPatch = async (item, patch) => {
    setNotice(null);
    try {
      const res = await client.patchItem(item.internal.vendor, item.id, patch, item.etag);
      setItems((prev) => prev.map((i) => (i.id === item.id ? res.item : i)));
    } catch {
      // A 409 is not a failure to retry blindly — the record moved, and the founder's copy is
      // stale. The message says plainly that nothing was overwritten.
      setNotice(REFUSAL_COPY.etag_conflict);
    }
  };

  const runLifecycle = async (item, action) => {
    setNotice(null); setSuccess(null);
    try {
      const res = await client.lifecycle(item.internal.vendor, item.id, action, item.etag);
      setItems((prev) => prev.map((i) => (i.id === item.id ? res.item : i)));
      setSuccess(`${item.display.title} — ${LIFECYCLE_DONE[action] || 'updated'}.`);
      await load();
    } catch (e) {
      const code = e?.body?.error || e?.error || e?.message;
      setNotice(REFUSAL_COPY[code] || `Refused: ${code || 'unknown reason'}`);
    }
  };

  const toggleCategory = (item, categoryId) => {
    // De-duplicated by construction — see toggleCategoryId.
    applyPatch(item, { greetMeCategories: toggleCategoryId(item.curation.greetMeCategories, categoryId) });
  };

  const sectionItems = useMemo(() => items, [items]);

  if (!open) return null;

  return (
    <div data-testid="manage-catalog-drawer" role="dialog" aria-label="Manage Catalog" style={panel}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
      }}>
        <h2 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700 }}>Manage Catalog</h2>
        <button type="button" onClick={guardedClose} aria-label="Close Manage Catalog"
          style={{ padding: 0, width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'transparent', cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </header>

      <nav style={{ display: 'flex', gap: '0.375rem', padding: '0.75rem 1.25rem', overflowX: 'auto', borderBottom: '1px solid var(--border)' }}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => guardedSection(s.id)}
            aria-pressed={section === s.id}
            style={{
              flexShrink: 0, padding: '0.375rem 0.875rem', borderRadius: '9999px',
              border: '1px solid var(--border)',
              background: section === s.id ? 'var(--primary)' : 'transparent',
              color: section === s.id ? 'white' : 'var(--text-secondary)',
              fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {!isProviders && !isMerch && (
        <div style={{ padding: '0.75rem 1.25rem 0', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            data-testid="add-product"
            onClick={() => (form ? closeForm() : openForm())}
            aria-expanded={Boolean(form)}
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.5rem 0.875rem', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--primary)', background: form ? 'transparent' : 'var(--primary)',
              color: form ? 'var(--primary)' : 'white',
              fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <Plus size={14} /> {form ? 'Close' : 'Add Goody Product'}
          </button>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stored records by title…"
            aria-label="Search catalog records"
            style={{ flex: '1 1 12rem', minWidth: 0, boxSizing: 'border-box', padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontFamily: 'inherit' }}
          />
        </div>
      )}

      {success && (
        <p data-testid="drawer-success" role="status" style={{ margin: '0.75rem 1.25rem 0', padding: '0.625rem 0.75rem', border: '1px solid #10b981', borderRadius: 'var(--radius-md)', background: '#ecfdf5', fontSize: '0.8125rem', color: '#065f46' }}>
          <Check size={14} style={{ verticalAlign: '-2px' }} /> {success}
        </p>
      )}

      {notice && (
        <p data-testid="drawer-notice" role="status" style={{ margin: '0.75rem 1.25rem 0', padding: '0.625rem 0.75rem', border: '1px solid #f59e0b', borderRadius: 'var(--radius-md)', background: '#fffbeb', fontSize: '0.8125rem' }}>
          <AlertTriangle size={14} style={{ verticalAlign: '-2px' }} /> {notice}
        </p>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
        {form && (
          <form
            data-testid="add-product-form"
            aria-label="Add a curated product"
            onSubmit={(e) => { e.preventDefault(); saveNewProduct(); }}
            style={{ border: '1px solid var(--primary)', borderRadius: 'var(--radius-lg)', padding: '0.875rem', marginBottom: '1rem' }}
          >
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>Add a curated product</h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              It is saved as a draft. Customers cannot see it until it is published, and publishing
              stays unavailable while its provider is dormant.
            </p>

            {/* The provider is FIXED, not chosen. This control exists to add the launch
                provider's products; offering a picker would imply a choice that is not on offer,
                and would invite a record filed under the wrong source. The label comes from the
                backend's own provider list so it is never a second source of truth. */}
            <p style={fieldLabel}>
              Provider
              <span data-testid="apf-source" data-source={form.source}
                style={{ ...field, display: 'block', background: 'var(--bg-secondary, #f9fafb)', color: 'var(--text-secondary)' }}>
                {providers.find((p) => p.providerId === form.source)?.label || form.source}
              </span>
            </p>
            {formErrors.source && <p data-testid="apf-err-source" style={fieldError}>{formErrors.source}</p>}

            <label style={fieldLabel} htmlFor="apf-external-id">
              Provider product ID
              <input id="apf-external-id" data-testid="apf-external-id" style={field}
                value={form.externalProductId} onChange={(e) => editForm({ externalProductId: e.target.value })}
                placeholder="the id in the provider's own catalog" />
            </label>
            {formErrors.externalProductId && <p data-testid="apf-err-external-id" style={fieldError}>{formErrors.externalProductId}</p>}

            <label style={fieldLabel} htmlFor="apf-title">
              Title
              <input id="apf-title" data-testid="apf-title" style={field}
                value={form.title} onChange={(e) => editForm({ title: e.target.value })} />
            </label>
            {formErrors.title && <p data-testid="apf-err-title" style={fieldError}>{formErrors.title}</p>}

            <label style={fieldLabel} htmlFor="apf-description">
              Description
              <textarea id="apf-description" data-testid="apf-description" rows={2} style={field}
                value={form.description} onChange={(e) => editForm({ description: e.target.value })} />
            </label>

            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
              <label style={{ ...fieldLabel, flex: '1 1 8rem' }} htmlFor="apf-price">
                Price (dollars)
                <input id="apf-price" data-testid="apf-price" inputMode="decimal" style={field}
                  value={form.priceDollars} onChange={(e) => editForm({ priceDollars: e.target.value })}
                  placeholder="78.00" />
              </label>
              <label style={{ ...fieldLabel, flex: '0 1 6rem' }} htmlFor="apf-currency">
                Currency
                <input id="apf-currency" data-testid="apf-currency" maxLength={3} style={field}
                  value={form.currency} onChange={(e) => editForm({ currency: e.target.value })} />
              </label>
            </div>
            {formErrors.priceDollars && <p data-testid="apf-err-price" style={fieldError}>{formErrors.priceDollars}</p>}
            {formErrors.currency && <p data-testid="apf-err-currency" style={fieldError}>{formErrors.currency}</p>}

            <label style={fieldLabel} htmlFor="apf-image">
              Image URL
              <input id="apf-image" data-testid="apf-image" style={field}
                value={form.imageUrl} onChange={(e) => editForm({ imageUrl: e.target.value })}
                placeholder="https://…" />
            </label>
            {formErrors.imageUrl && <p data-testid="apf-err-image" style={fieldError}>{formErrors.imageUrl}</p>}
            {form.imageUrl && !formErrors.imageUrl && (
              <img data-testid="apf-image-preview" src={form.imageUrl} alt="Preview of the product image"
                style={{ marginTop: '0.5rem', width: 96, height: 96, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
            )}

            <label style={fieldLabel} htmlFor="apf-variants">
              Variants <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(comma separated, optional)</span>
              <input id="apf-variants" data-testid="apf-variants" style={field}
                value={form.variants} onChange={(e) => editForm({ variants: e.target.value })}
                placeholder="Dark Roast, Medium Roast" />
            </label>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" data-testid="apf-save" disabled={saving}
                style={{ ...btn('white'), background: 'var(--primary)', borderColor: 'var(--primary)', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save as draft'}
              </button>
              <button type="button" data-testid="apf-cancel" onClick={closeForm} disabled={saving} style={btn('var(--text-secondary)')}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading && <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>Loading…</p>}
        {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

        {isMerch && (
          <MerchCurationSection client={client} onDirtyChange={setMerchDirty} />
        )}

        {/* PHASE 2 — staging a product that is NOT yet in the catalog.
            A SIBLING of the curation section, never inside it. The two do different things:
            the section above curates products that are already on sale and offers no browse,
            no create and no import — an invariant its own suite asserts on that subtree. This
            block prepares a reviewed code change for something that is not on sale at all, and
            keeping it outside `merch-section` is what stops Phase 2 from quietly widening what
            Phase 1 promises about itself. */}
        {isMerch && (
          <div data-testid="merch-staging-block" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle, #e6e1d8)' }}>
            <MerchStagingSection client={client} onDirtyChange={setStagingDirty} />
          </div>
        )}

        {!loading && !error && !isMerch && isProviders && (
          <ul data-testid="provider-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.75rem' }}>
            {providers.map((p) => (
              <li key={p.providerId} data-testid={`provider-${p.providerId}`}
                style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '0.9375rem' }}>{p.label}</strong>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: p.browseAvailable ? 'var(--primary)' : 'var(--text-tertiary)' }}>
                    {p.browseAvailable ? 'Active' : 'Dormant — not activated'}
                  </span>
                </div>
                {!p.browseAvailable && (
                  <>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0.25rem' }}>
                      Browsing this provider becomes available only after it is separately authorized and activated.
                    </p>
                    {p.launchBlockerIds?.length > 0 && (
                      <ul data-testid={`blockers-${p.providerId}`} style={{ margin: '0.25rem 0 0 1rem', padding: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {p.launchBlockerIds.map((b) => <li key={b}>{b}</li>)}
                      </ul>
                    )}
                  </>
                )}
                <button
                  type="button"
                  data-testid={`browse-${p.providerId}`}
                  disabled={!p.browseAvailable}
                  onClick={() => p.browseAvailable && client.browseProvider(p.providerId)}
                  style={{
                    marginTop: '0.75rem', padding: '0.375rem 0.875rem', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)', background: 'transparent',
                    color: p.browseAvailable ? 'var(--primary)' : 'var(--text-tertiary)',
                    cursor: p.browseAvailable ? 'pointer' : 'not-allowed', fontSize: '0.8125rem', fontWeight: 600,
                  }}
                >
                  {p.browseAvailable ? 'Browse products' : <><Lock size={12} style={{ verticalAlign: '-1px' }} /> Browse unavailable</>}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!loading && !error && !isProviders && !isMerch && (
          <ul data-testid="catalog-item-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '1rem' }}>
            {sectionItems.length === 0 && <li style={{ color: 'var(--text-secondary)' }}>No records in this section.</li>}
            {sectionItems.map((item) => (
              <li key={item.id} data-testid={`item-${item.id}`}
                style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '0.875rem' }}>
                {/* The lifecycle badge answers the only question that matters at a glance: can a
                    customer see this right now? */}
                {(() => {
                  const badge = lifecycleBadge(item.lifecycle);
                  const tone = BADGE_TONE[badge.tone] || BADGE_TONE.muted;
                  return (
                    <span data-testid={`badge-${item.id}`} title={badge.title}
                      style={{
                        display: 'inline-block', padding: '0.1875rem 0.5rem', borderRadius: '9999px',
                        border: `1px solid ${tone.border}`, background: tone.bg, color: tone.color,
                        fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.03em',
                      }}>
                      {badge.label}
                    </span>
                  );
                })()}

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', alignItems: 'flex-start' }}>
                  {previewImageUrl(item) && (
                    <img data-testid={`image-${item.id}`} src={previewImageUrl(item)} alt=""
                      style={{ flexShrink: 0, width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
                  )}
                  <strong style={{ fontSize: '0.9375rem' }}>{item.display.title}</strong>
                </div>

                {/* Internal identity, clearly labelled so it is never mistaken for customer copy. */}
                <p style={{ margin: '0.25rem 0', fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Internal · {item.internal.source} / {item.internal.vendor} / {item.internal.externalProductId}
                </p>

                {/* Vendor-authoritative, read-only. */}
                <p style={{ margin: '0.25rem 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Vendor price <strong data-testid={`price-${item.id}`}>{formatMoney(item.vendorAuthoritative.priceCents, item.vendorAuthoritative.currency)}</strong>
                  {' · '}{item.vendorAuthoritative.available ? 'available' : 'unavailable'}
                  {' · '}synced {item.vendorAuthoritative.syncedAt || 'never'}
                </p>

                <fieldset style={{ border: 'none', margin: '0.5rem 0 0', padding: 0 }}>
                  <legend style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Categories</legend>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.375rem' }}>
                    {STORABLE_CATEGORY_IDS.map((id) => {
                      const on = (item.curation.greetMeCategories || []).includes(id);
                      return (
                        <button key={id} type="button" data-testid={`cat-${item.id}-${id}`} aria-pressed={on}
                          onClick={() => toggleCategory(item, id)}
                          style={{
                            padding: '0.25rem 0.625rem', borderRadius: '9999px', fontSize: '0.75rem',
                            border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                            background: on ? 'var(--primary)' : 'transparent',
                            color: on ? 'white' : 'var(--text-secondary)', cursor: 'pointer',
                          }}>
                          {CATEGORY_LABELS[id]}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.625rem', fontSize: '0.8125rem' }}>
                  <input type="checkbox" data-testid={`brandable-${item.id}`}
                    checked={item.curation.brandable}
                    onChange={(e) => applyPatch(item, { brandable: e.target.checked })} />
                  Brandable Goods
                </label>

                <label style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.8125rem' }}>
                  Featured rank
                  <input type="number" min="1" data-testid={`rank-${item.id}`}
                    value={item.curation.featuredRank ?? ''}
                    onChange={(e) => applyPatch(item, { featuredRank: e.target.value === '' ? null : Number(e.target.value) })}
                    style={{ marginLeft: '0.5rem', width: 80, padding: '0.25rem 0.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }} />
                </label>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.75rem' }}>
                  {!item.lifecycle.displayEnabled && item.lifecycle.state !== 'retired' && (
                    <button type="button" data-testid={`publish-${item.id}`} onClick={() => runLifecycle(item, 'publish')}
                      style={btn('var(--primary)')}>Publish</button>
                  )}
                  {item.lifecycle.displayEnabled && (
                    <button type="button" data-testid={`unpublish-${item.id}`} onClick={() => runLifecycle(item, 'unpublish')}
                      style={btn('var(--text-secondary)')}>Unpublish</button>
                  )}
                  {item.lifecycle.state !== 'retired' && (
                    <button type="button" data-testid={`retire-${item.id}`} onClick={() => runLifecycle(item, 'retire')}
                      style={btn('var(--text-secondary)')}>Retire</button>
                  )}
                  {item.lifecycle.state === 'retired' && (
                    <button type="button" data-testid={`reactivate-${item.id}`} onClick={() => runLifecycle(item, 'reactivate')}
                      style={btn('var(--primary)')}>Reactivate to Draft</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function btn(color) {
  return {
    padding: '0.375rem 0.875rem', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)', background: 'transparent',
    color, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  };
}
