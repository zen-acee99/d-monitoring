import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { findPersonnelSignatureCoordinates } from "../src/utils/dtrVectorPdf.js";

async function main() {
  const buf = fs.readFileSync("scratch/test_dv_real.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  console.log("=== ACEMATA MALTO ===");
  console.log(findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO"));
  console.log("\n=== ACE MATA MALTO ===");
  console.log(findPersonnelSignatureCoordinates(pdfDoc, "ACE MATA MALTO"));
  console.log("\n=== ACE MALTO ===");
  console.log(findPersonnelSignatureCoordinates(pdfDoc, "ACE MALTO"));
  console.log("\n=== ANNABEL C. ODOÑO-CALIMPONG ===");
  console.log(findPersonnelSignatureCoordinates(pdfDoc, "ANNABEL C. ODOÑO-CALIMPONG"));
  console.log("\n=== LEAH B. DY ===");
  console.log(findPersonnelSignatureCoordinates(pdfDoc, "LEAH B. DY"));
  console.log("\n=== NORLY A. TABO ===");
  console.log(findPersonnelSignatureCoordinates(pdfDoc, "NORLY A. TABO"));
}
main().catch(console.error);
