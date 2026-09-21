// src/components/founderCatalog/ProviderBrowsePanel.jsx
//
// Browse one provider's catalog, read-only, one page at a time.
//
// NOTHING HERE PERSISTS ANYTHING except the one explicit "Add as Draft" action, which creates a
// founder-only record that is still invisible and unpublishable. There is no select-all, no
// checkbox column and no "add these" — adding a product is a single deliberate act, and the
// absence of a multi-select is the mechanism, not a habit.
//
// AN ID IS NEVER TYPED, AND PRODUCT DATA IS NEVER SENT. Every row came from the server, and Add
// as Draft sends back two identifiers: the server re-fetches the product and builds the record
// itself. A title, price or variant list typed here could disagree with the vendor, and the
// disagreement would surface only at quote time with an order already funded.
//
// A DORMANT PROVIDER IS NEVER REQUESTED. The drawer only renders this panel for a provider the
// server has already reported as browseAvailable, so a disabled provider is a stated fact rather
// than a spinner waiting on a 503.
//
// SEARCH SPANS THE CATALOG, AND SAYS HOW FAR IT GOT. The server walks a bounded number of provider
// pages per request, so a match on page three is found — but a catalog larger than that bound is
// only partly searched. When that happens this panel NEVER prints "No products match": an empty
// result from a partial search is not a statement about the catalog, and saying it were would be
// the most convincing wrong answer the surface could give. It says how much was searched and
// offers to continue from where the search stopped.

import { useCallback, useEffect, useState } from 'react';
import { Search, Plus, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  CATEGORY_LABELS, STORABLE_CATEGORY_IDS, REFUSAL_COPY,
  browseProducts, isDormantBrowse, browsePaging, BROWSE_PAGE_SIZE, formatMoney,
  browseTraversal, browseCountCopy,
} from './catalogDrawerModel';

/**
 * Provider-level constraints a product row cannot show.
 *
 * These are DELIVERY-SHAPE facts, not merchandising: where the provider ships, and how far ahead
 * it will accept a date. They belong to the provider, so they are stated once per provider rather
 * than repeated per row — and they are stated at all because a founder cannot infer them from a
 * picture and a price.
 *
 * A provider with no entry here prints nothing. An empty panel is the honest default: inventing a
 * reassuring line for a provider whose limits nobody has written down would be worse than silence.
 */
const PROVIDER_BROWSE_LIMITS = Object.freeze({
  florist_one: Object.freeze([
    'Delivers to United States addresses only. A product published here cannot be sent anywhere else.',
    'Delivery dates are offered up to 30 days ahead, and each address is checked at checkout.',
    'One product, one price — this provider publishes no sizes or variants.',
  ]),
});

const card = {
  border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '0.75rem',
  display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
};
const btn = (primary) => ({
  padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-md)',
  border: `1px solid ${primary ? 'var(--primary)' : 'var(--border)'}`,
  background: primary ? 'var(--primary)' : 'transparent',
  color: primary ? 'white' : 'var(--text-secondary)',
  fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
});

