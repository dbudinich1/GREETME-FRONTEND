// src/components/corporateCampaign/Bubbles.jsx
//
// TEAM A — SLICE D: the circular selectors used across the dashboard.
//
// These are REAL form controls wearing a circle. The native input stays in the accessibility tree
// (visually hidden, never `display:none`), so a multi-select group is genuinely a set of checkboxes
// and a single-select group is genuinely a radio group — keyboard operation, screen-reader
// semantics, and focus all come from the platform rather than from re-implementation.
//
// A disabled bubble always carries its reason as TEXT, so state is never communicated by colour
// alone.

import "./premiumDashboard.css";

export function CategoryBubble({ id, label, note, count, checked, onChange, disabled = false, reason = null, describedBy }) {
  const descId = note || reason ? `${id}-desc` : undefined;
  return (
    <label className={`gcd-bubble${disabled ? " gcd-bubble--disabled" : ""}`} htmlFor={id} data-testid={`bubble-${id}`}>
      <input
        id={id} type="checkbox" checked={checked} disabled={disabled}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        aria-describedby={describedBy || descId}
      />
      <span className="gcd-dot" aria-hidden="true" />
      <span className="gcd-bubble-text">
        <span className="gcd-bubble-label">{label}</span>
        {typeof count === "number" ? <span className="gcd-bubble-count" data-testid={`bubble-${id}-count`}>{count} selected</span> : null}
        {note ? <span className="gcd-bubble-note" id={descId}>{note}</span> : null}
        {reason ? <span className="gcd-bubble-reason" id={descId}>{reason}</span> : null}
      </span>
    </label>
  );
}

export function ChoiceBubble({ id, name, value, label, note, checked, onChange, disabled = false, reason = null }) {
  const descId = note || reason ? `${id}-desc` : undefined;
  return (
    <label className={`gcd-bubble${disabled ? " gcd-bubble--disabled" : ""}`} htmlFor={id} data-testid={`bubble-${id}`}>
      <input
        id={id} type="radio" name={name} value={value} checked={checked} disabled={disabled}
        onChange={() => !disabled && onChange(value)}
        aria-describedby={descId}
      />
      <span className="gcd-dot" aria-hidden="true" />
      <span className="gcd-bubble-text">
        <span className="gcd-bubble-label">{label}</span>
        {note ? <span className="gcd-bubble-note" id={descId}>{note}</span> : null}
        {/* The truthful reason a real, purchasable gift cannot be automated by a campaign. */}
        {reason ? <span className="gcd-bubble-reason" id={descId} data-testid={`bubble-${id}-reason`}>{reason}</span> : null}
      </span>
    </label>
  );
}

// A labelled group wrapper. `role` is radiogroup/group so assistive tech announces the set.
export function BubbleGroup({ label, children, role = "group", testId }) {
  return (
    <div className="gcd-section" data-testid={testId}>
      <p className="gcd-section-label" id={testId ? `${testId}-label` : undefined}>{label}</p>
      <div className="gcd-bubbles" role={role} aria-labelledby={testId ? `${testId}-label` : undefined}>
        {children}
      </div>
    </div>
  );
}
