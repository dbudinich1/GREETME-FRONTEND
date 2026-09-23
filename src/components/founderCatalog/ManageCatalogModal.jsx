// src/components/founderCatalog/ManageCatalogModal.jsx
//
// UNIFIED MANAGE CATALOG (Team C, 2026-09-23) — replaces ManageCatalogDrawer.jsx as the founder's
// catalog-management surface, per the founder-approved redesign: a near-full-screen modal showing
// ONLY currently-published (customer-visible) products, with search, provider filtering, a trash
// can (unpublish, never permanent delete), and a unified "Add to Catalog" flow across all four
// providers.
//
// FRONTEND SIMPLIFICATION ONLY. Every backend endpoint this calls already existed before this
// file did (founderCatalogApi, unchanged) — no bulk endpoint was added, no lifecycle state was
// removed, no safety record was weakened. "Unpublished" products still exist server-side exactly
// as before; this view simply no longer shows the founder a Draft/Unpublished/Retired browsing
// surface, per the approved design ("Catalog shows only products currently published and visible
// on the customer site").
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, Trash2, Plus, ChevronDown, ChevronUp, RefreshCw, Building2 } from 'lucide-react';
import founderCatalogApiDefault from '../../api/founderCatalog';
import {
  STORABLE_CATEGORY_IDS, CATEGORY_LABELS, formatMoney, previewImageUrl, toggleCategoryId,
} from './catalogDrawerModel';
import AddToCatalogPicker from './AddToCatalogPicker';
import ProvidersStatusView from './ProvidersStatusView';

const PROVIDER_FILTER_OPTIONS = [
  { id: '', label: 'All providers' },
  { id: 'florist_one', label: 'Florist One' },
  { id: 'goody', label: 'Goody' },
  { id: 'prezzee', label: 'Prezzee' },
  { id: 'printful', label: 'Printful' },
];

const PROVIDER_LABELS = {
  florist_one: 'Florist One', goody: 'Goody', prezzee: 'Prezzee', printful: 'Printful',
};

// The responsive contract, as a real stylesheet rule (not fluid auto-fit) so the exact column
// counts at each breakpoint are unambiguous and directly testable against this source. Scoped by
// a unique class name — no global CSS is touched.
const GRID_STYLE_TEXT = `
.gm-manage-catalog-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
}
@media (max-width: 1100px) {
  .gm-manage-catalog-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 720px) {
  .gm-manage-catalog-grid { grid-template-columns: repeat(2, 1fr); }
}
`;

const categoryButtonStyle = (active) => ({
  padding: '0.3rem 0.7rem',
  borderRadius: '9999px',
  border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
  background: active ? 'var(--primary)' : 'white',
  color: active ? 'white' : 'var(--text-secondary)',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
});

