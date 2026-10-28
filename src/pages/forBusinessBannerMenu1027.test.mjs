// Founder 2026-10-27: For Business banner contrast, headline, Hero card copy and Animation Packs resting border;
// account-menu items left-aligned on desktop and phone.
// Run: node --test src/pages/forBusinessBannerMenu1027.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FB = readFileSync(new URL("./ForBusiness.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const LAYOUT = readFileSync(new URL("../components/DashboardLayout.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("both purple banners: headings and supporting text are white (index.css h1/h2/p colours otherwise win); gradients unchanged", () => {
  const banners = FB.split("background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',\n          borderRadius").slice(1);
  assert.equal(banners.length, 2, "the top banner and the final banner");
  for (const b of banners) {
    const heading = b.slice(b.search(/<h[12] style=\{\{/), b.indexOf("}}>", b.search(/<h[12] style=\{\{/)));
    const para = b.slice(b.indexOf("<p style={{"), b.indexOf("}}>", b.indexOf("<p style={{")));
    assert.match(heading, /color: 'white'/);
    assert.match(para, /color: 'white'/);
    assert.doesNotMatch(para, /opacity/);
  }
});

test("headline and Hero card copy are the founder's approved wording", () => {
  assert.match(FB, />\s*Celebrate your clients and employees with branded gifts\.\s*</);
  assert.doesNotMatch(FB, /Create branded gifts to acknowledge/);
  assert.match(FB, /Greet-Me™ Hero™ Participation/);
  assert.match(FB, /All corporate patronage is automatically Greet-Me™ Hero™ eligible\. Turn moments of appreciation into opportunities to give back\. Together, we can celebrate your people while supporting the heroes who serve us all\./);
  assert.doesNotMatch(FB, /not live yet|participation is live/);
});

test("Animation Packs: 1px resting border like its neighbours; purple only while hovered; destination unchanged", () => {
  const i = FB.indexOf("reconnects to the real Animation Bank purchase flow");
  const tile = FB.slice(i, FB.indexOf("</h3>", i));
  assert.match(tile, /border: '1px solid var\(--border\)'/);
  assert.match(tile, /onMouseEnter=\{\(e\) => \{\n\s*e\.currentTarget\.style\.borderColor = '#8b5cf6';/);
  assert.match(tile, /onMouseLeave=\{\(e\) => \{\n\s*e\.currentTarget\.style\.borderColor = 'var\(--border\)';/);
  assert.match(tile, /navigate\('\/dashboard\/animations'\)/);
  assert.equal((FB.match(/border: '2px solid/g) || []).length, 0);
});

test("account menus: every item starts at the left edge (global button rule centres flex content) and icons never shrink", () => {
  const desk = LAYOUT.slice(LAYOUT.indexOf('data-testid="usermenu-founder-command"'), LAYOUT.indexOf("<span>Logout</span>"));
  assert.equal((desk.match(/justifyContent: 'flex-start'/g) || []).length, 5, "Central Command, Media Library, My Orders, Settings, Logout");
  assert.equal((desk.match(/size=\{16\} style=\{\{ flexShrink: 0 \}\}/g) || []).length, 5);
  assert.equal((desk.match(/gap: '0\.5rem'/g) || []).length, 5, "one icon-to-text gap");
  const phoneStart = LAYOUT.indexOf("mobilemenu-founder-command");
  const phone = LAYOUT.slice(phoneStart, LAYOUT.indexOf("<span>Logout</span>", phoneStart));
  assert.equal((phone.match(/justifyContent: 'flex-start'/g) || []).length, 2, "account items + Logout");
  assert.equal((phone.match(/size=\{18\} style=\{\{ flexShrink: 0 \}\}/g) || []).length, 2);
  assert.equal((phone.match(/gap: '0\.75rem'/g) || []).length, 2);
});

test("phones: the top headline scales down (fits a 320px banner) and Logout shares the account list's left inset", () => {
  assert.match(FB, /<h1 style=\{\{\n\s*fontSize: 'clamp\(1\.5rem, 7\.5vw, 2\.25rem\)',/);
  const footer = LAYOUT.slice(LAYOUT.indexOf("{/* Menu Footer */}"), LAYOUT.indexOf("<span>Logout</span>", LAYOUT.indexOf("{/* Menu Footer */}")));
  assert.match(footer, /padding: '1rem',/, "footer inset unchanged");
  assert.match(footer, /padding: '0\.75rem 0\.5rem',/, "Logout: 1rem footer + 0.5rem = the list's 0.5rem + 1rem");
});

test("phones: both Contact Sales buttons narrow their side padding so they stay centred in a 320px banner; destination unchanged", () => {
  const buttons = FB.split("onClick={() => setShowContactForm(true)}").slice(1);
  assert.equal(buttons.length, 2);
  for (const b of buttons) assert.match(b, /^\n\s*style=\{\{\n\s*padding: '0\.875rem clamp\(1rem, 5vw, 2rem\)',/);
});
