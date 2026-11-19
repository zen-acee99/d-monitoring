import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from "../src/utils/dtrVectorPdf.js";

async function topText() {
  const buf = fs.readFileSync("scratch/test_revistual.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdfDoc.getPages()[0];
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const items = extractTextItemsFromContentStream(sBytes, cmaps);

  console.log("--- Items with REVISTUAL or NOREEN ---");
  items.filter(it => it.text.toUpperCase().includes("REVISTUAL") || it.text.toUpperCase().includes("NOREEN")).forEach(it => console.log(it.text, "x:", Math.round(it.x), "y:", Math.round(it.y)));

  console.log("--- Items with ANNABEL or ODO ---");
  items.filter(it => it.text.toUpperCase().includes("ANNABEL") || it.text.toUpperCase().includes("ODO")).forEach(it => console.log(it.text, "x:", Math.round(it.x), "y:", Math.round(it.y)));

  process.exit(0);
}

topText().catch((e) => {
  console.error(e);
  process.exit(1);
});
