import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import {
  repairPdfCatalogIfCorrupted,
  extractPageContentStreamBytes,
  loadPageFontCMaps,
  extractTextItemsFromContentStream
} from '../src/utils/dtrVectorPdf.js';

async function main() {
  const bytes = fs.readFileSync('./scratch/test_pov.pdf');
  const repaired = repairPdfCatalogIfCorrupted(bytes);
  const pdfDoc = await PDFDocument.load(repaired);
  const page = pdfDoc.getPages()[0];
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  console.log("Page content stream bytes length:", sBytes.length);

  const fontCMaps = loadPageFontCMaps(pdfDoc, page);
  console.log("Font CMaps count:", fontCMaps.size);

  const items = extractTextItemsFromContentStream(sBytes, fontCMaps);
  console.log("Text items extracted count:", items.length);
  for (let i = 0; i < Math.min(20, items.length); i++) {
    console.log(`- "${items[i].text}" at (${items[i].x}, ${items[i].y})`);
  }
}

main().catch(console.error);
