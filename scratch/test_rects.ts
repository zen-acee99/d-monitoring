import fs from 'fs';
import { PDFDocument, rgb } from 'pdf-lib';
import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const bytes = fs.readFileSync('scratch/masareta_from_db.pdf');
  const doc = await PDFDocument.load(bytes);
  const p = doc.getPages()[1];

  // Draw rectangle at [263, 337, 400, 355] (the existing signature rect)
  p.drawRectangle({
    x: 263,
    y: 337,
    width: 137,
    height: 18,
    borderColor: rgb(1, 0, 0),
    borderWidth: 2,
  });

  // Draw rectangle at [263, 327.84, 400, 337.84] (around ANNABEL text)
  p.drawRectangle({
    x: 252,
    y: 327,
    width: 200,
    height: 12,
    borderColor: rgb(0, 0, 1),
    borderWidth: 1,
  });

  // Draw rectangle around OIC-Regional Director [306, 307, width, 12]
  p.drawRectangle({
    x: 306,
    y: 307,
    width: 150,
    height: 12,
    borderColor: rgb(0, 1, 0),
    borderWidth: 1,
  });

  const modifiedBytes = await doc.save();
  fs.writeFileSync('scratch/test_rects.pdf', modifiedBytes);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
  const pdfPath = path.resolve('scratch/test_rects.pdf');
  await page.goto(`file://${pdfPath}#page=2`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'scratch/test_rects.png' });
  await browser.close();
  console.log('Saved scratch/test_rects.png');
}

main().catch(console.error);