export default function ProviderBrowsePanel({ client, providerId, providerLabel, onAdded }) {
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');              // the query actually searched
  const [categoryId, setCategoryId] = useState('');
  const [start, setStart] = useState(0);
  const [cursor, setCursor] = useState(null);            // continue a truncated search from here
  const [state, setState] = useState({
    loading: false, products: [], total: 0, dormant: false, error: null,
    traversal: { complete: true, truncated: false, scanned: 0, failed: false, nextCursor: null },
  });
  const [adding, setAdding] = useState(null);
  const [added, setAdded] = useState([]);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await client.browseProvider(providerId, {
        q: applied || undefined,
        categoryId: categoryId || undefined,
        start,
        count: BROWSE_PAGE_SIZE,
        cursor: cursor || undefined,
      });
      // FAIL-CLOSED: a refusal yields no products, and a dormant refusal is named as such rather
      // than shown as an empty catalog. Completeness is likewise believed only when stated.
      setState({
        loading: false,
        products: browseProducts(res),
        total: Number.isInteger(res?.total) ? res.total : 0,
        dormant: isDormantBrowse(res),
        error: res && res.ok === false && !isDormantBrowse(res) ? (REFUSAL_COPY[res.error] || 'The provider catalog could not be read.') : null,
        traversal: browseTraversal(res),
      });
    } catch (e) {
      setState({
        loading: false, products: [], total: 0, dormant: false,
        error: 'The provider catalog could not be read.',
        traversal: browseTraversal(null),
      });
    }
  }, [client, providerId, applied, categoryId, start, cursor]);

  useEffect(() => { load(); }, [load]);

  // A NEW search starts a NEW traversal. Carrying a continuation across a changed query would
  // silently skip the beginning of the catalog for the new terms.
  const search = (e) => { e.preventDefault(); setStart(0); setCursor(null); setApplied(query.trim()); };
  const pickCategory = (id) => { setStart(0); setCursor(null); setCategoryId((c) => (c === id ? '' : id)); };
  const keepSearching = () => { setStart(0); setCursor(state.traversal.nextCursor); };
  const startOver = () => { setStart(0); setCursor(null); };

  const addAsDraft = async (product) => {
    setAdding(product.providerProductId);
    setNotice(null);
    try {
      // TWO IDENTIFIERS. Nothing about the product itself travels from this component.
      const res = await client.addFromProvider({ providerId, externalProductId: product.providerProductId });
      setAdded((prev) => [...prev, product.providerProductId]);
      setNotice(`Added “${res?.item?.display?.title || product.name}” as a draft. Customers cannot see it.`);
      if (onAdded) await onAdded(res?.item);
    } catch (e) {
      const code = e?.body?.error || e?.error || e?.message;
      setNotice(REFUSAL_COPY[code] || `Could not add that product: ${code || 'unknown reason'}`);
    } finally {
      setAdding(null);
    }
  };

  const paging = browsePaging({ start, count: BROWSE_PAGE_SIZE, total: state.total });

  if (state.dormant) {
    return (
      <p data-testid="browse-dormant" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        {providerLabel || providerId} is dormant, so its catalog cannot be browsed yet. Browsing
        becomes available only after the provider is separately activated.
      </p>
    );
  }

  const limits = PROVIDER_BROWSE_LIMITS[providerId] || null;

  return (
    <section data-testid="provider-browse-panel" aria-label={`Browse ${providerLabel || providerId}`}>
      {/* THE LIMITS OF WHAT CAN BE SOLD, STATED BEFORE ANYTHING IS CHOSEN.
          A founder curating a catalog is making a commitment on Greet-Me's behalf, and the two
          constraints below cannot be read off a product row: they are properties of the provider,
          not of the item. Printing them here — above the results, not in a tooltip — is what stops
          a product being published for a country it cannot reach or a date it cannot meet. */}
      {limits ? (
        <ul
          data-testid="browse-limits"
          style={{
            listStyle: 'none', margin: '0 0 0.75rem', padding: '0.5rem 0.625rem',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary, #f9fafb)',
            fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'grid', gap: '0.25rem',
          }}
        >
          {limits.map((line) => <li key={line}>{line}</li>)}
        </ul>
      ) : null}

      <form onSubmit={search} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label htmlFor="browse-q" style={{ flex: '1 1 12rem', minWidth: 0 }}>
          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            Search this provider&rsquo;s catalog
          </span>
          <input
            id="browse-q" data-testid="browse-q" type="search" value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the provider's catalog…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontFamily: 'inherit' }}
          />
        </label>
        <button type="submit" data-testid="browse-search" style={btn(true)}>
          <Search size={13} style={{ verticalAlign: '-2px' }} /> Search
        </button>
      </form>

      {/* EXISTING categories only. This panel invents none and renames none. */}
      <div data-testid="browse-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.625rem' }}>
        {STORABLE_CATEGORY_IDS.map((id) => {
          const on = categoryId === id;
          return (
            <button key={id} type="button" data-testid={`browse-cat-${id}`} aria-pressed={on}
              onClick={() => pickCategory(id)}
              style={{
                padding: '0.25rem 0.625rem', borderRadius: '9999px', fontSize: '0.75rem',
                border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                background: on ? 'var(--primary)' : 'transparent',
                color: on ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
              }}>
              {CATEGORY_LABELS[id]}
            </button>
          );
        })}
      </div>

      {notice && (
        <p data-testid="browse-notice" role="status" style={{ margin: '0.75rem 0 0', padding: '0.5rem 0.625rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem' }}>
          {notice}
        </p>
      )}
      {state.error && (
        <p data-testid="browse-error" role="status" style={{ margin: '0.75rem 0 0', color: '#b91c1c', fontSize: '0.8125rem' }}>
          <AlertTriangle size={13} style={{ verticalAlign: '-2px' }} /> {state.error}
        </p>
      )}

      {state.loading && <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>Loading…</p>}

      {!state.loading && !state.error && (
        <>
          <p data-testid="browse-count" style={{ margin: '0.75rem 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            {browseCountCopy({ total: state.total, paging, traversal: state.traversal })}
          </p>

          {state.traversal.truncated && (
            <p data-testid="browse-truncated" role="status" style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#9a3412' }}>
              <AlertTriangle size={12} style={{ verticalAlign: '-2px' }} />{' '}
              {state.traversal.failed
                ? 'The provider stopped responding partway through this search, so the rest of the catalog was not searched.'
                : 'This search stopped at a safety limit, so the rest of the catalog has not been searched yet.'}
              {state.traversal.nextCursor && (
                <>
                  {' '}
                  <button type="button" data-testid="browse-continue" onClick={keepSearching}
                    style={{ ...btn(false), padding: '0.125rem 0.5rem', fontSize: '0.75rem' }}>
                    Keep searching
                  </button>
                </>
              )}
            </p>
          )}
          {cursor && (
            <p data-testid="browse-continued" style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Continuing from where the last search stopped.{' '}
              <button type="button" data-testid="browse-restart" onClick={startOver}
                style={{ ...btn(false), padding: '0.125rem 0.5rem', fontSize: '0.75rem' }}>
                Start over
              </button>
            </p>
          )}

          <ul data-testid="browse-results" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.625rem' }}>
            {state.products.map((p) => {
              const isAdded = added.includes(p.providerProductId) || p.alreadyInCatalog;
              return (
                <li key={p.providerProductId} data-testid={`browse-item-${p.providerProductId}`} style={card}>
                  {p.imageUrl && (
                    <img data-testid={`browse-image-${p.providerProductId}`} src={p.imageUrl} alt=""
                      style={{ flexShrink: 0, width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: '0.9375rem' }}>{p.name}</strong>
                    {p.brandName && (
                      <span data-testid={`browse-brand-${p.providerProductId}`} style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{p.brandName}</span>
                    )}
                    <p style={{ margin: '0.25rem 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      <strong data-testid={`browse-price-${p.providerProductId}`}>{formatMoney(p.priceCents, p.currency)}</strong>
                      {' · '}
                      <span data-testid={`browse-availability-${p.providerProductId}`}>
                        {p.providerStatus === 'active' ? 'active at provider' : `provider status: ${p.providerStatus || 'unknown'}`}
                      </span>
                    </p>
                    {p.variantNames.length > 0 && (
                      <p data-testid={`browse-variants-${p.providerProductId}`} style={{ margin: '0.25rem 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        Options: {p.variantNames.join(', ')}
                      </p>
                    )}
                    {!p.directSendEligible && (
                      <p data-testid={`browse-ineligible-${p.providerProductId}`} style={{ margin: '0.25rem 0', fontSize: '0.75rem', color: '#9a3412' }}>
                        <AlertTriangle size={12} style={{ verticalAlign: '-2px' }} /> Not direct-send eligible
                        {p.ineligibleReasons.length > 0 ? ` — ${p.ineligibleReasons.join(', ')}` : ''}
                      </p>
                    )}
                    {p.suggestedCategoryIds.length > 0 && (
                      <p data-testid={`browse-suggested-${p.providerProductId}`} style={{ margin: '0.25rem 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        Suggested: {p.suggestedCategoryIds.map((id) => CATEGORY_LABELS[id] || id).join(', ')}
                        {' '}<span>(you can change this after adding)</span>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    data-testid={`browse-add-${p.providerProductId}`}
                    disabled={isAdded || adding === p.providerProductId}
                    onClick={() => addAsDraft(p)}
                    style={{ ...btn(!isAdded), flexShrink: 0, opacity: isAdded ? 0.7 : 1, cursor: isAdded ? 'default' : 'pointer' }}
                  >
                    {isAdded
                      ? <><Check size={13} style={{ verticalAlign: '-2px' }} /> In catalog</>
                      : (adding === p.providerProductId
                        ? <><RefreshCw size={13} style={{ verticalAlign: '-2px' }} /> Adding…</>
                        : <><Plus size={13} style={{ verticalAlign: '-2px' }} /> Add as Draft</>)}
                  </button>
                </li>
              );
            })}
          </ul>

          {(paging.hasPrev || paging.hasNext) && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button type="button" data-testid="browse-prev" disabled={!paging.hasPrev}
                onClick={() => setStart(paging.prevStart)} style={{ ...btn(false), opacity: paging.hasPrev ? 1 : 0.5 }}>
                Previous
              </button>
              <button type="button" data-testid="browse-next" disabled={!paging.hasNext}
                onClick={() => setStart(paging.nextStart)} style={{ ...btn(false), opacity: paging.hasNext ? 1 : 0.5 }}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
