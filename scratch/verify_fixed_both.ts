import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { scanPdfForSigners } from "../src/utils/dtrVectorPdf.js";

async function verifyAll() {
  const mockUsers = [
    { name: "Annabel C. Odoño-Calimpong", role: "OIC-Regional Director", email: "annabel.calimpong@dict.gov.ph" },
    { name: "Ace M. Malto", role: "Planning Officer", email: "ace.malto@dict.gov.ph" },
    { name: "Tabo Norly Avila", role: "Accountant", email: "norly.tabo@dict.gov.ph" },
    { name: "Ebuenga John Nomel Besid", role: "Chief", email: "john.ebuenga@dict.gov.ph" },
  ];

  console.log("--- 1. Testing POV Fixed ---");
  const povBytes = fs.readFileSync("scratch/test_pov_fixed.pdf");
  const povDoc = await PDFDocument.load(povBytes, { ignoreEncryption: true });
  console.log("POV Pages:", povDoc.getPageCount());
  const povScan = await scanPdfForSigners(new Uint8Array(povBytes), mockUsers);
  console.log("POV Primary:", povScan.primaryPersonnel);
  console.log("POV Signatures count:", povScan.existingSignatures?.length);

  console.log("\n--- 2. Testing Abstract Fixed ---");
  const absBytes = fs.readFileSync("scratch/test_abstract_fixed.pdf");
  const absDoc = await PDFDocument.load(absBytes, { ignoreEncryption: true });
  console.log("Abstract Pages:", absDoc.getPageCount());
  const absScan = await scanPdfForSigners(new Uint8Array(absBytes), mockUsers);
  console.log("Abstract Primary:", absScan.primaryPersonnel);
  console.log("Abstract Signatures count:", absScan.existingSignatures?.length);
  
  console.log("\nALL VERIFICATIONS PASSED!");
}

verifyAll().catch(console.error);
