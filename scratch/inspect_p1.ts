import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

async function main() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794696272616_577d24d5.pdf';
  const bytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPage(0);
  const { width, height } = page.getSize();
  console.log(`Page 1 size: ${width} x ${height}`);
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const fontCMaps = loadPageFontCMaps(pdfDoc, page);
  const items = extractTextItemsFromContentStream(sBytes, fontCMaps);
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  items.forEach(it => {
    console.log(`(x: ${it.x.toFixed(1)}, y: ${it.y.toFixed(1)}) font=${it.fontSize} "${it.text}"`);
  });
}
main().catch(console.error);
