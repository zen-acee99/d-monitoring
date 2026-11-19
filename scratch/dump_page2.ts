import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from "../src/utils/dtrVectorPdf.js";

async function dumpPage2() {
  const buf = fs.readFileSync("scratch/test_memo_138.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdfDoc.getPage(1); // Page 2 (0-indexed 1)
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const items = extractTextItemsFromContentStream(sBytes, cmaps);

  console.log("Total text items on Page 2:", items.length);
  for (let i = 0; i < Math.min(items.length, 50); i++) {
    console.log(`[${i}] "${items[i].text}" at x=${items[i].x}, y=${items[i].y}`);
  }
  process.exit(0);
}

dumpPage2().catch((e) => {
  console.error(e);
  process.exit(1);
});
