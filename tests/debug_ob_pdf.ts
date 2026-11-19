import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

async function inspectObSlip() {
  const testPdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794696272616_577d24d5.pdf';
  const pdfBytes = fs.readFileSync(testPdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const page = pdfDoc.getPage(0);
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const fontCMaps = loadPageFontCMaps(pdfDoc, page);
  const textItems = extractTextItemsFromContentStream(sBytes, fontCMaps);
  
  console.log("Text items on page 0:");
  textItems.forEach(item => {
    console.log(`Text: "${item.text}", X: ${item.x}, Y: ${item.y}`);
  });
}

inspectObSlip().catch(console.error);
