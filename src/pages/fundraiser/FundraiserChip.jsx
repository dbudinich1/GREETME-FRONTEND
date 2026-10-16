// src/pages/fundraiser/FundraiserChip.jsx
// Status chip shared by the founder and partner fundraiser screens (approved rev 6 layout).
const STATUS = {
  active: ["Active", "#dcfce7", "#166534"],
  ended: ["Partnership ended", "#f1f5f9", "#64748b"],
  prepared: ["Not active yet", "#fef3c7", "#92400e"],
  suspended: ["Suspended", "#fee2e2", "#991b1b"],
  draft: ["Draft", "#f1f5f9", "#334155"],
  closed: ["Closed", "#f1f5f9", "#64748b"],
  paused: ["Paused", "#fef3c7", "#92400e"],
};

export default function Chip({ s }) {
  const [t, bg, fg] = STATUS[s] || [s, "#eee", "#333"];
  return <span data-chip={s} style={{ display: "inline-block", fontSize: 12, fontWeight: 700, padding: "2px 9px", borderRadius: 10, background: bg, color: fg, whiteSpace: "nowrap" }}>{t}</span>;
}
