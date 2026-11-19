import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

async function main() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794696272616_577d24d5.pdf';
  const bytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(bytes);
  console.log('Page count:', pdfDoc.getPageCount());
  for (let i = 0; i < pdfDoc.getPageCount(); i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    console.log(`--- PAGE ` + (i + 1) + ` (` + width + `x` + height + `) ---`);
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const items = extractTextItemsFromContentStream(sBytes, fontCMaps);
    console.log('Text item count:', items.length);
    items.forEach(it => {
      const u = it.text.toUpperCase();
      if (
        u.includes('BUEN') ||
        u.includes('RENE') ||
        u.includes('APPROV') ||
        u.includes('GUARD') ||
        u.includes('BUSINESS') ||
        u.includes('DEPART') ||
        u.includes('OFFICIAL') ||
        u.includes('OB') ||
        u.includes('PRINTED') ||
        u.includes('SIGNATURE')
      ) {
        console.log(`[P` + (i + 1) + `] (${Math.round(it.x)}, ${Math.round(it.y)}) font=${it.fontSize}: "${it.text}"`);
      }
    });
  }
}
main().catch(console.error);
