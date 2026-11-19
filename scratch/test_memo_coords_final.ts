import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { findPersonnelSignatureCoordinates } from "../src/utils/dtrVectorPdf.js";

async function testMemoCoords() {
  const buf = fs.readFileSync("scratch/test_memo_138.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const loc = findPersonnelSignatureCoordinates(pdfDoc, "ANNABEL C. ODOÑO-CALIMPONG", {
    isCounterSign: false,
  });
  console.log("Calculated Annabel coords for Memo 138:", loc);
  process.exit(0);
}

testMemoCoords().catch((e) => {
  console.error(e);
  process.exit(1);
});
