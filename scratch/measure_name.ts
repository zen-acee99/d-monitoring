import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from "../src/utils/dtrVectorPdf.js";

async function measureName() {
  const buf = fs.readFileSync("scratch/test_dv_real.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdfDoc.getPages()[0];
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const items = extractTextItemsFromContentStream(sBytes, cmaps);

  const annabel = items.find(it => it.text.includes("ANNABEL"));
  const aivan = items.find(it => it.text.includes("BALOLOY"));
  console.log("Annabel item:", annabel);
  console.log("Aivan item:", aivan);
}

measureName().catch(console.error);
