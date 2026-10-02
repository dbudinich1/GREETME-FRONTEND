// src/components/founderCatalog/ProvidersStatusView.jsx
//
// PROVIDERS — the opening view of Manage Catalog (Team C, 2026-09-23 redesign; provider-first
// pass same day). Each row shows a restrained icon, name, its real existing status, and a
// "+ Add Products" action that opens that ONE provider's picker directly — never a second
// provider-selection screen. A safe refresh action is offered where the backend actually supports
// it. Product browsing itself still lives entirely behind "Add Products" (AddToCatalogPicker);
// nothing about provider browsing capability was removed backend-side.
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Building2, Plus } from 'lucide-react';

// W11: three different facts must never collapse into one bare "Active".
//   1. INTEGRATION — is the provider connection switched on (p.enabled)?
//   2. CATALOG    — can we browse its products to publish (p.browseAvailable)?
//   3. PURCHASABLE — customers can only buy products the founder has PUBLISHED to the catalog.
// The badge states (1); the caption beneath states (2) and (3).
export function statusLabel(p) {
  return p.enabled ? 'Integration enabled' : 'Integration off';
}

export function catalogCaption(p) {
  if (!p.enabled) return 'Nothing from this provider is purchasable by customers.';
  if (!p.browseAvailable) return 'No browsable catalog — cannot publish new products. Customers can buy only products already published.';
  return 'Browsable. Customers can buy only products you have published to the catalog.';
}

function statusColor(p) {
  if (!p.enabled) return { bg: '#f1f5f9', fg: 'var(--text-tertiary)' };
  if (!p.browseAvailable) return { bg: '#fef3c7', fg: '#92400e' };
  return { bg: '#d1fae5', fg: '#065f46' };
}

/**
 * Printful is a live, shipping, charging merch supplier — not a member of the dormant-provider
 * registry (services/providers/registry.js asserts exactly three registrations: florist_one,
 * goody, prezzee; a CI guard fails the build if "printful" ever appears in FULFILLABLE_SOURCES).
 * So this row is synthesized here rather than returned by listProviders() — but its status is not
 * invented: Printful products already ship and charge cards today, through the existing staging/
 * review pipeline (see AddToCatalogPicker's own "submitted for a reviewed release" copy), so
 * "Active" reflects the true, existing state. It carries no refresh action because this endpoint
 * has never governed it — inventing one here would claim a capability that does not exist.
 */
const PRINTFUL_STATUS_ENTRY = Object.freeze({
  providerId: 'printful',
  label: 'Printful',
  enabled: true,
  browseAvailable: true,
  reason: 'Live merch supplier. New products are submitted for a reviewed release before going live.',
  refreshable: false,
});

