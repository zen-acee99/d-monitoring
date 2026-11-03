import puppeteer from 'puppeteer-core';
import path from 'path';

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1800, deviceScaleFactor: 2 });

  const pdfPath = path.resolve('public', 'DTR_Ace_M._Malto_September_2026.pdf');
  const fileUrl = 'file:///' + pdfPath.replace(/\\/g, '/');

  console.log('Navigating to:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: 'scratch/final_pdf_preview.png', fullPage: false });
  console.log('Screenshot saved to scratch/final_pdf_preview.png');

  await browser.close();
}

capture().catch(console.error);
