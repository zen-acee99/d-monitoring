import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { scanPdfForSigners } from "../src/utils/dtrVectorPdf.js";

const buf = fs.readFileSync("scratch/test_abstract.pdf");
let str = buf.toString("latin1");

const bad16 = `16 0 obj
<<
/XObject<</FRM 35 0 R>>>>/Fields[37 0 R 47 0 R 69 0 R 75 0 R 84 0 R]/SigFlags 3>>/Dests 15 0 R/Lang(en)/Metadata 45 0 R/Pages 14 0 R/Type/Catalog/Version/1.6/ViewerPreferences<</DisplayDocTitle true/Type/ViewerPreferences>>
/AcroForm 103 0 R
>>
endobj`;

const good16 = `16 0 obj
<<
/Dests 15 0 R/Lang(en)/Metadata 45 0 R/Pages 14 0 R/Type/Catalog/Version/1.6/ViewerPreferences<</DisplayDocTitle true/Type/ViewerPreferences>>
/AcroForm 103 0 R
>>
endobj`;

console.log("Pad length needed:", bad16.length - good16.length);
const padLen = bad16.length - good16.length;
const paddedGood16 = good16.replace("endobj", " ".repeat(padLen) + "endobj");
console.log("Length match:", paddedGood16.length === bad16.length);

const fixedStr = str.replace(bad16, paddedGood16);
fs.writeFileSync("scratch/test_abstract_fixed.pdf", Buffer.from(fixedStr, "latin1"));

async function testFixed() {
  const fixedBuf = fs.readFileSync("scratch/test_abstract_fixed.pdf");
  const pdfDoc = await PDFDocument.load(fixedBuf, { ignoreEncryption: true });
  console.log("Abstract PDF loaded successfully! Page count:", pdfDoc.getPageCount());

  const mockUsers = [
    { name: "Annabel C. Odoño-Calimpong", role: "OIC-Regional Director", email: "annabel.calimpong@dict.gov.ph" },
    { name: "Ace M. Malto", role: "Planning Officer", email: "ace.malto@dict.gov.ph" },
    { name: "Tabo Norly Avila", role: "Accountant", email: "norly.tabo@dict.gov.ph" },
  ];
  const scanResult = await scanPdfForSigners(new Uint8Array(fixedBuf), mockUsers);
  console.log("Scan result with fixed Abstract PDF:");
  console.log("- primaryPersonnel:", scanResult.primaryPersonnel);
  console.log("- requiredSigners:", scanResult.requiredSigners);
  console.log("- signers:", scanResult.signers);
  console.log("- existingSignatures:", scanResult.existingSignatures);
}

testFixed().catch(console.error);
