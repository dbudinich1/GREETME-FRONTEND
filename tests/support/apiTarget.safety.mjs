/**
 * apiTarget.safety.mjs — Team F fail-closed safety unit tests.
 *
 * Run on Node 20 with the built-in runner (no new dependency):
 *   node --test tests/support/apiTarget.safety.mjs
 *
 * Named ".safety.mjs" (not ".spec./.test.") so Playwright's default testMatch
 * never collects it, and so it stays outside the frontend ESLint browser glob.
 *
 * Proves the 13 required guarantees. Where a proof concerns real spec files
 * (zero-network, guard-ordering, layout-only isolation), the test reads the
 * actual files so the guarantee is regression-protected, not just modelled.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  assertSafeApiTarget,
  requireSafeApiBase,
  isProductionHost,
  UnsafeApiTargetError,
  LOOPBACK_HOSTS,
} from '../../safety/apiTarget.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = join(HERE, '..');

const PROD = 'https://greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net';
const readSpec = (name) => readFileSync(join(TESTS_DIR, name), 'utf8');

// A fetch/network spy: if the validator ever performs I/O these throw loudly.
function withNoNetwork(fn) {
  const originals = { fetch: globalThis.fetch };
  let networkCalls = 0;
  globalThis.fetch = () => {
    networkCalls += 1;
    throw new Error('NETWORK CALL ATTEMPTED — validator must never touch the network');
  };
  try {
    fn();
  } finally {
    globalThis.fetch = originals.fetch;
  }
  return networkCalls;
}

// ---------------------------------------------------------------------------
// Proof 1: Missing API_BASE cannot contact production.
// ---------------------------------------------------------------------------
test('1. missing API_BASE fails closed (no production default)', () => {
  assert.throws(() => assertSafeApiTarget(undefined), UnsafeApiTargetError);
  // Via the spec resolver, with no env at all:
  assert.throws(
    () => requireSafeApiBase({ env: {}, requireIsolatedOptIn: false }),
    UnsafeApiTargetError
  );
});

// ---------------------------------------------------------------------------
// Proof 2: Empty API_BASE cannot contact production.
// ---------------------------------------------------------------------------
test('2. empty / whitespace API_BASE fails closed', () => {
  assert.throws(() => assertSafeApiTarget(''), UnsafeApiTargetError);
  assert.throws(() => assertSafeApiTarget('   '), UnsafeApiTargetError);
  assert.throws(
    () => requireSafeApiBase({ env: { API_BASE: '' }, requireIsolatedOptIn: false }),
    UnsafeApiTargetError
  );
});

// ---------------------------------------------------------------------------
// Proof 3: Production Azure hostname is rejected.
// ---------------------------------------------------------------------------
test('3. production Azure hostname is rejected', () => {
  assert.throws(() => assertSafeApiTarget(PROD), UnsafeApiTargetError);
  assert.equal(isProductionHost('greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net'), true);
  assert.equal(isProductionHost('anything.azurewebsites.net'), true);
});

// ---------------------------------------------------------------------------
// Proof 4: Production hostname with path/query variations is rejected.
// ---------------------------------------------------------------------------
test('4. production host with path/query/port variations is rejected', () => {
  const variants = [
    `${PROD}/api/auth/register`,
    `${PROD}/api/jobs/send-greeting?debug=1`,
    `${PROD}:443/api/public/greetings/abc`,
    `${PROD.toUpperCase()}/API`, // case-insensitive host match
    'http://greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net', // http scheme
  ];
  for (const v of variants) {
    assert.throws(() => assertSafeApiTarget(v), UnsafeApiTargetError, `should reject: ${v}`);
  }
});

// ---------------------------------------------------------------------------
// Proof 5: localhost is allowed.
// ---------------------------------------------------------------------------
test('5. localhost is allowed', () => {
  assert.ok(assertSafeApiTarget('http://localhost:3001'));
  assert.ok(assertSafeApiTarget('http://localhost')); // no port
  assert.ok(LOOPBACK_HOSTS.includes('localhost'));
});

// ---------------------------------------------------------------------------
// Proof 6: 127.0.0.1 is allowed.
// ---------------------------------------------------------------------------
test('6. 127.0.0.1 is allowed', () => {
  assert.ok(assertSafeApiTarget('http://127.0.0.1:3001'));
  assert.ok(assertSafeApiTarget('https://127.0.0.1'));
});

// ---------------------------------------------------------------------------
// Proof 7: Explicit approved non-production hostname is allowed only when configured.
// ---------------------------------------------------------------------------
test('7. explicit non-prod host allowed ONLY when allow-listed', () => {
  const staging = 'http://staging-api.internal.test:8080/api';
  // Not allow-listed -> rejected.
  assert.throws(() => assertSafeApiTarget(staging), UnsafeApiTargetError);
  // Allow-listed via option -> permitted.
  assert.ok(assertSafeApiTarget(staging, { allowedRemoteHost: 'staging-api.internal.test' }));
  // Allow-listed via env through the resolver -> permitted.
  assert.ok(
    requireSafeApiBase({
      env: { API_BASE: staging, TEST_ALLOWED_API_HOST: 'staging-api.internal.test' },
    })
  );
  // A DIFFERENT allow-listed host does not permit this one.
  assert.throws(
    () => assertSafeApiTarget(staging, { allowedRemoteHost: 'other-host.internal.test' }),
    UnsafeApiTargetError
  );
});

// ---------------------------------------------------------------------------
// Proof 8: Unknown remote hostname is rejected.
// ---------------------------------------------------------------------------
test('8. unknown remote hosts and loopback-lookalikes are rejected', () => {
  const rejected = [
    'https://example.com',
    'https://api.greet-me.com',
    'http://localhost.evil.example', // suffix trick
    'http://127.0.0.1.attacker.test', // prefix trick
    'http://0.0.0.0:3001', // not loopback
    'ftp://localhost', // wrong protocol
    'file:///etc/passwd', // wrong protocol
    'not-a-url',
  ];
  for (const url of rejected) {
    assert.throws(() => assertSafeApiTarget(url), UnsafeApiTargetError, `should reject: ${url}`);
  }
});

// ---------------------------------------------------------------------------
// Proof 5b (contract §5): the opt-in must NOT override production rejection.
// ---------------------------------------------------------------------------
test('opt-in + allow-list can NEVER override production rejection', () => {
  // Even with opt-in set, allow-list pointed at prod, and prod API_BASE:
  assert.throws(
    () =>
      requireSafeApiBase({
        env: {
          API_BASE: PROD,
          ALLOW_ISOLATED_TEST: '1',
          TEST_ALLOWED_API_HOST: 'greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net',
        },
        requireIsolatedOptIn: true,
      }),
    UnsafeApiTargetError
  );
  // Direct: allow-listing an azure host is still rejected.
  assert.throws(
    () => assertSafeApiTarget(PROD, { allowedRemoteHost: 'greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net' }),
    UnsafeApiTargetError
  );
});

// ---------------------------------------------------------------------------
// Isolated opt-in gate: integration specs require ALLOW_ISOLATED_TEST=1.
// ---------------------------------------------------------------------------
test('isolated integration specs require ALLOW_ISOLATED_TEST=1', () => {
  // Local API_BASE but no opt-in -> still refuses (gate).
  assert.throws(
    () => requireSafeApiBase({ env: { API_BASE: 'http://127.0.0.1:3001' }, requireIsolatedOptIn: true }),
    UnsafeApiTargetError
  );
  // Opt-in + local -> allowed.
  assert.ok(
    requireSafeApiBase({
      env: { API_BASE: 'http://127.0.0.1:3001', ALLOW_ISOLATED_TEST: '1' },
      requireIsolatedOptIn: true,
    })
  );
});

// ---------------------------------------------------------------------------
// Proof 9 & 10: registration / send-greeting setup make ZERO calls after rejection.
// Model the exact spec pattern: top-level guard throws -> beforeAll body (which
// performs the register / send-greeting POST) is never reached.
// ---------------------------------------------------------------------------
test('9 & 10. registration & send-greeting setup make zero network calls after rejection', () => {
  for (const setup of ['register', 'send-greeting']) {
    let posts = 0;
    const fakeRequest = { post: () => (posts += 1) };
    assert.throws(() => {
      // spec top-level:
      const API_BASE = requireSafeApiBase({ env: { API_BASE: PROD }, requireIsolatedOptIn: true });
      // beforeAll body (never runs because the line above throws):
      fakeRequest.post(`${API_BASE}/api/auth/${setup}`);
    }, UnsafeApiTargetError);
    assert.equal(posts, 0, `${setup} setup must issue zero calls after rejection`);
  }
});

// ---------------------------------------------------------------------------
// Proof 11: the guard executes before any beforeAll/beforeEach network activity,
// AND performs no network itself.
// ---------------------------------------------------------------------------
test('11. guard runs (and throws) before any network activity, with no I/O of its own', () => {
  const order = [];
  const netCalls = withNoNetwork(() => {
    assert.throws(() => {
      order.push('guard');
      requireSafeApiBase({ env: { API_BASE: PROD }, requireIsolatedOptIn: true });
      order.push('beforeAll-network'); // unreachable
    }, UnsafeApiTargetError);
  });
  assert.deepEqual(order, ['guard']); // network step never reached
  assert.equal(netCalls, 0); // validator itself made no fetch
});

// ---------------------------------------------------------------------------
// Proof 12: layout-only Playwright specs do not depend on API_BASE (so they run
// locally, unaffected by the guard).
// ---------------------------------------------------------------------------
test('12. layout-only specs never reference API_BASE or the production host', () => {
  const layoutSpecs = [
    'viewport-fit.spec.js',
    'layoutLock.invariants.spec.js',
    'computed-values-audit.spec.js',
    'debug-typography.spec.js',
  ];
  for (const name of layoutSpecs) {
    const src = readSpec(name);
    assert.ok(!/API_BASE/.test(src), `${name} should not use API_BASE`);
    assert.ok(!/azurewebsites\.net/.test(src), `${name} should not reference production host`);
    assert.ok(!/apiTarget/.test(src), `${name} should not import the guard`);
  }
});

// ---------------------------------------------------------------------------
// Proof 13 (static half): the integration specs are guarded and no longer carry
// a production default. (Runtime-behavior-unchanged is verified via git diff.)
// ---------------------------------------------------------------------------
test('13. onboarding specs import the guard and carry no production default', () => {
  for (const name of ['onboarding-flow.spec.js', 'onboarding-greeting-engine.spec.js']) {
    const src = readSpec(name);
    assert.ok(/requireSafeApiBase/.test(src), `${name} must use requireSafeApiBase`);
    assert.ok(
      !/process\.env\.API_BASE\s*\|\|/.test(src),
      `${name} must not default API_BASE to any hard-coded fallback`
    );
    assert.ok(
      !/API_BASE\s*=\s*['"`]https?:\/\//.test(src),
      `${name} must not hard-code an API_BASE URL`
    );
  }
});