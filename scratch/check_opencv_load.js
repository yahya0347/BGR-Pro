const puppeteer = require('puppeteer-core');

(async () => {
  try {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Log all console events
    page.on('console', msg => {
      console.log(`[PAGE CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    // Log page errors
    page.on('pageerror', err => {
      console.error(`[PAGE EXCEPTION]: ${err.toString()}`);
    });

    // Log request failures
    page.on('requestfailed', request => {
      console.error(`[REQUEST FAILED]: ${request.url()} - ${request.failure() ? request.failure().errorText : 'unknown'}`);
    });

    // Log response status
    page.on('response', response => {
      if (response.status() >= 400) {
        console.error(`[HTTP ERROR ${response.status()}]: ${response.url()}`);
      }
    });

    console.log("Navigating to http://localhost:8080...");
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle2' });

    console.log("Waiting 5 seconds...");
    await new Promise(r => setTimeout(r, 5000));

    console.log("Checking cv status inside page...");
    const cvStatus = await page.evaluate(() => {
      return {
        hasCv: typeof cv !== 'undefined',
        cvReady: window.cvReady,
        onOpenCvReadyExists: typeof window.onOpenCvReady === 'function',
        cvProperties: typeof cv !== 'undefined' ? Object.keys(cv).slice(0, 10) : []
      };
    });
    console.log("CV status:", cvStatus);

    await browser.close();
  } catch (err) {
    console.error("Debug script failed:", err);
  }
})();
