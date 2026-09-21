// src/components/founderCatalog/MerchBrowseModal.jsx
//
// Browse the Printful store, read-only, one page at a time.
//
// NOTHING HERE PERSISTS ANYTHING except the one explicit "Stage this product" action, which
// creates a founder-only record that is still invisible and unpurchasable. There is no
// select-all, no checkbox column and no "stage these" — adding a product is a single deliberate
// act, and the absence of a multi-select is the mechanism, not a habit.
//
// An id is never typed. Every stageable row came from the server, and the server re-fetches the
// product itself rather than trusting what this component sends back.

import { useCallback, useEffect, useState } from 'react';
import { STAGED_REFUSAL_COPY } from './catalogDrawerModel.js';

const money = (c) => (c == null ? '—' : `$${(c / 100).toFixed(2)}`);

const row = {
  display: 'flex', alignItems: 'center', gap: '0.75rem',
  padding: '0.625rem 0', borderBottom: '1px solid var(--border-subtle, #e6e1d8)',
};
const btn = {
  padding: '0.375rem 0.75rem', fontSize: '0.8125rem', borderRadius: '0.375rem',
  border: '1px solid var(--border-subtle, #d8d2c7)', background: 'var(--surface, #fff)', cursor: 'pointer',
};

export default function MerchBrowseModal({ client, onClose, onStaged }) {
  const [page, setPage] = useState(null);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (nextOffset) => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.browseMerch({ offset: nextOffset, limit });
      setPage(res);
      setOffset(res.offset ?? nextOffset);
    } catch (e) {
      setError(STAGED_REFUSAL_COPY[e?.body?.error] || 'The Printful store could not be read.');
    } finally {
      setLoading(false);
    }
  }, [client, limit]);

  useEffect(() => { load(0); }, [load]);

  const stage = async (syncProductId) => {
    setBusyId(syncProductId);
    setError(null);
    try {
      const res = await client.stageMerch(syncProductId);
      if (onStaged) onStaged(res.item);
      await load(offset);
    } catch (e) {
      setError(STAGED_REFUSAL_COPY[e?.body?.error] || 'That product could not be staged.');
    } finally {
      setBusyId(null);
    }
  };

  const products = page?.products || [];
  const total = page?.total;
  const canPrev = offset > 0;
  const canNext = total == null ? products.length === limit : offset + limit < total;

  return (
    <div data-testid="merch-browse-modal" role="dialog" aria-label="Browse Printful products"
      style={{ border: '1px solid var(--border-subtle, #d8d2c7)', borderRadius: '0.5rem', padding: '1rem' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ margin: 0, fontSize: '0.9375rem' }}>Printful store</h3>
        <button type="button" style={btn} onClick={onClose} data-testid="merch-browse-close">Close</button>
      </div>

      {/* Said plainly, because the whole point of this screen is that looking is free. */}
      <p data-testid="merch-browse-readonly-note" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        Read-only. Browsing saves nothing. Staging a product does not put it on sale — it can only
        go on sale after a reviewed catalog change is deployed.
      </p>

      {error ? <p data-testid="merch-browse-error" role="alert" style={{ fontSize: '0.8125rem' }}>{error}</p> : null}
      {loading ? <p data-testid="merch-browse-loading" style={{ fontSize: '0.8125rem' }}>Loading…</p> : null}

      <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0 }}>
        {products.map((p) => {
          const blocked = p.alreadyLive || p.alreadyStaged;
          return (
            <li key={p.syncProductId} style={row} data-testid={`merch-browse-row-${p.syncProductId}`}>
              <span style={{ flex: 1, fontSize: '0.875rem' }}>{p.name}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {p.variantCount == null ? '' : `${p.variantCount} variants`}
              </span>
              {p.alreadyLive ? (
                <span data-testid={`merch-browse-live-${p.syncProductId}`} style={{ fontSize: '0.75rem' }}>
                  Already in the catalog
                </span>
              ) : null}
              {p.alreadyStaged ? (
                <span data-testid={`merch-browse-staged-${p.syncProductId}`} style={{ fontSize: '0.75rem' }}>
                  Already staged
                </span>
              ) : null}
              <button
                type="button"
                style={btn}
                disabled={blocked || busyId === p.syncProductId}
                data-testid={`merch-browse-stage-${p.syncProductId}`}
                onClick={() => stage(p.syncProductId)}
              >
                {busyId === p.syncProductId ? 'Staging…' : 'Stage this product'}
              </button>
            </li>
          );
        })}
      </ul>

      {!loading && products.length === 0
        ? <p data-testid="merch-browse-empty" style={{ fontSize: '0.8125rem' }}>No products on this page.</p>
        : null}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', alignItems: 'center' }}>
        <button type="button" style={btn} disabled={!canPrev || loading}
          data-testid="merch-browse-prev" onClick={() => load(Math.max(0, offset - limit))}>Previous</button>
        <button type="button" style={btn} disabled={!canNext || loading}
          data-testid="merch-browse-next" onClick={() => load(offset + limit)}>Next</button>
        <span data-testid="merch-browse-position" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {total == null ? `From ${offset + 1}` : `${Math.min(offset + 1, total)}–${Math.min(offset + limit, total)} of ${total}`}
        </span>
      </div>
    </div>
  );
}

export { money };
