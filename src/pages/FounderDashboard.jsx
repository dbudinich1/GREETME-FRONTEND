// src/pages/FounderDashboard.jsx
// War room dashboard for founder — real-time system health
// Route: /admin (protected by admin key in API calls)

import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE;
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || '';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/admin/health`, {
    headers: { 'x-admin-key': ADMIN_KEY },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function fetchPayouts() {
  const [claimedRes, fulfilledRes] = await Promise.all([
    fetch(`${API_BASE}/api/gifts/admin/list?status=claimed`, { headers: { 'x-admin-key': ADMIN_KEY } }),
    fetch(`${API_BASE}/api/gifts/admin/list?status=fulfilled`, { headers: { 'x-admin-key': ADMIN_KEY } }),
  ]);
  const claimed = await claimedRes.json();
  const fulfilled = await fulfilledRes.json();
  return [
    ...(claimed.gifts || []),
    ...(fulfilled.gifts || []),
  ].filter(g => g.claimMethod && g.claimMethod !== 'stripe_connect')
   .sort((a, b) => {
     if ((a.payoutStatus === 'pending') !== (b.payoutStatus === 'pending'))
       return a.payoutStatus === 'pending' ? -1 : 1;
     return new Date(b.claimedAt || 0) - new Date(a.claimedAt || 0);
   });
}

export default function FounderDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await fetchHealth();
      setData(result);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPayouts = async () => {
    setPayoutsLoading(true);
    try { setPayouts(await fetchPayouts()); }
    catch (err) { console.error('Payouts fetch failed:', err); }
    finally { setPayoutsLoading(false); }
  };

  const markPaid = async (claimToken) => {
    if (!confirm('Mark this payout as paid?')) return;
    setMarkingPaid(claimToken);
    try {
      const res = await fetch(`${API_BASE}/api/gifts/admin/fulfill/${claimToken}`, {
        method: 'POST',
        headers: { 'x-admin-key': ADMIN_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      if (result.ok) { loadPayouts(); }
      else { alert(result.error || 'Failed to mark as paid'); }
    } catch (err) { alert(`Error: ${err.message}`); }
    finally { setMarkingPaid(null); }
  };

  useEffect(() => { load(); loadPayouts(); }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (error && !data) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', fontFamily: FONT }}>
        <h1 style={{ color: '#dc2626' }}>Dashboard Error</h1>
        <p style={{ color: '#666' }}>{error}</p>
        <p style={{ color: '#999', fontSize: '0.875rem' }}>Check VITE_ADMIN_KEY is set and ADMIN_API_KEY matches on backend.</p>
      </div>
    );
  }

  const s = data?.sends || {};
  const g = data?.g1g1 || {};
  const u = data?.users || {};
  const lc = data?.launchControl || {};
  const errors = data?.errors || [];

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: FONT, padding: '2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Greet-Me Command Center</h1>
            <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '0.25rem 0 0' }}>
              {lastRefresh ? `Last refresh: ${lastRefresh.toLocaleTimeString()}` : 'Loading...'} · Auto-refresh 30s
            </p>
          </div>
          <button onClick={load} disabled={loading} style={{
            padding: '0.5rem 1rem', background: '#334155', color: '#e2e8f0',
            border: '1px solid #475569', borderRadius: '6px', cursor: 'pointer',
            fontSize: '0.875rem', fontFamily: FONT,
          }}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Launch Control Status */}
        {(lc.pauseSends || lc.pauseG1G1) && (
          <div style={{
            background: '#7f1d1d', border: '1px solid #dc2626', borderRadius: '8px',
            padding: '1rem', marginBottom: '1.5rem', textAlign: 'center',
          }}>
            {lc.pauseSends && <strong>SENDS PAUSED</strong>}
            {lc.pauseSends && lc.pauseG1G1 && ' · '}
            {lc.pauseG1G1 && <strong>G1G1 PAUSED</strong>}
          </div>
        )}

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <MetricCard label="Sends (24h)" value={s.total || 0} sub={`${s.success || 0} ok · ${s.failed || 0} failed`} alert={s.failed > 0} />
          <MetricCard label="G1G1 Created" value={g.created || 0} sub={`${g.claimed || 0} claimed (${g.claimRate || 'n/a'})`} />
          <MetricCard label="New Users (24h)" value={u.newUsers || 0} />
          <MetricCard label="Send Success Rate" value={s.total > 0 ? `${((s.success / s.total) * 100).toFixed(0)}%` : '—'} alert={s.total > 0 && s.success / s.total < 0.95} />
        </div>

        {/* Recent Errors */}
        <div style={{ background: '#1e293b', borderRadius: '8px', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem', color: '#f1f5f9' }}>
            Recent Issues ({errors.length})
          </h2>
          {errors.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No issues in last 24 hours.</p>
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {errors.map((e, i) => (
                <div key={i} style={{
                  padding: '0.5rem 0', borderBottom: '1px solid #334155',
                  fontSize: '0.8125rem', display: 'flex', gap: '1rem',
                }}>
                  <span style={{ color: '#64748b', minWidth: '140px' }}>{new Date(e.at).toLocaleString()}</span>
                  <span style={{ color: '#f87171', minWidth: '160px' }}>{e.type}</span>
                  <span style={{ color: '#94a3b8' }}>{e.reason || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* QR Cash Payouts */}
        <div style={{ background: '#1e293b', borderRadius: '8px', padding: '1.25rem', marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#f1f5f9' }}>
              QR Cash Payouts ({payouts.filter(p => p.payoutStatus === 'pending').length} pending)
            </h2>
            <button onClick={loadPayouts} disabled={payoutsLoading} style={{
              padding: '0.375rem 0.75rem', background: '#334155', color: '#e2e8f0',
              border: '1px solid #475569', borderRadius: '4px', cursor: 'pointer',
              fontSize: '0.75rem', fontFamily: FONT,
            }}>
              {payoutsLoading ? '...' : 'Refresh'}
            </button>
          </div>
          {payouts.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No QR Cash claims found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #334155', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.5rem', color: '#94a3b8', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '0.5rem 0.5rem', color: '#94a3b8', fontWeight: 600 }}>Recipient</th>
                    <th style={{ padding: '0.5rem 0.5rem', color: '#94a3b8', fontWeight: 600 }}>Amount</th>
                    <th style={{ padding: '0.5rem 0.5rem', color: '#94a3b8', fontWeight: 600 }}>Method</th>
                    <th style={{ padding: '0.5rem 0.5rem', color: '#94a3b8', fontWeight: 600 }}>Destination</th>
                    <th style={{ padding: '0.5rem 0.5rem', color: '#94a3b8', fontWeight: 600 }}>Claimed</th>
                    <th style={{ padding: '0.5rem 0.5rem', color: '#94a3b8', fontWeight: 600 }}>Paid</th>
                    <th style={{ padding: '0.5rem 0.5rem', color: '#94a3b8', fontWeight: 600 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '0.5rem' }}>
                        <span style={{
                          display: 'inline-block', padding: '0.125rem 0.5rem', borderRadius: '9999px',
                          fontSize: '0.6875rem', fontWeight: 600,
                          background: p.payoutStatus === 'pending' ? '#fef3c7' : '#d1fae5',
                          color: p.payoutStatus === 'pending' ? '#92400e' : '#065f46',
                        }}>
                          {p.payoutStatus || 'pending'}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem', color: '#e2e8f0' }}>
                        <div>{p.recipientName || '—'}</div>
                        <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{p.recipientEmail || ''}</div>
                      </td>
                      <td style={{ padding: '0.5rem', color: '#10b981', fontWeight: 600 }}>
                        ${((p.giftAmountCents || 0) / 100).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.5rem', color: '#e2e8f0' }}>{p.claimMethod || '—'}</td>
                      <td style={{ padding: '0.5rem', color: '#e2e8f0', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.claimDetails?.destination || '—'}
                      </td>
                      <td style={{ padding: '0.5rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                        {p.claimedAt ? new Date(p.claimedAt).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '0.5rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        {p.payoutStatus === 'pending' ? (
                          <button
                            onClick={() => markPaid(p.id)}
                            disabled={markingPaid === p.id}
                            style={{
                              padding: '0.25rem 0.5rem', background: '#059669', color: 'white',
                              border: 'none', borderRadius: '4px', cursor: 'pointer',
                              fontSize: '0.6875rem', fontWeight: 600, fontFamily: FONT,
                              opacity: markingPaid === p.id ? 0.5 : 1,
                            }}
                          >
                            {markingPaid === p.id ? '...' : 'Mark Paid'}
                          </button>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: '0.6875rem' }}>✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {payouts.some(p => p.fraudFlags?.length) && (
            <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.75rem' }}>
              ⚠️ Some claims have fraud flags — check admin/list details before paying out.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, alert }) {
  return (
    <div style={{
      background: '#1e293b', borderRadius: '8px', padding: '1.25rem',
      border: alert ? '1px solid #dc2626' : '1px solid #334155',
    }}>
      <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: alert ? '#f87171' : '#f1f5f9' }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 0' }}>{sub}</p>}
    </div>
  );
}
