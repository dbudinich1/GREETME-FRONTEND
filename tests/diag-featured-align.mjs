import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173/#/__debug/greeting-fixture', { waitUntil: 'networkidle' });
  await page.waitForSelector('.gc-wax-seal', { timeout: 10000 });
  await page.evaluate(() => document.querySelector('.gc-wax-seal')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('.gc-cover')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('.gc-interior-spread')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: 'tests/featured-desktop-aligned.png', fullPage: false });

  const data = await page.evaluate(() => {
    const videoFrame = document.querySelector('.gc-video-frame');
    const albumFrame = document.querySelector('.gc-album-frame');
    const albumTitle = document.querySelector('.gc-album-title');
    function r(el) {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) };
    }
    return { videoFrame: r(videoFrame), albumFrame: r(albumFrame), albumTitle: r(albumTitle) };
  });
  console.log('Video frame top:', data.videoFrame?.top, '| Album frame top:', data.albumFrame?.top);
  console.log('Gap:', (data.albumFrame?.top || 0) - (data.videoFrame?.top || 0), 'px');
  console.log('Album title:', data.albumTitle?.top, 'to', data.albumTitle?.bottom);
  await page.close();
  await browser.close();
})();
