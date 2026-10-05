// Plain hash links, like the rest of Central Command (the app uses HashRouter). Shared layout for the Command Center hub pages (breadcrumbs, page frame, link lists). Presentation only.

export const ui = {
  card: { background: "#fff", border: "1px solid rgba(27,24,48,.12)", borderRadius: 16, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 },
  title: { margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1b1830" },
  note: { fontSize: ".8rem", color: "#475569", margin: 0, lineHeight: 1.45 },
  btn: { background: "#4F2D7F", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: ".82rem", textDecoration: "none", display: "inline-block", cursor: "pointer" },
  btn2: { background: "#fff", color: "#4F2D7F", border: "1px solid #4F2D7F", borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: ".82rem", textDecoration: "none", display: "inline-block", cursor: "pointer" },
  th: { textAlign: "left", padding: "8px 10px", fontSize: ".74rem", fontWeight: 700, color: "#3a3552", whiteSpace: "nowrap", borderBottom: "1px solid #e5e7eb" },
  td: { padding: "8px 10px", fontSize: ".86rem", color: "#1b1830", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" },
};
ui.num = { ...ui.td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
export const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 };

export function Crumbs({ trail }) {
  return (
    <nav aria-label="Breadcrumb" data-testid="cc-crumbs" style={{ fontSize: ".82rem", margin: "0 0 12px", display: "flex", gap: 6, flexWrap: "wrap" }}>
      <a href="#/dashboard/founder/command" data-testid="cc-back-command" style={{ color: "#4F2D7F", fontWeight: 700 }}>Central Command</a>
      {trail.map(([label, to]) => (
        <span key={label}>/ {to ? <a href={`#${to}`} style={{ color: "#4F2D7F", fontWeight: 700 }}>{label}</a> : <span data-testid="cc-crumb-here">{label}</span>}</span>
      ))}
    </nav>
  );
}
export function Page({ trail, title, sub, testid, children }) {
  return (
    <div data-testid={testid} style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      <Crumbs trail={trail} />
      <h1 data-testid="cc-page-title" style={{ fontFamily: "Georgia, serif", fontSize: "1.4rem", margin: 0 }}>{title}</h1>
      {sub ? <p style={{ color: "#605c78", fontSize: ".85rem", margin: "6px 0 14px" }}>{sub}</p> : null}
      {children}
    </div>
  );
}
/** Plain list of related destinations behind a hub. Each entry is a real, existing route. */
export function LinkList({ items, testid }) {
  return (
    <ul data-testid={testid} style={{ listStyle: "none", margin: "16px 0 0", padding: 0, display: "grid", gap: 8 }}>
      {items.map((it) => (
        <li key={it.id} data-testid={`cc-item-${it.id}`} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 14px" }}>
          <div style={{ fontWeight: 700, fontSize: ".92rem" }}>
            <a href={`#${it.to}`} data-testid={`cc-link-${it.id}`} style={{ color: "#4F2D7F" }}>{it.label}</a>
          </div>
          <div style={ui.note}>{it.desc}</div>
        </li>
      ))}
    </ul>
  );
}
