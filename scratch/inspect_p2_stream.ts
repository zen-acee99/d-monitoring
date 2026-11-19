import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

async function main() {
  const bytes = fs.readFileSync('scratch/masareta_from_db.pdf');
  const doc = await PDFDocument.load(bytes);
  const p = doc.getPages()[1];
  const sBytes = extractPageContentStreamBytes(doc, p);
  const fontCMaps = loadPageFontCMaps(doc, p);
  const items = extractTextItemsFromContentStream(sBytes, fontCMaps);
  const annabel = items.find(it => it.text.includes('ANNABEL') || it.text.includes('ODO'));
  console.log('Annabel item:', annabel);
  const oic = items.find(it => it.text.includes('OIC') || it.text.includes('Regional Director'));
  console.log('OIC item:', oic);
}

main().catch(console.error);
