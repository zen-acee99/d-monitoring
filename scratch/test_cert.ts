import { safeLoadPdfDocument, extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream, findPersonnelSignatureCoordinates } from '../src/utils/dtrVectorPdf';
import fs from 'fs';

(async () => {
  const bytes = fs.readFileSync('scratch/cert_test.pdf');
  const pdfDoc = await safeLoadPdfDocument(bytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  console.log('Page dims:', width, height);
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  console.log('sBytes len:', sBytes.length);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  console.log('cmaps count:', cmaps.size);
  const items = extractTextItemsFromContentStream(sBytes, cmaps);
  console.log('Text items count:', items.length);
  console.log('--- ALL EXTRACTED TEXT ITEMS ---');
  for (const it of items) {
    console.log('x:', it.x.toFixed(1), 'y:', it.y.toFixed(1), 'text:', JSON.stringify(it.text));
  }
  console.log('--- TESTING findPersonnelSignatureCoordinates ---');
  const loc1 = findPersonnelSignatureCoordinates(pdfDoc, 'Annabel C. Odoño-Calimpong');
  console.log('Loc Annabel:', loc1);
  const loc2 = findPersonnelSignatureCoordinates(pdfDoc, 'DIR. ANNABEL C. ODOÑO-CALIMPONG');
  console.log('Loc DIR Annabel:', loc2);
  const loc3 = findPersonnelSignatureCoordinates(pdfDoc, 'ACE MALTO');
  console.log('Loc Ace:', loc3);
})();
