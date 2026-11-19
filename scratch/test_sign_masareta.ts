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
  
  // Find coordinates for Annabel
  const coords = await findPersonnelSignatureCoordinates(doc, "ANNABEL C. ODOÑO-CALIMPONG");
  console.log('Coordinates for Annabel:', coords);

  // Sign using Rene Jane or test P12
  const p12Buffer = fs.readFileSync('scratch/rene_jane.p12');
  const signedRes = await signPdfBuffer(bytes, p12Buffer.toString('base64'), '1234567890Aa!', {
    signerName: 'Annabel C. Odoño-Calimpong',
    sigRects: coords.sigRects,
    pageIndex: coords.pageIndex,
    reason: 'Official Digital Signature - DICT Region V',
    customFieldName: 'Signature_Test_Annabel_Clean',
  });

  fs.writeFileSync('scratch/masareta_newly_signed.pdf', signedRes.signedBuffer);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
  const pdfPath = path.resolve('scratch/masareta_newly_signed.pdf');
  await page.goto(`file://${pdfPath}#page=2`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: 'scratch/masareta_newly_signed.png' });
  await browser.close();
  console.log('Saved scratch/masareta_newly_signed.png');
}

main().catch(console.error);
