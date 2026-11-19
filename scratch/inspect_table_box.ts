import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

async function main() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794696272616_577d24d5.pdf';
  const bytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPage(0);
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const fontCMaps = loadPageFontCMaps(pdfDoc, page);
  const items = extractTextItemsFromContentStream(sBytes, fontCMaps);

  console.log("=== Text items between Y=140 and Y=260 ===");
  items
    .filter(it => it.y >= 140 && it.y <= 260)
    .sort((a, b) => b.y - a.y)
    .forEach(it => {
      console.log(`x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}, font=${it.fontSize}: "${it.text}"`);
    });

  const str = new TextDecoder('latin1').decode(sBytes);
  console.log("\n=== Rectangles between Y=140 and Y=260 ===");
  const reRegex = /([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+re/g;
  let m;
  while ((m = reRegex.exec(str)) !== null) {
    const x = parseFloat(m[1]);
    const y = parseFloat(m[2]);
    const w = parseFloat(m[3]);
    const h = parseFloat(m[4]);
    if (y >= 140 && y <= 260) {
      console.log(`RECT: x=${x.toFixed(1)}, y=${y.toFixed(1)}, w=${w.toFixed(1)}, h=${h.toFixed(1)} (top=${(y+h).toFixed(1)}, right=${(x+w).toFixed(1)})`);
    }
  }
}
main().catch(console.error);