// W12/W13 Option B styles. Container query keyed to each provider card, so the narrow layout also applies
// inside a narrow drawer, not just a narrow viewport.
const ROW_CSS = `
.gm-psv-row{display:grid;align-items:center;gap:.5rem .75rem;grid-template-columns:16px 190px 190px 1fr;grid-template-areas:"ic nm st ad"}
@container (max-width:520px){.gm-psv-row{grid-template-columns:16px 1fr auto;grid-template-areas:"ic nm ad" "st st st"}}
[data-testid^="provider-status-"]{container-type:inline-size}
.gm-psv-refresh-slot{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:0 0 28px}
.gm-psv-refresh{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:#fff;color:var(--text-secondary);cursor:pointer}
.gm-psv-refresh:hover:not(:disabled){background:#f1f5f9;color:var(--text-primary)}
.gm-psv-refresh:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.gm-psv-refresh:disabled{cursor:default;opacity:.6}
.gm-psv-spin{animation:gm-psv-spin 0.9s linear infinite}
@keyframes gm-psv-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.gm-psv-spin{animation-duration:2.5s}}
`;
export default function ProvidersStatusView({ client, onAddProducts }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshingId, setRefreshingId] = useState(null);
  const [refreshResult, setRefreshResult] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.listProviders();
      setProviders(Array.isArray(res?.providers) ? res.providers : []);
    } catch (e) {
      setError(e?.message || 'Could not load provider status.');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { load(); }, [load]);

  const runRefresh = useCallback(async (providerId) => {
    setRefreshingId(providerId);
    try {
      const res = await client.refreshProvider(providerId, {});
      setRefreshResult((prev) => ({ ...prev, [providerId]: res?.ok ? `Refreshed ${res.refreshed ?? 0}` : (res?.error || 'Refresh failed') }));
    } catch (e) {
      setRefreshResult((prev) => ({ ...prev, [providerId]: e?.message || 'Refresh failed' }));
    } finally {
      setRefreshingId(null);
    }
  }, [client]);

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading providers…</p>;
  if (error) return <p style={{ color: '#dc2626' }}>{error}</p>;

  // Printful is not part of the backend registry this endpoint reads (by design — see above), so
  // it is appended here rather than fetched, once the real providers have actually loaded.
  const allProviders = [...providers, PRINTFUL_STATUS_ENTRY];

  return (
    <>
    <style>{ROW_CSS}</style>
    <ul data-testid="providers-status-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      {allProviders.map((p) => {
        const colors = statusColor(p);
        return (
          <li key={p.providerId} data-testid={`provider-status-${p.providerId}`} style={{
            border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
          }}>
            {/* THE ACTION ROW (W12/W13 Option B): a fixed grid - icon | name + reserved refresh-icon slot |
                status badge | Add Products. The refresh slot is ALWAYS rendered (empty for Goody/Printful),
                so the badge and Add Products land in the same place on every row; below ~520px the badge
                moves to its own full-width line, again identical on every row. */}
            <div className="gm-psv-row">
              <Building2 size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0, gridArea: 'ic' }} />
              <span style={{ gridArea: 'nm', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.375rem', minWidth: 0 }}>
                <span style={{ fontWeight: 700 }}>{p.label || p.providerId}</span>
                <span className="gm-psv-refresh-slot" data-testid={`provider-refresh-slot-${p.providerId}`}>
                  {p.enabled && p.refreshable !== false && (
                    <button
                      type="button"
                      data-testid={`provider-refresh-${p.providerId}`}
                      aria-label={`Refresh ${p.label || p.providerId}`}
                      title={`Refresh ${p.label || p.providerId} catalog`}
                      aria-busy={refreshingId === p.providerId}
                      onClick={() => runRefresh(p.providerId)}
                      disabled={refreshingId === p.providerId}
                      className="gm-psv-refresh"
                      style={{ padding: 0 }}
                    >
                      <RefreshCw size={14} className={refreshingId === p.providerId ? 'gm-psv-spin' : undefined} />
                    </button>
                  )}
                </span>
              </span>
              <span data-testid={`provider-status-badge-${p.providerId}`} style={{
                gridArea: 'st', padding: '0.2rem 0.625rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
                background: colors.bg, color: colors.fg, textAlign: 'center',
              }}>
                {statusLabel(p)}
              </span>
              <button
                type="button"
                data-testid={`provider-add-${p.providerId}`}
                onClick={() => onAddProducts(p.providerId)}
                style={{
                  gridArea: 'ad', justifySelf: 'end', display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.35rem 0.75rem', borderRadius: '0.375rem', border: 'none',
                  background: 'var(--primary)', color: 'white', fontWeight: 700, cursor: 'pointer',
                  fontSize: '0.75rem', fontFamily: 'inherit',
                }}
              >
                <Plus size={13} /> Add Products
              </button>
            </div>            <p data-testid={`provider-catalog-caption-${p.providerId}`} style={{ margin: 0, width: '100%', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {catalogCaption(p)}
            </p>
            {p.reason && <p style={{ margin: 0, width: '100%', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{p.reason}</p>}
            {Array.isArray(p.launchBlockerIds) && p.launchBlockerIds.length > 0 && (
              <ul data-testid={`provider-blockers-${p.providerId}`} style={{ margin: 0, width: '100%', paddingLeft: '1.25rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                {p.launchBlockerIds.map((id) => <li key={id}>{id}</li>)}
              </ul>
            )}
            {refreshResult[p.providerId] && (
              <p style={{ margin: 0, width: '100%', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{refreshResult[p.providerId]}</p>
            )}
          </li>
        );
      })}
    </ul>
    </>
  );
}
