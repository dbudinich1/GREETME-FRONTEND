// src/components/founderCatalog/AddToCatalogPicker.jsx
//
// UNIFIED ADD TO CATALOG (Team C, 2026-09-23) — one provider-selection screen behind which every
// provider's real differences stay hidden: Florist One and Goody are browsed and multi-selected;
// Prezzee offers its one fixed Smart Card; Printful is browsed and submitted to its existing
// staging/review flow (never instantly live — that is a real backend safety gate, not something
// this screen is allowed to skip).
//
// SEQUENTIAL, EXISTING, SINGLE-ITEM ENDPOINTS ONLY. No bulk backend endpoint exists or was added
// for this. "Publish Selected" walks the selection one item at a time, through the same
// addFromProvider -> lifecycle('publish') pair (or stageMerch for Printful) a founder adding one
// product by hand would already trigger — so a partial failure here is not a new failure mode this
// backend could introduce, only new UI truthfully surfacing each item's own real outcome.
import { useState, useEffect, useCallback } from 'react';
import { X, Loader, Check, AlertCircle } from 'lucide-react';
import { PREZZEE_SMART_CARD_EXTERNAL_PRODUCT_ID } from './catalogDrawerModel';

const PROVIDERS = [
  { id: 'florist_one', label: 'Florist One', mode: 'browse' },
  { id: 'goody', label: 'Goody', mode: 'browse' },
  { id: 'prezzee', label: 'Prezzee', mode: 'fixed' },
  { id: 'printful', label: 'Printful', mode: 'printful' },
];

const PREZZEE_FIXED_ITEM = Object.freeze({
  externalProductId: PREZZEE_SMART_CARD_EXTERNAL_PRODUCT_ID,
  title: 'Greet-Me Smart eGift Card',
});

function selectionKey(providerId, externalId) {
  return `${providerId}:${externalId}`;
}

/** Publishes ONE selected product through the existing single-item endpoints, sequentially. */
async function publishOne(client, sel) {
  if (sel.providerId === 'printful') {
    try {
      const res = await client.stageMerch(sel.externalProductId);
      if (!res?.ok) return { ok: false, error: res?.error || 'Could not submit this product for review.' };
      return { ok: true, submittedForReview: true };
    } catch (e) {
      return { ok: false, error: e?.message || 'Could not submit this product for review.' };
    }
  }
  let created;
  try {
    created = await client.addFromProvider({ providerId: sel.providerId, externalProductId: sel.externalProductId });
  } catch (e) {
    return { ok: false, error: e?.message || 'Could not add this product.' };
  }
  if (!created?.ok || !created.item) return { ok: false, error: created?.error || 'Could not add this product.' };
  const item = created.item;
  try {
    const pub = await client.lifecycle(item.internal.vendor, item.id, 'publish', item.etag);
    if (!pub?.ok) return { ok: false, error: pub?.error || 'Could not publish this product.' };
    return { ok: true, item: pub.item };
  } catch (e) {
    return { ok: false, error: e?.message || 'Could not publish this product.' };
  }
}

