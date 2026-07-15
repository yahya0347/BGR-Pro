const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('file:///Users/macbookairm1/Desktop/PROJETS%20/bg-eraser-pro/editor.html');
  
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
