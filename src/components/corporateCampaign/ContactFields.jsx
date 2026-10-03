// src/components/corporateCampaign/ContactFields.jsx
//
// SURFACE 8 - ONE field set shared by "Add contact" and "Edit contact" so the two can never drift apart.
// Name and email are required; everything else, including the whole delivery address, is optional and a
// missing address never produces an error. Field names follow the personal recipient form's delivery block
// (street, line 2, city, state, ZIP, country).
import { ADDRESS_ADVISORY } from "./contactManageModel.js";

const boxStyle = (err) => ({
  display: "block", width: "100%", boxSizing: "border-box", marginTop: 3, padding: 6, borderRadius: 6,
  border: `1px solid ${err ? "#b3261e" : "#cbd5e1"}`,
});
const grid = { display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" };

// Top level (not defined inside ContactFields) so an input keeps focus while the reader types.
function Field({ prefix, k, label, type = "text", value, onChange, ac, error }) {
  return (
    <label style={{ fontSize: ".78rem", fontWeight: 700 }}>
      {label}
      <input type={type} data-testid={`${prefix}-${k}`} value={value} autoComplete={ac || "off"}
        onChange={(e) => onChange(e.target.value)} aria-invalid={error ? "true" : "false"} style={boxStyle(error)} />
      {error ? <span role="alert" data-testid={`${prefix}-error-${k}`} style={{ color: "#b3261e", fontWeight: 400 }}>{error}</span> : null}
    </label>
  );
}

export default function ContactFields({ prefix, draft, setDraft, errors = {} }) {
  const set = (k, v) => setDraft({ ...draft, [k]: v });
  const setAddr = (k, v) => setDraft({ ...draft, address: { ...draft.address, [k]: v } });
  const f = (k, label, extra = {}) => (
    <Field prefix={prefix} k={k} label={label} value={draft[k]} onChange={(v) => set(k, v)} error={errors[k]} {...extra} />
  );
  const a = (k, label, ac) => (
    <Field prefix={prefix} k={k} label={label} value={draft.address[k]} onChange={(v) => setAddr(k, v)} ac={ac} error={errors[k]} />
  );
  return (
    <>
      <div style={grid}>
        {f("name", "Name *")}
        {f("email", "Email *", { type: "email" })}
        {f("phone", "Phone", { type: "tel" })}
        {f("company", "Company")}
        {f("department", "Department")}
      </div>
      <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 8, margin: "10px 0 0", padding: "8px 10px" }}>
        <legend style={{ fontSize: ".78rem", fontWeight: 700 }}>Occasion dates (optional)</legend>
        <div style={grid}>
          {f("birthday", "Birthday", { type: "date" })}
          {f("anniversary", "Anniversary", { type: "date" })}
        </div>
      </fieldset>
      <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 8, margin: "10px 0 0", padding: "8px 10px" }}>
        <legend style={{ fontSize: ".78rem", fontWeight: 700 }}>Delivery address (optional)</legend>
        <p data-testid={`${prefix}-address-advisory`} style={{ margin: "0 0 8px", fontSize: ".78rem", color: "#334155" }}>
          {ADDRESS_ADVISORY}
        </p>
        <div style={grid}>
          {a("line1", "Street address", "address-line1")}
          {a("line2", "Address line 2", "address-line2")}
          {a("city", "City", "address-level2")}
          {a("state", "State", "address-level1")}
          {a("zip", "ZIP code", "postal-code")}
          {a("country", "Country", "country-name")}
        </div>
      </fieldset>
      <label style={{ display: "block", fontSize: ".78rem", fontWeight: 700, marginTop: 10 }}>
        Notes
        <textarea data-testid={`${prefix}-notes`} rows={2} value={draft.notes} onChange={(e) => set("notes", e.target.value)} style={boxStyle(false)} />
      </label>
    </>
  );
}
