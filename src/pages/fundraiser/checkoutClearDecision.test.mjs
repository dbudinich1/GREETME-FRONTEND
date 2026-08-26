// src/pages/fundraiser/checkoutClearDecision.test.mjs
//
// Behavioral proof of the checkout clear-decision. The real `checkoutSessionCreated` predicate is
// esbuild-bundled out of Checkout.jsx (heavy UI deps stubbed) and exercised over the response matrix.
// The token is cleared ONLY when this predicate is true (asserted structurally in referralWiring.test),
// so these cases prove: survive network/400/403/429/500/malformed-2xx; clear only on a valid session.
// Run: node --test src/pages/fundraiser/checkoutClearDecision.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__clear.bundle.mjs");
let checkoutSessionCreated;

before(async () => {
  // Bundle ONLY Checkout.jsx (real); stub every one of its imports to a permissive proxy module so the
  // top-level runs (the component is never invoked) and the pure predicate is exposed without real deps.
  const STUB = "const p = new Proxy(function(){}, { get: () => p, apply: () => p, construct: () => ({}) });\nexport default p;\nexport const jsx=p,jsxs=p,jsxDEV=p,Fragment=p,useState=p,useEffect=p,useRef=p,useNavigate=p,useLocation=p,loadStripe=p,useAuth=p,getErrorMessage=p,getCurrentPriceMap=p,personalPlans=p,fundraiserCheckoutField=p,salesCheckoutField=p,clearToken=p,isFundraiserUiEnabled=p,CreditCard=p,Lock=p,ArrowLeft=p,CheckCircle=p,ShoppingBag=p,Truck=p,Shield=p;";
  const stub = { name: "stub", setup(b) {
    b.onResolve({ filter: /.*/ }, (a) => {
      if (a.kind === "entry-point") return undefined;          // the entry file
      if (a.path.startsWith("node:")) return undefined;
      if (/pages\/Checkout\.jsx$/.test(a.path) || /Checkout\.jsx$/.test(a.path)) return undefined; // bundle Checkout for real
      return { path: a.path, namespace: "stub" };              // stub everything else
    });
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: STUB, loader: "js" }));
  } };
  writeFileSync(join(__dirname, ".__clear.entry.mjs"), `export { checkoutSessionCreated } from "../../pages/Checkout.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__clear.entry.mjs")], outfile: BUNDLE, bundle: true, format: "esm", platform: "node",
    jsx: "automatic", jsxImportSource: "react",
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, plugins: [stub], logLevel: "silent",
  });
  rmSync(join(__dirname, ".__clear.entry.mjs"), { force: true });
  ({ checkoutSessionCreated } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ } });

// Cases that must NOT clear (token preserved) — network/non-2xx resolve to {ok:false,...}; malformed 2xx has no url.
const PRESERVE = [
  ["network reject shape {ok:false,status:0}", { ok: false, status: 0 }],
  ["backend 400", { ok: false, status: 400 }],
  ["backend 403", { ok: false, status: 403 }],
  ["backend 429", { ok: false, status: 429 }],
  ["backend 500", { ok: false, status: 500 }],
  ["2xx missing url", { ok: true }],
  ["2xx empty url", { url: "" }],
  ["null/undefined", null],
  ["undefined", undefined],
];

test("predicate is FALSE (⇒ do not clear) for network/400/403/429/500/malformed-2xx", () => {
  for (const [name, data] of PRESERVE) assert.equal(checkoutSessionCreated(data), false, name);
});

test("predicate is TRUE (⇒ clear) ONLY for a successfully created session with a valid redirect url", () => {
  assert.equal(checkoutSessionCreated({ url: "https://checkout.stripe.com/c/pay/cs_test_123" }), true);
  assert.equal(checkoutSessionCreated({ url: "https://x", creditApplied: true }), true);
});

test("predicate ignores non-string / truthy-but-invalid url shapes (fail-closed)", () => {
  for (const bad of [{ url: 123 }, { url: null }, { url: {} }, { url: [] }, { url: true }]) {
    assert.equal(checkoutSessionCreated(bad), false, JSON.stringify(bad));
  }
});
