const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  try {
    console.log("Launching browser to generate PDF...");
    const browser = await puppeteer.launch({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const htmlPath = path.join(__dirname, 'seo_guide.html');
    console.log(`Opening HTML file: file://${htmlPath}`);
    
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle2' });

    const pdfPath = path.join(__dirname, '../SEO_and_Blogging_Guide.pdf');
    console.log(`Generating PDF at: ${pdfPath}`);
    
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      printBackground: true
    });

    console.log("PDF generation complete successfully.");
    await browser.close();
  } catch (error) {
    console.error("Error generating PDF:", error);
    process.exit(1);
  }
})();
