import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from "../src/utils/dtrVectorPdf.js";

async function dumpTexts() {
  const buf = fs.readFileSync("scratch/test_dv_real.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdfDoc.getPages()[0];
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const items = extractTextItemsFromContentStream(sBytes, cmaps);

  console.log(`Extracted ${items.length} text items on page 1:`);
  for (const it of items) {
    if (it.y > 100 && it.y < 350) {
      console.log(`  "${it.text}" at x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}`);
    }
  }
}

dumpTexts().catch(console.error);
