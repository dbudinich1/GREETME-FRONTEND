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
import { X, Lock, AlertTriangle } from 'lucide-react';
import founderCatalogApi from '../../api/founderCatalog';
import {
  CATEGORY_LABELS, REFUSAL_COPY, SECTIONS, STORABLE_CATEGORY_IDS, toggleCategoryId,
} from './catalogDrawerModel';

// Re-exported so the component remains the single import site for callers that already have it.
export { STORABLE_CATEGORY_IDS, CATEGORY_LABELS, SECTIONS };

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

  const isProviders = section === 'providers';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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
  }, [client, section, query, isProviders]);

  useEffect(() => { if (open) load(); }, [open, load]);

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
    setNotice(null);
    try {
      const res = await client.lifecycle(item.internal.vendor, item.id, action, item.etag);
      setItems((prev) => prev.map((i) => (i.id === item.id ? res.item : i)));
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
        <button type="button" onClick={onClose} aria-label="Close Manage Catalog"
          style={{ padding: 0, width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'transparent', cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </header>

      <nav style={{ display: 'flex', gap: '0.375rem', padding: '0.75rem 1.25rem', overflowX: 'auto', borderBottom: '1px solid var(--border)' }}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
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

      {!isProviders && (
        <div style={{ padding: '0.75rem 1.25rem 0' }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stored records by title…"
            aria-label="Search catalog records"
            style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontFamily: 'inherit' }}
          />
        </div>
      )}

      {notice && (
        <p data-testid="drawer-notice" role="status" style={{ margin: '0.75rem 1.25rem 0', padding: '0.625rem 0.75rem', border: '1px solid #f59e0b', borderRadius: 'var(--radius-md)', background: '#fffbeb', fontSize: '0.8125rem' }}>
          <AlertTriangle size={14} style={{ verticalAlign: '-2px' }} /> {notice}
        </p>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
        {loading && <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>Loading…</p>}
        {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

        {!loading && !error && isProviders && (
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

        {!loading && !error && !isProviders && (
          <ul data-testid="catalog-item-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '1rem' }}>
            {sectionItems.length === 0 && <li style={{ color: 'var(--text-secondary)' }}>No records in this section.</li>}
            {sectionItems.map((item) => (
              <li key={item.id} data-testid={`item-${item.id}`}
                style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '0.875rem' }}>
                <strong style={{ display: 'block', fontSize: '0.9375rem' }}>{item.display.title}</strong>

                {/* Internal identity, clearly labelled so it is never mistaken for customer copy. */}
                <p style={{ margin: '0.25rem 0', fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Internal · {item.internal.source} / {item.internal.vendor} / {item.internal.externalProductId}
                </p>

                {/* Vendor-authoritative, read-only. */}
                <p style={{ margin: '0.25rem 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Vendor price {item.vendorAuthoritative.priceCents == null ? '—' : `$${(item.vendorAuthoritative.priceCents / 100).toFixed(2)}`}
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
