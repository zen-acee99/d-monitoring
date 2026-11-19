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
  // Standard 1x scaling, large window
  await page.setViewport({ width: 1400, height: 1800, deviceScaleFactor: 1 });
  const pdfPath = path.resolve('scratch/test_rects.pdf');
  await page.goto(`file://${pdfPath}#page=2`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  // Let's take screenshot of the entire page content
  // Chrome PDF viewer embeds an <embed> or uses a pdf-viewer web component
  // Let's capture the center 800x800 area
  await page.screenshot({
    path: 'scratch/zoom_rects.png',
    clip: {
      x: 350,
      y: 900,
      width: 700,
      height: 500
    }
  });
  await browser.close();
  console.log('Saved scratch/zoom_rects.png');
}

main().catch(console.error);
