import { chromium } from 'playwright';

const LONG_FINALE = `I hope this message brings a smile to your face and warmth to your heart. These moments of celebration remind us how precious our connections truly are.

May your journey ahead be filled with endless possibilities, beautiful surprises, and the kind of deep joy that comes from knowing you are loved beyond measure.

With heartfelt appreciation, Megan.`;

const viewports = [
  { name: '844x390 (landscape)', width: 844, height: 390 },
  { name: '390x844 (portrait)', width: 390, height: 844 },
  { name: '1280x720 (desktop)', width: 1280, height: 720 },
];

async function navigateToFinale(page) {
  await page.waitForSelector('.gc-wax-seal', { timeout: 10000 });
  await page.evaluate(() => document.querySelector('.gc-wax-seal')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('.gc-cover')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('.gc-interior-spread')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('.gc-featured-spread')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(1500);
}

(async () => {
  const browser = await chromium.launch();

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('http://localhost:5173/#/__debug/greeting-fixture', { waitUntil: 'networkidle' });
    await navigateToFinale(page);

    // Inject long text
    await page.evaluate((text) => {
      const msg = document.querySelector('.gc-closing-message');
      if (!msg) return;
      msg.innerHTML = text.split('\n\n').map(p => `<p>${p}</p>`).join('');
    }, LONG_FINALE);

    // Wait, then trigger resize to force auto-fit
    await page.waitForTimeout(300);
    await page.setViewportSize({ width: vp.width + 1, height: vp.height });
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);

    const data = await page.evaluate(() => {
      const msg = document.querySelector('.gc-closing-message');
      if (!msg) return { error: 'not found' };
      const cs = getComputedStyle(msg);
      const pTags = msg.querySelectorAll('p');
      return {
        scrollH: msg.scrollHeight,
        clientH: msg.clientHeight,
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        fitFontVar: msg.style.getPropertyValue('--fit-finale-font-size'),
        fitLHVar: msg.style.getPropertyValue('--fit-finale-line-height'),
        clips: msg.scrollHeight > msg.clientHeight,
        pCount: pTags.length,
        textLength: msg.textContent.length,
        pFontSizes: Array.from(pTags).map(p => getComputedStyle(p).fontSize),
      };
    });
    console.log(`\n=== ${vp.name} ===`);
    console.log(`textLen=${data.textLength} pCount=${data.pCount}`);
    console.log(`fontSize=${data.fontSize} lineHeight=${data.lineHeight}`);
    console.log(`scrollH=${data.scrollH} clientH=${data.clientH} clips=${data.clips}`);
    console.log(`fitFontVar=${data.fitFontVar || '(unset)'} fitLHVar=${data.fitLHVar || '(unset)'}`);
    console.log(`pFontSizes=${JSON.stringify(data.pFontSizes)}`);
    await page.close();
  }

  await browser.close();
})();
