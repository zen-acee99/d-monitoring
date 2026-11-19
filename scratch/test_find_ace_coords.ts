import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { findPersonnelSignatureCoordinates } from "../src/utils/dtrVectorPdf";

async function main() {
  const bytes = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(bytes);

  console.log("--- Testing findPersonnelSignatureCoordinates for 'Ace malto' ---");
  const res1 = findPersonnelSignatureCoordinates(pdfDoc, "Ace malto");
  console.log("Result for 'Ace malto':", JSON.stringify(res1, null, 2));

  console.log("--- Testing findPersonnelSignatureCoordinates for 'ACE MATA MALTO' ---");
  const res2 = findPersonnelSignatureCoordinates(pdfDoc, "ACE MATA MALTO");
  console.log("Result for 'ACE MATA MALTO':", JSON.stringify(res2, null, 2));

  console.log("--- Testing findPersonnelSignatureCoordinates for 'RENE JANE R. BUENA' ---");
  const res3 = findPersonnelSignatureCoordinates(pdfDoc, "RENE JANE R. BUENA");
  console.log("Result for 'RENE JANE R. BUENA':", JSON.stringify(res3, null, 2));
}

main().catch(console.error);
