import fs from 'fs';
import { safeLoadPdfDocument, findPersonnelSignatureCoordinates } from '../src/utils/dtrVectorPdf';
import { PDFName, PDFArray, rgb, StandardFonts } from 'pdf-lib';
import puppeteer from 'puppeteer-core';
import path from 'path';

async function main() {
  const origBytes = fs.readFileSync('scratch/cert_test.pdf');
  const pdfDoc = await safeLoadPdfDocument(origBytes);
  const page = pdfDoc.getPages()[0];
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 1. Primary Signer (Mam Bhel / Annabel C. Odoño-Calimpong)
  const locAnnabel = findPersonnelSignatureCoordinates(pdfDoc, 'DIR. ANNABEL C. ODOÑO-CALIMPONG');
  console.log('locAnnabel:', locAnnabel);

  // Draw simulated DigiSigned stamp 1
  page.drawRectangle({
    x: locAnnabel.boxX,
    y: locAnnabel.boxY,
    width: locAnnabel.boxW,
    height: locAnnabel.boxH,
    borderColor: rgb(0.2, 0.4, 0.8),
    borderWidth: 1,
    color: rgb(1, 1, 1),
    opacity: 0.95,
  });
  page.drawText('Digitally signed', {
    x: locAnnabel.boxX + 28,
    y: locAnnabel.boxY + 16,
    size: 7.5,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });
  page.drawText('by Odoño-Calimpong Annabel', {
    x: locAnnabel.boxX + 28,
    y: locAnnabel.boxY + 8,
    size: 6.5,
    font: helvetica,
    color: rgb(0, 0, 0),
  });
  page.drawText('Cortez', {
    x: locAnnabel.boxX + 28,
    y: locAnnabel.boxY + 1.5,
    size: 6.5,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  // Register widget for Annabel
  const annot = pdfDoc.context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: [locAnnabel.boxX, locAnnabel.boxY, locAnnabel.boxX + locAnnabel.boxW, locAnnabel.boxY + locAnnabel.boxH],
  });
  const annotRef = pdfDoc.context.register(annot);
  let annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (!annots) {
    annots = pdfDoc.context.obj([]) as any;
    page.node.set(PDFName.of('Annots'), annots!);
  }
  annots!.push(annotRef);

  // 2. Counter-Signer (Ace Malto)
  const locAce = findPersonnelSignatureCoordinates(pdfDoc, 'ACE MALTO', {
    isCounterSign: true,
    counterSignIndex: 0,
    counterSignPosition: 'auto',
  });
  console.log('locAce:', locAce);

  page.drawRectangle({
    x: locAce.boxX,
    y: locAce.boxY,
    width: locAce.boxW,
    height: locAce.boxH,
    borderColor: rgb(0.2, 0.4, 0.8),
    borderWidth: 1,
    color: rgb(1, 1, 1),
    opacity: 0.95,
  });
  page.drawText('Digitally signed', {
    x: locAce.boxX + 28,
    y: locAce.boxY + 16,
    size: 7.5,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });
  page.drawText('by Malto Ace Mata', {
    x: locAce.boxX + 28,
    y: locAce.boxY + 8,
    size: 6.5,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  const outBytes = await pdfDoc.save();
  fs.writeFileSync('scratch/cert_perfect_both.pdf', outBytes);

  // Screenshot with Puppeteer
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;
  const browser = await puppeteer.launch({ executablePath, headless: true });
  const bPage = await browser.newPage();
  await bPage.setViewport({ width: 1200, height: 1600 });
  const pdfPath = path.resolve('scratch/cert_perfect_both.pdf').replace(/\\/g, '/');
  await bPage.goto(`file:///${pdfPath}`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200));
  await bPage.screenshot({ path: 'scratch/cert_perfect_both_view.png' });
  await browser.close();
  console.log('Saved scratch/cert_perfect_both_view.png');
}

main().catch(console.error);
