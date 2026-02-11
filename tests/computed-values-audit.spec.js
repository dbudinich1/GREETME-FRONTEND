/**
 * Computed Values Audit
 * Captures actual rendered CSS values for all 5 fixtures × 4 viewports
 */
import { test, expect } from '@playwright/test';

const FIXTURES = [
  { name: 'Normal',        path: '/#/__debug/greeting-fixture' },
  { name: 'Minimal',       path: '/#/__debug/greeting-min' },
  { name: 'MultiPara',     path: '/#/__debug/greeting-multi' },
  { name: 'MaxEdge1',      path: '/#/__debug/greeting-max' },
  { name: 'MaxOverflow2',  path: '/#/__debug/greeting-max-overflow' },
];

// Click through envelope → cover → interior spread (screen 3)
async function navigateToInterior(page) {
  await page.waitForSelector('.gc-envelope-wrapper, .gc-cover-wrapper, .gc-spread-wrapper', { timeout: 8000 });

  for (let attempt = 0; attempt < 8; attempt++) {
    const interior = await page.$('.gc-interior-spread');
    if (interior) return true;

    // Try wax seal first (envelope back face — force click through backface-visibility)
    const seal = await page.$('.gc-wax-seal');
    if (seal) {
      await seal.click({ force: true });
      await page.waitForTimeout(800);
      continue;
    }

    // Try cover
    const cover = await page.$('.gc-cover-wrapper');
    if (cover) {
      await cover.click();
      await page.waitForTimeout(800);
      continue;
    }

    // Fallback: arrow key right
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(800);
  }
  return !!(await page.$('.gc-interior-spread'));
}

async function getComputedValues(page) {
  return page.evaluate(() => {
    const cs = (el) => el ? getComputedStyle(el) : null;
    const px = (v) => v ? parseFloat(v).toFixed(1) : 'N/A';
    const ratio = (lh, fs) => lh && fs ? (parseFloat(lh) / parseFloat(fs)).toFixed(3) : 'N/A';

    const salutation = document.querySelector('.gc-greeting-salutation');
    const occasion = document.querySelector('.gc-greeting-occasion');
    const message = document.querySelector('.gc-greeting-message');
    const signature = document.querySelector('.gc-signature');
    const poem = document.querySelector('.gc-poem');
    const warmWishes = document.querySelector('.gc-warm-wishes');
    const pageContent = document.querySelector('.gc-interior-spread .gc-page-left .gc-page-content');
    const poemContent = document.querySelector('.gc-poem-content');
    const spread = document.querySelector('.gc-interior-spread');

    const salCS = cs(salutation);
    const occCS = cs(occasion);
    const msgCS = cs(message);
    const sigCS = cs(signature);
    const poemCS = cs(poem);
    const wwCS = cs(warmWishes);
    const pcCS = cs(pageContent);
    const spreadCS = cs(spread);

    // Check for fit variable overrides
    const pcEl = pageContent;
    const fitFontSize = pcEl ? pcEl.style.getPropertyValue('--fit-message-font-size') : '';
    const fitLineHeight = pcEl ? pcEl.style.getPropertyValue('--fit-message-line-height') : '';
    const fitPoemSize = poem ? poem.style.getPropertyValue('--fit-poem-font-size') : '';

    // Check clipping
    const msgClipped = message ? message.scrollHeight > message.clientHeight + 2 : false;
    const poemClipped = poem ? poem.scrollHeight > poem.clientHeight + 2 : false;

    // Overlap check
    const msgRect = message ? message.getBoundingClientRect() : null;
    const sigRect = signature ? signature.getBoundingClientRect() : null;
    const overlap = (msgRect && sigRect) ? Math.max(0, msgRect.bottom - sigRect.top) : 0;

    return {
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      spread: {
        width: spread ? px(spreadCS.width) : 'N/A',
        height: spread ? px(spreadCS.height) : 'N/A',
      },
      salutation: {
        fontSize: salCS ? px(salCS.fontSize) : 'N/A',
        lineHeight: salCS ? px(salCS.lineHeight) : 'N/A',
        lhRatio: salCS ? ratio(salCS.lineHeight, salCS.fontSize) : 'N/A',
      },
      occasion: {
        fontSize: occCS ? px(occCS.fontSize) : 'N/A',
        lineHeight: occCS ? px(occCS.lineHeight) : 'N/A',
        lhRatio: occCS ? ratio(occCS.lineHeight, occCS.fontSize) : 'N/A',
      },
      message: {
        fontSize: msgCS ? px(msgCS.fontSize) : 'N/A',
        lineHeight: msgCS ? px(msgCS.lineHeight) : 'N/A',
        lhRatio: msgCS ? ratio(msgCS.lineHeight, msgCS.fontSize) : 'N/A',
        clipped: msgClipped,
      },
      signature: {
        fontSize: sigCS ? px(sigCS.fontSize) : 'N/A',
        lineHeight: sigCS ? px(sigCS.lineHeight) : 'N/A',
      },
      poem: {
        fontSize: poemCS ? px(poemCS.fontSize) : 'N/A',
        lineHeight: poemCS ? px(poemCS.lineHeight) : 'N/A',
        lhRatio: poemCS ? ratio(poemCS.lineHeight, poemCS.fontSize) : 'N/A',
        clipped: poemClipped,
      },
      warmWishes: {
        fontSize: wwCS ? px(wwCS.fontSize) : 'N/A',
      },
      fitOverrides: {
        messageFontSize: fitFontSize || 'none',
        messageLineHeight: fitLineHeight || 'none',
        poemFontSize: fitPoemSize || 'none',
      },
      overlap: overlap > 0 ? `${overlap.toFixed(0)}px OVERLAP` : 'clear',
      pageContent: {
        top: pcCS ? px(pcCS.top) : 'N/A',
        left: pcCS ? px(pcCS.left) : 'N/A',
        right: pcCS ? px(pcCS.right) : 'N/A',
        bottom: pcCS ? px(pcCS.bottom) : 'N/A',
      },
    };
  });
}

