// src/components/importWizard/CorporateImportFlow.jsx
//
// TEAM A — Slice 2B-2B Corporate import orchestration: preview → explicit confirmation + authorized
// organization selection → authenticated commit → honest error handling → deterministic reconciliation
// → truthful results summary (stays on the summary; never auto-navigates). Personal review is
// untouched. Practice/Test Drive can NEVER reach here (the wizard mounts this only when !sample) and a
// fail-closed guard blocks any network call if `sample` ever leaks in.
//
// Authorization is backend-derived: the org id in the request MUST be one returned by
// GET /api/corporate-contacts/organizations. A typed/uploaded/query/cached org id never authorizes.

import { useCallback, useEffect, useRef, useState } from "react";
import CorporateImportPreview from "./CorporateImportPreview.jsx";
import { createCorporateContactsClient } from "../../api/corporateContacts.js";
import {
  buildCorporatePayload, confirmationCounts, classifyCorporateOutcome, rowPresentation,
  DUPLICATE_STRATEGIES, ROW_STATUS,
} from "../../import/corporateCommit.js";

const card = { background: "#fffdf8", border: "1px solid #e7e0d4", borderRadius: 12, padding: "16px 18px", margin: "12px 0" };
const muted = { color: "#6a5f86", fontSize: ".85rem", lineHeight: 1.5 };
const btn = (bg, fg = "#fff") => ({ background: bg, color: fg, border: bg === "transparent" ? "1px solid #d7d0ea" : "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer" });
const STRAT_LABEL = { skip: "Skip duplicates", update: "Update existing", merge: "Fill blanks (merge)" };

