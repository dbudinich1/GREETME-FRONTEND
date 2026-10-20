// src/components/scheduledGift/ScheduledGiftEntry.jsx
//
// One occasion's scheduled physical gift, as it reads in the Occasion Scheduler and in the dashboard's Dates & gifts:
// the chosen product, how many, where it goes, the authorised maximum and whether it is ordered automatically or kept
// as a reminder — with "Choose the gift" / "Change" / "Remove". Shown only while SCHEDULED_PHYSICAL_GIFT_AVAILABLE is
// true (the caller gates it). Nothing here charges or orders.
import { centsToDollarString } from '../../utils/qrCashAmount';

export default function ScheduledGiftEntry({ setting, onChoose, onRemove, compact = false }) {
  const g = setting && setting.scheduledGift;
  const linkBtn = { background: 'none', border: 'none', padding: 0, color: 'var(--primary-dark)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontSize: '0.8125rem', fontFamily: 'inherit' };
  if (!g) {
    return (
      <button type="button" data-testid="sg-choose" onClick={onChoose}
        style={{ padding: '0.45rem 0.9rem', borderRadius: 10, border: '1px dashed var(--primary)', background: '#fff', color: 'var(--primary-dark)', fontWeight: 600, cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit', marginTop: compact ? 0 : 8 }}>
        Choose the exact gift (ordered on the date)
      </button>
    );
  }
  const count = g.vendor === 'gift_boxes' ? g.quantity : (g.items || []).length;
  const d = g.delivery || {};
  return (
    <div data-testid="sg-entry" style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: compact ? 0 : 8, padding: '0.55rem 0.7rem', border: '1px solid var(--border)', borderRadius: 12, background: '#fff' }}>
      {g.imageUrl ? <img src={g.imageUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flex: 'none' }} /> : null}
      <div style={{ minWidth: 0, flex: 1, fontSize: '0.8125rem', lineHeight: 1.45 }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{g.name || 'Chosen gift'}{count > 1 ? ` × ${count}` : ''}</div>
        <div style={{ color: 'var(--text-secondary)' }}>To {[d.firstName, d.lastName].filter(Boolean).join(' ')}, {d.city}{d.state ? `, ${d.state}` : ''} · up to {centsToDollarString(g.maxTotalCents)}</div>
        {g.backup ? <div data-testid="sg-entry-backup" style={{ color: 'var(--text-secondary)' }}>Backup: {g.backup.name || 'Chosen gift box'}</div> : null}
        <div data-testid="sg-entry-status" style={{ color: setting.autoGift ? '#166534' : 'var(--text-secondary)', fontWeight: 600 }}>
          {setting.autoGift ? 'Auto-Gift on — charged and ordered on the date' : 'Reminder only — confirmation required'}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
        <button type="button" data-testid="sg-change" onClick={onChoose} style={linkBtn}>Change</button>
        <button type="button" data-testid="sg-remove" onClick={onRemove} style={linkBtn}>Remove</button>
      </div>
    </div>
  );
}
