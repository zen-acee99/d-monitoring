import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { scanPdfForSigners } from "../src/utils/dtrVectorPdf.js";

// Let's create a fixed copy of test_pov.pdf where object 18 has a properly cleaned catalog dictionary
const buf = fs.readFileSync("scratch/test_pov.pdf");
let str = buf.toString("latin1");

// Replace the corrupt object 18 (Version 3)
const bad18 = `18 0 obj
<<
/Dests 17 0 R/Type/Catalog/Lang(en)/Font<</ZaDb 53 0 R/Helv 52 0 R>>>>>>/Pages 16 0 R/ViewerPreferences<</Type/ViewerPreferences/DisplayDocTitle true>>
/AcroForm 76 0 R
>>
endobj`;

// Notice: In the original Version 0, it was:
// <</Type /Catalog /Pages 16 0 R /Dests 17 0 R /ViewerPreferences <</Type /ViewerPreferences /DisplayDocTitle true>> /Lang (en)>>
// So with /AcroForm 76 0 R, it should simply be:
const good18 = `18 0 obj
<<
/Type /Catalog
/Pages 16 0 R
/Dests 17 0 R
/ViewerPreferences <</Type /ViewerPreferences /DisplayDocTitle true>>
/Lang (en)
/AcroForm 76 0 R
>>
endobj`;

console.log("Replacing bad 18 with good 18 (padded to keep byte offset identical)...");
// We can pad good18 with whitespace comments or spaces so byte length doesn't shift xref
const padLen = bad18.length - good18.length;
console.log("Pad length needed:", padLen);
const paddedGood18 = good18.replace("endobj", " ".repeat(padLen) + "endobj");
console.log("Length match:", paddedGood18.length === bad18.length);

const fixedStr = str.replace(bad18, paddedGood18);
fs.writeFileSync("scratch/test_pov_fixed.pdf", Buffer.from(fixedStr, "latin1"));

async function testFixed() {
  const fixedBuf = fs.readFileSync("scratch/test_pov_fixed.pdf");
  const pdfDoc = await PDFDocument.load(fixedBuf, { ignoreEncryption: true });
  console.log("PDF successfully loaded! Page count:", pdfDoc.getPageCount());
  
  const mockUsers = [
    { name: "Annabel C. Odoño-Calimpong", role: "OIC-Regional Director", email: "annabel.calimpong@dict.gov.ph" },
    { name: "Ace M. Malto", role: "Planning Officer", email: "ace.malto@dict.gov.ph" },
    { name: "Tabo Norly Avila", role: "Accountant", email: "norly.tabo@dict.gov.ph" },
    { name: "Ebuenga John Nomel Besid", role: "Chief", email: "john.ebuenga@dict.gov.ph" },
  ];
  const scanResult = await scanPdfForSigners(new Uint8Array(fixedBuf), mockUsers);
  console.log("Scan result with fixed PDF:");
  console.log("- primaryPersonnel:", scanResult.primaryPersonnel);
  console.log("- requiredSigners:", scanResult.requiredSigners);
  console.log("- signers:", scanResult.signers);
  console.log("- existingSignatures:", scanResult.existingSignatures);
}

testFixed().catch(console.error);
