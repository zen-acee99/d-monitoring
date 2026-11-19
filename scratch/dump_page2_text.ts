import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

async function main() {
  const bytes = fs.readFileSync('scratch/masareta_from_db.pdf');
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPages()[1];
  const sBytes = extractPageContentStreamBytes(doc, page);
  const fontCMaps = loadPageFontCMaps(doc, page);
  const items = extractTextItemsFromContentStream(sBytes, fontCMaps);
  console.log('All Page 2 items:');
  items.sort((a, b) => b.y - a.y);
  for (const it of items) {
    console.log(`y=${it.y.toFixed(2)}, x=${it.x.toFixed(2)}: "${it.text}"`);
  }
}

main().catch(console.error);
