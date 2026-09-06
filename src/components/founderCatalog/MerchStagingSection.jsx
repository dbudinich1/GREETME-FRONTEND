// src/components/founderCatalog/MerchStagingSection.jsx
//
// Staging a new Printful product for a REVIEWED CODE RELEASE.
//
// THE HONESTY THIS SCREEN OWES THE FOUNDER
//   • Nothing here is on sale. Every state says so, including "Ready for code review".
//   • The retail price field starts EMPTY. Printful's own price is shown beside it, labelled as
//     Printful's, and is never copied into the field — not as a placeholder, not as a default.
//   • No markup is suggested and no shipping claim is made, because neither would be true for
//     every product and a half-true promise on a pricing screen is worse than none.
//   • The final action is "Prepare reviewed release", not "Publish", because that is what it does:
//     it hands a developer a manifest. A product goes live when that ships, and not before.

import { useCallback, useEffect, useState } from 'react';
import MerchBrowseModal from './MerchBrowseModal.jsx';
import {
  STAGED_REFUSAL_COPY, stagedStatusLabel, stagedNextAction, canPrepareRelease, parseRetailCents,
  toggleCategoryId, STORABLE_CATEGORY_IDS, CATEGORY_LABELS,
} from './catalogDrawerModel.js';

const money = (c) => (c == null ? '—' : `$${(c / 100).toFixed(2)}`);
const btn = {
  padding: '0.375rem 0.75rem', fontSize: '0.8125rem', borderRadius: '0.375rem',
  border: '1px solid var(--border-subtle, #d8d2c7)', background: 'var(--surface, #fff)', cursor: 'pointer',
};
const card = {
  border: '1px solid var(--border-subtle, #e6e1d8)', borderRadius: '0.5rem',
  padding: '0.75rem', marginBottom: '0.75rem',
};

const copyFor = (e, fallback) => STAGED_REFUSAL_COPY[e?.body?.error] || fallback;

