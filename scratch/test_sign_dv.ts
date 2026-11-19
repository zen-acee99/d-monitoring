import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { findPersonnelSignatureCoordinates } from "../src/utils/dtrVectorPdf.js";

async function testAll() {
  const buf = fs.readFileSync("scratch/test_dv_real.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });

  const locAivan = findPersonnelSignatureCoordinates(pdfDoc, "AIVAN M. BALOLOY", {
    isCounterSign: false,
  });
  console.log("Calculated location for Aivan:", locAivan);

  const locAnnabel = findPersonnelSignatureCoordinates(pdfDoc, "ANNABEL C. ODOÑO-CALIMPONG", {
    isCounterSign: false,
  });
  console.log("Calculated location for Annabel:", locAnnabel);
}

testAll().catch(console.error);
