import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream, findPersonnelSignatureCoordinates } from '../src/utils/dtrVectorPdf';

async function main() {
  const bytes = fs.readFileSync('scratch/test_to.pdf');
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPages()[1];
  const sBytes = extractPageContentStreamBytes(doc, page);
  const fontCMaps = loadPageFontCMaps(doc, page);
  const items = extractTextItemsFromContentStream(sBytes, fontCMaps);
  const nearby = items.filter(it => it.y >= 540 && it.y <= 620);
  console.log('Nearby items:', nearby);

  const loc = findPersonnelSignatureCoordinates(doc, 'ANNABEL C. ODOÑO-CALIMPONG');
  console.log('loc:', loc);
}
main().catch(console.error);
