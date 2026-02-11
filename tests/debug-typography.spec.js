import { test, expect } from '@playwright/test';

const URL_GOOD = 'http://localhost:5174/#/g/4da2d5e9-c1c9-485c-97d0-1f3a69f6dc5a';
const URL_BAD  = 'http://localhost:5174/#/g/0610620a-5cca-4ad9-96c7-b2afecec7094';
const URL_MAX  = 'http://localhost:5174/#/__debug/greeting-max';

async function navigateToInterior(page) {
  await page.waitForSelector('.gc-wax-seal', { timeout: 10000 });
  await page.evaluate(() => {
    const seal = document.querySelector('.gc-wax-seal');
    if (seal) seal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1000);
  await page.waitForSelector('.gc-cover', { timeout: 10000 });
  await page.evaluate(() => {
    const cover = document.querySelector('.gc-cover');
    if (cover) cover.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1000);
  await expect(page.locator('.gc-interior-spread')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(500);
}

async function dumpMetrics(page, label) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);

  const data = await page.evaluate(() => {
    const getAll = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        fontSize: cs.fontSize,
        fontFamily: cs.fontFamily,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        color: cs.color,
        boxW: Math.round(rect.width),
        boxH: Math.round(rect.height),
        textContent: el.textContent?.slice(0, 80),
        scrollH: el.scrollHeight,
        clientH: el.clientHeight,
      };
    };

    const pageContent = document.querySelector('.gc-page-left .gc-page-content');
    const pcStyle = pageContent?.getAttribute('style') || '(none)';

    const msgPs = Array.from(document.querySelectorAll('.gc-greeting-message p'));
    const pMetrics = msgPs.map((p, i) => {
      const cs = getComputedStyle(p);
      return { idx: i, fontSize: cs.fontSize, lineHeight: cs.lineHeight };
    });

    return {
      pageContentInlineStyle: pcStyle,
      salutation: getAll('.gc-greeting-salutation'),
      occasion: getAll('.gc-greeting-occasion'),
      message: getAll('.gc-greeting-message'),
      signature: getAll('.gc-signature'),
      messageParagraphs: pMetrics,
    };
  });

  console.log(`\n========== ${label} ==========`);
  console.log(`Inline style: ${data.pageContentInlineStyle}`);
  for (const [name, m] of Object.entries(data)) {
    if (name === 'pageContentInlineStyle' || name === 'messageParagraphs') continue;
    if (!m) { console.log(`${name}: NOT FOUND`); continue; }
    console.log(`${name}: fontSize=${m.fontSize} lh=${m.lineHeight} box=${m.boxW}x${m.boxH} scrollH=${m.scrollH} clientH=${m.clientH}`);
    console.log(`  "${m.textContent?.slice(0, 60)}"`);
  }
  if (data.messageParagraphs?.length) {
    for (const p of data.messageParagraphs) {
      console.log(`  p[${p.idx}]: fontSize=${p.fontSize} lh=${p.lineHeight}`);
    }
  }
  console.log(`${'='.repeat(40)}\n`);
  return data;
}

test('portrait 390x844: compare SHORT vs LONG vs MAX edge case', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  // SHORT content (Amy)
  await page.goto(URL_GOOD, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await navigateToInterior(page);
  const short = await dumpMetrics(page, 'SHORT (Amy)');
  await page.screenshot({ path: 'tests/screenshot-short-390x844.png' });

  // LONG content (Alexander)
  await page.goto(URL_BAD, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await navigateToInterior(page);
  const long = await dumpMetrics(page, 'LONG (Alexander)');
  await page.screenshot({ path: 'tests/screenshot-long-390x844.png' });

  // MAX edge case (fixture)
  await page.goto(URL_MAX, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await navigateToInterior(page);
  const max = await dumpMetrics(page, 'MAX EDGE CASE (fixture)');
  await page.screenshot({ path: 'tests/screenshot-max-390x844.png' });

  // Summary comparison
  console.log('\n========== SIZE COMPARISON ==========');
  console.log(`SHORT:  salutation=${short.salutation?.fontSize}  message=${short.message?.fontSize}  signature=${short.signature?.fontSize}`);
  console.log(`LONG:   salutation=${long.salutation?.fontSize}  message=${long.message?.fontSize}  signature=${long.signature?.fontSize}`);
  console.log(`MAX:    salutation=${max.salutation?.fontSize}  message=${max.message?.fontSize}  signature=${max.signature?.fontSize}`);
  console.log('=====================================\n');

  expect(true).toBe(true);
});