export default function MerchStagingSection({ client, onDirtyChange }) {
  const [items, setItems] = useState([]);
  const [readState, setReadState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [browsing, setBrowsing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [priceDrafts, setPriceDrafts] = useState({});   // { [syncProductId]: { [syncVariantId]: '' } }
  const [manifests, setManifests] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.listStaged();
      setItems(res.items || []);
      setReadState(res.state || null);
    } catch (e) {
      setError(copyFor(e, 'The staging store could not be read.'));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { load(); }, [load]);

  // Unsaved price text is real work; the drawer's guard should know about it.
  useEffect(() => {
    if (!onDirtyChange) return;
    const dirty = Object.values(priceDrafts).some(
      (byVariant) => Object.values(byVariant || {}).some((v) => String(v ?? '').trim() !== '')
    );
    onDirtyChange(dirty);
  }, [priceDrafts, onDirtyChange]);

  const run = async (id, fn, successNotice) => {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fn();
      if (successNotice) setNotice(successNotice);
      await load();
      return res;
    } catch (e) {
      setError(copyFor(e, 'That change was refused.'));
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const savePricing = (item) => {
    const drafts = priceDrafts[item.syncProductId] || {};
    const variants = [];
    for (const v of item.variants) {
      const raw = drafts[v.syncVariantId];
      const typed = raw === undefined ? null : parseRetailCents(raw);
      if (Number.isNaN(typed)) {
        setError(STAGED_REFUSAL_COPY.INVALID_PRICE);
        return undefined;
      }
      variants.push({
        syncVariantId: v.syncVariantId,
        greetMeRetailCents: raw === undefined ? v.greetMeRetailCents ?? null : typed,
      });
    }
    return run(item.syncProductId,
      () => client.patchStagedPricing(item.syncProductId, variants, item.etag),
      'Prices saved. Any earlier fulfilment approval was cleared.');
  };

  const setPresentation = (item, patch) =>
    run(item.syncProductId, () => client.patchStagedPresentation(item.syncProductId, patch, item.etag));

  const prepare = async (item) => {
    const res = await run(item.syncProductId,
      () => client.prepareStagedRelease(item.syncProductId, item.etag),
      'Release manifest prepared. The product stays hidden when the catalog change is deployed — '
      + 'your visibility choice is applied only after you confirm the deployed entry matches.');
    if (res?.releaseManifest) {
      setManifests((m) => ({ ...m, [item.syncProductId]: res.releaseManifest }));
    }
  };

  /**
   * Confirmation is not the same as "it is now live".
   *
   * A founder who chose to keep the product hidden gets a truthful message saying so, rather than
   * a success line implying a storefront change that did not happen. The server reports which it
   * was; this only repeats it.
   */
  const confirm = async (item) => {
    setBusyId(item.syncProductId);
    setError(null);
    setNotice(null);
    try {
      const res = await client.confirmStagedPublished(item.syncProductId, item.etag);
      setNotice(res?.customerVisible
        ? 'Verified against the deployed catalog. The product is now visible to customers.'
        : 'Verified against the deployed catalog. The product stays hidden, as you chose — '
          + 'unhide it in the Merch section whenever you are ready.');
      await load();
    } catch (e) {
      setError(copyFor(e, 'That change was refused.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section data-testid="merch-staging-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ margin: 0, fontSize: '0.9375rem' }}>Add a product</h3>
        <button type="button" style={btn} data-testid="merch-staging-browse"
          onClick={() => setBrowsing((b) => !b)}>
          {browsing ? 'Close browser' : 'Browse Printful'}
        </button>
      </div>

      <p data-testid="merch-staging-preamble" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        Products are added one at a time. Nothing staged here is on sale: a product becomes
        purchasable only when a reviewed change to the catalog config is deployed.
      </p>

      {browsing ? (
        <MerchBrowseModal client={client} onClose={() => setBrowsing(false)} onStaged={() => load()} />
      ) : null}

      {error ? <p role="alert" data-testid="merch-staging-error" style={{ fontSize: '0.8125rem' }}>{error}</p> : null}
      {notice ? <p data-testid="merch-staging-notice" style={{ fontSize: '0.8125rem' }}>{notice}</p> : null}
      {loading ? <p data-testid="merch-staging-loading" style={{ fontSize: '0.8125rem' }}>Loading…</p> : null}
      {readState === 'unavailable' ? (
        <p data-testid="merch-staging-unavailable" style={{ fontSize: '0.8125rem' }}>
          {STAGED_REFUSAL_COPY.staging_unavailable}
        </p>
      ) : null}

      {!loading && items.length === 0 ? (
        <p data-testid="merch-staging-empty" style={{ fontSize: '0.8125rem' }}>Nothing staged.</p>
      ) : null}

      {items.map((item) => {
        const drafts = priceDrafts[item.syncProductId] || {};
        const busy = busyId === item.syncProductId;
        const manifest = manifests[item.syncProductId] || item.releaseManifest;
        return (
          <article key={item.syncProductId} style={card} data-testid={`merch-staged-${item.syncProductId}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong style={{ fontSize: '0.875rem' }}>{item.vendor?.name || item.syncProductId}</strong>
              <span data-testid={`merch-staged-status-${item.syncProductId}`} style={{ fontSize: '0.75rem' }}>
                {stagedStatusLabel(item)}
              </span>
            </div>

            {/* Stated on every card, in every state — including published, where the fact that this
                record is not what makes it buyable is exactly what a founder could misread. */}
            <p data-testid={`merch-staged-notlive-${item.syncProductId}`}
              style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>
              Not on sale from this screen.
            </p>
            <p data-testid={`merch-staged-next-${item.syncProductId}`} style={{ fontSize: '0.75rem', margin: '0.25rem 0' }}>
              {stagedNextAction(item)}
            </p>
            {item.state === 'ready_for_code_review' ? (
              <p data-testid={`merch-staged-hiddenondeploy-${item.syncProductId}`}
                style={{ fontSize: '0.75rem', margin: '0.25rem 0' }}>
                Deploying the catalog change will not reveal this product. It stays hidden until you
                confirm the deployed entry matches what you approved.
              </p>
            ) : null}

            <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Variant</th>
                  <th style={{ textAlign: 'left' }}>Printful’s price</th>
                  <th style={{ textAlign: 'left' }}>Greet-Me retail</th>
                </tr>
              </thead>
              <tbody>
                {item.variants.map((v) => (
                  <tr key={v.syncVariantId} data-testid={`merch-staged-variant-${v.syncVariantId}`}>
                    <td>{v.label}{v.vendorAvailable === false ? ' — unavailable' : ''}</td>
                    <td data-testid={`merch-staged-vendorprice-${v.syncVariantId}`}>{money(v.vendorPriceCents)}</td>
                    <td>
                      {/* No placeholder, no default, no value derived from Printful's price. An
                          unset price renders as an empty field, which is the truth. */}
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Retail price for ${v.label}`}
                        data-testid={`merch-staged-retail-${v.syncVariantId}`}
                        value={drafts[v.syncVariantId] ?? (v.greetMeRetailCents == null ? '' : (v.greetMeRetailCents / 100).toFixed(2))}
                        onChange={(e) => setPriceDrafts((d) => ({
                          ...d,
                          [item.syncProductId]: { ...(d[item.syncProductId] || {}), [v.syncVariantId]: e.target.value },
                        }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button type="button" style={btn} disabled={busy}
              data-testid={`merch-staged-save-prices-${item.syncProductId}`}
              onClick={() => savePricing(item)}>Save prices</button>

            <fieldset style={{ border: 'none', padding: '0.5rem 0', margin: 0 }}>
              <legend style={{ fontSize: '0.75rem' }}>Presentation — chosen before the release is prepared</legend>
              {STORABLE_CATEGORY_IDS.map((cid) => (
                <label key={cid} style={{ fontSize: '0.8125rem', marginRight: '0.75rem' }}>
                  <input
                    type="checkbox"
                    data-testid={`merch-staged-cat-${item.syncProductId}-${cid}`}
                    checked={(item.presentation?.greetMeCategories || []).includes(cid)}
                    disabled={busy}
                    onChange={() => setPresentation(item, {
                      greetMeCategories: toggleCategoryId(item.presentation?.greetMeCategories, cid),
                    })}
                  />{' '}{CATEGORY_LABELS[cid] || cid}
                </label>
              ))}
              <label style={{ fontSize: '0.8125rem', marginRight: '0.75rem' }}>
                <input type="checkbox" data-testid={`merch-staged-brandable-${item.syncProductId}`}
                  checked={item.presentation?.brandable === true} disabled={busy}
                  onChange={(e) => setPresentation(item, { brandable: e.target.checked })} /> Brandable Goods
              </label>
              <label style={{ fontSize: '0.8125rem', marginRight: '0.75rem' }}>
                <input type="checkbox" data-testid={`merch-staged-visible-${item.syncProductId}`}
                  checked={item.presentation?.displayEnabled === true} disabled={busy}
                  onChange={(e) => setPresentation(item, { displayEnabled: e.target.checked })} /> Visible once live
              </label>
              <label style={{ fontSize: '0.8125rem' }}>
                Featured rank{' '}
                <input type="text" inputMode="numeric" style={{ width: '4rem' }}
                  data-testid={`merch-staged-rank-${item.syncProductId}`}
                  defaultValue={item.presentation?.featuredRank ?? ''}
                  onBlur={(e) => {
                    const t = e.target.value.trim();
                    setPresentation(item, { featuredRank: t === '' ? null : Number(t) });
                  }} />
              </label>
            </fieldset>

            <button type="button" style={btn} disabled={busy || !item.pricingComplete}
              data-testid={`merch-staged-approve-${item.syncProductId}`}
              onClick={() => run(item.syncProductId,
                () => client.approveStagedFulfillment(item.syncProductId, item.etag),
                'Fulfilment mapping approved against Printful.')}>
              Approve Printful mapping
            </button>

            <button type="button" style={btn} disabled={busy || !canPrepareRelease(item)}
              data-testid={`merch-staged-prepare-${item.syncProductId}`}
              onClick={() => prepare(item)}>
              Prepare reviewed release
            </button>

            <button type="button" style={btn} disabled={busy || item.state !== 'ready_for_code_review'}
              data-testid={`merch-staged-confirm-${item.syncProductId}`}
              onClick={() => confirm(item)}>
              Confirm the deployed catalog matches
            </button>

            <button type="button" style={btn} disabled={busy}
              data-testid={`merch-staged-abandon-${item.syncProductId}`}
              onClick={() => run(item.syncProductId, () => client.abandonStaged(item.syncProductId, item.etag))}>
              Abandon
            </button>

            {manifest ? (
              <div data-testid={`merch-staged-manifest-${item.syncProductId}`} style={{ marginTop: '0.5rem' }}>
                <p style={{ fontSize: '0.75rem', margin: '0 0 0.25rem' }}>
                  Give this to a developer to add to the catalog config, then deploy. It is not applied by this screen.
                </p>
                <pre style={{ fontSize: '0.6875rem', overflowX: 'auto' }}>{JSON.stringify(manifest, null, 2)}</pre>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
