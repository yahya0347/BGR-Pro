const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://localhost:8123/pdf/merge.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await new Promise(r => setTimeout(r, 1200));

  // Full-canvas purple scan for #630ed4 (99,14,212), sampled right after moves.
  const scanPurple = () => page.evaluate(() => {
    const c = document.getElementById('interactive-grid');
    const ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, c.width, c.height).data;
    let purple = 0, moved = 0;
    for (let i = 0; i < img.length; i += 4) {
      if (img[i+3] > 0) {
        moved++;
        if (img[i] > 70 && img[i] < 130 && img[i+1] < 60 && img[i+2] > 170) purple++;
      }
    }
    return { purple, litDots: moved };
  });

  let maxPurple = 0;
  // Sweep the cursor across the viewport; scan immediately after each hop.
  for (const [x, y] of [[300,300],[500,350],[700,400],[900,450],[640,500],[400,600]]) {
    await page.mouse.move(x, y);
    await new Promise(r => setTimeout(r, 30));
    const s = await scanPurple();
    maxPurple = Math.max(maxPurple, s.purple);
  }

  // Also prove dots physically move (repel): capture a dot-position hash twice while moving.
  const posA = await page.evaluate(() => {
    const c = document.getElementById('interactive-grid');
    return c.getContext('2d').getImageData(0,0,200,200).data.reduce((a,b)=>a+b,0);
  });
  await page.mouse.move(100, 100);
  await new Promise(r => setTimeout(r, 60));
  const posB = await page.evaluate(() => {
    const c = document.getElementById('interactive-grid');
    return c.getContext('2d').getImageData(0,0,200,200).data.reduce((a,b)=>a+b,0);
  });

  console.log(JSON.stringify({
    maxPurpleDuringMotion: maxPurple,
    animationReactsToMouse: maxPurple > 0,
    frameChangedWhileMoving: posA !== posB
  }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
