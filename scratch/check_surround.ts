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
  const fullPageText = textItems.map((it) => it.text).join(" ").toUpperCase();

  const idx = fullPageText.indexOf("BUENA RENE JANE");
  console.log('Index of BUENA RENE JANE:', idx);
  if (idx !== -1) {
    console.log('Surrounding text:', fullPageText.slice(Math.max(0, idx - 50), idx + 80));
  }
}
check().catch(console.error);