export default function CorporateImportFlow({ items = [], kindLabel = "Corporate", sample = false, onStartOver, client }) {
  const apiRef = useRef(null);
  if (!apiRef.current) apiRef.current = client || createCorporateContactsClient();
  const abortRef = useRef(null);
  const inflightRef = useRef(false);   // SYNCHRONOUS double-submit guard (state updates lag a tick)

  const [phase, setPhase] = useState("preview");           // preview | confirm | done
  const [orgs, setOrgs] = useState({ loading: false, loaded: false, error: null, dormant: false, unauthorized: false, list: [] });
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [strategy, setStrategy] = useState("skip");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);            // classified result (stays until Start over)

  const counts = confirmationCounts(items);
  const selectedOrg = orgs.list.find((o) => o.corporateOrganizationId === selectedOrgId) || null;

  // Load the caller's authorized organizations — ONLY in the real flow, NEVER in Practice/Test Drive.
  const loadOrgs = useCallback(async () => {
    if (sample) return;                                    // fail-closed guard #1: practice never fetches
    setOrgs((s) => ({ ...s, loading: true, loaded: false, error: null, dormant: false, unauthorized: false }));
    const res = await apiRef.current.listOrganizations();
    if (res.dormant) { setOrgs({ loading: false, loaded: true, error: null, dormant: true, unauthorized: false, list: [] }); return; }
    if (res.unauthorized) { setOrgs({ loading: false, loaded: true, error: null, dormant: false, unauthorized: true, list: [] }); return; }
    if (!res.ok) { setOrgs({ loading: false, loaded: true, error: res.malformed ? "malformed" : (res.error || "error"), dormant: false, unauthorized: false, list: [] }); return; }
    const list = res.organizations || [];
    setOrgs({ loading: false, loaded: true, error: null, dormant: false, unauthorized: false, list });
    if (list.length === 1) setSelectedOrgId(list[0].corporateOrganizationId); // exactly one → explicit select
  }, [sample]);

  const goConfirm = useCallback(() => { setPhase("confirm"); setOutcome(null); loadOrgs(); }, [loadOrgs]);

  // Org change clears any prior submission/result state (org A data can never linger under org B).
  const changeOrg = useCallback((orgId) => { setSelectedOrgId(orgId); setOutcome(null); }, []);

  const canSubmit = !sample && !busy && !!selectedOrgId && DUPLICATE_STRATEGIES.includes(strategy) && counts.importable > 0;

  const submit = useCallback(async () => {
    if (inflightRef.current || busy) return;               // double-submit guard (synchronous + state)
    if (sample) { setOutcome({ kind: "error", message: "Practice mode can't import." }); return; } // fail-closed guard #2
    if (!selectedOrgId || counts.importable < 1) return;
    inflightRef.current = true;
    const { envelope, submittedPreviewIndex } = buildCorporatePayload(items, { duplicateStrategy: strategy });
    setBusy(true); setOutcome(null);
    const controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
    abortRef.current = controller;
    const res = await apiRef.current.importContacts(selectedOrgId, envelope, { signal: controller ? controller.signal : undefined });
    abortRef.current = null;
    inflightRef.current = false;
    setBusy(false);
    setOutcome(classifyCorporateOutcome(res, submittedPreviewIndex));
    setPhase("done");
  }, [busy, sample, selectedOrgId, counts.importable, items, strategy]);

  const cancelInflight = useCallback(() => { if (abortRef.current) try { abortRef.current.abort(); } catch { /* noop */ } }, []);

  useEffect(() => () => { if (abortRef.current) try { abortRef.current.abort(); } catch { /* noop */ } }, []);

  // ---------------- PREVIEW ----------------
  if (phase === "preview") {
    return <CorporateImportPreview items={items} kindLabel={kindLabel} onStartOver={onStartOver} onContinue={goConfirm} />;
  }

  // ---------------- DONE (results / error) — stays here until an explicit action ----------------
  if (phase === "done" && outcome) {
    return <CorporateResults outcome={outcome} items={items} orgId={selectedOrgId} onStartOver={onStartOver}
      onBack={() => { setPhase("confirm"); setOutcome(null); }} />;
  }

  // ---------------- CONFIRM ----------------
  return (
    <div data-testid="corp-confirm">
      <div style={{ ...card, borderColor: "rgba(214,145,16,.4)", background: "rgba(214,145,16,.06)" }}>
        <h3 style={{ margin: "2px 0 8px", fontFamily: "Georgia,serif" }}>Confirm import — {kindLabel}</h3>
        <p style={muted} data-testid="corp-confirm-note">
          Review before importing. <b>No address shown is verified.</b> Contacts with an absent or
          incomplete delivery address may still be imported, but they are <b>not eligible for future
          physical-gift fulfillment</b> until later correction, approval, and verification work exists.
          Physical-gift ordering and vendor fulfillment are not active.
        </p>
      </div>

      {/* Authorized organization */}
      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Authorized organization</div>
        {orgs.loading && <div data-testid="corp-org-loading" style={muted}>Checking your authorized organizations…</div>}
        {!orgs.loading && orgs.dormant && (
          <div data-testid="corp-org-dormant" style={muted}>Corporate import is currently unavailable. Nothing has been saved or sent.</div>
        )}
        {!orgs.loading && orgs.unauthorized && (
          <div data-testid="corp-org-unauthorized" style={muted}>You don't have access to import contacts. No organization is available.</div>
        )}
        {!orgs.loading && orgs.error && (
          <div data-testid="corp-org-error" style={muted}>We couldn't load your organizations. Please try again.
            <button style={{ ...btn("transparent", "#4338ca"), marginLeft: 8, padding: "4px 10px" }} onClick={loadOrgs}>Retry</button>
          </div>
        )}
        {!orgs.loading && !orgs.dormant && !orgs.unauthorized && !orgs.error && orgs.list.length === 0 && (
          <div data-testid="corp-org-empty" style={muted}>No corporate organization has been set up for your account yet. A Greet-Me administrator must provision your organization before you can import corporate contacts — please contact Greet-Me to get started. Nothing has been saved or sent.</div>
        )}
        {!orgs.loading && orgs.list.length > 0 && (
          <div data-testid="corp-org-list" role="radiogroup" aria-label="Authorized organizations">
            {orgs.list.map((o) => (
              <label key={o.corporateOrganizationId} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "4px 0", cursor: "pointer" }}>
                <input type="radio" name="corp-org" data-testid="corp-org-radio"
                  checked={selectedOrgId === o.corporateOrganizationId}
                  onChange={() => changeOrg(o.corporateOrganizationId)} />
                <span>
                  {o.name && <span style={{ fontWeight: 600 }}>{o.name} </span>}
                  <code data-testid="corp-org-id" style={{ fontSize: ".82rem", color: "#332a52" }}>{o.corporateOrganizationId}</code>
                  <span style={muted}> · {o.role}</span>
                </span>
              </label>
            ))}
            {selectedOrg && (
              <p style={{ ...muted, marginTop: 4 }}>
                Importing to <code data-testid="corp-selected-org-id">{selectedOrg.corporateOrganizationId}</code>
                {selectedOrg.name ? " (label shown for reference only; access is verified by the server)" : ""}.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Counts */}
      <div style={card} data-testid="corp-confirm-counts">
        <Row k="Rows in file" v={counts.total} tid="cc-total" />
        <Row k="Importable" v={counts.importable} tid="cc-importable" />
        <Row k="Excluded before import (missing name/email)" v={counts.rejectedPreCommit} tid="cc-rejected" />
        <Row k="Complete address — not verified" v={counts.completeUnverified} tid="cc-unverified" />
        <Row k="Incomplete address" v={counts.incompleteAddress} tid="cc-incomplete" />
        <Row k="No delivery address" v={counts.noAddress} tid="cc-noaddress" />
        <Row k="Unrecognized country — needs review" v={counts.unknownCountry} tid="cc-unknown" />
      </div>

      {/* Duplicate strategy */}
      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>If a contact already exists</div>
        <select data-testid="corp-strategy" value={strategy} onChange={(e) => setStrategy(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8 }}>
          {DUPLICATE_STRATEGIES.map((s) => <option key={s} value={s}>{STRAT_LABEL[s]}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap", marginTop: 8 }}>
        <button data-testid="corp-cancel" style={btn("transparent", "#1b1830")} onClick={() => setPhase("preview")}>Back</button>
        <button data-testid="corp-submit" style={{ ...btn("#6b3a2a"), opacity: canSubmit ? 1 : 0.5 }}
          disabled={!canSubmit} aria-disabled={!canSubmit}
          onClick={submit}>
          {busy ? "Importing…" : `Import ${counts.importable} contact${counts.importable === 1 ? "" : "s"}`}
        </button>
      </div>
      {busy && <div data-testid="corp-submitting" style={{ ...muted, textAlign: "center", marginTop: 8 }}>
        Importing… <button style={{ ...btn("transparent", "#b91c1c"), padding: "4px 10px" }} onClick={cancelInflight}>Cancel</button>
      </div>}
    </div>
  );
}

function Row({ k, v, tid }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: ".88rem" }}>
      <span style={{ color: "#6a5f86" }}>{k}</span>
      <b data-testid={tid}>{v}</b>
    </div>
  );
}

