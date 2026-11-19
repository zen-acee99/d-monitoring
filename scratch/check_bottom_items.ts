import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { loadPageFontCMaps, extractPageContentStreamBytes, extractTextItemsFromContentStream } from "../src/utils/dtrVectorPdf";

async function main() {
  const bytes = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPages()[0];
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const items = extractTextItemsFromContentStream(sBytes, cmaps);

  for (const it of items) {
    if (it.y < 200) {
      console.log(`y < 200: "${it.text}" at (${it.x.toFixed(1)}, ${it.y.toFixed(1)})`);
    }
  }
}

main().catch(console.error);
