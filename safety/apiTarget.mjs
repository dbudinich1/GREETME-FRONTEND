/**
 * safety/apiTarget.mjs — Team F single shared fail-closed API-target validator.
 *
 * ONE validator for BOTH automated tests (Playwright specs) AND operational
 * scripts (seed / diagnostic / public-gate). Host classification lives here and
 * nowhere else — do not duplicate hostname logic. Performs NO network I/O.
 *
 * Modes
 * -----
 *  - MUTATING (tests + seed scripts): production is ALWAYS rejected, even with
 *    opt-in. Requires ALLOW_ISOLATED_TEST=1. Loopback or one allow-listed host.
 *      -> requireSafeApiBase()
 *  - READ-ONLY DIAGNOSTIC (instrumentation scripts): explicit target required;
 *    fail closed when missing; production reads require READ_ONLY_PRODUCTION_AUDIT=true
 *    and are GET/HEAD only.
 *      -> requireReadOnlyTarget()
 *  - PUBLIC PRODUCTION GATE (public verification): no embedded host; explicit
 *    target required; requires PUBLIC_PRODUCTION_GATE=true; GET/HEAD only; no
 *    credentials / customer identifiers.
 *      -> requirePublicGateTarget()
 *
 * The guard is intended to run at module-evaluation time (before any beforeAll
 * hook or main()), so a rejection throws BEFORE any network request is made.
 *
 * .mjs so it is importable by both .spec.js specs and .js/.mjs scripts, and so
 * it stays outside the frontend ESLint browser-globals glob (the js/jsx files).
 */

export class UnsafeApiTargetError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsafeApiTargetError';
  }
}

// Always-safe hosts. EXACT match only — no suffix/prefix matching, so
// "localhost.evil.example" / "127.0.0.1.attacker.test" are NOT treated as safe.
export const LOOPBACK_HOSTS = Object.freeze(['localhost', '127.0.0.1']);

// Read-only HTTP methods. Everything else is a mutation.
export const READ_ONLY_METHODS = Object.freeze(['GET', 'HEAD']);

// Any hostname containing one of these substrings is production and can never be
// allow-listed. Substring (not suffix) matching is deliberate defense-in-depth.
const PRODUCTION_HOST_SUBSTRINGS = Object.freeze(['azurewebsites.net']);

// Known exact production hosts (belt-and-suspenders alongside the substring set).
const PRODUCTION_HOSTS = Object.freeze([
  'greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net',
  'greet-me.com',
  'www.greet-me.com',
]);

/**
 * True when the hostname is a production host that must never be contacted by a
 * mutating flow (and only ever read under an explicit audit opt-in).
 */
export function isProductionHost(hostname) {
  const host = String(hostname).toLowerCase();
  if (PRODUCTION_HOSTS.includes(host)) return true;
  return PRODUCTION_HOST_SUBSTRINGS.some((marker) => host.includes(marker));
}

/**
 * Parse + validate scheme of a URL string. Throws UnsafeApiTargetError on
 * empty/missing/malformed/non-http(s). Returns a URL. No network I/O.
 */
function parseHttpUrl(rawUrl, label = 'API target') {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    throw new UnsafeApiTargetError(
      `Refusing to run: ${label} is missing or empty (fail-closed). ` +
        'Provide an explicit local (http://127.0.0.1:PORT) target.'
    );
  }
  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new UnsafeApiTargetError(
      `Refusing to run: ${label} is not a valid URL (fail-closed).`
    );
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeApiTargetError(
      `Refusing to run: ${label} protocol must be http/https, got "${url.protocol}" (fail-closed).`
    );
  }
  return url;
}

/**
 * Assert an HTTP method is read-only (GET/HEAD). Throws otherwise.
 */
export function assertReadOnlyMethod(method, context = 'read-only mode') {
  const m = String(method || '').toUpperCase();
  if (!READ_ONLY_METHODS.includes(m)) {
    throw new UnsafeApiTargetError(
      `Refusing "${m}" in ${context}: only GET/HEAD are permitted (fail-closed).`
    );
  }
  return m;
}

/**
 * MUTATING/host-safety core. Returns the normalized URL string on success;
 * throws UnsafeApiTargetError otherwise. Production is rejected FIRST so the
 * allowlist can never override it. No network I/O.
 *
 * @param {string} rawUrl
 * @param {object} [opts]
 * @param {string} [opts.allowedRemoteHost] - single explicit non-prod host to permit
 */