// ---------------- Results / error summary (truthful; stays put) ----------------
function CorporateResults({ outcome, items, orgId, onStartOver, onBack }) {
  const kind = outcome.kind;
  const isTerminalError = ["error", "dormant", "aborted", "indeterminate", "failed"].includes(kind);
  const recon = outcome.reconciliation;
  const previewById = new Map(items.map((it) => [it.index, it]));

  return (
    <div data-testid="corp-results">
      <div style={{ ...card, borderColor: kind === "success" ? "#c7d2fe" : "rgba(185,28,28,.35)", background: kind === "success" ? "#eef2ff" : "rgba(185,28,28,.05)" }}>
        <h3 style={{ margin: "2px 0 6px", fontFamily: "Georgia,serif" }} data-testid="corp-results-title" data-kind={kind}>
          {kind === "success" && "Import complete"}
          {kind === "partial" && "Import finished with some issues"}
          {kind === "failed" && "No contacts were imported"}
          {kind === "error" && "Import couldn't be completed"}
          {kind === "dormant" && "Corporate import is unavailable"}
          {kind === "aborted" && "Import status unconfirmed"}
          {kind === "indeterminate" && "Import status unconfirmed"}
        </h3>
        <p style={muted} data-testid="corp-results-message">{outcome.message || defaultMessage(kind)}</p>
        {(kind === "aborted" || kind === "indeterminate") && (
          <p style={{ ...muted, color: "#b91c1c" }} data-testid="corp-indeterminate-warn">
            Import status could not be confirmed. Do not submit again until the organization's contacts are checked.
          </p>
        )}
      </div>

      {outcome.data && (
        <div style={card} data-testid="corp-results-totals">
          <Row k="Imported (new)" v={outcome.data.added} tid="cr-added" />
          <Row k="Updated" v={outcome.data.updated} tid="cr-updated" />
          <Row k="Merged" v={outcome.data.merged} tid="cr-merged" />
          <Row k="Skipped" v={outcome.data.skipped} tid="cr-skipped" />
          <Row k="Not imported" v={outcome.data.failed} tid="cr-failed" />
          {recon && recon.missing.length > 0 && <Row k="Result unavailable" v={recon.missing.length} tid="cr-missing" />}
        </div>
      )}

      {recon && recon.perRow.length > 0 && (
        <div style={{ ...card, padding: 0, overflow: "hidden" }} data-testid="corp-results-rows">
          {recon.perRow.map((p) => {
            const it = previewById.get(p.previewIndex);
            const addrStatus = it && it.addressStatus ? it.addressStatus.status : null;
            const pres = rowPresentation(p.status, addrStatus);
            return (
              <div key={p.submitIndex} data-testid="corp-result-row" data-bucket={pres.bucket}
                style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 14px", borderTop: p.submitIndex === recon.perRow[0].submitIndex ? "none" : "1px solid #efeae0", fontSize: ".84rem" }}>
                <span>{(it && it.contact.fullName) || "(row)"} <span style={muted}>· {(it && it.contact.email) || ""}</span></span>
                <span style={{ color: p.status === ROW_STATUS.FAILED ? "#b91c1c" : "#332a52" }}>{pres.label}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 8, flexWrap: "wrap" }}>
        {isTerminalError && !["dormant"].includes(kind) && (
          <button data-testid="corp-results-back" style={btn("transparent", "#1b1830")} onClick={onBack}>Back to review</button>
        )}
        <button data-testid="corp-results-startover" style={btn("#6d74ee")} onClick={onStartOver}>Start over</button>
      </div>
    </div>
  );
}

function defaultMessage(kind) {
  if (kind === "success") return "Your contacts were imported.";
  if (kind === "partial") return "Some contacts were imported; others need attention.";
  return "Nothing was confirmed as saved.";
}
