// src/components/founderCatalog/MerchCurationSection.jsx
//
// The Merch (Printful) section of the Manage Catalog drawer.
//
// Printful is a LIVE SUPPLIER — it already serves five products through the existing cart, Stripe
// checkout and Printful fulfilment. It is deliberately NOT a row in the Providers section: that
// list is the Florist One / Goody registry, whose boot invariant asserts exactly two
// registrations, and describing a shipping, charging supplier as "dormant" would be false.
//
// Everything here curates PRESENTATION. Name, image, price and variant count are shown as
// server-authoritative and are not editable, because they come from Printful and from the code
// allowlist, never from this drawer.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CATEGORY_LABELS, STORABLE_CATEGORY_IDS, REFUSAL_COPY, toggleCategoryId,
  merchStatusLabel, merchPlacementError, merchIsDirty,
} from './catalogDrawerModel';

const label = { fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' };
const money = (c) => (c == null ? '—' : `$${(c / 100).toFixed(2)}`);

const draftFrom = (item) => ({
  displayEnabled: item.curation.displayEnabled !== false,
  greetMeCategories: [...(item.curation.greetMeCategories || [])],
  brandable: item.curation.brandable === true,
  featuredRank: item.curation.featuredRank ?? null,
  state: item.curation.state || 'active',
});

export default function MerchCurationSection({ client, onDirtyChange }) {
  const [items, setItems] = useState([]);
  const [overlayState, setOverlayState] = useState(null);
  const [writesEnabled, setWritesEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await client.listMerch();
      const list = res?.items || [];
      setItems(list);
      setOverlayState(res?.overlayState || null);
      setWritesEnabled(res?.writesEnabled !== false);
      setDrafts(Object.fromEntries(list.map((i) => [i.syncProductId, draftFrom(i)])));
    } catch (e) {
      setError(e?.message || 'Could not load the merch catalog.');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { load(); }, [load]);

  // The drawer asks before closing or switching away while anything is unsaved.
  const dirtyIds = useMemo(
    () => items.filter((i) => merchIsDirty(drafts[i.syncProductId], draftFrom(i))).map((i) => i.syncProductId),
    [items, drafts]
  );
  useEffect(() => { if (onDirtyChange) onDirtyChange(dirtyIds.length > 0); }, [dirtyIds, onDirtyChange]);

  const setDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  async function save(item) {
    const id = item.syncProductId;
    const draft = drafts[id];
    const placement = merchPlacementError(draft);
    if (placement) { setNotice(placement); return; }
    setBusyId(id); setNotice(null);
    try {
      const res = await client.patchMerch(id, {
        displayEnabled: draft.displayEnabled,
        greetMeCategories: draft.greetMeCategories,
        brandable: draft.brandable,
        featuredRank: draft.featuredRank === '' || draft.featuredRank == null
          ? null : Number(draft.featuredRank),
      }, item.etag);
      const next = res?.item;
      if (next) {
        setItems((list) => list.map((i) => (i.syncProductId === id ? next : i)));
        setDrafts((d) => ({ ...d, [id]: draftFrom(next) }));
        setNotice('Saved.');
      }
    } catch (e) {
      const code = e?.data?.error || e?.code || '';
      setNotice(REFUSAL_COPY[code] || e?.message || 'Could not save.');
    } finally { setBusyId(null); }
  }

  async function lifecycle(item, action) {
    setBusyId(item.syncProductId); setNotice(null);
    try {
      const res = await client.merchLifecycle(item.syncProductId, action, item.etag);
      const next = res?.item;
      if (next) {
        setItems((list) => list.map((i) => (i.syncProductId === next.syncProductId ? next : i)));
        setDrafts((d) => ({ ...d, [next.syncProductId]: draftFrom(next) }));
        setNotice(action === 'retire' ? 'Retired.' : 'Restored — it is hidden until you show it.');
      }
    } catch (e) {
      const code = e?.data?.error || e?.code || '';
      setNotice(REFUSAL_COPY[code] || e?.message || 'Could not update.');
    } finally { setBusyId(null); }
  }

  if (loading) {
    return <p data-testid="merch-loading" style={{ color: 'var(--text-secondary)' }}>Loading merch…</p>;
  }
  if (error) {
    return <p data-testid="merch-error" role="alert" style={{ color: 'var(--danger, #b3261e)' }}>{error}</p>;
  }

  return (
    <div data-testid="merch-section">
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        <strong>Printful</strong> — live supplier, serving {items.length} products through the existing
        cart, Stripe checkout and Printful fulfilment. Curated here; prices and variants are set by
        Printful and in code.
      </p>

      {overlayState === 'unavailable' && (
        <p data-testid="merch-unavailable-banner" role="status" style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem' }}>
          {REFUSAL_COPY.merch_unavailable}
        </p>
      )}
      {!writesEnabled && (
        <p data-testid="merch-writes-disabled" role="status" style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem' }}>
          {REFUSAL_COPY.WRITES_DISABLED}
        </p>
      )}
      {notice && (
        <p data-testid="merch-notice" aria-live="polite" style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem' }}>{notice}</p>
      )}

      <ul data-testid="merch-item-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '1rem' }}>
        {items.map((item) => {
          const id = item.syncProductId;
          const draft = drafts[id] || draftFrom(item);
          const retired = item.curation.state === 'retired';
          const dirty = merchIsDirty(draft, draftFrom(item));
          return (
            <li key={id} data-testid={`merch-item-${id}`}
              style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '0.875rem' }}>
              <strong style={{ display: 'block', fontSize: '0.9375rem' }}>{item.vendorAuthoritative.name}</strong>

              <p style={{ ...label, margin: '0.25rem 0' }}>
                Supplier · Printful · fulfilment {item.vendorAuthoritative.fulfillmentSource}
              </p>

              {/* Server-authoritative, deliberately not editable. */}
              <p data-testid={`merch-authoritative-${id}`}
                style={{ margin: '0.25rem 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {money(item.vendorAuthoritative.priceCentsMin)}
                {item.vendorAuthoritative.priceCentsMax !== item.vendorAuthoritative.priceCentsMin
                  ? `–${money(item.vendorAuthoritative.priceCentsMax)}` : ''}
                {' · '}{item.vendorAuthoritative.variantCount} variants
                {' · '}set by Printful
              </p>

              <p data-testid={`merch-status-${id}`} style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.8125rem' }}>
                Status: <strong>{merchStatusLabel(item.curation)}</strong>
              </p>

              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8125rem' }}>
                <input type="checkbox" data-testid={`merch-visible-${id}`}
                  checked={draft.displayEnabled} disabled={retired || !writesEnabled}
                  aria-checked={draft.displayEnabled}
                  onChange={(e) => setDraft(id, { displayEnabled: e.target.checked })} />
                Show in the marketplace
              </label>

              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8125rem', marginTop: '0.35rem' }}>
                <input type="checkbox" data-testid={`merch-brandable-${id}`}
                  checked={draft.brandable} disabled={!writesEnabled}
                  aria-checked={draft.brandable}
                  onChange={(e) => setDraft(id, { brandable: e.target.checked })} />
                Show under Brandable Goods
              </label>

              <fieldset style={{ border: 'none', margin: '0.5rem 0 0', padding: 0 }}>
                <legend style={{ ...label }}>Categories</legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {STORABLE_CATEGORY_IDS.map((cid) => {
                    const on = (draft.greetMeCategories || []).includes(cid);
                    return (
                      <label key={cid} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.75rem' }}>
                        <input type="checkbox" data-testid={`merch-cat-${id}-${cid}`}
                          checked={on} disabled={!writesEnabled} aria-checked={on}
                          onChange={() => setDraft(id, { greetMeCategories: toggleCategoryId(draft.greetMeCategories, cid) })} />
                        {CATEGORY_LABELS[cid] || cid}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.8125rem' }}>
                <span style={{ ...label, display: 'block' }}>Featured rank</span>
                <input data-testid={`merch-rank-${id}`} inputMode="numeric" aria-label="Featured rank"
                  value={draft.featuredRank ?? ''} disabled={!writesEnabled}
                  onChange={(e) => setDraft(id, { featuredRank: e.target.value === '' ? null : e.target.value })}
                  style={{ maxWidth: 96 }} />
              </label>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                <button type="button" data-testid={`merch-save-${id}`}
                  disabled={busyId === id || !dirty || !writesEnabled} onClick={() => save(item)}>
                  Save
                </button>
                <button type="button" data-testid={`merch-cancel-${id}`}
                  disabled={busyId === id || !dirty}
                  onClick={() => setDrafts((d) => ({ ...d, [id]: draftFrom(item) }))}>
                  Cancel
                </button>
                {retired ? (
                  <button type="button" data-testid={`merch-restore-${id}`}
                    disabled={busyId === id || !writesEnabled} onClick={() => lifecycle(item, 'restore')}>
                    Restore
                  </button>
                ) : (
                  <button type="button" data-testid={`merch-retire-${id}`}
                    disabled={busyId === id || !writesEnabled} onClick={() => lifecycle(item, 'retire')}>
                    Retire
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
