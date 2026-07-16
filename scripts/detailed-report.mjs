/**
 * detailed-report.mjs — Captures exact measurements per user spec:
 * Portrait: poem scrollH vs clientH, warm-wishes top Y, poem bottom Y
 * Landscape: poem top relative to page-right top, free space above poem
 * Plus: poem visual line wrapping count
 */
import { chromium } from '@playwright/test';
import { requireReadOnlyTarget } from '../safety/apiTarget.mjs';

const VIEWPORTS = [
  { name: '390x844 portrait', w: 390, h: 844 },
  { name: '844x390 landscape', w: 844, h: 390 },
  { name: '667x375 landscape', w: 667, h: 375 },
  { name: '1440x900 desktop', w: 1440, h: 900 },
];

const ALL_ROUNDS = [
  [
    { id: '4da2d5e9-c1c9-485c-97d0-1f3a69f6dc5a', label: 'R1-Amy' },
    { id: 'b4ea565d-98da-46bb-8095-f2bb3c806b8f', label: 'R1-Ben' },
    { id: '692fb3d8-d13d-46ab-a370-9e3b6d0d57d6', label: 'R1-Catherine' },
    { id: '8373b600-b67c-4a12-a58d-8c3cd4ba460d', label: 'R1-Grandma Rose' },
    { id: '0610620a-5cca-4ad9-96c7-b2afecec7094', label: 'R1-Alexander' },
  ],
  [
    { id: '834b1b96-098d-4ed2-9d4d-0d572e82ba98', label: 'R2-Amy' },
    { id: 'fe196b07-6ed8-4bf0-957b-06b499de0516', label: 'R2-Ben' },
    { id: 'b4ad6a2f-f5de-48e8-a66a-7aed692abcc5', label: 'R2-Catherine' },
    { id: 'f7bcb531-21a7-4e0f-b74e-b1a074f5707f', label: 'R2-Grandma Rose' },
    { id: '01985bd2-5a2d-4360-9df5-e6e9bdbe2b26', label: 'R2-Alexander' },
  ],
  [
    { id: '48a9f482-6235-4b63-82c3-fb248dbc629c', label: 'R3-Amy' },
    { id: '1383196c-11e7-409b-bd64-814497e147ed', label: 'R3-Ben' },
    { id: 'ec6980d8-e610-4a7f-8148-a081c3da18c3', label: 'R3-Catherine' },
    { id: '250ff080-a7b8-49c5-8ff0-00cea340619d', label: 'R3-Grandma Rose' },
    { id: '665f5f8d-9adf-4c31-a1c8-fa0db8e46ee0', label: 'R3-Alexander' },
  ],
  [
    { id: '57ddac29-309b-4540-9e68-96f2b168e63b', label: 'R4-Amy' },
    { id: 'cd2e4e77-56ea-4f30-a2ec-236789f98665', label: 'R4-Ben' },
    { id: 'd78d14ab-7160-4a4f-80e0-b17f0f9783b7', label: 'R4-Catherine' },
    { id: '73afd205-60c2-4c9f-a7c2-fb246dfb092c', label: 'R4-Grandma Rose' },
    { id: '6f0860d8-e7ed-4da7-9f2c-04273d97a90d', label: 'R4-Alexander' },
  ],
];

const BASE_URL = 'http://localhost:5174';
// READ-ONLY diagnostic — fail-closed (Team F). Explicit API_BASE required; a
// production target additionally requires READ_ONLY_PRODUCTION_AUDIT=true and is
// GET/HEAD only. Resolves at module top-level so any rejection throws before I/O.
//   READ_ONLY_PRODUCTION_AUDIT=true API_BASE=https://<prod-host> node scripts/detailed-report.mjs
const READONLY = requireReadOnlyTarget({ target: process.env.API_BASE, context: 'detailed-report.mjs' });
const API_BASE = READONLY.apiBase;

