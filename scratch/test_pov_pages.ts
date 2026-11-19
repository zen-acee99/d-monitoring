import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

async function main() {
  const buf = fs.readFileSync('scratch/test_pov.pdf');
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
  console.log("Pages:", doc.getPageCount());
  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i);
    console.log(`Page ${i + 1}: ${page.getWidth()} x ${page.getHeight()}`);
    const sBytes = extractPageContentStreamBytes(doc, page);
    const fontCMaps = loadPageFontCMaps(doc, page);
    const items = extractTextItemsFromContentStream(sBytes, fontCMaps);
    console.log(`Extracted ${items.length} items from page ${i + 1}`);
    const matches = items.filter(it => it.text.toUpperCase().includes("ANNABEL") || it.text.toUpperCase().includes("CALIMPONG") || it.text.toUpperCase().includes("DY") || it.text.toUpperCase().includes("LEAH"));
    console.log("Signer matches:", matches);
  }
}

main();
