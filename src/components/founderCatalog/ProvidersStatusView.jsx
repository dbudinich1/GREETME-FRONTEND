// src/components/founderCatalog/ProvidersStatusView.jsx
//
// PROVIDERS — STATUS ONLY (Team C, 2026-09-23). Per the approved catalog redesign, Providers shows
// connection/activation state and a safe refresh action — never product browsing (that now lives
// entirely behind "Add to Catalog"). Deliberately narrow: the browse toggle and the inline
// ProviderBrowsePanel mount that used to live in ManageCatalogDrawer.jsx's Providers tab are gone
// from here; nothing about provider browsing capability was removed backend-side.
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

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

export default function ProvidersStatusView({ client }) {
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

  return (
    <ul data-testid="providers-status-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '40rem' }}>
      {providers.map((p) => {
        const colors = statusColor(p);
        return (
          <li key={p.providerId} data-testid={`provider-status-${p.providerId}`} style={{
            border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontWeight: 700 }}>{p.label || p.providerId}</span>
              <span data-testid={`provider-status-badge-${p.providerId}`} style={{
                padding: '0.2rem 0.625rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
                background: colors.bg, color: colors.fg,
              }}>
                {statusLabel(p)}
              </span>
              {p.enabled && (
                <button
                  type="button"
                  data-testid={`provider-refresh-${p.providerId}`}
                  onClick={() => runRefresh(p.providerId)}
                  disabled={refreshingId === p.providerId}
                  style={{
                    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem',
                    padding: '0.3rem 0.625rem', borderRadius: '0.375rem', border: '1px solid var(--border)',
                    background: 'white', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit',
                  }}
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              )}
            </div>
            {p.reason && <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{p.reason}</p>}
            {Array.isArray(p.launchBlockerIds) && p.launchBlockerIds.length > 0 && (
              <ul data-testid={`provider-blockers-${p.providerId}`} style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                {p.launchBlockerIds.map((id) => <li key={id}>{id}</li>)}
              </ul>
            )}
            {refreshResult[p.providerId] && (
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{refreshResult[p.providerId]}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
