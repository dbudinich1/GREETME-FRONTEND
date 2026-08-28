// src/pages/sales/vanityAlias.js
//
// TEAM B (SALES S1) — the clean salesperson link: https://greet-me.com/<alias>
//
// The hosting navigation fallback already serves index.html for any non-asset path, so `/alex`
// reaches this application intact. What it does NOT do is route: the app uses HashRouter, and the
// hash for `/alex` is empty, so ordinary routing would render the home page and the alias would be
// silently discarded. This module is the one place that reads `location.pathname` first.
//
// It resolves NOTHING and decides NOTHING about identity. It answers one narrow question — "is
// this pathname eligible to be treated as a referral alias?" — and hands the opaque code to the
// existing carrier. Whether that code belongs to anybody is the server's decision, exactly as it
// is for an opaque token.
//
// The address bar is deliberately left alone: no redirect, no hash rewrite, no history push. The
// visitor keeps the clean URL they were given.

/**
 * Pathnames this application already owns. A single-segment path matching one of these is a REAL
 * page and must never be treated as an alias.
 *
 * This list is the frontend's own routing knowledge — it mirrors, and must stay consistent with,
 * services/sales/referralSlug.js#RESERVED_SLUGS on the backend, which is authoritative for what
 * may be ASSIGNED. Here the list only prevents an alias from shadowing a real page; a slug that
 * slipped past this check would still fail server-side resolution and attribute nobody.
 */
export const RESERVED_PATHS = Object.freeze(new Set([
  // infrastructure / served assets
  "api", "assets", "health", "static", "public", "index", "index.html", "favicon.ico",
  "robots.txt", "sitemap.xml", "manifest.json", "sw.js", "vite.svg", "web.config",
  ".well-known", "_next", "cdn", "media", "static-assets",
  // authentication
  "login", "logout", "signin", "signout", "signup", "register", "forgot-password",
  "reset-password", "verify-email", "auth",
  // legal / marketing
  "legal", "privacy", "terms", "pricing", "support", "help", "contact", "about", "blog",
  "landing", "business", "thank-you", "recipient-thankyou", "courtesy-credit",
  // application surfaces (src/App.jsx top-level routes)
  "admin", "app", "dashboard", "qa", "payment", "checkout", "cart",
  "greeting", "gift", "gifts", "credit", "claim-credit", "redeem", "merch", "hero",
  "fundraiser", "campaigns", "contacts", "notifications", "profile", "rewards",
  "send", "sent", "settings", "invitations", "import-wizard", "animations",
  // single-letter route prefixes already in use (/s/:token, /f/:token, /g/:jobId)
  "s", "f", "g",
]));

// Same canonical shape the backend enforces: lowercase, 2–40, internal single hyphens.
const ALIAS_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}[a-z0-9]$/;

/**
 * Read a referral alias out of a pathname.
 *
 * Returns the alias string, or null when the path is not a single eligible segment. Fail-safe in
 * every direction: a reserved page, a nested path, a malformed segment or an empty path all yield
 * null, so ordinary navigation is never disturbed.
 */
export function readVanityAlias(pathname) {
  if (typeof pathname !== "string" || pathname.length === 0) return null;
  // Exactly one segment. A trailing slash is tolerated; anything deeper is a real route.
  const trimmed = pathname.replace(/\/+$/, "");
  if (trimmed === "" || trimmed[0] !== "/") return null;
  const segment = trimmed.slice(1);
  if (segment.includes("/")) return null;

  let decoded = segment;
  try { decoded = decodeURIComponent(segment); } catch { return null; }
  if (!ALIAS_RE.test(decoded)) return null;
  if (RESERVED_PATHS.has(decoded)) return null;
  return decoded;
}

/** Convenience for the running browser. Never throws. */
export function currentVanityAlias() {
  try { return readVanityAlias(window.location.pathname); } catch { return null; }
}
