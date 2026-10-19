// src/components/dashboard/InfoTip.jsx
//
// A small info icon whose explanation opens on hover, on keyboard focus and on tap (click), and closes on Escape,
// on leaving or on a second tap. The text is announced as the button's description while open. It floats over the
// layout (absolutely positioned), so opening it never moves anything.
import { useId, useState } from 'react';
import { Info } from 'lucide-react';

export default function InfoTip({ label, children, testid }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="itip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="itip-btn"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        data-testid={testid}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
      >
        <Info size={14} aria-hidden="true" />
      </button>
      {open ? <span role="tooltip" id={id} className="itip-pop" data-testid={testid ? `${testid}-text` : undefined}>{children}</span> : null}
    </span>
  );
}
