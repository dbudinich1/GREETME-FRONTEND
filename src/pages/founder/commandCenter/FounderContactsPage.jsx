// W46 Founder contact book (lean version). Founder-only (the server enforces it; this check is cosmetic). General housekeeping
// contacts: not a lead tracker. Delete is PERMANENT and always goes through a warning step. Links open in a new tab and are never fetched.
import { useCallback, useEffect, useState } from "react";
import { isFounder } from "../../../utils/accountState.js";
import { founderContactsApi, founderContactsErrorMessage } from "../../../api/founderContacts.js";
import { Page, ui } from "./commandCenterUi.jsx";

export const STARTER_CATEGORIES = ["Partner", "Advisor", "Vendor", "Investor", "Legal / Finance", "Press", "Key person", "Other"];
export const DELETE_WARNING = "Continuing will delete this contact permanently. Are you sure you want to delete this contact?";

function readUser() {
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
}
/** http/https only; anything else is not rendered as a link. */
export function safeUrl(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try { const u = new URL(withScheme); return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : ""; } catch { return ""; }
}
const blank = () => ({ name: "", organization: "", roleTitle: "", category: "", emails: [], phones: [], links: [], notes: "", tags: [], nextFollowUpAt: "" });
const fieldCss = { padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: ".9rem", width: "100%", boxSizing: "border-box" };
const lab = { display: "block", fontSize: ".78rem", fontWeight: 700, color: "#3a3552", margin: "10px 0 3px" };
const errCss = { color: "#b3261e", fontSize: ".78rem", margin: "2px 0 0" };

export function validate(c) {
  const e = {};
  if (!String(c.name || "").trim()) e.name = "Name is required.";
  (c.emails || []).forEach((x, i) => { if (x.value && !/^\S+@\S+\.\S+$/.test(x.value.trim())) e[`email-${i}`] = "That email address does not look right."; });
  (c.links || []).forEach((x, i) => { if (x.url && !safeUrl(x.url)) e[`link-${i}`] = "Use a web address starting with http or https."; });
  if (c.nextFollowUpAt && !/^\d{4}-\d{2}-\d{2}$/.test(c.nextFollowUpAt)) e.nextFollowUpAt = "Use the date format YYYY-MM-DD.";
  return e;
}
const clean = (c) => ({
  name: c.name.trim(), organization: c.organization.trim(), roleTitle: c.roleTitle.trim(), category: c.category.trim(),
  emails: c.emails.filter((x) => x.value.trim()).map((x) => ({ label: x.label.trim(), value: x.value.trim() })),
  phones: c.phones.filter((x) => x.value.trim()).map((x) => ({ label: x.label.trim(), value: x.value.trim() })),
  links: c.links.filter((x) => x.url.trim()).map((x) => ({ label: x.label.trim(), url: safeUrl(x.url) })),
  notes: c.notes, tags: c.tags, nextFollowUpAt: c.nextFollowUpAt || null,
});

