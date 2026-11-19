import puppeteer from 'puppeteer-core';
import path from 'path';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600 });
  
  // Use file:// URL with PDF
  const pdfPath = path.resolve('scratch/cert_test.pdf').replace(/\\/g, '/');
  await page.goto(`file:///${pdfPath}`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'scratch/cert_rendered.png' });
  console.log('Saved scratch/cert_rendered.png');
  await browser.close();
}
main().catch(console.error);
