import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from "../src/utils/dtrVectorPdf.js";

async function inspectFonts() {
  const buf = fs.readFileSync("scratch/test_to_real.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdfDoc.getPages()[0];
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const items = extractTextItemsFromContentStream(sBytes, cmaps);

  const approved = items.find(it => it.text.includes("APPROVED"));
  const annabel = items.find(it => it.text.includes("ANNABEL"));
  const director = items.find(it => it.text.includes("Regional Director"));

  console.log("Approved item:", approved);
  console.log("Annabel item:", annabel);
  console.log("Director item:", director);
}

inspectFonts().catch(console.error);
