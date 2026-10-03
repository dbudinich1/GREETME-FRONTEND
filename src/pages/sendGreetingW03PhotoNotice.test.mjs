// Run: node --test src/pages/sendGreetingW03PhotoNotice.test.mjs
// W03: the required sender profile photo is explained BEFORE the final send/checkout, with a direct
// remediation action, and nothing dispatches until the requirement is met. Source-structure test
// (SendGreeting is not mountable under node --test); predicate is extracted and evaluated.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "SendGreeting.jsx"), "utf8");

const predicateSrc = SRC.match(/const senderPhotoMissing = \(\(\) => \{([\s\S]*?)\n  \}\)\(\);/);

test("senderPhotoMissing predicate: empty, data URL and placeholders are missing; real https is not", () => {
  assert.ok(predicateSrc, "predicate present");
  const mk = (user) => new Function("user", `${predicateSrc[1]}`)(user);
  assert.equal(mk({ photoUrl: "" }), true);
  assert.equal(mk(null), true);
  assert.equal(mk({ photoUrl: "data:image/png;base64,AAA" }), true);
  assert.equal(mk({ photoUrl: "https://placehold.co/100" }), true);
  assert.equal(mk({ photoUrl: "https://acct.blob.core.windows.net/p/me.jpg" }), false);
});

test("an up-front notice and two remediation buttons exist and go to the profile page", () => {
  assert.match(SRC, /data-testid="sender-photo-required-notice"/);
  assert.match(SRC, /data-testid="add-profile-photo"[\s\S]{0,80}navigate\('\/dashboard\/profile'\)/);
  assert.match(SRC, /data-testid="add-profile-photo-from-error"[\s\S]{0,80}navigate\('\/dashboard\/profile'\)/);
});

test("the notice sits before the submit row", () => {
  assert.ok(SRC.indexOf('data-testid="sender-photo-required-notice"') < SRC.indexOf("{/* Submit */}"));
});

test("validate() uses the same predicate, and handleSubmit opens the review only after validate passes", () => {
  assert.match(SRC, /if \(senderPhotoMissing\) \{\s*newErrors\.photo = SENDER_PHOTO_REQUIRED_MESSAGE;/);
  const h = SRC.slice(SRC.indexOf("const handleSubmit = async"), SRC.indexOf("const handleReviewClose"));
  assert.ok(h.indexOf("if (!validate()) return;") > -1);
  assert.ok(h.indexOf("if (!validate()) return;") < h.indexOf("setIsPreSendReviewOpen(true)"));
  assert.doesNotMatch(h.split("\n").map((l) => l.split("//")[0]).join("\n"), /executeGreetingSend|api\./, "handleSubmit never dispatches itself");
});

test("the old pointer to a non-existent Personalization page is gone", () => {
  assert.doesNotMatch(SRC, /Dashboard \\u2192 Personalization/);
});

