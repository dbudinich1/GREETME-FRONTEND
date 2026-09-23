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

function statusLabel(p) {
  if (!p.enabled) return 'Dormant — not activated';
  if (!p.browseAvailable) return 'Active — no browsable catalog';
  return 'Active';
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
    <ul data-testid="providers-status-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      {allProviders.map((p) => {
        const colors = statusColor(p);
        return (
          <li key={p.providerId} data-testid={`provider-status-${p.providerId}`} style={{
            border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem',
            display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap',
          }}>
            <Building2 size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <span style={{ fontWeight: 700 }}>{p.label || p.providerId}</span>
            <span data-testid={`provider-status-badge-${p.providerId}`} style={{
              padding: '0.2rem 0.625rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
              background: colors.bg, color: colors.fg,
            }}>
              {statusLabel(p)}
            </span>
            {p.enabled && p.refreshable !== false && (
              <button
                type="button"
                data-testid={`provider-refresh-${p.providerId}`}
                onClick={() => runRefresh(p.providerId)}
                disabled={refreshingId === p.providerId}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.3rem 0.625rem', borderRadius: '0.375rem', border: '1px solid var(--border)',
                  background: 'white', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit',
                }}
              >
                <RefreshCw size={12} /> Refresh
              </button>
            )}
            <button
              type="button"
              data-testid={`provider-add-${p.providerId}`}
              onClick={() => onAddProducts(p.providerId)}
              style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.35rem 0.75rem', borderRadius: '0.375rem', border: 'none',
                background: 'var(--primary)', color: 'white', fontWeight: 700, cursor: 'pointer',
                fontSize: '0.75rem', fontFamily: 'inherit',
              }}
            >
              <Plus size={13} /> Add Products
            </button>
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
  );
}
