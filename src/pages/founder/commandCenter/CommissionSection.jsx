// One collapsible commission panel for the salesperson profile. Native <details>/<summary>: keyboard and screen-reader
// support come from the browser, and the content stays mounted while collapsed (so an in-progress edit is never lost).
// The saved summary sits in the <summary> row, so it is readable whether the panel is open or closed. A flex <summary>
// hides the browser's own disclosure marker, so an explicit chevron shows that the row opens.
import { useState } from "react";

const wrap = { border: "1px solid var(--border, #e5e7eb)", borderRadius: "var(--radius-md, 10px)", background: "var(--surface, #fff)" };
const head = { display: "flex", alignItems: "baseline", gap: ".6rem", padding: ".7rem .85rem", cursor: "pointer", listStyle: "none" };
const chevron = { flex: "0 0 auto", width: "1rem", fontSize: ".8rem", color: "var(--text-secondary, #475569)", transition: "transform .15s" };
const titleStyle = { fontSize: ".92rem", fontWeight: 700, marginRight: ".4rem" };
const summaryStyle = { fontSize: ".82rem", color: "var(--text-secondary, #475569)", overflowWrap: "anywhere" };

// `testPrefix` lets the same panel serve other profile sections (e.g. Links) with their own test ids.
export default function CommissionSection({ id, title, summary, defaultOpen = false, testPrefix = "fcc-commission", children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details data-testid={`${testPrefix}-${id}`} open={defaultOpen} onToggle={(e) => setOpen(e.currentTarget.open)} style={wrap}>
      <summary data-testid={`${testPrefix}-${id}-head`} style={head}>
        <span aria-hidden="true" style={{ ...chevron, transform: open ? "rotate(90deg)" : "none" }}>{"▶"}</span>
        <span style={{ minWidth: 0, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: ".2rem 0" }}>
          <span style={titleStyle}>{title}</span>
          <span data-testid={`${testPrefix}-${id}-summary`} style={summaryStyle}>{summary}</span>
        </span>
      </summary>
      <div style={{ padding: ".75rem .85rem .85rem", borderTop: "1px solid var(--border, #e5e7eb)" }}>
        {children}
      </div>
    </details>
  );
}
