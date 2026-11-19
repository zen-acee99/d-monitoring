import fs from "fs";
import { scanPdfForSigners } from "../src/utils/dtrVectorPdf.js";

async function main() {
  const buf = fs.readFileSync("scratch/test_pov.pdf");
  const bytes = new Uint8Array(buf);
  console.log("Testing scanPdfForSigners on test_pov.pdf (size:", bytes.length, ")...");

  const mockUsers = [
    { name: "Annabel C. Odoño-Calimpong", role: "OIC-Regional Director", email: "annabel.calimpong@dict.gov.ph" },
    { name: "Ace M. Malto", role: "Planning Officer", email: "ace.malto@dict.gov.ph" },
    { name: "Tabo Norly Avila", role: "Accountant", email: "norly.tabo@dict.gov.ph" },
    { name: "Ebuenga John Nomel Besid", role: "Chief", email: "john.ebuenga@dict.gov.ph" },
  ];

  const result = await scanPdfForSigners(bytes, mockUsers);
  console.log("Scan result:");
  console.log("- primaryPersonnel:", result.primaryPersonnel);
  console.log("- requiredSigners:", result.requiredSigners);
  console.log("- signers:", result.signers);
  console.log("- existingSignatures:", result.existingSignatures);
  console.log("- detectedTexts length:", result.detectedTexts?.length);
  if (result.detectedTexts) {
    console.log("- detected sample texts:", result.detectedTexts.slice(0, 15).map(t => `"${t.text}" at (${t.x}, ${t.y}) page ${t.pageIndex}`));
  }
}

main().catch(console.error);
