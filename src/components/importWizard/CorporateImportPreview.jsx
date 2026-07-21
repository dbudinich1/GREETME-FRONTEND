// src/components/importWizard/CorporateImportPreview.jsx
//
// TEAM A — Slice 2B-1 READ-ONLY corporate import PREVIEW. Renders the normalized rows from the shared
// import pipeline (importCore.processRow) with the six structured delivery-address fields and a per-row
// address-exception badge. It is COMMIT-FREE: no API call, no write, no order — corporate import is
// still dormant. Anything shown here is derived from the same normalized model a future commit (2B-2)
// would submit, so preview↔commit parity holds. Personal review (ReviewScreen) is untouched.

import { PREVIEW_STATUS } from "../../import/corporateAddressStatus.js";

const ADDR_FIELDS = [
  ["line1", "Address Line 1"], ["line2", "Address Line 2"], ["city", "City"],
  ["state", "State/Province"], ["zip", "Postal/ZIP"], ["country", "Country"],
];

const BADGE = {
  [PREVIEW_STATUS.REVIEW]: { bg: "#eef2ff", fg: "#4338ca", bd: "#c7d2fe" },
  [PREVIEW_STATUS.INCOMPLETE]: { bg: "#fef3c7", fg: "#92400e", bd: "#fde68a" },
  [PREVIEW_STATUS.UNKNOWN_COUNTRY]: { bg: "#fef3c7", fg: "#92400e", bd: "#fde68a" },
  [PREVIEW_STATUS.ABSENT]: { bg: "#f3f4f6", fg: "#6b7280", bd: "#e5e7eb" },
};

const card = { background: "#fffdf8", border: "1px solid #e7e0d4", borderRadius: 12, padding: "18px 20px", margin: "12px 0" };
const muted = { color: "#6a5f86", fontSize: ".85rem", lineHeight: 1.5 };

export default function CorporateImportPreview({ items = [], kindLabel = "Corporate", onStartOver }) {
  const total = items.length;
  const withException = items.filter((it) => it.addressStatus.status !== PREVIEW_STATUS.REVIEW).length;
  const invalidRows = items.filter((it) => !it.valid).length;

  return (
    <div data-testid="corporate-preview" className="gmiw-corp-preview">
      <div style={{ ...card, borderColor: "rgba(214,145,16,.4)", background: "rgba(214,145,16,.06)" }}>
        <span className="gmiw-badge" style={{ display: "inline-block" }}>Preview only</span>
        <h3 style={{ margin: "6px 0", fontFamily: "Georgia,serif" }}>{kindLabel} contacts — delivery-address preview</h3>
        <p data-testid="corp-preview-note" style={muted}>
          This is a preview of your uploaded file, parsed on your device. Corporate import isn’t available
          yet — <b>nothing has been saved or sent</b>, no contact was created, and no gift was ordered.
        </p>
      </div>

      <div style={{ ...card, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
        <span data-testid="corp-count"><b>{total}</b> contact{total === 1 ? "" : "s"}</span>
        <span data-testid="corp-exception-count" style={{ color: withException ? "#92400e" : "#4338ca" }}>
          <b>{withException}</b> address{withException === 1 ? "" : "es"} need review
        </span>
        {invalidRows > 0 && <span data-testid="corp-invalid-count" style={{ color: "#92400e" }}><b>{invalidRows}</b> row{invalidRows === 1 ? "" : "s"} missing a name or valid email</span>}
      </div>

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        {items.map((it) => {
          const a = it.address || {};
          const b = BADGE[it.addressStatus.status] || BADGE.absent;
          return (
            <div key={it.index} data-testid="corp-preview-row" style={{ padding: "12px 16px", borderTop: it.index === 0 ? "none" : "1px solid #efeae0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                <div>
                  <b>{it.contact.fullName || "(no name)"}</b>
                  <span style={muted}> · {it.contact.email || "(no email)"}</span>
                  {(it.contact.company || it.contact.recipientType) && (
                    <span style={muted}> · {[it.contact.company, it.contact.department, it.contact.recipientType].filter(Boolean).join(" / ")}</span>
                  )}
                </div>
                <span data-testid="corp-addr-badge" data-status={it.addressStatus.status}
                  style={{ fontSize: ".72rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: b.bg, color: b.fg, border: `1px solid ${b.bd}` }}>
                  {it.addressStatus.label}
                </span>
              </div>
              <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "2px 14px" }}>
                {ADDR_FIELDS.map(([k, label]) => (
                  <div key={k} style={{ fontSize: ".8rem" }}>
                    <span style={{ color: "#9a8fb0" }}>{label}: </span>
                    <span data-testid={`corp-addr-${k}`} style={{ color: a[k] ? "#332a52" : "#c0b8cf" }}>{a[k] || "—"}</span>
                  </div>
                ))}
              </div>
              {!it.valid && <div data-testid="corp-row-error" style={{ marginTop: 4, fontSize: ".78rem", color: "#b91c1c" }}>This row can’t be imported: {it.errors[0]}</div>}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
        <button data-testid="corp-start-over" onClick={onStartOver}
          style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #d7d0ea", background: "#fbfaff", cursor: "pointer", fontWeight: 600 }}>
          Start over
        </button>
      </div>
    </div>
  );
}
