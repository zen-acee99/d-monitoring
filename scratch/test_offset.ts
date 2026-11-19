import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import puppeteer from 'puppeteer-core';
import path from 'path';
import { findPersonnelSignatureCoordinates } from '../src/utils/dtrVectorPdf';
import { signPdfBuffer } from '../server/services/pnpkiSigningService';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const bytes = fs.readFileSync('scratch/masareta_from_db.pdf');
  const doc = await PDFDocument.load(bytes);
  
  const coords = await findPersonnelSignatureCoordinates(doc, "ANNABEL C. ODOÑO-CALIMPONG");
  console.log('Original detected coords:', coords);

  // Test offset = +6.0
  const p12Buffer = fs.readFileSync('scratch/rene_jane.p12');
  const boxY = Math.round(coords.boxY - 1.5 + 6.0); // baseline + 6.0 = 358 + 6 = 364
  const boxH = 18;
  const sigRects: [number, number, number, number][] = [[coords.boxX, boxY, coords.boxX + coords.boxW, boxY + boxH]];

  const signedRes = await signPdfBuffer(bytes, p12Buffer.toString('base64'), '1234567890Aa!', {
    signerName: 'Annabel C. Odoño-Calimpong',
    sigRects,
    pageIndex: coords.pageIndex,
    reason: 'Official Digital Signature - DICT Region V',
    customFieldName: 'Signature_Test_Offset6',
  });

  fs.writeFileSync('scratch/masareta_offset6.pdf', signedRes.signedBuffer);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1800, deviceScaleFactor: 2 });
  const pdfPath = path.resolve('scratch/masareta_offset6.pdf');
  await page.goto(`file://${pdfPath}#page=2`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: 'scratch/masareta_offset6.png' });
  await browser.close();
  console.log('Saved scratch/masareta_offset6.png');
}

main().catch(console.error);