for (const fixture of FIXTURES) {
  test(`Computed values: ${fixture.name}`, async ({ page }, testInfo) => {
    await page.goto(fixture.path, { waitUntil: 'networkidle' });
    // Wait for fonts
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    const reached = await navigateToInterior(page);
    expect(reached).toBe(true);

    // Wait for auto-fit to run
    await page.waitForTimeout(500);

    const values = await getComputedValues(page);
    const project = testInfo.project.name;

    // Format as readable output
    const output = [
      `\n===== ${fixture.name} @ ${project} (${values.viewport}) =====`,
      `Spread: ${values.spread.width}×${values.spread.height}px`,
      ``,
      `--- LEFT PAGE (Letter) ---`,
      `Page insets: top=${values.pageContent.top} left=${values.pageContent.left} right=${values.pageContent.right} bottom=${values.pageContent.bottom}`,
      `Salutation:  ${values.salutation.fontSize}px  LH=${values.salutation.lineHeight}px (${values.salutation.lhRatio})`,
      `Occasion:    ${values.occasion.fontSize}px  LH=${values.occasion.lineHeight}px (${values.occasion.lhRatio})`,
      `Message:     ${values.message.fontSize}px  LH=${values.message.lineHeight}px (${values.message.lhRatio})  clipped=${values.message.clipped}`,
      `Signature:   ${values.signature.fontSize}px  LH=${values.signature.lineHeight}px`,
      `Overlap:     ${values.overlap}`,
      ``,
      `--- RIGHT PAGE (Poem) ---`,
      `Poem:        ${values.poem.fontSize}px  LH=${values.poem.lineHeight}px (${values.poem.lhRatio})  clipped=${values.poem.clipped}`,
      `Warm Wishes: ${values.warmWishes.fontSize}px`,
      ``,
      `--- AUTO-FIT OVERRIDES ---`,
      `--fit-message-font-size:   ${values.fitOverrides.messageFontSize}`,
      `--fit-message-line-height: ${values.fitOverrides.messageLineHeight}`,
      `--fit-poem-font-size:      ${values.fitOverrides.poemFontSize}`,
    ].join('\n');

    console.log(output);

    // Basic sanity: no clipping, no overlap
    if (values.message.clipped) {
      console.warn(`  ⚠ MESSAGE CLIPPED at ${fixture.name} @ ${project}`);
    }
    if (values.poem.clipped) {
      console.warn(`  ⚠ POEM CLIPPED at ${fixture.name} @ ${project}`);
    }
    if (values.overlap !== 'clear') {
      console.warn(`  ⚠ ${values.overlap} at ${fixture.name} @ ${project}`);
    }
  });
}
