const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} });
  await new Promise(r => setTimeout(r, 3500));

  // Move mouse into an open background area (left of hero) so the dot cluster
  // is clearly visible, and let the continuous rAF loop render a few frames.
  const target = { x: 320, y: 640 };
  await page.mouse.move(target.x - 40, target.y - 40);
  await page.mouse.move(target.x, target.y);
  await new Promise(r => setTimeout(r, 500));

  // Full viewport shot
  await page.screenshot({ path: 'scratch/hover_full.png' });

  // Tight crop around the cursor to show radius growth + purple lerp
  await page.screenshot({
    path: 'scratch/hover_crop.png',
    clip: { x: target.x - 170, y: target.y - 170, width: 340, height: 340 }
  });

  // Sanity: read a few pixels near the cursor to confirm purple-ish dots exist
  const sample = await page.evaluate((t) => {
    const c = document.getElementById('homeHubCanvas');
    const ctx = c.getContext('2d');
    // canvas backing store == innerWidth x innerHeight (no DPR), so client coords map 1:1
    const img = ctx.getImageData(t.x - 60, t.y - 60, 120, 120).data;
    let maxPurple = 0, litPixels = 0;
    for (let i = 0; i < img.length; i += 4) {
      const r = img[i], g = img[i + 1], b = img[i + 2], a = img[i + 3];
      if (a > 0) {
        litPixels++;
        // purple-ness: high-ish R+B, low G relative to rest colour (195)
        if (b > 200 && g < 160) maxPurple = Math.max(maxPurple, b - g);
      }
    }
    return { litPixels, maxPurple };
  }, target);

  console.log(JSON.stringify(sample));
  console.log('screenshots written');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
