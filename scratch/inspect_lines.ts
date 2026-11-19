import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes } from '../src/utils/dtrVectorPdf';

async function main() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794696272616_577d24d5.pdf';
  const bytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPage(0);
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const str = new TextDecoder('latin1').decode(sBytes);

  // Look for lines and rectangles around y=100 to y=450
  const lines = str.split('\n');
  for (const l of lines) {
    if (l.includes(' re') || l.includes(' m') || l.includes(' l')) {
      // Print lines with numbers
      const match = l.match(/([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+re/);
      if (match) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        const w = parseFloat(match[3]);
        const h = parseFloat(match[4]);
        if (y >= 100 && y <= 450) {
          console.log(`RECT: x=${x}, y=${y}, w=${w}, h=${h}`);
        }
      }
    }
  }
}
main().catch(console.error);
