import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

async function check() {
  const bytes = fs.readFileSync('c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15).pdf');
  const pdfDoc = await PDFDocument.load(bytes);
  const targetPage = pdfDoc.getPage(0);
  const sBytes = extractPageContentStreamBytes(pdfDoc, targetPage);
  const fontCMaps = loadPageFontCMaps(pdfDoc, targetPage);
  const textItems = sBytes.length > 0 ? extractTextItemsFromContentStream(sBytes, fontCMaps) : [];
  for (const it of textItems) {
    if (it.text.toUpperCase().includes('BUENA') || it.text.toUpperCase().includes('RENE')) {
      console.log(`[x=${it.x}, y=${it.y}] "${it.text}"`);
    }
  }
}
check().catch(console.error);
