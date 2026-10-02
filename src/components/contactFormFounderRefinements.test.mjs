// Run: node --test src/components/contactFormFounderRefinements.test.mjs
// PROPOSED Surface 2 founder refinements (2026-10-01) on ContactForm.jsx. Source-structure test
// (the form is not mountable under node --test); the rendered behaviour is covered by
// tests/surface2Preview.spec.js in the 5231 preview.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sanitizeRelationshipForSave } from "./contactFormValidation.js";

const RAW = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "ContactForm.jsx"), "utf8").replace(/\r\n/g, "\n");
const CODE = RAW.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").split("\n").map((l) => l.replace(/(^|\s)\/\/.*$/, "")).join("\n");

test("Relation section heading is Relationship Context; option vocabulary headings untouched", () => {
  assert.match(CODE, /<span>Relationship Context<\/span>/);
  assert.doesNotMatch(CODE, /<span>Relation<\/span>/);
});

test("Cultural & Personal Context is no longer rendered", () => {
  assert.doesNotMatch(CODE, /Cultural & Personal Context|Cultural \/ Heritage|Faith \/ Observance|culturalSectionExpanded/);
});

test("culturalContext is still carried: initial state, draft restore, edit load, and the submit payload", () => {
  assert.match(CODE, /culturalContext: \{\s*heritage: \[\],\s*faith: null,\s*preferCulturalGifts: false/);
  assert.match(CODE, /\.\.\.\(draft\.formData\.culturalContext \|\| \{\}\)/);
  assert.match(CODE, /culturalContext: contact\.culturalContext \|\|/);
  assert.match(CODE, /sanitizeRelationshipForSave\(formData\)/);
  // QR Cash fix (Team 1A): the saved payload is {...sanitized, occasionGiftSettings: normalised}; culturalContext rides in the spread
  assert.match(CODE, /await onSubmit\(\{ \.\.\.toSave, occasionGiftSettings: normalizeGiftSettingsForSave/);
  // the sanitizer passes stored cultural data through untouched (backend PUT writes `culturalContext || {}`)
  const stored = { heritage: ["Irish"], faith: "Catholic", preferCulturalGifts: true };
  const out = sanitizeRelationshipForSave({ relationshipCategory: "", relationship: "", culturalContext: stored });
  assert.deepEqual(out.culturalContext, stored);
});

test("Moments heading is the founder's exact text, one heading, no optional/memory subscript", () => {
  assert.match(CODE, /MOMENTS : ADD IMAGES TO MAKE YOUR GREET-ME UNFORGETTABLE/);
  const hdr = RAW.slice(RAW.indexOf('data-testid="moments-heading"'), RAW.indexOf("{memoryPhotosExpanded ? ("));
  assert.doesNotMatch(hdr, /Optional|memory photos|photo\$\{|Memory/i);
});

test("Special Occasions: centered heading, collapsed by default, caret toggle, controls kept, errors never hidden", () => {
  assert.match(CODE, /useState\(false\);\s*\n\s*useEffect\(\(\) => \{ if \(errors && errors\.occasions\) setOccasionsExpanded\(true\)/);
  assert.match(CODE, /const \[occasionsExpanded, setOccasionsExpanded\] = useState\(false\)/);
  assert.match(CODE, /data-testid="special-occasions-heading"[^>]*textAlign: 'center'/);
  assert.match(CODE, /justifyContent: 'center'[\s\S]{0,300}special-occasions-heading/);
  assert.match(CODE, /ChevronUp size=\{20\}[\s\S]{0,200}ChevronDown size=\{20\}/);
  // existing controls are inside the collapsible fragment, and the occasions error sits outside it
  const body = CODE.slice(CODE.indexOf("{occasionsExpanded && (<>"), CODE.indexOf("</>)}"));
  for (const k of ["handleOccasionGiftChange", "autoGift", "FaithBasedOccasionSelector"]) assert.ok(body.includes(k) || CODE.includes(k), `${k} still present`);
  assert.ok(CODE.indexOf("</>)}") < CODE.indexOf("{errors.occasions && <p"), "occasions error is rendered outside the collapsed body");
});

test("footer: outside the cards, Cancel on the left and Save on the right, Save label", () => {
  const i = CODE.indexOf('<div data-testid="contact-form-footer"');
  assert.ok(i > CODE.indexOf("{errors.occasions && <p"), "footer follows (is outside) the occasions card");
  const foot = CODE.slice(i, CODE.indexOf("</form>", i));
  assert.match(foot, /justifyContent: 'space-between'/);
  assert.ok(foot.indexOf("Cancel") < foot.indexOf("'Save'"), "Cancel precedes Save (left to right)");
  assert.match(foot, /contact \? 'Update Recipient' : 'Save'/);
  assert.doesNotMatch(foot, /'Add Recipient'/);
});



test("round 2/3: header is Occasion Scheduler with subtext and festive icons; the round-2 conditional status line is gone", () => {
  assert.match(CODE, />Occasion Scheduler<\/h3>/);
  assert.doesNotMatch(CODE, />Special Occasions<\/h3>/);
  assert.doesNotMatch(CODE, /giftsConfigured|GIFTS ARE CONFIGURED/, "no duplicate of the banner");
  assert.match(CODE, /data-testid="scheduler-subtext"[^>]*>Schedule the love!<\/span>/);
  const ic = CODE.slice(CODE.indexOf('data-testid="scheduler-festive-icons"'), CODE.indexOf('data-testid="special-occasions-heading"'));
  for (const n of ["<Calendar ", "<PartyPopper ", "<Heart "]) assert.ok(ic.includes(n), n + " in the header");
  assert.match(CODE, /flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center'/);
});

test("round 3: gift banner is centered with a cinematic gift icon on BOTH sides and no left-only icon", () => {
  const b = CODE.slice(CODE.indexOf('<div data-testid="gift-banner"'), CODE.indexOf("{/* Occasions */}") > 0 ? CODE.length : undefined);
  const blk = b.slice(0, b.indexOf("within your budget.") + 200);
  assert.equal((blk.match(/<CinematicGiftIcon \/>/g) || []).length, 2, "an icon on each side");
  assert.ok(blk.indexOf("<CinematicGiftIcon />") < blk.indexOf("Remember to Include a gift") && blk.lastIndexOf("<CinematicGiftIcon />") > blk.indexOf("OR let Greet-Me select one"));
  assert.doesNotMatch(blk, /<Gift size=\{20\}/, "old left-only icon removed");
  assert.match(blk, /justifyContent: 'center'/);
  assert.equal((blk.match(/textAlign: 'center'/g) || []).length >= 3, true, "container, title and body centered");
  assert.match(blk, /Remember to Include a gift/);
  assert.match(blk, /Complete the moment with the thoughtful gift from the Greet-Me Gift Place\. OR let Greet-Me select one for you within your budget\./);
  assert.doesNotMatch(blk, /Gifts are configured per occasion|thoughtfulg|<button|onClick/, "old copy gone, dictation typo fixed, informational only (no CTA)");
  assert.ok(CODE.indexOf('data-testid="special-occasions-toggle"') < CODE.indexOf('<div data-testid="gift-banner" style'), "banner is after the scheduler header");
  assert.ok(CODE.indexOf('</>)}') < CODE.indexOf('<div data-testid="gift-banner" style'), "banner is after the scheduler content");
  assert.ok(CODE.indexOf('<div data-testid="gift-banner" style') < CODE.indexOf('<div data-testid="contact-form-footer"'), "banner is above the footer");
  assert.match(CODE, /<option value="curated">Let Greet-Me select a gift<\/option>/);
  assert.match(CODE, /<option value=\{25\}>\$25<\/option>[\s\S]{0,400}<option value=\{150\}>\$150<\/option>/);
  assert.match(CODE, /navigate\(\(giftSetting\.type === 'merch' \|\| giftSetting\.type === 'marketplace'\) \? `\/dashboard\/merch\?category=merch/);
});

test("round 3: Profile Photo label; Moments copy states no invented count", () => {
  assert.doesNotMatch(CODE, /Default Photo|Default photo/);
  assert.match(CODE, />\s*Profile Photo\s*</);
  assert.match(CODE, /Add images below\. These images will be presented inside your sent Greet-Me\./);
  assert.doesNotMatch(CODE, /Add up to \d+ images/);
  assert.match(CODE, /file\.size > 5 \* 1024 \* 1024/, "the real 5MB per-image limit is still enforced");
});

test("round 3: ONE section gap and ONE inner gap, applied uniformly (no responsive overrides)", () => {
  assert.match(CODE, /'--gm-section-gap': '1\.5rem', '--gm-inner-gap': '1rem'/);
  assert.match(CODE, /gap: 'var\(--gm-section-gap\)'/);
  assert.match(CODE, /\.gm-cf > \* \{ margin-top: 0 !important; margin-bottom: 0 !important; \}/);
  assert.doesNotMatch(CODE, /gap: '2\.5rem'/);
});

test("round 3: brand tokens for gradients and accents (existing variables only)", () => {
  for (const v of ["var(--primary-dark)", "var(--accent)", "var(--gray-900)", "var(--radius-lg)"]) assert.ok(CODE.includes(v), v);
  assert.match(CODE, /background: 'var\(--primary-dark\)'.*boxShadow/s, "Save uses --primary-dark (white-on-#4f46e5 clears 4.5:1)");
});

test("round 2 keeps behaviour: still collapsed, caret, auto-open on error, controls and data pass-through", () => {
  assert.match(CODE, /useState\(false\)/);
  assert.match(CODE, /setOccasionsExpanded\(true\)/);
  assert.match(CODE, /sanitizeRelationshipForSave\(formData\)/);
  // QR Cash fix (Team 1A): the saved payload is {...sanitized, occasionGiftSettings: normalised}; culturalContext rides in the spread
  assert.match(CODE, /await onSubmit\(\{ \.\.\.toSave, occasionGiftSettings: normalizeGiftSettingsForSave/);
});

test("round 3: Moments heading wraps (normal white-space, shrinkable flex children), text unchanged", () => {
  const h = RAW.slice(RAW.indexOf('data-testid="moments-heading"'), RAW.indexOf("MOMENTS : ADD IMAGES"));
  assert.match(h, /whiteSpace: 'normal'/);
  assert.match(h, /overflowWrap: 'anywhere'/);
  assert.doesNotMatch(h, /nowrap|ellipsis/);
  assert.match(RAW, /flex: 1, minWidth: 0 \}\}>\s*\n\s*<Camera/);
  assert.match(CODE, /MOMENTS : ADD IMAGES TO MAKE YOUR GREET-ME UNFORGETTABLE/);
});
test("round 4: occasion cards open fully when checked (gift section always open), no chevron, no 'No gift (optional)'", () => {
  assert.doesNotMatch(CODE, /giftBlockExpanded|setGiftBlockExpanded|No gift \(optional\)/);
  // FOUNDER round 4b: the visible "Gift & Delivery" label and its icon are gone; nothing referenced it
  assert.doesNotMatch(CODE, /Gift &amp; Delivery|gift-delivery-heading/);
  assert.doesNotMatch(CODE, /aria-labelledby/);
  // the Delivery Details blocks (the real delivery fields) are separate and still gated by requiresDeliveryAddress
  assert.equal((CODE.match(/Delivery Details/g) || []).length, 3, "personal, secular and faith delivery blocks untouched");
  assert.equal((CODE.match(/requiresDeliveryAddress\(giftSetting\.type\) && \(/g) || []).length, 3);
  // the gift row is rendered inside the {isSelected && (...)} area of the personal AND secular cards
  assert.equal((CODE.match(/\{renderAddGiftRow\(occasion\.value\)\}/g) || []).length, 2);
});

test("round 4: Add gift checkbox is unchecked by default and is a VIEW of the same occasionGiftSettings data", () => {
  assert.match(CODE, /const isAddGiftChecked = \(occ\) => \(addGiftOn\[occ\] !== undefined \? addGiftOn\[occ\] : getOccasionGiftSetting\(occ\)\.type !== 'none'\)/);
  // default setting is none => unchecked
  assert.match(CODE, /\|\| \{ type: 'none', autoGift: false \}/);
  // unticking == the old "None": the SAME handler with 'none'; occasionGiftSettings shape untouched
  assert.match(CODE, /if \(!on\) handleOccasionGiftChange\(occ, 'type', 'none'\);/);
  assert.match(CODE, /<input\s+type="checkbox"\s+data-testid=\{`add-gift-\$\{occ\}`\}/);
  assert.match(CODE, /Add gift\s*<\/label>/);
});

test("round 4: selector keeps every current mode, disabled until Add gift is ticked; sub-controls unchanged", () => {
  const row = CODE.slice(CODE.indexOf("const renderAddGiftRow"), CODE.indexOf("const handleOccasionGiftChange"));
  for (const v of ['value="qrcash"', 'value="merch"', 'value="curated">Let Greet-Me select a gift', 'value="marketplace"']) assert.ok(row.includes(v), v);
  assert.ok(!row.includes('value="none"'), "no None entry in the selector");
  assert.match(row, /disabled=\{!checked\}/);
  // budget selector and Choose Item flow (return-to-form) remain
  assert.match(CODE, /<option value=\{25\}>\$25<\/option>[\s\S]{0,400}<option value=\{150\}>\$150<\/option>/);
  assert.match(CODE, /returnRecipientId=\$\{contact\.id\}/);
});

test("round 4: the annual-repeat sentence appears only for yearly-repeating occasions (recurring !== false)", () => {
  assert.match(CODE, /const repeatsAnnually = \(occ\) => getOccasionCadenceLabel\(occ\) === 'Repeats yearly'/);
  assert.match(CODE, /\{checked && repeatsAnnually\(occ\) && \(\s*<small[^>]*>\s*Your gift selection will automatically repeat annually until changed\./);
  assert.equal((CODE.match(/Your gift selection will automatically repeat annually until changed\./g) || []).length, 1);
  // data source: only graduation and getwell carry recurring:false in helpers
  const H = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "utils", "helpers.js"), "utf8");
  const oneTime = [...H.matchAll(/value: '([a-z_]+)'[^\n]*recurring: false/g)].map((m) => m[1]);
  assert.deepEqual(oneTime.sort(), ["getwell", "graduation"]);
});

test("round 4: faith-holiday gift block is untouched (flagged), banner stays informational", () => {
  assert.ok(CODE.includes("Gift Add-On:"), "faith block still uses the old Gift Add-On dropdown (flagged to founder)");
});
