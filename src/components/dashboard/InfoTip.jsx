// src/components/dashboard/InfoTip.jsx
//
// A small info icon whose explanation opens on hover, on keyboard focus and on tap (click), and closes on Escape,
// on leaving, on tapping elsewhere or on scroll. (A tap focuses the button before it clicks, so a click only ever
// opens it; toggling would open and immediately close it on a real tap.) The text is announced as the button's description while open. The
// explanation is positioned against the window (fixed), so a scrolling list can never clip it and opening it never
// moves anything on the page.
import { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';

export default function InfoTip({ label, children, testid }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const id = useId();

  const show = () => {
    const r = btnRef.current && typeof btnRef.current.getBoundingClientRect === 'function' ? btnRef.current.getBoundingClientRect() : null;
    if (r) {
      const width = 260;
      const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, (window.innerWidth || 1024) - width - 8));
      setPos({ left, bottom: (window.innerHeight || 768) - r.top + 6, width });
    }
    setOpen(true);
  };
  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);

  return (
    <span className="itip" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={btnRef}
        type="button"
        className="itip-btn"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        data-testid={testid}
        onClick={show}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(e) => { if (e.key === 'Escape') hide(); }}
      >
        <Info size={14} aria-hidden="true" />
      </button>
      {open ? (
        <span role="tooltip" id={id} className="itip-pop" data-testid={testid ? `${testid}-text` : undefined}
          style={pos ? { position: 'fixed', left: pos.left, bottom: pos.bottom, width: pos.width, transform: 'none', top: 'auto' } : undefined}>
          {children}
        </span>
      ) : null}
    </span>
  );
}
