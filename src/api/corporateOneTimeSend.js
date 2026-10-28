// src/api/corporateOneTimeSend.js
//
// SURFACE 8 - client for the owner-only "Send a Greet-Me now" (one-time, unscheduled) endpoints:
//   POST /api/corporate-campaigns/organizations/:org/one-time-sends/preview   the review (reads only)
//   POST /api/corporate-campaigns/organizations/:org/one-time-sends           the send (execution-gated, final)
//   GET  /api/corporate-campaigns/organizations/:org/one-time-sends/:id       status of an accepted send
//
// Why not the shared campaigns client: its 409 handling deliberately forwards only a short allowlist, and this
// flow NEEDS the structured details of a refusal (how many Greet-Mes are short, which recipients are not ready).
// Every outcome is normalised here; nothing is invented and the server's code is always kept.
//
//   preview -> { ok:true, preview }            | { ok:false, dormant|unauthorized|notAvailable|error, status }
//   send    -> { ok:true, result, replay }     | { ok:false, error, details, status } | { ok:false, indeterminate:true }
// `fetchImpl` / `getToken` / `apiBase` are injectable so the flow is testable with no network.

function viteApiBase() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;
  } catch { /* import.meta.env absent under node:test */ }
  return "";
}
function defaultGetToken() {
  try { return localStorage.getItem("token"); } catch { return null; }
}

/** A short safe code: letters, digits, underscore, dash. Anything else is dropped rather than shown. */
const safeCode = (v) => (typeof v === "string" && /^[a-z0-9_.-]{1,80}$/i.test(v) ? v : null);

export function createOneTimeSendClient({
  fetchImpl = (typeof fetch !== "undefined" ? fetch : undefined),
  getToken = defaultGetToken,
  apiBase = viteApiBase(),
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("oneTimeSendClient: fetchImpl is required");

  const url = (orgId, suffix = "") =>
    `${apiBase}/api/corporate-campaigns/organizations/${encodeURIComponent(orgId)}/one-time-sends${suffix}`;
  const headers = () => {
    const h = { "Content-Type": "application/json" };
    const token = getToken && getToken();
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  };

  async function request(method, target, body) {
    let res;
    try {
      res = await fetchImpl(target, { method, headers: headers(), body: body != null ? JSON.stringify(body) : undefined });
    } catch {
      return { transport: "network" };
    }
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { res, data };
  }

  function refusal(res, data) {
    const out = { ok: false, status: res.status };
    if (res.status === 503) { out.dormant = true; return out; }
    if (res.status === 401 || res.status === 403) { out.unauthorized = true; return out; }
    if (res.status === 404 || res.status === 405) { out.notAvailable = true; return out; }
    const code = data && safeCode(data.error);
    if (code) out.error = code;
    if (data && data.details && typeof data.details === "object" && !Array.isArray(data.details)) out.details = data.details;
    if (!out.error) out.error = `HTTP_${res.status}`;
    return out;
  }

  async function preview(orgId, body) {
    if (!orgId || typeof orgId !== "string") return { ok: false, status: 400, error: "missing_org" };
    const r = await request("POST", url(orgId, "/preview"), body || {});
    if (r.transport) return { ok: false, networkError: true, status: 0 };
    if (!r.res.ok) return refusal(r.res, r.data);
    return r.data && typeof r.data === "object" && r.data.recipients && r.data.plan
      ? { ok: true, status: r.res.status, preview: r.data }
      : { ok: false, malformed: true, status: r.res.status };
  }

  async function send(orgId, body) {
    if (!orgId || typeof orgId !== "string") return { ok: false, status: 400, error: "missing_org" };
    const r = await request("POST", url(orgId), body || {});
    // A POST that never returned MAY have landed. The caller retries with the SAME idempotency key, which the
    // server converges on, so a retry can never send twice - but it is never reported as a failure either.
    if (r.transport) return { ok: false, indeterminate: true, status: 0 };
    if (!r.res.ok) return refusal(r.res, r.data);
    const d = r.data || {};
    return {
      ok: true, status: r.res.status, replay: Boolean(d.alreadySubmitted),
      result: { sendId: d.sendId || null, stage: d.stage || null, recipientCount: Number.isFinite(d.recipientCount) ? d.recipientCount : null,
        chargedTotalCents: Number.isFinite(d.chargedTotalCents) ? d.chargedTotalCents : 0, featuredSpreadIncluded: d.featuredSpreadIncluded !== false },
    };
  }

  async function status(orgId, sendId) {
    if (!orgId || !sendId) return { ok: false, status: 400, error: "missing_id" };
    const r = await request("GET", url(orgId, `/${encodeURIComponent(sendId)}`));
    if (r.transport) return { ok: false, networkError: true, status: 0 };
    if (!r.res.ok) return refusal(r.res, r.data);
    return { ok: true, status: r.res.status, result: r.data || {} };
  }

  return { preview, send, status };
}