export default function AddToCatalogPicker({ client, onClose, onPublished, lockedProviderId }) {
  // PROVIDER-FIRST REDESIGN (2026-09-23): when opened from a specific provider's "+ Add Products"
  // row, the picker opens directly on that provider — no second provider-selection screen. The tab
  // bar (still used as a fallback if ever mounted without a locked provider) is hidden.
  const isLocked = Boolean(lockedProviderId);
  const [activeProvider, setActiveProvider] = useState(lockedProviderId || 'florist_one');
  const [browseResults, setBrowseResults] = useState([]);
  const [browsing, setBrowsing] = useState(false);
  const [browseError, setBrowseError] = useState(null);
  const [query, setQuery] = useState('');
  // Map key -> { providerId, externalProductId, title }
  const [selected, setSelected] = useState({});
  const [publishing, setPublishing] = useState(false);
  // Map key -> { ok, error } once an attempt has been made
  const [results, setResults] = useState({});

  const provider = PROVIDERS.find((p) => p.id === activeProvider);

  const runBrowse = useCallback(async () => {
    if (provider.mode !== 'browse' && provider.mode !== 'printful') return;
    setBrowsing(true);
    setBrowseError(null);
    try {
      const res = provider.mode === 'printful'
        ? await client.browseMerch({ offset: 0, limit: 40 })
        : await client.browseProvider(provider.id, { q: query || undefined, start: 0, count: 30 });
      if (!res?.ok) {
        setBrowseResults([]);
        setBrowseError(res?.error || 'This provider is not available to browse right now.');
        return;
      }
      const products = provider.mode === 'printful'
        ? (Array.isArray(res.products) ? res.products : [])
        : (Array.isArray(res.products) ? res.products : []);
      setBrowseResults(products);
    } catch (e) {
      setBrowseResults([]);
      setBrowseError(e?.message || 'This provider is not available to browse right now.');
    } finally {
      setBrowsing(false);
    }
  }, [client, provider, query]);

  useEffect(() => {
    setBrowseResults([]);
    setBrowseError(null);
    if (provider.mode === 'browse' || provider.mode === 'printful') runBrowse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProvider]);

  const toggleSelect = useCallback((providerId, externalProductId, title) => {
    const key = selectionKey(providerId, externalProductId);
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = { providerId, externalProductId, title };
      return next;
    });
    setResults((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }, []);

  const selectedList = Object.entries(selected).map(([key, sel]) => ({ key, ...sel }));

  const runPublishSelected = useCallback(async () => {
    setPublishing(true);
    let anySucceeded = false;
    for (const sel of selectedList) {
      const outcome = await publishOne(client, sel);
      setResults((prev) => ({ ...prev, [sel.key]: outcome }));
      if (outcome.ok) {
        anySucceeded = true;
        setSelected((prev) => { const n = { ...prev }; delete n[sel.key]; return n; });
      }
      // Failed items stay selected (per requirement) so the founder can see and retry them.
    }
    setPublishing(false);
    if (anySucceeded) onPublished();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, selectedList]);

  const isPrezzeeAlreadySelected = Boolean(selected[selectionKey('prezzee', PREZZEE_FIXED_ITEM.externalProductId)]);

  return (
    <div data-testid="add-to-catalog-picker" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <h3 data-testid="add-to-catalog-heading" style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, marginRight: 'auto' }}>
          {isLocked ? `Add Products — ${provider.label}` : 'Add to Catalog'}
        </h3>
        <button type="button" data-testid="add-to-catalog-close" onClick={onClose} aria-label="Back to catalog"
          style={{ padding: '0.375rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      {!isLocked && (
        <div role="tablist" aria-label="Provider" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={activeProvider === p.id}
              data-testid={`provider-tab-${p.id}`}
              onClick={() => setActiveProvider(p.id)}
              style={{
                padding: '0.5rem 1rem', borderRadius: '9999px',
                border: activeProvider === p.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: activeProvider === p.id ? 'var(--primary)' : 'white',
                color: activeProvider === p.id ? 'white' : 'var(--text-secondary)',
                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        {provider.mode === 'browse' && (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input
                type="text"
                data-testid="provider-browse-search"
                placeholder={`Search ${provider.label}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runBrowse(); }}
                style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontFamily: 'inherit' }}
              />
              <button type="button" onClick={runBrowse}
                style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
                Search
              </button>
            </div>
            {browsing && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
            {browseError && <p style={{ color: '#dc2626' }}>{browseError}</p>}
            {!browsing && !browseError && (
              <div data-testid="provider-browse-results" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                {browseResults.map((p) => {
                  const key = selectionKey(provider.id, p.externalProductId || p.id);
                  const isSelected = Boolean(selected[key]);
                  const result = results[key];
                  return (
                    <label key={key} data-testid={`browse-result-${key}`} style={{
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                      borderRadius: '0.5rem', padding: '0.625rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', cursor: 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        data-testid={`browse-checkbox-${key}`}
                        checked={isSelected}
                        onChange={() => toggleSelect(provider.id, p.externalProductId || p.id, p.title || p.name)}
                      />
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.title || p.name || 'Untitled'}</span>
                      {result && !result.ok && <span style={{ fontSize: '0.75rem', color: '#dc2626' }}>{result.error}</span>}
                      {result && result.ok && <span style={{ fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Check size={12} /> Published</span>}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {provider.mode === 'fixed' && (
          <div>
            <label data-testid="prezzee-fixed-item" style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', border: isPrezzeeAlreadySelected ? '2px solid var(--primary)' : '1px solid var(--border)',
              borderRadius: '0.5rem', padding: '1rem', maxWidth: '24rem', cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                data-testid="prezzee-fixed-checkbox"
                checked={isPrezzeeAlreadySelected}
                onChange={() => toggleSelect('prezzee', PREZZEE_FIXED_ITEM.externalProductId, PREZZEE_FIXED_ITEM.title)}
              />
              <span style={{ fontWeight: 700 }}>{PREZZEE_FIXED_ITEM.title}</span>
            </label>
            {(() => {
              const key = selectionKey('prezzee', PREZZEE_FIXED_ITEM.externalProductId);
              const result = results[key];
              if (!result) return null;
              return result.ok
                ? <p style={{ fontSize: '0.8125rem', color: '#059669', marginTop: '0.5rem' }}>Published.</p>
                : <p style={{ fontSize: '0.8125rem', color: '#dc2626', marginTop: '0.5rem' }}>{result.error}</p>;
            })()}
          </div>
        )}

        {provider.mode === 'printful' && (
          <div>
            {browsing && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
            {browseError && <p style={{ color: '#dc2626' }}>{browseError}</p>}
            {!browsing && !browseError && (
              <>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Selected Printful products are submitted for a reviewed release, not published instantly —
                  the same safety step this catalog has always required for a live supplier.
                </p>
                <div data-testid="printful-browse-results" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  {browseResults.map((p) => {
                    const key = selectionKey('printful', p.syncProductId || p.id);
                    const isSelected = Boolean(selected[key]);
                    const result = results[key];
                    const variantCount = Array.isArray(p.variants) ? p.variants.length : (p.variantCount ?? null);
                    return (
                      <label key={key} data-testid={`browse-result-${key}`} style={{
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                        borderRadius: '0.5rem', padding: '0.625rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', cursor: p.alreadyLive || p.alreadyStaged ? 'not-allowed' : 'pointer',
                      }}>
                        <input
                          type="checkbox"
                          data-testid={`browse-checkbox-${key}`}
                          checked={isSelected}
                          disabled={p.alreadyLive || p.alreadyStaged}
                          onChange={() => toggleSelect('printful', p.syncProductId || p.id, p.name || p.title)}
                        />
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.name || p.title || 'Untitled'}</span>
                        {variantCount != null && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{variantCount} variant(s)</span>}
                        {p.alreadyLive && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Already live</span>}
                        {p.alreadyStaged && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Already staged</span>}
                        {result && !result.ok && <span style={{ fontSize: '0.75rem', color: '#dc2626' }}>{result.error}</span>}
                        {result && result.ok && <span style={{ fontSize: '0.75rem', color: '#059669' }}>Submitted for review</span>}
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <footer style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          {selectedList.length} selected
        </span>
        <button
          type="button"
          data-testid="publish-selected-button"
          onClick={runPublishSelected}
          disabled={selectedList.length === 0 || publishing}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none',
            background: selectedList.length === 0 || publishing ? '#9ca3af' : 'var(--primary)',
            color: 'white', fontWeight: 700, cursor: selectedList.length === 0 || publishing ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {publishing ? <Loader size={16} /> : null}
          Publish Selected
        </button>
      </footer>
    </div>
  );
}
