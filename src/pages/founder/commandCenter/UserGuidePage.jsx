// Founder-only User Guide (W48 files, served through the API). The 20 files are listed from the server manifest; Open and Download
// each ask the server for a fresh short-lived storage link at click time. HTML guides are opened ONLY in a new tab (never embedded
// in this app, never fetched and injected): the storage domain is a different origin, so a guide cannot read this app's storage.
import { useCallback, useEffect, useState } from "react";
import { isFounder } from "../../../utils/accountState.js";
import { founderUserGuideApi } from "../../../api/founderUserGuide.js";
import { Page, ui } from "./commandCenterUi.jsx";
import { VIEWS, FORMATS, AREAS, EMPTY_TEXT, formatSize, formatUpdated, readManifest, isEmpty, userGuideErrorMessage, isSafeFileUrl } from "./userGuideLogic.js";

function readUser() {
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
}

function FileCell({ file, api, windowOpen, onMessage }) {
  const [busy, setBusy] = useState("");
  const [fallback, setFallback] = useState(null); // { url } when the browser blocked the new tab
  if (!file || file.available !== true) return <span style={ui.note} data-testid={`ug-na-${file ? file.id : "x"}`}>Not uploaded yet</span>;
  const isHtml = file.format === "html";

  async function open() {
    setBusy("open"); setFallback(null); onMessage("");
    // Open the tab NOW (inside the click), then point it at the fresh link: a tab opened after an await is blocked as a popup.
    let w = null;
    try { w = windowOpen("about:blank", "_blank"); } catch { w = null; }
    if (w) { try { w.opener = null; } catch { /* ignore */ } }
    const r = await api.fileUrl(file.id, "inline");
    setBusy("");
    if (!r.ok || !r.data || !isSafeFileUrl(r.data.url)) { if (w) { try { w.close(); } catch { /* ignore */ } } onMessage(userGuideErrorMessage(r.ok ? null : r)); return; }
    if (w) { try { w.location.replace(r.data.url); } catch { setFallback({ url: r.data.url }); } } else setFallback({ url: r.data.url });
  }
  async function download() {
    setBusy("download"); onMessage("");
    const r = await api.fileUrl(file.id, "attachment");
    setBusy("");
    if (!r.ok || !r.data || !isSafeFileUrl(r.data.url)) { onMessage(userGuideErrorMessage(r.ok ? null : r)); return; }
    // The link forces a download (attachment); this page is not navigated away.
    const a = document.createElement("a");
    a.href = r.data.url; a.rel = "noopener noreferrer"; a.download = r.data.filename || ""; a.style.display = "none";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  return (
    <div style={{ display: "grid", gap: 4 }} data-testid={`ug-file-${file.id}`}>
      <div style={ui.note} data-testid={`ug-meta-${file.id}`}>{[formatSize(file.sizeBytes), formatUpdated(file.updatedAt) ? `updated ${formatUpdated(file.updatedAt)}` : ""].filter(Boolean).join(", ")}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" style={ui.btn2} disabled={busy !== ""} data-testid={`ug-open-${file.id}`} onClick={open}>{busy === "open" ? "Opening..." : isHtml ? "Open in new tab" : "Open"}</button>
        <button type="button" style={ui.btn2} disabled={busy !== ""} data-testid={`ug-download-${file.id}`} onClick={download}>{busy === "download" ? "Preparing..." : "Download"}</button>
      </div>
      {fallback ? (
        <p style={ui.note} data-testid={`ug-fallback-${file.id}`}>Your browser blocked the new tab. <a href={fallback.url} target="_blank" rel="noopener noreferrer" data-testid={`ug-fallback-link-${file.id}`}>Open the guide</a> (the link works for a few minutes).</p>
      ) : null}
    </div>
  );
}

export default function UserGuidePage({ api = founderUserGuideApi, user: injectedUser, windowOpen = (...a) => window.open(...a) }) {
  const founder = isFounder(injectedUser !== undefined ? injectedUser : readUser());
  const [state, setState] = useState({ loading: true });
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setState({ loading: true });
    const r = await api.list();
    const m = readManifest(r);
    if (m) setState({ m }); else setState({ error: userGuideErrorMessage(r.ok ? null : r), forbidden: r.status === 403 });
  }, [api]);
  useEffect(() => { if (founder) load(); }, [founder, load]);

  if (!founder) return <div style={{ padding: "2rem" }} data-testid="ug-denied"><h1 style={{ fontSize: "1.25rem", margin: 0 }}>Not available</h1><p style={{ marginTop: ".5rem", color: "#605c78" }}>This area is limited to the founder account.</p></div>;
  const m = state.m;
  return (
    <Page trail={[["User Guide"]]} title="User Guide" sub="Every screen and state of the system, as PDF and as interactive guides, for desktop and for mobile." testid="page-user-guide">
      {state.loading ? <p style={ui.note} data-testid="ug-loading">Loading the guides...</p> : null}
      {state.error ? (
        <p role="alert" style={{ ...ui.note, color: "#b3261e" }} data-testid="ug-error">{state.error}{state.forbidden ? null : <> <button type="button" style={ui.btn2} onClick={load} data-testid="ug-retry">Try again</button></>}</p>
      ) : null}
      {m && isEmpty(m) ? <div style={ui.card} data-testid="ug-empty"><h2 style={ui.title}>{EMPTY_TEXT}</h2><p style={ui.note}>{m.configured ? "None of the 20 guide files has been uploaded yet. They appear here once they are published." : "The User Guide is not set up yet. It appears here once the guide files are published."}</p></div> : null}
      {message ? <p role="alert" style={{ ...ui.note, color: "#b3261e", margin: "0 0 10px" }} data-testid="ug-message">{message}</p> : null}
      {m && !isEmpty(m) ? (
        <div style={{ display: "grid", gap: 18 }} data-testid="ug-groups">
          {VIEWS.map((v) => (
            <section key={v.id} data-testid={`ug-view-${v.id}`} style={ui.card} aria-labelledby={`ug-h-${v.id}`}>
              <h2 id={`ug-h-${v.id}`} style={ui.title}>{v.label} guides</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {AREAS.map((a) => (
                  <div key={a.id} data-testid={`ug-row-${v.id}-${a.id}`} style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10, display: "grid", gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: ".92rem" }}>{a.label}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                      {FORMATS.map((f) => (
                        <div key={f.id} data-testid={`ug-cell-${v.id}-${a.id}-${f.id}`}>
                          <div style={{ fontSize: ".74rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>{f.label}</div>
                          <FileCell file={m.get(v.id, a.id, f.id)} api={api} windowOpen={windowOpen} onMessage={setMessage} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <p style={ui.note}>Interactive guides open in a new browser tab from a separate address, so they cannot reach this app. Links work for a few minutes and are requested fresh each time.</p>
        </div>
      ) : null}
    </Page>
  );
}
