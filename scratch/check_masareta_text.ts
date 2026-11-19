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
  console.log('Page 2 items count:', items.length);
  const textInArea = items.filter(it => it.y >= 300 && it.y <= 450);
  console.log('Text between y=300 and y=450:', textInArea);
}

main().catch(console.error);
