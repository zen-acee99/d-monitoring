import fs from 'fs';
import { safeLoadPdfDocument, signUploadedPersonnelPdfBytes } from '../src/utils/dtrVectorPdf';
import puppeteer from 'puppeteer-core';
import path from 'path';

async function main() {
  const originalBytes = fs.readFileSync('scratch/cert_test.pdf');
  console.log('Original size:', originalBytes.length);

  // Sign 1: Annabel C. Odoño-Calimpong
  console.log('--- Step 1: Signing as Annabel C. Odoño-Calimpong ---');
  const res1 = await signUploadedPersonnelPdfBytes(
    originalBytes,
    'DIR. ANNABEL C. ODOÑO-CALIMPONG',
    null,
    null,
    {
      signerName: 'Annabel C. Odoño-Calimpong',
      targetSignatoryName: 'DIR. ANNABEL C. ODOÑO-CALIMPONG',
    }
  );
  console.log('Step 1 coords:', res1.signatureCoordinates);
  fs.writeFileSync('scratch/cert_step1.pdf', res1.bytes);

  // Sign 2: Ace Malto counter-signing or second signatory
  console.log('--- Step 2: Signing as Ace Malto ---');
  const res2 = await signUploadedPersonnelPdfBytes(
    res1.bytes,
    'ACE MALTO',
    null,
    null,
    {
      signerName: 'Ace Malto',
      targetSignatoryName: 'DIR. ANNABEL C. ODOÑO-CALIMPONG',
      isCounterSign: true,
      counterSignIndex: 0,
      counterSignPosition: 'auto',
    }
  );
  console.log('Step 2 coords:', res2.signatureCoordinates);
  fs.writeFileSync('scratch/cert_step2.pdf', res2.bytes);

  // Render screenshot
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;
  const browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600 });
  const pdfPath = path.resolve('scratch/cert_step2.pdf').replace(/\\/g, '/');
  await page.goto(`file:///${pdfPath}`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'scratch/cert_step2_view.png' });
  await browser.close();
  console.log('Saved scratch/cert_step2_view.png');
}

main().catch(console.error);
