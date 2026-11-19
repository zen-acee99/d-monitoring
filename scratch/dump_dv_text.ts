import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from "../src/utils/dtrVectorPdf.js";

async function main() {
  const buf = fs.readFileSync("scratch/test_dv_real.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  console.log(`Page size: width=${width}, height=${height}`);
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const textItems = extractTextItemsFromContentStream(sBytes, cmaps);
  console.log("Total text items:", textItems.length);
  textItems.sort((a,b) => b.y - a.y);
  for (const it of textItems) {
    if (it.y < 450) {
      console.log(`y=${it.y.toFixed(1).padStart(5)}, x=${it.x.toFixed(1).padStart(5)}: "${it.text}"`);
    }
  }
}
main().catch(console.error);