function CatalogTile({ item, client, onRemoved, onSaved }) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [local, setLocal] = useState(item);

  useEffect(() => { setLocal(item); }, [item]);

  const providerId = local.internal?.source || local.internal?.vendor;
  const image = previewImageUrl(local);
  const title = local.display?.title || local.vendorAuthoritative?.title || 'Untitled';
  const priceCents = local.vendorAuthoritative?.priceCents;

  const runRemove = useCallback(async () => {
    setRemoving(true);
    setRemoveError(null);
    try {
      const res = await client.lifecycle(local.internal.vendor, local.id, 'unpublish', local.curation?.etag ?? local.etag);
      if (!res?.ok) {
        setRemoveError(res?.error || 'Could not remove this product. It is still visible on your site.');
        setRemoving(false);
        return;
      }
      // Only remove the tile after the server confirms the unpublish.
      setConfirming(false);
      setRemoving(false);
      onRemoved(local.id);
    } catch (e) {
      setRemoveError(e?.message || 'Could not remove this product. It is still visible on your site.');
      setRemoving(false);
    }
  }, [client, local, onRemoved]);

  const runPatch = useCallback(async (patch) => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await client.patchItem(local.internal.vendor, local.id, patch, local.etag);
      if (!res?.ok || !res.item) {
        setSaveError(res?.error || 'Could not save this change.');
        setSaving(false);
        return;
      }
      setLocal(res.item);
      setSaving(false);
      onSaved?.(res.item);
    } catch (e) {
      setSaveError(e?.message || 'Could not save this change.');
      setSaving(false);
    }
  }, [client, local, onSaved]);

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await client.refreshItem(local.internal.vendor, local.id, local.etag);
      if (res?.ok && res.item) setLocal(res.item);
    } catch { /* a safe no-op refusal is left visible as-is */ }
    setRefreshing(false);
  }, [client, local]);

  const categories = local.curation?.greetMeCategories || [];
  const isPrintful = providerId === 'printful';

  return (
    <div data-testid={`catalog-tile-${local.id}`} style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      background: 'white', display: 'flex', flexDirection: 'column',
    }}>
      {/* SOFTENED 2026-09-23: a shorter aspect ratio (was 4/3) so the image is less dominant
          relative to the product information below it, and a smaller, visually secondary trash
          control (was a prominent 2rem red circle) — still a real, easy-to-click target. */}
      <div style={{ position: 'relative', aspectRatio: '16 / 10', background: '#f3f4f6' }}>
        {image ? (
          <img src={image} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>No image</div>
        )}
        <button
          type="button"
          data-testid={`trash-${local.id}`}
          aria-label="Remove this product from your site"
          onClick={() => setConfirming(true)}
          style={{
            position: 'absolute', top: '0.5rem', right: '0.5rem',
            width: '1.75rem', height: '1.75rem', padding: 0, borderRadius: '9999px', border: 'none',
            background: 'rgba(255,255,255,0.9)', color: 'var(--text-tertiary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', flex: 1 }}>
        <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
          {PROVIDER_LABELS[providerId] || providerId || 'Unknown provider'}
        </div>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {formatMoney(priceCents, local.vendorAuthoritative?.currency)}
        </div>

        <button
          type="button"
          data-testid={`expand-${local.id}`}
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem',
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: 'var(--primary)', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Hide details' : 'Manage'}
        </button>

        {expanded && (
          <div data-testid={`expanded-${local.id}`} style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Categories</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {STORABLE_CATEGORY_IDS.map((catId) => (
                  <button
                    key={catId}
                    type="button"
                    data-testid={`category-${local.id}-${catId}`}
                    disabled={saving}
                    onClick={() => runPatch({ greetMeCategories: toggleCategoryId(categories, catId) })}
                    style={categoryButtonStyle(categories.includes(catId))}
                  >
                    {CATEGORY_LABELS[catId] || catId}
                  </button>
                ))}
              </div>
            </div>
            <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Featured rank
              <input
                type="number"
                data-testid={`rank-${local.id}`}
                defaultValue={local.curation?.featuredRank ?? ''}
                disabled={saving}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  runPatch({ featuredRank: v === '' ? null : Number(v) });
                }}
                style={{ width: '4.5rem', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border)' }}
              />
            </label>
            {!isPrintful && (
              <button
                type="button"
                data-testid={`refresh-${local.id}`}
                onClick={runRefresh}
                disabled={refreshing}
                style={{
                  alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.3rem 0.625rem', borderRadius: '0.375rem', border: '1px solid var(--border)',
                  background: 'white', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit',
                }}
              >
                <RefreshCw size={12} className={refreshing ? 'gm-spin' : undefined} />
                Refresh from provider
              </button>
            )}
            {isPrintful && (
              <div data-testid={`printful-variants-${local.id}`} style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                {Array.isArray(local.vendorAuthoritative?.variants) ? local.vendorAuthoritative.variants.length : 0} variant(s) — managed via the Printful staging flow.
              </div>
            )}
            {saveError && <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>{saveError}</div>}
          </div>
        )}
      </div>

      {confirming && (
        <div data-testid={`confirm-remove-${local.id}`} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '1.5rem', maxWidth: '24rem', width: '90%' }}>
            <p style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1rem' }}>Remove this product from your site?</p>
            {removeError && <p style={{ fontSize: '0.8125rem', color: '#dc2626', marginBottom: '0.75rem' }}>{removeError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setConfirming(false); setRemoveError(null); }} disabled={removing}
                style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button type="button" data-testid={`confirm-remove-yes-${local.id}`} onClick={runRemove} disabled={removing}
                style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
                {removing ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ManageCatalogModal({ open, onClose, client = founderCatalogApiDefault }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [view, setView] = useState('catalog'); // 'catalog' | 'add' | 'providers'
  const debounceRef = useRef(null);

  const load = useCallback(async (opts = {}) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await client.listItems({
        state: 'published',
        q: (opts.q ?? query) || undefined,
        source: (opts.source ?? providerFilter) || undefined,
        limit: 200,
      });
      setItems(Array.isArray(res?.items) ? res.items : []);
    } catch (e) {
      setLoadError(e?.message || 'Could not load the catalog.');
    } finally {
      setLoading(false);
    }
  }, [client, query, providerFilter]);

  useEffect(() => {
    if (!open) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, providerFilter]);

  const onQueryChange = useCallback((value) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load({ q: value }), 300);
  }, [load]);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const replaceItem = useCallback((updated) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
  }, []);

  if (!open) return null;

  return (
    // SOFTENED 2026-09-23: centered over a restrained darkened backdrop, ~90vw wide with a
    // comfortable margin on all four sides (was edge-anchored via `inset`), max 84vh tall so the
    // modal never touches the viewport top/bottom either. The header/toolbar below stays a
    // sibling of the scrollable content area, exactly as before — only its own padding shrank.
    <div data-testid="manage-catalog-backdrop" style={{
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'rgba(15, 23, 42, 0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
    }}>
      <div data-testid="manage-catalog-modal" style={{
        width: '90vw', maxWidth: '90vw', maxHeight: '84vh',
        background: 'white', borderRadius: 'var(--radius-xl)', boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
      <style>{GRID_STYLE_TEXT}</style>
      <header style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem',
        borderBottom: '1px solid var(--border)', flexWrap: 'wrap', flexShrink: 0,
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, marginRight: 'auto' }}>Manage Catalog</h2>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            data-testid="catalog-search"
            placeholder="Search catalog"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontFamily: 'inherit' }}
          />
        </div>
        <select
          data-testid="provider-filter"
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontFamily: 'inherit' }}
        >
          {PROVIDER_FILTER_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <button
          type="button"
          data-testid="add-to-catalog-button"
          onClick={() => setView('add')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem',
            borderRadius: '0.5rem', border: 'none', background: 'var(--primary)', color: 'white',
            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Plus size={16} /> Add to Catalog
        </button>
        <button
          type="button"
          data-testid="providers-view-button"
          onClick={() => setView('providers')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem',
            borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'white',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Building2 size={16} /> Providers
        </button>
        <button type="button" data-testid="manage-catalog-close" onClick={onClose} aria-label="Close"
          style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
        {view === 'add' && (
          <AddToCatalogPicker
            client={client}
            onClose={() => setView('catalog')}
            // Refreshes the underlying catalog data in the background WITHOUT switching views —
            // a partial failure must stay on screen (per-item success/error, failed items still
            // selected) rather than being hidden the instant the FIRST item happens to succeed.
            // The founder closes back to the catalog explicitly once they've seen the outcome.
            onPublished={() => { load(); }}
          />
        )}
        {view === 'providers' && <ProvidersStatusView client={client} />}
        {view === 'catalog' && (
          <>
            {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading catalog…</p>}
            {loadError && <p style={{ color: '#dc2626' }}>{loadError}</p>}
            {!loading && !loadError && items.length === 0 && (
              <p style={{ color: 'var(--text-secondary)' }}>Nothing is published to your site yet. Use "Add to Catalog" to publish a product.</p>
            )}
            {!loading && items.length > 0 && (
              <div className="gm-manage-catalog-grid" data-testid="catalog-grid">
                {items.map((item) => (
                  <CatalogTile key={item.id} item={item} client={client} onRemoved={removeItem} onSaved={replaceItem} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
