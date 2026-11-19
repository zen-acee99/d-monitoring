import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { scanPdfForSigners } from "../src/utils/dtrVectorPdf.js";

async function verifyDv() {
  const buf = fs.readFileSync("scratch/test_dv_corrected.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  console.log("DV Page count:", pdfDoc.getPageCount());

  const mockUsers = [
    { name: "ANNABEL C. ODOÑO-CALIMPONG", role: "OIC-Regional Director", email: "annabel.calimpong@dict.gov.ph" },
    { name: "AIVAN M. BALOLOY", role: "Accountant III", email: "aivan.baloloy@dict.gov.ph" },
  ];
  const scan = await scanPdfForSigners(new Uint8Array(buf), mockUsers);
  console.log("Signatures in corrected DV:");
  scan.existingSignatures?.forEach(s => {
    console.log(`  - ${s.signerName}: rect=[${s.rect.join(", ")}]`);
  });
}

verifyDv().catch(console.error);
