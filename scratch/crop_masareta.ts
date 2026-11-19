import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
  const pdfPath = path.resolve('scratch/masareta_from_db.pdf');
  await page.goto(`file://${pdfPath}#page=2`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  
  await page.screenshot({
    path: 'scratch/masareta_crop2.png',
    clip: {
      x: 450,
      y: 600,
      width: 400,
      height: 200
    }
  });
  await browser.close();
  console.log('Saved scratch/masareta_crop2.png');
}

main().catch(console.error);
