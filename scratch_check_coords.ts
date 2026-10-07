import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { findPersonnelSignatureCoordinates } from "./src/utils/dtrVectorPdf.ts";

async function checkCoords() {
  const filePath = "C:\\Users\\Ace\\Downloads\\Documents\\AAR_LibonAlbay.docx_3.pdf";
  const buf = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACE M. MALTO", { isCounterSign: false });
  console.log("Found coords for ACE M. MALTO:", loc);
}

checkCoords();
