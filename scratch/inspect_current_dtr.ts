import { PDFDocument, PDFName, PDFDict, PDFArray, PDFNumber, PDFString } from 'pdf-lib';
import fs from 'fs';
import { extractTextItemsFromContentStream, extractPageContentStreamBytes, loadPageFontCMaps } from '../src/utils/dtrVectorPdf';

async function main() {
  const bytes = fs.readFileSync('scratch/current_dtr.pdf');
  const pdfDoc = await PDFDocument.load(bytes);
  console.log("Pages:", pdfDoc.getPageCount());

  for (let p = 0; p < pdfDoc.getPageCount(); p++) {
    const page = pdfDoc.getPage(p);
    console.log(`\n--- Page ${p + 1} (${page.getWidth()} x ${page.getHeight()}) ---`);
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const items = extractTextItemsFromContentStream(sBytes, fontCMaps);
    console.log(`Extracted ${items.length} text items.`);
    
    // Look for signatures or widgets
    const annotsArr = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (annotsArr) {
      console.log(`Found ${annotsArr.size()} annotations.`);
      for (let i = 0; i < annotsArr.size(); i++) {
        const annot = pdfDoc.context.lookup(annotsArr.get(i), PDFDict);
        if (annot) {
          const subtype = annot.lookupMaybe(PDFName.of("Subtype"), PDFName)?.asString();
          const rect = annot.lookupMaybe(PDFName.of("Rect"), PDFArray);
          const t = annot.lookupMaybe(PDFName.of("T"), PDFString)?.asString();
          let rVals: number[] = [];
          if (rect && rect.size() === 4) {
            rVals = [0, 1, 2, 3].map(idx => (rect.get(idx) as PDFNumber).asNumber());
          }
          console.log(`Annot ${i}: Subtype=${subtype}, T=${t}, Rect=${JSON.stringify(rVals)}`);
        }
      }
    }

    // Print text items matching Ace or Buena or Malto or Rene
    console.log("\nKey items:");
    for (const it of items) {
      const u = it.text.toUpperCase();
      if (u.includes("ACE") || u.includes("MALTO") || u.includes("BUENA") || u.includes("RENE") || u.includes("DIGI") || u.includes("SIGNED")) {
        console.log(`  [x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}] "${it.text}"`);
      }
    }
  }
}

main();
