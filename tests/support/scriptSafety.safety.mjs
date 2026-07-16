/**
 * scriptSafety.safety.mjs — Team F EXPANDED fail-closed safety unit tests.
 *
 * Run on Node 20 (built-in runner, no new dependency):
 *   node --test tests/support/scriptSafety.safety.mjs
 *
 * Covers the expanded scope: the five operational scripts, the read-only and
 * public-gate modes, method (GET/HEAD-only) enforcement, and .env.development.
 * Where a proof concerns a real file, the test reads that file so the guarantee
 * is regression-protected, not just modelled. No network I/O is performed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  requireSafeApiBase,
  requireReadOnlyTarget,
  requirePublicGateTarget,
  assertReadOnlyMethod,
  isProductionHost,
  UnsafeApiTargetError,
} from '../../safety/apiTarget.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..'); // frontend repo root
const readFile = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const PROD = 'https://greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net';

const MUTATING_SCRIPTS = ['scripts/create-4-rounds.mjs', 'scripts/create-test-jobs.mjs'];
const READONLY_SCRIPTS = ['scripts/detailed-report.mjs', 'scripts/viewport-metrics.mjs'];
const PUBLIC_GATE_SCRIPTS = ['scripts/section1d_public_gate.js', 'scripts/section1c_landscape_gate.js'];
const ALL_SCRIPTS = [...MUTATING_SCRIPTS, ...READONLY_SCRIPTS, ...PUBLIC_GATE_SCRIPTS];

// Network spy: proves every rejection happens before any I/O.
function countNetworkDuring(fn) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => {
    calls += 1;
    throw new Error('NETWORK CALL ATTEMPTED — must never happen before validation');
  };
  try {
    fn();
  } finally {
    globalThis.fetch = original;
  }
  return calls;
}

// ---------------------------------------------------------------------------
// Proof 1: No listed script has an executable hard-coded production default.
// ---------------------------------------------------------------------------
test('1. no listed script contains a hard-coded production host', () => {
  for (const rel of ALL_SCRIPTS) {
    const src = readFile(rel);
    assert.ok(!/greet-me-bzbkeqeeh2gecngt/.test(src), `${rel} must not embed the prod API host`);
    assert.ok(!/azurewebsites\.net/.test(src), `${rel} must not embed any azurewebsites host`);
    assert.ok(!/['"`]https?:\/\/(www\.)?greet-me\.com/.test(src), `${rel} must not embed the prod web host`);
    // And it must route through the single shared validator.
    assert.ok(/safety\/apiTarget\.mjs/.test(src), `${rel} must import the shared validator`);
  }
});

// ---------------------------------------------------------------------------
// Proof 2: Mutating scripts reject production even WITH opt-in.
// ---------------------------------------------------------------------------
test('2. mutating mode rejects production even with opt-in + allow-list', () => {
  assert.throws(
    () =>
      requireSafeApiBase({
        env: { API_BASE: PROD, ALLOW_ISOLATED_TEST: '1', TEST_ALLOWED_API_HOST: PROD },
        requireIsolatedOptIn: true,
        context: 'create-4-rounds.mjs',
      }),
    UnsafeApiTargetError
  );
  // And the mutating scripts declare the isolated opt-in.
  for (const rel of MUTATING_SCRIPTS) {
    assert.ok(/requireIsolatedOptIn:\s*true/.test(readFile(rel)), `${rel} must require the isolated opt-in`);
  }
});

// ---------------------------------------------------------------------------
// Proof 3: Missing targets fail closed (all three modes).
// ---------------------------------------------------------------------------
test('3. missing targets fail closed in every mode', () => {
  assert.throws(() => requireSafeApiBase({ env: {} }), UnsafeApiTargetError);
  assert.throws(() => requireReadOnlyTarget({ env: {} }), UnsafeApiTargetError);
  assert.throws(
    () => requirePublicGateTarget({ env: { PUBLIC_PRODUCTION_GATE: 'true' } }),
    UnsafeApiTargetError
  );
});

// ---------------------------------------------------------------------------
// Proof 4: Localhost is allowed (read-only + public-gate + mutating).
// ---------------------------------------------------------------------------
test('4. localhost is allowed across modes', () => {
  const ro = requireReadOnlyTarget({ env: {}, target: 'http://127.0.0.1:8099' });
  assert.equal(ro.production, false);
  assert.ok(ro.apiBase.startsWith('http://127.0.0.1:8099'));

  assert.ok(requireSafeApiBase({ env: { API_BASE: 'http://localhost:3001' } }));

  const gate = requirePublicGateTarget({
    env: { PUBLIC_PRODUCTION_GATE: 'true' },
    target: 'http://127.0.0.1:8099',
  });
  assert.ok(gate.target.startsWith('http://127.0.0.1:8099'));
});

// ---------------------------------------------------------------------------
// Proof 5: Exact approved non-production host is allowed.
// ---------------------------------------------------------------------------
test('5. exact allow-listed non-production host is allowed', () => {
  const ro = requireReadOnlyTarget({
    env: { TEST_ALLOWED_API_HOST: 'staging-api.internal.test' },
    target: 'https://staging-api.internal.test/api',
  });
  assert.equal(ro.production, false);
  assert.ok(requireSafeApiBase({
    env: { API_BASE: 'https://staging-api.internal.test', TEST_ALLOWED_API_HOST: 'staging-api.internal.test' },
  }));
});

// ---------------------------------------------------------------------------
// Proof 6: Unknown remote hosts are rejected.
// ---------------------------------------------------------------------------
test('6. unknown remote hosts are rejected (read-only + mutating)', () => {
  assert.throws(() => requireReadOnlyTarget({ env: {}, target: 'https://evil.example.com' }), UnsafeApiTargetError);
  assert.throws(() => requireSafeApiBase({ env: { API_BASE: 'https://evil.example.com' } }), UnsafeApiTargetError);
});

// ---------------------------------------------------------------------------
// Proof 7: Read-only production mode requires explicit opt-in.
// ---------------------------------------------------------------------------
test('7. read-only production read requires READ_ONLY_PRODUCTION_AUDIT=true', () => {
  assert.throws(() => requireReadOnlyTarget({ env: {}, target: PROD }), UnsafeApiTargetError);
  const ok = requireReadOnlyTarget({ env: { READ_ONLY_PRODUCTION_AUDIT: 'true' }, target: PROD });
  assert.equal(ok.production, true);
  assert.deepEqual([...ok.allowedMethods], ['GET', 'HEAD']);
});

// ---------------------------------------------------------------------------
// Proof 8: Production audit mode allows GET/HEAD only.
// ---------------------------------------------------------------------------
test('8. audit mode permits GET and HEAD', () => {
  const ok = requireReadOnlyTarget({ env: { READ_ONLY_PRODUCTION_AUDIT: 'true' }, target: PROD });
  assert.equal(ok.assertMethod('GET'), 'GET');
  assert.equal(ok.assertMethod('head'), 'HEAD');
  assert.equal(assertReadOnlyMethod('GET'), 'GET');
});

// ---------------------------------------------------------------------------
// Proof 9: Production audit mode rejects POST/PUT/PATCH/DELETE.
// ---------------------------------------------------------------------------
test('9. audit mode rejects all mutating methods', () => {
  const ok = requireReadOnlyTarget({ env: { READ_ONLY_PRODUCTION_AUDIT: 'true' }, target: PROD });
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.throws(() => ok.assertMethod(m), UnsafeApiTargetError, `must reject ${m}`);
    assert.throws(() => assertReadOnlyMethod(m), UnsafeApiTargetError, `must reject ${m}`);
  }
  // The read-only scripts actually wire this enforcement into their route handler.
  for (const rel of READONLY_SCRIPTS) {
    assert.ok(/assertMethod\(route\.request\(\)\.method\(\)\)/.test(readFile(rel)), `${rel} must enforce method in route handler`);
  }
});

// ---------------------------------------------------------------------------
// Proof 10: Public-gate mode requires explicit opt-in and is GET/HEAD only.
// ---------------------------------------------------------------------------
test('10. public gate requires PUBLIC_PRODUCTION_GATE=true and is GET/HEAD only', () => {
  assert.throws(() => requirePublicGateTarget({ env: {}, target: PROD }), UnsafeApiTargetError);
  const gate = requirePublicGateTarget({ env: { PUBLIC_PRODUCTION_GATE: 'true' }, target: PROD });
  assert.deepEqual([...gate.allowedMethods], ['GET', 'HEAD']);
  assert.throws(() => gate.assertMethod('POST'), UnsafeApiTargetError);
  // Public-gate scripts must attach no credentials (no Authorization / token / admin key).
  for (const rel of PUBLIC_GATE_SCRIPTS) {
    const src = readFile(rel);
    assert.ok(!/[Aa]uthorization/.test(src), `${rel} must not send Authorization`);
    assert.ok(!/Bearer/.test(src), `${rel} must not send a Bearer token`);
    assert.ok(!/x-admin-key/i.test(src), `${rel} must not send an admin key`);
  }
});

// ---------------------------------------------------------------------------
// Proof 13 (section1c closure): the landscape gate is fully hardened.
// ---------------------------------------------------------------------------
test('13. section1c_landscape_gate is guarded (no prod default, opt-in, GET/HEAD, no creds, pre-I/O)', () => {
  const rel = 'scripts/section1c_landscape_gate.js';
  const src = readFile(rel);

  assert.ok(!/greet-me\.com/.test(src), 'section1c must not embed greet-me.com');
  assert.ok(!/azurewebsites\.net/.test(src), 'section1c must not embed an azure host');
  assert.ok(/requirePublicGateTarget/.test(src) && /safety\/apiTarget\.mjs/.test(src), 'section1c must use the shared public-gate guard');
  assert.ok(!/[Aa]uthorization|Bearer|x-admin-key/i.test(src), 'section1c must not attach credentials');
  assert.ok(src.indexOf('requirePublicGateTarget(') < src.indexOf('chromium.launch'), 'guard must run before browser launch');

  assert.throws(() => requirePublicGateTarget({ env: { PUBLIC_PRODUCTION_GATE: 'true' }, context: 'section1c' }), UnsafeApiTargetError);
  assert.throws(() => requirePublicGateTarget({ env: {}, target: 'https://greet-me.com', context: 'section1c' }), UnsafeApiTargetError);

  const calls = countNetworkDuring(() => {
    assert.throws(() => requirePublicGateTarget({ env: { PUBLIC_PRODUCTION_GATE: 'true' } }), UnsafeApiTargetError);
    assert.throws(() => requirePublicGateTarget({ env: {}, target: 'https://greet-me.com' }), UnsafeApiTargetError);
  });
  assert.equal(calls, 0);

  const gate = requirePublicGateTarget({ env: { PUBLIC_PRODUCTION_GATE: 'true' }, target: 'https://greet-me.com' });
  assert.equal(gate.assertMethod('GET'), 'GET');
  assert.equal(gate.assertMethod('HEAD'), 'HEAD');
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.throws(() => gate.assertMethod(m), UnsafeApiTargetError, `must reject ${m}`);
  }
});

// ---------------------------------------------------------------------------
// Proof 11: .env.development points to localhost (not production).
// ---------------------------------------------------------------------------
test('11. .env.development VITE_API_BASE points to localhost', () => {
  const env = readFile('.env.development');
  const m = env.match(/VITE_API_BASE=(\S+)/);
  assert.ok(m, 'VITE_API_BASE must be defined');
  const host = new URL(m[1]).hostname;
  assert.ok(['127.0.0.1', 'localhost'].includes(host), `expected loopback, got ${host}`);
  assert.equal(isProductionHost(host), false);
  assert.ok(!/azurewebsites\.net/.test(env) && !/greet-me\.com/.test(env), 'no production host in .env.development');
});

// ---------------------------------------------------------------------------
// Proof 12: Every rejection occurs before any network I/O.
// ---------------------------------------------------------------------------
test('12. all rejections happen before any network call', () => {
  const calls = countNetworkDuring(() => {
    const reject = (fn) => assert.throws(fn, UnsafeApiTargetError);
    reject(() => requireSafeApiBase({ env: { API_BASE: PROD, ALLOW_ISOLATED_TEST: '1' }, requireIsolatedOptIn: true }));
    reject(() => requireReadOnlyTarget({ env: {}, target: PROD }));
    reject(() => requireReadOnlyTarget({ env: {} }));
    reject(() => requirePublicGateTarget({ env: {}, target: PROD }));
    reject(() => requirePublicGateTarget({ env: { PUBLIC_PRODUCTION_GATE: 'true' } }));
  });
  assert.equal(calls, 0);
});
