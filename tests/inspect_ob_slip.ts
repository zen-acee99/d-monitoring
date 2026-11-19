import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'fs';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';
import path from 'path';

async function inspectObSlip() {
  const pdfPath = path.join(process.cwd(), 'scratch', 'signed_ob_slip.pdf');
  console.log("PDF Path:", pdfPath);
  console.log("Exists:", fs.existsSync(pdfPath));
  const pdfBytes = readFileSync(pdfPath);
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
