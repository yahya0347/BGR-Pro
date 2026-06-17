const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Auto-dismiss dialogs
  page.on('dialog', async dialog => {
    console.log(`[DIALOG ${dialog.type()}]: ${dialog.message()}`);
    await dialog.accept();
  });

  // Override confirm/alert to auto-accept
  await page.evaluateOnNewDocument(() => {
    window.confirm = () => true;
    window.alert = () => {};
  });

  const allErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') allErrors.push(msg.text());
  });
  page.on('pageerror', err => {
    allErrors.push(`[EXCEPTION]: ${err.toString()}`);
  });

  console.log("Loading page...");
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  console.log("Clicking sample item...");
  await page.click('.sample-item');
  await new Promise(r => setTimeout(r, 3000));

  // Check workspace state
  const state1 = await page.evaluate(() => {
    const ws = document.getElementById('editorWorkspace');
    const landing = document.getElementById('uploadLanding');
    return {
      workspaceActive: ws?.classList.contains('active'),
      landingDisplay: landing?.style.display,
      landingClasses: landing?.className
    };
  });
  console.log("After sample click:", JSON.stringify(state1));

  // Try each tab
  for (const tab of ['bg-remover', 'wm-remover', 'wm-maker']) {
    await page.evaluate(t => {
      const btn = document.querySelector(`button[data-tab="${t}"]`);
      if (btn) btn.click();
    }, tab);
    await new Promise(r => setTimeout(r, 1000));
    
    const tabState = await page.evaluate(t => {
      const view = document.querySelector(`[data-view="${t}"]`) || document.getElementById(t);
      return {
        viewFound: !!view,
        viewActive: view?.classList.contains('active'),
        viewDisplay: view?.style.display
      };
    }, tab);
    console.log(`Tab "${tab}":`, JSON.stringify(tabState));
  }

  // Test sidebar buttons
  console.log("\n=== Checking sidebar buttons ===");
  const sidebarButtons = await page.evaluate(() => {
    const btns = document.querySelectorAll('.sidebar-left button, .sidebar-left .action-btn');
    return Array.from(btns).map(b => ({
      id: b.id,
      text: b.textContent.trim().substring(0, 40),
      disabled: b.disabled,
      onclick: !!b.onclick
    }));
  });
  console.log("Sidebar buttons:", JSON.stringify(sidebarButtons, null, 2));

  // Check download button
  console.log("\n=== Checking download/export ===");
  const downloadState = await page.evaluate(() => {
    const btn = document.getElementById('btnDownloadImage');
    const fmt = document.getElementById('exportFormat');
    return {
      btnExists: !!btn,
      btnDisabled: btn?.disabled,
      fmtExists: !!fmt,
      fmtOptions: fmt ? Array.from(fmt.options).map(o => o.value) : []
    };
  });
  console.log("Download state:", JSON.stringify(downloadState));

  // Print all errors
  console.log("\n=== ALL ERRORS ===");
  allErrors.forEach((e, i) => console.log(`ERROR ${i+1}: ${e}`));

  // Take screenshot
  await page.screenshot({ path: 'scratch/diagnostic_screenshot.png' });
  console.log("Screenshot saved.");

  await browser.close();
})();
