import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from "../src/utils/dtrVectorPdf.js";

async function inspectMemo() {
  const buf = fs.readFileSync("scratch/test_memo_138.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  console.log("Memo page count:", pdfDoc.getPageCount());

  for (let p = 0; p < pdfDoc.getPageCount(); p++) {
    const page = pdfDoc.getPage(p);
    const { width, height } = page.getSize();
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    const cmaps = loadPageFontCMaps(pdfDoc, page);
    const items = extractTextItemsFromContentStream(sBytes, cmaps);

    console.log(`\n=== Page ${p + 1} (${width}x${height}) ===`);
    const annabel = items.filter(it => it.text.toUpperCase().includes("ANNABEL") || it.text.toUpperCase().includes("ODO"));
    console.log("Annabel items on Page " + (p + 1) + ":", annabel);

    const directors = items.filter(it => it.text.toUpperCase().includes("DIRECTOR"));
    console.log("Director items on Page " + (p + 1) + ":", directors);
  }
  process.exit(0);
}

inspectMemo().catch((e) => {
  console.error(e);
  process.exit(1);
});
