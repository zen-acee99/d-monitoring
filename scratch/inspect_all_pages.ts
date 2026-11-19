import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

async function main() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794696272616_577d24d5.pdf';
  const bytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(bytes);
  for (let p = 0; p < pdfDoc.getPageCount(); p++) {
    const page = pdfDoc.getPage(p);
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const items = extractTextItemsFromContentStream(sBytes, fontCMaps);
    console.log(`=== PAGE ${p+1} ===`);
    items.forEach(it => {
      console.log(`[P${p+1}] (x: ${it.x.toFixed(1)}, y: ${it.y.toFixed(1)}) "${it.text}"`);
    });
  }
}
main().catch(console.error);
