const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const errors = [];
  const warnings = [];
  const logs = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') errors.push(text);
    else if (type === 'warning') warnings.push(text);
    else logs.push(text);
  });

  page.on('pageerror', err => {
    errors.push(`[PAGE EXCEPTION]: ${err.toString()}`);
  });

  page.on('requestfailed', req => {
    errors.push(`[REQUEST FAILED]: ${req.url()} - ${req.failure()?.errorText || 'unknown'}`);
  });

  console.log("=== Loading page ===");
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  console.log("\n=== CONSOLE ERRORS ===");
  errors.forEach((e, i) => console.log(`ERROR ${i+1}: ${e}`));
  
  console.log("\n=== CONSOLE WARNINGS ===");
  warnings.forEach((w, i) => console.log(`WARN ${i+1}: ${w}`));

  // Check if app.js loaded and key functions exist
  console.log("\n=== Checking JS state ===");
  const jsState = await page.evaluate(() => {
    return {
      // Check if key elements exist
      uploadLanding: !!document.getElementById('uploadLanding'),
      editorWorkspace: !!document.getElementById('editorWorkspace'),
      bgRemoverTab: !!document.querySelector('button[data-tab="bg-remover"]'),
      wmRemoverTab: !!document.querySelector('button[data-tab="wm-remover"]'),
      wmMakerTab: !!document.querySelector('button[data-tab="wm-maker"]'),
      pdfToolsTab: !!document.querySelector('button[data-tab="pdf-tools"]'),
      btnEraseWatermark: !!document.getElementById('btnEraseWatermark'),
      btnDownloadImage: !!document.getElementById('btnDownloadImage'),
      exportFormat: !!document.getElementById('exportFormat'),
      sampleItems: document.querySelectorAll('.sample-item').length,
      // Check for dead listeners by trying clicks
      cvReady: window.cvReady,
      hasCv: typeof cv !== 'undefined',
    };
  });
  console.log("JS State:", JSON.stringify(jsState, null, 2));

  // Try clicking a sample to see if it responds
  console.log("\n=== Clicking sample item ===");
  const hasSample = await page.$('.sample-item');
  if (hasSample) {
    await page.click('.sample-item');
    await new Promise(r => setTimeout(r, 2000));
    
    const afterClick = await page.evaluate(() => {
      const landing = document.getElementById('uploadLanding');
      const workspace = document.getElementById('editorWorkspace');
      return {
        landingHidden: landing?.classList.contains('hidden') || landing?.style.display === 'none',
        landingClasses: landing?.className,
        workspaceClasses: workspace?.className,
        workspaceVisible: workspace?.classList.contains('active'),
      };
    });
    console.log("After sample click:", JSON.stringify(afterClick, null, 2));
  }

  // Check new console errors after interaction
  console.log("\n=== Errors after interaction ===");
  const newErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') newErrors.push(msg.text());
  });
  
  // Try switching tabs
  console.log("\n=== Trying tab switches ===");
  const tabs = ['bg-remover', 'wm-remover', 'wm-maker', 'pdf-tools'];
  for (const tab of tabs) {
    try {
      await page.evaluate((t) => {
        const btn = document.querySelector(`button[data-tab="${t}"]`);
        if (btn) btn.click();
      }, tab);
      await new Promise(r => setTimeout(r, 500));
      console.log(`Tab "${tab}": clicked OK`);
    } catch (e) {
      console.log(`Tab "${tab}": FAILED - ${e.message}`);
    }
  }

  await new Promise(r => setTimeout(r, 1000));
  console.log("\nNew errors after interactions:", newErrors);

  await browser.close();
  console.log("\n=== Diagnosis complete ===");
})();
