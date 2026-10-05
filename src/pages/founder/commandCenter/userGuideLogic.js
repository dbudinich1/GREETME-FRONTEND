// User Guide helpers: pure, no network, no React.
export const VIEWS = [{ id: "desktop", label: "Desktop" }, { id: "mobile", label: "Mobile" }];
export const FORMATS = [{ id: "pdf", label: "PDF" }, { id: "html", label: "Interactive (HTML)" }];
export const AREAS = [
  { id: "full", label: "Full set" },
  { id: "customer-app", label: "Customer app" },
  { id: "business-tools", label: "Business, corporate and fundraiser tools" },
  { id: "emails-recipient", label: "Emails and recipient experience" },
  { id: "founder-command-center", label: "Founder Command Center" },
];
export const EMPTY_TEXT = "Guides are not published yet";

export function formatSize(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
export function formatUpdated(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : "";
}

/** Normalise a manifest response; unknown shapes yield null so the page shows an error rather than guessing. */
export function readManifest(res) {
  const d = res && res.ok && res.data;
  if (!d || !Array.isArray(d.files)) return null;
  const byKey = new Map();
  for (const f of d.files) if (f && typeof f.id === "string") byKey.set(`${f.view}|${f.area}|${f.format}`, f);
  return { configured: d.configured !== false, files: d.files, get: (view, area, format) => byKey.get(`${view}|${area}|${format}`) || null };
}
export const availableCount = (m) => (m ? m.files.filter((f) => f && f.available === true).length : 0);
/** Show the plain empty state when storage is not configured or nothing at all is published. */
export const isEmpty = (m) => !m || m.configured === false || availableCount(m) === 0;

/** Plain sentences for the contract's refusals. Never shows a raw code. */
export function userGuideErrorMessage(res) {
  if (!res) return "That didn't go through. Please try again.";
  if (res.networkError) return "Couldn't reach the server. Check your connection and try again.";
  switch (res.status) {
    case 401: return "Your session has expired. Sign in again to continue.";
    case 403: return "The User Guide is not available on this account.";
    case 404: return "That guide is not published yet.";
    case 409: return "The User Guide is not set up yet.";
    case 429: return "Too many requests. Wait a moment and try again.";
    case 503: return "The guide storage is temporarily unavailable. Try again in a moment.";
    default: return "That didn't go through. Please try again.";
  }
}
/** Only an https storage URL is ever opened. */
export const isSafeFileUrl = (u) => { try { return new URL(u).protocol === "https:"; } catch { return false; } };
