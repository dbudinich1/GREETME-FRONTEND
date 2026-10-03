// src/components/corporateCampaign/CategoryContactManager.jsx
//
// SURFACE 8 - what "Manage" opens on a category tile: that category's own contact list with search, a
// Ready / Needs-info badge (name + email only), a quiet "Address on file / No address yet" note, Add, Edit
// and Remove (a PERMANENT delete, only after an explicit confirmation). Reads come from the management read (full records), writes use the
// existing corporate contact endpoints through the injected `writes` client. Nothing here decides anything
// about campaigns; it only warns, at the moment of removal, which campaigns currently include the contact.
import { useState, useEffect, useRef } from "react";
import ContactFields from "./ContactFields.jsx";
import {
  EMPTY_FORM, fromContact, validateContact, toPayload, hasAddress, readinessOf, deleteCopy, writeFailureMessage,
} from "./contactManageModel.js";
import { sanitizeDeletionEntry } from "../../api/corporateContacts.js";
import "./premiumDashboard.css";

export default function CategoryContactManager({
  category, label, contacts, orgId, writes, campaigns = [], reload, startWithAdd = false, onImport, canWrite = true,
}) {
  const singular = String(label || "").replace(/s$/, "");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(Boolean(startWithAdd && canWrite));
  const [editingId, setEditingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [history, setHistory] = useState(null); // null = unavailable / not loaded; else [{date, category, count}]
  const [showHistory, setShowHistory] = useState(false);
  const cancelRef = useRef(null);

  const inCategory = (Array.isArray(contacts) ? contacts : []).filter((c) => c.corporateContactType === category);
  const shown = inCategory.filter((c) => String(c.name || "").toLowerCase().includes(q.trim().toLowerCase()));
  const editing = editingId ? inCategory.find((c) => c.id === editingId) || null : null;
  const removing = removingId ? inCategory.find((c) => c.id === removingId) || null : null;

  function closeForms() { setAdding(false); setEditingId(null); setErrors({}); }
  function beginAdd() { closeForms(); setDraft(EMPTY_FORM); setAdding(true); setRemovingId(null); setMessage(null); }
  function beginEdit(c) { closeForms(); setDraft(fromContact(c)); setEditingId(c.id); setRemovingId(null); setMessage(null); }

  // Deletion history: owner-only, read-only, date + category + count. Shown only when the server answers; any
  // failure (or a server without the endpoint) simply leaves it hidden.
  const canReadHistory = canWrite && writes && typeof writes.listDeletionLog === "function";
  useEffect(() => {
    if (!canReadHistory) return undefined;
    let alive = true;
    (async () => {
      try {
        const res = await writes.listDeletionLog(orgId);
        if (alive) setHistory(res && res.ok === true && Array.isArray(res.entries) ? res.entries.map(sanitizeDeletionEntry).filter(Boolean) : null);
      } catch { if (alive) setHistory(null); }
    })();
    return () => { alive = false; };
  }, [canReadHistory, writes, orgId, contacts]);

  // The confirmation opens with focus on Cancel, so Enter/Space can never delete by accident.
  useEffect(() => { if (removingId && cancelRef.current) cancelRef.current.focus(); }, [removingId]);

  async function run(fn) {
    if (busy) return false;
    setBusy(true);
    try { return await fn(); } finally { setBusy(false); }
  }

  async function submitAdd(e) {
    e.preventDefault();
    const errs = validateContact(draft, contacts, null);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    await run(async () => {
      const res = await writes.createContact(orgId, toPayload(draft, { category }));
      if (!res || res.ok !== true) {
        setMessage({ kind: "error", text: writeFailureMessage(res) });
        return;
      }
      await reload();
      setMessage({ kind: "ok", text: "Contact added." });
      closeForms();
    });
  }

  async function submitEdit(e) {
    e.preventDefault();
    if (!editing) return;
    const errs = validateContact(draft, contacts, editing.id);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    await run(async () => {
      const res = await writes.updateContact(orgId, editing.id, toPayload(draft, { existing: editing }));
      if (!res || res.ok !== true) {
        setMessage({ kind: "error", text: writeFailureMessage(res) });
        if (res && res.notFound) await reload();
        return;
      }
      await reload();
      setMessage({ kind: "ok", text: "Contact updated." });
      closeForms();
    });
  }

  async function confirmRemove() {
    if (!removing) return;
    await run(async () => {
      const res = await writes.deleteContact(orgId, removing.id);
      if (!res || (res.ok !== true && !res.notFound)) { setMessage({ kind: "error", text: writeFailureMessage(res) }); return; }
      await reload();
      setRemovingId(null);
      setMessage({ kind: "ok", text: "Contact deleted permanently." });
    });
  }

  const copy = removing ? deleteCopy(removing, campaigns) : null;

  return (
    <div data-testid={`manage-${category}`} style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <strong style={{ fontSize: ".9rem" }}>{label}</strong>
        <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
          {onImport ? <button type="button" className="gcd-btn" data-testid={`manage-${category}-import`} onClick={onImport}>Import {label.toLowerCase()}</button> : null}
          {canWrite ? <button type="button" className="gcd-btn gcd-btn--primary" data-testid={`manage-${category}-add`} onClick={beginAdd}>{`Add ${singular}`}</button> : null}
        </span>
      </div>

      {message ? (
        <p role="status" data-testid="manage-message" style={{ fontSize: ".82rem", margin: "0 0 8px", color: message.kind === "error" ? "#b3261e" : "#166534" }}>{message.text}</p>
      ) : null}

      {adding ? (
        <form data-testid="manage-add-form" onSubmit={submitAdd} noValidate
          style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 12, marginBottom: 10, background: "#f8fafc" }}>
          <p style={{ margin: "0 0 8px", fontSize: ".85rem" }}>New contact in <strong data-testid="manage-add-category">{label}</strong>.</p>
          <ContactFields prefix="manage-add" draft={draft} setDraft={setDraft} errors={errors} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="submit" className="gcd-btn gcd-btn--primary" data-testid="manage-add-save" disabled={busy}>{busy ? "Adding…" : "Add contact"}</button>
            <button type="button" className="gcd-btn" data-testid="manage-add-cancel" onClick={closeForms} disabled={busy}>Cancel</button>
          </div>
        </form>
      ) : null}

      {editing ? (
        <form data-testid="manage-edit-form" role="dialog" aria-labelledby="manage-edit-title" onSubmit={submitEdit} noValidate
          style={{ border: "2px solid #4f2d7f", borderRadius: 10, padding: 12, marginBottom: 10, background: "#fff" }}>
          <h4 id="manage-edit-title" style={{ margin: "0 0 6px", fontSize: ".95rem" }}>Edit contact</h4>
          <p style={{ margin: "0 0 8px", fontSize: ".85rem" }}>In <strong data-testid="manage-edit-category">{label}</strong>.</p>
          <ContactFields prefix="manage-edit" draft={draft} setDraft={setDraft} errors={errors} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="submit" className="gcd-btn gcd-btn--primary" data-testid="manage-edit-save" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
            <button type="button" className="gcd-btn" data-testid="manage-edit-cancel" onClick={closeForms} disabled={busy}>Cancel</button>
          </div>
        </form>
      ) : null}

      {removing ? (
        <div role="alertdialog" aria-modal="true" aria-labelledby="manage-remove-title" data-testid="manage-remove-confirm"
          onKeyDown={(e) => { if (e.key === "Escape" && !busy) { e.stopPropagation(); setRemovingId(null); } }}
          style={{ border: "1px solid #b3261e", borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <strong id="manage-remove-title">{copy.question}</strong>
          <p style={{ margin: "6px 0", fontSize: ".85rem" }}>{copy.detail}</p>
          <p data-testid="manage-remove-records-note" style={{ margin: "6px 0", fontSize: ".8rem", color: "#475569" }}>{copy.recordsNote}</p>
          {copy.warning ? <p data-testid="manage-remove-warning" style={{ margin: "6px 0", fontSize: ".85rem", color: "#92400e" }}>{copy.warning} {copy.scheduledWarning}</p> : null}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="gcd-btn" ref={cancelRef} data-testid="manage-remove-no" onClick={() => setRemovingId(null)} disabled={busy}>Cancel</button>
            <button type="button" className="gcd-btn" style={{ background: "#b3261e", borderColor: "#b3261e", color: "#fff" }} data-testid="manage-remove-yes" onClick={confirmRemove} disabled={busy}>{busy ? "Deleting…" : "Delete permanently"}</button>
          </div>
        </div>
      ) : null}

      <label style={{ fontSize: ".78rem", fontWeight: 700 }}>
        Search {String(label).toLowerCase()}{" "}
        <input data-testid="manage-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name"
          style={{ padding: "6px 9px", borderRadius: 8, border: "1px solid #cbd5e1", marginLeft: 6 }} />
      </label>
      {shown.length === 0 ? (
        <p data-testid="manage-empty" className="gcd-roster-empty" style={{ marginTop: 10 }}>
          {inCategory.length === 0 ? "Nobody in this category yet. Add or import to get started." : "No one matches that search."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 8 }}>
          {shown.map((c) => {
            const r = readinessOf(c);
            return (
              <li key={c.id} data-testid={`manage-row-${c.id}`} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: ".88rem", flex: "1 1 160px" }}>{c.name}</strong>
                  <span data-testid={`manage-ready-${c.id}`} data-ready={r.ready ? "yes" : "no"}
                    style={{ fontSize: ".72rem", fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: r.ready ? "#dcfce7" : "#fef3c7", color: r.ready ? "#166534" : "#92400e" }}>{r.label}</span>
                  <span data-testid={`manage-address-${c.id}`} data-has={hasAddress(c) ? "yes" : "no"} style={{ fontSize: ".72rem", color: "#475569" }}>
                    {hasAddress(c) ? "Address on file" : "No address yet"}
                  </span>
                  {canWrite ? <button type="button" className="gcd-btn" data-testid={`manage-edit-${c.id}`} onClick={() => beginEdit(c)}>Edit</button> : null}
                  {canWrite ? <button type="button" className="gcd-btn" data-testid={`manage-remove-${c.id}`} onClick={() => { closeForms(); setRemovingId(c.id); }}>Remove</button> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {history ? (
        <div style={{ marginTop: 14 }}>
          <button type="button" className="gcd-btn" data-testid="manage-history-toggle" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? "Hide deletion history" : "Deletion history"}
          </button>
          {showHistory ? (
            history.length === 0 ? (
              <p data-testid="manage-history-empty" style={{ fontSize: ".8rem", color: "#475569" }}>No contacts have been deleted.</p>
            ) : (
              <table data-testid="manage-history" style={{ fontSize: ".8rem", marginTop: 8, borderCollapse: "collapse" }}>
                <caption style={{ textAlign: "left", color: "#475569", paddingBottom: 4 }}>Date, category and number of contacts deleted. No personal details are kept here.</caption>
                <thead><tr><th scope="col" style={{ textAlign: "left", paddingRight: 16 }}>Date</th><th scope="col" style={{ textAlign: "left", paddingRight: 16 }}>Category</th><th scope="col" style={{ textAlign: "left" }}>Deleted</th></tr></thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={`${h.date}-${h.category}-${i}`} data-testid="manage-history-row">
                      <td style={{ paddingRight: 16 }}>{h.date}</td><td style={{ paddingRight: 16 }}>{h.category || "-"}</td><td>{h.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
