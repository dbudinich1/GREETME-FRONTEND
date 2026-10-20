// src/components/G1G1Badge.jsx
// Compact G1G1 control for the dashboard header (replaces the gold foil seal, founder 2026-10-20). The seal it
// replaces had no action (it was a static decoration), so this control's only action is its explanation: shown on
// hover and keyboard focus, and toggled by a tap. Escape or a tap elsewhere closes it.
import { useEffect, useRef, useState } from 'react';

export const G1G1_EXPLANATION = 'Every Greet-Me subscription comes with one of equal value to share with a friend or loved one.';

export default function G1G1Badge({ compact = false }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  const shown = open || hover || focused;

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }} onPointerLeave={() => setHover(false)}>
      <button
        type="button"
        data-testid="g1g1-badge"
        aria-describedby="g1g1-tip"
        aria-expanded={shown}
        aria-label="G1G1™ Greet One, Give One™"
        onClick={() => setOpen((v) => !v)}
        // Keyboard focus shows it; focus that comes from a tap or click does not, so a second tap can close it.
        onFocus={(e) => { let kb = false; try { kb = e.currentTarget.matches(':focus-visible'); } catch { kb = false; } setFocused(kb); }}
        onBlur={() => { setFocused(false); setOpen(false); }}
        onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setFocused(false); e.currentTarget.blur(); } }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
          height: compact ? '2.25rem' : '2.5rem', minHeight: 0, padding: compact ? '0 0.625rem' : '0 0.875rem',
          borderRadius: '999px', border: '1px solid #C9A961', cursor: 'pointer',
          background: 'linear-gradient(135deg,#FBF0D2 0%,#F5E6C8 55%,#EBD07A 100%)',
          color: '#3D2F0F', font: `800 ${compact ? '0.8125rem' : '0.875rem'}/1 Inter, -apple-system, "Segoe UI", Roboto, sans-serif`,
          letterSpacing: '0.04em', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(139,105,20,0.18)',
        }}
      >
        <span aria-hidden="true" style={{ color: '#8B6914', fontSize: '0.75rem' }}>★</span>
        G1G1™
      </button>
      <span
        id="g1g1-tip"
        role="tooltip"
        data-testid="g1g1-tip"
        style={{
          position: 'absolute', top: 'calc(100% + 8px)', ...(compact ? { right: 0 } : { left: 0 }), zIndex: 60,
          width: compact ? '15rem' : '17rem', maxWidth: 'calc(100vw - 2rem)',
          background: '#2C1D46', color: '#fff', borderRadius: '10px', padding: '0.625rem 0.75rem',
          font: '500 0.8125rem/1.45 Inter, -apple-system, "Segoe UI", Roboto, sans-serif',
          boxShadow: '0 12px 28px -12px rgba(0,0,0,0.5)', textAlign: 'left', whiteSpace: 'normal',
          visibility: shown ? 'visible' : 'hidden', opacity: shown ? 1 : 0, transition: 'opacity .15s',
          pointerEvents: shown ? 'auto' : 'none',
        }}
      >
        {G1G1_EXPLANATION}
      </span>
    </span>
  );
}
