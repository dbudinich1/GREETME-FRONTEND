// Guards against encoding corruption (UTF-8 text re-saved through a legacy codepage, producing
// "a-circumflex, euro, ..." sequences) and stray byte-order marks in source files.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOJIBAKE = Buffer.from([0xc3, 0xa2, 0xe2, 0x82, 0xac]); // C3 A2 E2 82 AC
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const EXT = /\.(jsx?|mjs|cjs|css|html|json)$/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXT.test(e.name)) out.push(p);
  }
  return out;
}

test("src/** contains no mojibake sequences and no BOM", () => {
  const bad = [];
  for (const f of walk(ROOT)) {
    const b = fs.readFileSync(f);
    if (b.indexOf(MOJIBAKE) >= 0) bad.push(`${path.relative(ROOT, f)}: mojibake`);
    if (b.subarray(0, 3).equals(BOM)) bad.push(`${path.relative(ROOT, f)}: BOM`);
  }
  assert.deepEqual(bad, []);
});