function RowList({ label, items, onChange, kind, errors }) {
  const key = kind === "link" ? "url" : "value";
  return (
    <div>
      <span style={lab}>{label}</span>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
          <input style={{ ...fieldCss, flex: "0 0 30%" }} aria-label={`${label} ${i + 1} label`} data-testid={`f-${kind}-label-${i}`} placeholder="Label" value={it.label} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <input style={fieldCss} aria-label={`${label} ${i + 1}`} data-testid={`f-${kind}-${i}`} value={it[key]} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [key]: e.target.value } : x)))} />
          <button type="button" style={ui.btn2} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove ${label} ${i + 1}`}>Remove</button>
          {errors[`${kind}-${i}`] ? <span style={errCss} data-testid={`err-${kind}-${i}`}>{errors[`${kind}-${i}`]}</span> : null}
        </div>
      ))}
      <button type="button" style={ui.btn2} data-testid={`add-${kind}`} onClick={() => onChange([...items, kind === "link" ? { label: "", url: "" } : { label: "", value: "" }])}>Add {label.toLowerCase().replace(/s$/, "")}</button>
    </div>
  );
}

function ContactForm({ initial, onSave, onCancel, busy, serverError }) {
  const [c, setC] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }));
  function submit(ev) {
    ev.preventDefault();
    const e = validate(c);
    setErrors(e);
    if (Object.keys(e).length === 0) onSave(clean(c));
  }
  return (
    <form onSubmit={submit} noValidate data-testid="contact-form" style={ui.card}>
      <h2 style={ui.title}>{initial.id ? "Edit contact" : "Add contact"}</h2>
      <label style={lab} htmlFor="f-name">Name</label>
      <input id="f-name" style={fieldCss} data-testid="f-name" value={c.name} onChange={(e) => set("name", e.target.value)} />
      {errors.name ? <p style={errCss} data-testid="err-name">{errors.name}</p> : null}
      <label style={lab} htmlFor="f-org">Organization</label>
      <input id="f-org" style={fieldCss} data-testid="f-org" value={c.organization} onChange={(e) => set("organization", e.target.value)} />
      <label style={lab} htmlFor="f-role">Role or title</label>
      <input id="f-role" style={fieldCss} data-testid="f-role" value={c.roleTitle} onChange={(e) => set("roleTitle", e.target.value)} />
      <label style={lab} htmlFor="f-cat">Category</label>
      <input id="f-cat" list="cat-list" style={fieldCss} data-testid="f-cat" value={c.category} onChange={(e) => set("category", e.target.value)} />
      <datalist id="cat-list">{STARTER_CATEGORIES.map((x) => <option key={x} value={x} />)}</datalist>
      <RowList label="Emails" kind="email" items={c.emails} onChange={(v) => set("emails", v)} errors={errors} />
      <RowList label="Phones" kind="phone" items={c.phones} onChange={(v) => set("phones", v)} errors={errors} />
      <RowList label="Links" kind="link" items={c.links} onChange={(v) => set("links", v)} errors={errors} />
      <label style={lab} htmlFor="f-follow">Next follow-up (YYYY-MM-DD)</label>
      <input id="f-follow" style={fieldCss} data-testid="f-follow" value={c.nextFollowUpAt || ""} onChange={(e) => set("nextFollowUpAt", e.target.value)} />
      {errors.nextFollowUpAt ? <p style={errCss} data-testid="err-follow">{errors.nextFollowUpAt}</p> : null}
      <label style={lab} htmlFor="f-notes">Notes</label>
      <textarea id="f-notes" rows={4} style={fieldCss} data-testid="f-notes" value={c.notes} onChange={(e) => set("notes", e.target.value)} />
      <p style={ui.note} data-testid="notes-warning">Do not store passwords or card numbers here.</p>
      {serverError ? <p style={errCss} data-testid="form-error" role="alert">{serverError}</p> : null}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="submit" style={ui.btn} disabled={busy} data-testid="f-save">Save</button>
        <button type="button" style={ui.btn2} onClick={onCancel} data-testid="f-cancel">Cancel</button>
      </div>
    </form>
  );
}

export default function FounderContactsPage({ api = founderContactsApi, user: injectedUser }) {
  const founder = isFounder(injectedUser !== undefined ? injectedUser : readUser());
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [due, setDue] = useState(false);
  const [state, setState] = useState({ loading: true });
  const [mode, setMode] = useState(null); // null | { contact } for form | { confirm } for delete
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [serverError, setServerError] = useState("");
  const load = useCallback(async () => {
    const r = await api.list({ q: q.trim(), category, followUpDue: due, sort: "name" });
    if (r.ok && r.data && Array.isArray(r.data.contacts)) setState({ data: r.data });
    else setState({ error: founderContactsErrorMessage(r) });
  }, [api, q, category, due]);
  useEffect(() => { if (founder) load(); }, [founder, load]);

  if (!founder) return <div style={{ padding: "2rem" }} data-testid="contacts-denied"><h1 style={{ fontSize: "1.25rem", margin: 0 }}>Not available</h1><p style={{ marginTop: ".5rem", color: "#605c78" }}>This area is limited to the founder account.</p></div>;
  const trail = [["Contacts"]];

  async function save(fields) {
    setBusy(true); setServerError("");
    const r = mode.contact.id ? await api.update(mode.contact.id, fields) : await api.create(fields);
    setBusy(false);
    if (!r.ok) { setServerError(founderContactsErrorMessage(r)); return; }
    setNotice(mode.contact.id ? "Contact updated." : "Contact added.");
    setMode(null); load();
  }
  async function remove(id) {
    setBusy(true);
    const r = await api.remove(id);
    setBusy(false);
    if (!r.ok && r.status !== 404) { setNotice(founderContactsErrorMessage(r)); setMode(null); return; }
    setNotice("Contact deleted."); setMode(null); load();
  }

  if (mode && mode.contact) {
    return <Page trail={trail} title="Contacts" testid="page-contacts"><ContactForm initial={mode.contact} onSave={save} onCancel={() => { setMode(null); setServerError(""); }} busy={busy} serverError={serverError} /></Page>;
  }
  const d = state.data;
  return (
    <Page trail={trail} title="Contacts" sub="Important contacts, vital info and links. A private founder-only book, separate from customer contacts." testid="page-contacts">
      {notice ? <p role="status" data-testid="notice" style={{ ...ui.note, color: "#166534", margin: "0 0 10px" }}>{notice}</p> : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input style={{ ...fieldCss, width: 240 }} placeholder="Search contacts" aria-label="Search contacts" data-testid="search" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={{ ...fieldCss, width: 190 }} aria-label="Category" data-testid="filter-category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {[...new Set([...STARTER_CATEGORIES, ...((d && d.categories) || [])])].map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <label style={{ fontSize: ".84rem" }}><input type="checkbox" data-testid="filter-due" checked={due} onChange={(e) => setDue(e.target.checked)} /> Follow-up due</label>
        <button type="button" style={ui.btn} data-testid="add-contact" onClick={() => { setNotice(""); setServerError(""); setMode({ contact: blank() }); }}>Add contact</button>
      </div>
      {state.loading ? <p style={ui.note} data-testid="loading">Loading contacts...</p> : null}
      {state.error ? <p role="alert" style={{ ...ui.note, color: "#b3261e" }} data-testid="error">{state.error} <button type="button" style={ui.btn2} onClick={load} data-testid="retry">Try again</button></p> : null}
      {d && d.contacts.length === 0 ? <p style={ui.note} data-testid="empty">{q || category || due ? "No contacts match." : "No contacts yet. Add your first important contact."}</p> : null}
      {d ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }} data-testid="contact-list">
          {d.contacts.map((c) => (
            <li key={c.id} data-testid={`contact-${c.id}`} style={ui.card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div><strong style={{ fontSize: "1rem" }}>{c.name}</strong>{c.roleTitle ? <span style={ui.note}>, {c.roleTitle}</span> : null}{c.organization ? <div style={ui.note}>{c.organization}</div> : null}</div>
                <span style={ui.note}>{c.category}</span>
              </div>
              {(c.emails || []).map((e, i) => <div key={`e${i}`} style={ui.note}>{e.label || "Email"}: {e.value}</div>)}
              {(c.phones || []).map((e, i) => <div key={`p${i}`} style={ui.note}>{e.label || "Phone"}: {e.value}</div>)}
              {(c.links || []).map((l, i) => { const href = safeUrl(l.url); return href ? <div key={`l${i}`}><a href={href} target="_blank" rel="noopener noreferrer" data-testid={`link-${c.id}-${i}`}>{l.label || l.url}</a></div> : null; })}
              {c.nextFollowUpAt ? <div style={ui.note} data-testid={`follow-${c.id}`}>Follow up by {c.nextFollowUpAt}</div> : null}
              {c.notes ? <div style={{ ...ui.note, whiteSpace: "pre-wrap" }}>{c.notes}</div> : null}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={ui.btn2} data-testid={`edit-${c.id}`} onClick={() => { setNotice(""); setServerError(""); setMode({ contact: { ...blank(), ...c, nextFollowUpAt: c.nextFollowUpAt || "", emails: c.emails || [], phones: c.phones || [], links: c.links || [], tags: c.tags || [] } }); }}>Edit</button>
                <button type="button" style={ui.btn2} data-testid={`delete-${c.id}`} onClick={() => setMode({ confirm: c })}>Delete</button>
              </div>
              {mode && mode.confirm && mode.confirm.id === c.id ? (
                <div role="alertdialog" aria-label="Confirm delete" data-testid="delete-confirm" style={{ border: "1px solid #b3261e", borderRadius: 10, padding: 12, background: "#fef2f2" }}>
                  <p style={{ margin: "0 0 8px", fontSize: ".88rem" }} data-testid="delete-warning">{DELETE_WARNING}</p>
                  <button type="button" style={ui.btn} disabled={busy} data-testid="delete-confirm-go" onClick={() => remove(c.id)}>Yes, delete permanently</button>{" "}
                  <button type="button" style={ui.btn2} data-testid="delete-cancel" onClick={() => setMode(null)}>Cancel</button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Page>
  );
}