async function captureDetailed(page) {
  return page.evaluate(() => {
    const poem = document.querySelector('.gc-interior-spread .gc-page-right .gc-poem');
    const warmWishes = document.querySelector('.gc-interior-spread .gc-page-right .gc-warm-wishes');
    const pageRight = document.querySelector('.gc-interior-spread .gc-page-right');
    const message = document.querySelector('.gc-interior-spread .gc-page-left .gc-greeting-message');
    const signature = document.querySelector('.gc-interior-spread .gc-page-left .gc-signature');

    const result = {};

    // Poem measurements
    if (poem) {
      const pRect = poem.getBoundingClientRect();
      result.poem = {
        scrollHeight: poem.scrollHeight,
        clientHeight: poem.clientHeight,
        clipped: poem.scrollHeight > poem.clientHeight + 2,
        topY: Math.round(pRect.top),
        bottomY: Math.round(pRect.bottom),
        fontSize: getComputedStyle(poem).fontSize,
        lineHeight: getComputedStyle(poem).lineHeight,
      };

      // Poem uses white-space:pre-line — count text lines from \n splits
      const poemTextContent = poem.textContent || '';
      const textLines = poemTextContent.split('\n').filter(l => l.trim().length > 0);
      result.poemTextLines = textLines.length;
      result.poemTextPreview = textLines.map(l => l.trim().substring(0, 50));

      // Estimate visual wrapped lines: total height / line-height
      const pCS = getComputedStyle(poem);
      const poemLH = parseFloat(pCS.lineHeight);
      const poemH = poem.getBoundingClientRect().height;
      result.poemVisualLines = Math.round(poemH / poemLH);
      result.poemLineHeightPx = Math.round(poemLH);
    }

    // Warm Wishes measurements
    if (warmWishes) {
      const wwRect = warmWishes.getBoundingClientRect();
      result.warmWishes = {
        topY: Math.round(wwRect.top),
        bottomY: Math.round(wwRect.bottom),
      };
    }

    // Poem-to-WarmWishes overlap check
    if (poem && warmWishes) {
      const pBottom = poem.getBoundingClientRect().bottom;
      const wwTop = warmWishes.getBoundingClientRect().top;
      result.poemWarmWishesGap = Math.round(wwTop - pBottom);
      result.poemIntrudesIntoWW = pBottom > wwTop + 2;
    }

    // Page right measurements
    if (pageRight) {
      const prRect = pageRight.getBoundingClientRect();
      result.pageRight = {
        topY: Math.round(prRect.top),
        bottomY: Math.round(prRect.bottom),
        height: Math.round(prRect.height),
      };
    }

    // Poem top relative to page-right top + free space
    if (poem && pageRight) {
      const pTop = poem.getBoundingClientRect().top;
      const prTop = pageRight.getBoundingClientRect().top;
      result.poemRelativeTopToPageRight = Math.round(pTop - prTop);
      result.freeSpaceAbovePoem = Math.round(pTop - prTop);
    }

    // Message measurements
    if (message) {
      result.message = {
        scrollHeight: message.scrollHeight,
        clientHeight: message.clientHeight,
        clipped: message.scrollHeight > message.clientHeight + 2,
        fontSize: getComputedStyle(message).fontSize,
        lineHeight: getComputedStyle(message).lineHeight,
      };
    }

    // Message-Signature collision
    if (message && signature) {
      const mBottom = message.getBoundingClientRect().bottom;
      const sTop = signature.getBoundingClientRect().top;
      result.msgSigGap = Math.round(sTop - mBottom);
      result.msgSigCollision = mBottom > sTop + 2;
    }

    return result;
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const allData = [];

  for (let roundIdx = 0; roundIdx < ALL_ROUNDS.length; roundIdx++) {
    const round = ALL_ROUNDS[roundIdx];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ROUND ${roundIdx + 1}`);
    console.log('='.repeat(60));

    for (const job of round) {
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
        const page = await context.newPage();

        await page.route(`${API_BASE}/api/public/greetings/${job.id}`, async (route) => {
          READONLY.assertMethod(route.request().method()); // GET/HEAD only — fail-closed
          const response = await route.fetch();
          const json = await response.json();
          if (json?.greeting) json.greeting.status = 'done';
          await route.fulfill({ json });
        });

        try {
          await page.goto(`${BASE_URL}/#/g/${job.id}`, { waitUntil: 'networkidle', timeout: 15000 });
          await page.waitForSelector('.gc-container', { timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(1000);

          // Navigate to interior spread
          for (let adv = 0; adv < 2; adv++) {
            const spread = await page.$('.gc-interior-spread');
            if (spread) break;
            await page.evaluate(() => {
              const seal = document.querySelector('.gc-wax-seal');
              if (seal) { seal.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
              const cover = document.querySelector('.gc-cover');
              if (cover) { cover.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
            });
            await page.waitForTimeout(1500);
          }

          await page.waitForSelector('.gc-interior-spread', { timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(500);

          const metrics = await captureDetailed(page);
          allData.push({ round: roundIdx + 1, job: job.label, viewport: vp.name, metrics });
        } catch (err) {
          allData.push({ round: roundIdx + 1, job: job.label, viewport: vp.name, error: err.message });
        }

        await context.close();
      }
    }
  }

  await browser.close();

  // === PRINT DETAILED REPORT ===
  console.log('\n' + '='.repeat(70));
  console.log('DETAILED MEASUREMENT REPORT — 4 ROUNDS x 5 JOBS x 4 VIEWPORTS');
  console.log('='.repeat(70));

  // Group by viewport
  for (const vp of VIEWPORTS) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`VIEWPORT: ${vp.name}`);
    console.log('─'.repeat(70));

    const vpEntries = allData.filter(d => d.viewport === vp.name);
    let issueCount = 0;

    for (const entry of vpEntries) {
      if (entry.error) {
        console.log(`  ${entry.job}: ERROR — ${entry.error}`);
        issueCount++;
        continue;
      }
      const m = entry.metrics;

      const issues = [];
      if (m.poem?.clipped) issues.push('POEM_CLIPPED');
      if (m.message?.clipped) issues.push('MSG_CLIPPED');
      if (m.poemIntrudesIntoWW) issues.push('POEM→WW_OVERLAP');
      if (m.msgSigCollision) issues.push('MSG→SIG_COLLISION');

      const status = issues.length > 0 ? `ISSUES: ${issues.join(', ')}` : 'OK';
      if (issues.length > 0) issueCount++;

      console.log(`  ${entry.job}: ${status}`);

      if (vp.name.includes('portrait')) {
        // Portrait detailed
        console.log(`    poem: scrollH=${m.poem?.scrollHeight} clientH=${m.poem?.clientHeight} clipped=${m.poem?.clipped} fontSize=${m.poem?.fontSize} lh=${m.poem?.lineHeight}`);
        console.log(`    poem bottomY=${m.poem?.bottomY}  warmWishes topY=${m.warmWishes?.topY}  gap=${m.poemWarmWishesGap}px  intrudes=${m.poemIntrudesIntoWW}`);
        console.log(`    poemTextLines=${m.poemTextLines} poemVisualLines=${m.poemVisualLines} lhPx=${m.poemLineHeightPx}`);
        if (m.poemTextPreview) {
          for (let i = 0; i < m.poemTextPreview.length; i++) {
            console.log(`      L${i}: "${m.poemTextPreview[i]}"`);
          }
        }
        console.log(`    message: scrollH=${m.message?.scrollHeight} clientH=${m.message?.clientHeight} clipped=${m.message?.clipped} fontSize=${m.message?.fontSize} lh=${m.message?.lineHeight}`);
        console.log(`    msgSigGap=${m.msgSigGap}px collision=${m.msgSigCollision}`);
      } else if (vp.name.includes('landscape')) {
        // Landscape detailed
        console.log(`    poem topY=${m.poem?.topY} pageRight topY=${m.pageRight?.topY} relativeTop=${m.poemRelativeTopToPageRight}px freeSpaceAbove=${m.freeSpaceAbovePoem}px`);
        console.log(`    poem: scrollH=${m.poem?.scrollHeight} clientH=${m.poem?.clientHeight} clipped=${m.poem?.clipped} fontSize=${m.poem?.fontSize}`);
        console.log(`    poemTextLines=${m.poemTextLines} poemVisualLines=${m.poemVisualLines} lhPx=${m.poemLineHeightPx}`);
        if (m.poemTextPreview) {
          for (let i = 0; i < m.poemTextPreview.length; i++) {
            console.log(`      L${i}: "${m.poemTextPreview[i]}"`);
          }
        }
      } else {
        // Desktop
        console.log(`    poem: scrollH=${m.poem?.scrollHeight} clientH=${m.poem?.clientHeight} clipped=${m.poem?.clipped} fontSize=${m.poem?.fontSize}`);
        console.log(`    message: scrollH=${m.message?.scrollHeight} clientH=${m.message?.clientHeight} clipped=${m.message?.clipped} fontSize=${m.message?.fontSize}`);
        console.log(`    poemTextLines=${m.poemTextLines} poemVisualLines=${m.poemVisualLines}`);
        if (m.poemTextPreview) {
          for (let i = 0; i < m.poemTextPreview.length; i++) {
            console.log(`      L${i}: "${m.poemTextPreview[i]}"`);
          }
        }
      }
    }

    console.log(`\n  VIEWPORT SUMMARY: ${issueCount}/${vpEntries.length} entries with issues`);
  }

  // Grand summary
  const totalIssues = allData.filter(d => {
    if (d.error) return true;
    const m = d.metrics;
    return m.poem?.clipped || m.message?.clipped || m.poemIntrudesIntoWW || m.msgSigCollision;
  }).length;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`GRAND TOTAL: ${totalIssues}/${allData.length} entries with issues (${allData.length - totalIssues} clean)`);
  console.log('='.repeat(70));
}

main().catch(console.error);
