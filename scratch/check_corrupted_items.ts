import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

async function check() {
  const bytes = fs.readFileSync('c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15) (1).pdf');
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPage(0);
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const fontCMaps = loadPageFontCMaps(pdfDoc, page);
  const items = extractTextItemsFromContentStream(sBytes, fontCMaps);
  console.log(`Total extracted text items: ${items.length}`);
  const sigItems = items.filter(it => 
    it.text.toLowerCase().includes('digitally') || 
    it.text.toLowerCase().includes('malto') || 
    it.text.toLowerCase().includes('buena') ||
    it.text.toLowerCase().includes('rene') ||
    it.text.toLowerCase().includes('signed')
  );
  console.log('Signature-related text items on canvas:');
  for (const it of sigItems) {
    console.log(`  "${it.text}" at (${it.x}, ${it.y})`);
  }
}
check().catch(console.error);
