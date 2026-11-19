import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { findPersonnelSignatureCoordinates } from "../src/utils/dtrVectorPdf.js";

async function testCoords() {
  const buf = fs.readFileSync("scratch/test_revistual.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const loc = findPersonnelSignatureCoordinates(pdfDoc, "ANNABEL C. ODOÑO-CALIMPONG", {
    isCounterSign: false,
  });
  console.log("Calculated Annabel coords:", loc);
  process.exit(0);
}

testCoords().catch((e) => {
  console.error(e);
  process.exit(1);
});