export function assertSafeApiTarget(rawUrl, { allowedRemoteHost } = {}) {
  const url = parseHttpUrl(rawUrl);
  const host = url.hostname.toLowerCase();

  // (1) Production is rejected FIRST — the allowlist can never override this.
  if (isProductionHost(host)) {
    throw new UnsafeApiTargetError(
      `Refusing to run: "${host}" is a production host (fail-closed). ` +
        'Automated/mutating flows must never contact production.'
    );
  }

  // (2) Loopback hosts are always permitted (exact match only).
  if (LOOPBACK_HOSTS.includes(host)) {
    return url.toString();
  }

  // (3) Exactly one explicit non-production remote host may be allow-listed.
  if (allowedRemoteHost) {
    const allowed = String(allowedRemoteHost).trim().toLowerCase();
    // Defense-in-depth: an allow-listed host that is itself production is still
    // rejected (already handled by (1); re-asserted to make the invariant explicit).
    if (allowed && !isProductionHost(allowed) && host === allowed) {
      return url.toString();
    }
  }

  // (4) Fail closed on everything else.
  throw new UnsafeApiTargetError(
    `Refusing to run: "${host}" is not localhost/127.0.0.1 and is not the ` +
      'allow-listed host (fail-closed). Set TEST_ALLOWED_API_HOST to permit an ' +
      'explicit non-production host.'
  );
}

/**
 * MUTATING resolver (tests + seed scripts). Resolves + validates API_BASE.
 * Production is always rejected; requires ALLOW_ISOLATED_TEST=1 when
 * requireIsolatedOptIn is true. Call at module top-level. Returns validated URL.
 */
export function requireSafeApiBase({
  env = process.env,
  requireIsolatedOptIn = false,
  context = 'test',
} = {}) {
  if (requireIsolatedOptIn && env.ALLOW_ISOLATED_TEST !== '1') {
    throw new UnsafeApiTargetError(
      `Refusing to run isolated mutating flow "${context}": set ` +
        'ALLOW_ISOLATED_TEST=1 to explicitly opt in, and point API_BASE at a ' +
        'local/allow-listed host. This opt-in never permits production hosts.'
    );
  }

  return assertSafeApiTarget(env.API_BASE, {
    allowedRemoteHost: env.TEST_ALLOWED_API_HOST,
  });
}

/**
 * READ-ONLY DIAGNOSTIC resolver. Requires an explicit target (falls back to
 * env.API_BASE only if it is set). Fails closed when the target is missing.
 * Production reads require READ_ONLY_PRODUCTION_AUDIT=true. Always GET/HEAD only.
 *
 * @returns {{apiBase: string, production: boolean, allowedMethods: readonly string[], assertMethod: Function}}
 */
export function requireReadOnlyTarget({
  env = process.env,
  target,
  context = 'diagnostic',
} = {}) {
  const raw = target !== undefined ? target : env.API_BASE;
  const url = parseHttpUrl(raw, `read-only target for "${context}"`);
  const host = url.hostname.toLowerCase();

  const assertMethod = (method) => assertReadOnlyMethod(method, `read-only diagnostic "${context}"`);

  if (isProductionHost(host)) {
    if (env.READ_ONLY_PRODUCTION_AUDIT !== 'true') {
      throw new UnsafeApiTargetError(
        `Refusing to read production host "${host}" for "${context}": set ` +
          'READ_ONLY_PRODUCTION_AUDIT=true to explicitly opt in. Production ' +
          'reads are GET/HEAD only.'
      );
    }
    return { apiBase: url.toString(), production: true, allowedMethods: READ_ONLY_METHODS, assertMethod };
  }

  // Non-production must still be loopback or the single allow-listed host.
  const apiBase = assertSafeApiTarget(raw, { allowedRemoteHost: env.TEST_ALLOWED_API_HOST });
  return { apiBase, production: false, allowedMethods: READ_ONLY_METHODS, assertMethod };
}

/**
 * PUBLIC PRODUCTION GATE resolver. No embedded host. Requires an explicit
 * target AND PUBLIC_PRODUCTION_GATE=true. GET/HEAD only. Never uses credentials
 * or customer identifiers (the caller must not attach auth headers).
 *
 * @returns {{target: string, allowedMethods: readonly string[], assertMethod: Function}}
 */
export function requirePublicGateTarget({
  env = process.env,
  target,
  context = 'public-gate',
} = {}) {
  if (env.PUBLIC_PRODUCTION_GATE !== 'true') {
    throw new UnsafeApiTargetError(
      `Refusing to run public gate "${context}": set PUBLIC_PRODUCTION_GATE=true ` +
        'to explicitly opt in. The public gate is GET/HEAD only and must never ' +
        'use credentials or customer identifiers.'
    );
  }
  const url = parseHttpUrl(target, `public-gate target for "${context}"`);
  const assertMethod = (method) => assertReadOnlyMethod(method, `public gate "${context}"`);
  return { target: url.toString(), allowedMethods: READ_ONLY_METHODS, assertMethod };
}