const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  console.log("Launching browser in desktop mode...");
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set viewport to standard desktop resolution
  await page.setViewport({
    width: 1440,
    height: 900
  });

  // Accept dialogs (fallback cutout popup)
  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  console.log("Navigating to http://localhost:8080/ ...");
  await page.goto('http://localhost:8080/', { waitUntil: 'load' });

  // Capture screenshot of desktop home landing page with left/right side ads
  const homeScreenshotPath = path.join(__dirname, 'desktop_home_ads.png');
  await page.screenshot({ path: homeScreenshotPath });
  console.log(`Saved screenshot to ${homeScreenshotPath}`);

  console.log("Clicking first sample item to enter editor workspace...");
  await page.click('.sample-item');
  await new Promise(r => setTimeout(r, 4000));

  // Capture screenshot of desktop editor workspace with the left sidebar ad
  const screenshotPath = path.join(__dirname, 'desktop_editor_ads.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`Saved screenshot to ${screenshotPath}`);

  await browser.close();
  console.log("Browser closed.");
})();
