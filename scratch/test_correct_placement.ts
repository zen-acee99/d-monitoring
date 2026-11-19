import fs from 'fs';
import { PDFDocument, rgb } from 'pdf-lib';
import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const bytes = fs.readFileSync('scratch/masareta_from_db.pdf');
  const doc = await PDFDocument.load(bytes);
  const p = doc.getPages()[1];

  // Draw rectangle around ANNABEL text [x=207.51, y=358.42, w=200, h=14]
  p.drawRectangle({
    x: 207,
    y: 358,
    width: 220,
    height: 14,
    borderColor: rgb(0, 0, 1),
    borderWidth: 1,
  });

  // Draw signature box strictly ABOVE ANNABEL:
  // Annabel text baseline is 358.42, cap height is ~10pt (ascends to 368.42).
  // boxY = 362 (starts at 362 or 360 to 380)
  // Let's test boxY = 361, boxH = 18 (extends to 379)
  const boxW = 142;
  const boxH = 18;
  const boxX = Math.round(207 + (220 - boxW) / 2); // centered over name
  const boxY = Math.round(358.42 + 9.5); // 368

  p.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    borderColor: rgb(1, 0, 0),
    borderWidth: 2,
  });

  const modifiedBytes = await doc.save();
  fs.writeFileSync('scratch/test_correct_placement.pdf', modifiedBytes);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1800, deviceScaleFactor: 1 });
  const pdfPath = path.resolve('scratch/test_correct_placement.pdf');
  await page.goto(`file://${pdfPath}#page=2`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({
    path: 'scratch/zoom_correct_placement.png',
    clip: {
      x: 350,
      y: 900,
      width: 700,
      height: 500
    }
  });
  await browser.close();
  console.log('Saved scratch/zoom_correct_placement.png');
}

main().catch(console.error);
