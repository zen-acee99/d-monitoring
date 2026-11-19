import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { loadPageFontCMaps } from "../src/utils/dtrVectorPdf.js";

async function main() {
  const buf = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(buf);
  const page = pdfDoc.getPages()[0];
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  console.log("cmaps keys:", Array.from(cmaps.keys()));
  for (const [k, v] of cmaps.entries()) {
    console.log(`CMap for font ${k}: size=${v.size}`);
    const sample = Array.from(v.entries()).slice(0, 10);
    console.log(`  sample mappings for ${k}:`, sample);
  }
}

main().catch(console.error);
