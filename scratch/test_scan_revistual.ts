import fs from "fs";
import { scanPdfForSigners } from "../src/utils/dtrVectorPdf.js";

async function testScan() {
  const buf = fs.readFileSync("scratch/test_revistual.pdf");
  const mockUsers = [
    { name: "ANNABEL C. ODOÑO-CALIMPONG", role: "Regional Director", email: "annabel.calimpong@dict.gov.ph" }
  ];
  const scan = await scanPdfForSigners(new Uint8Array(buf), mockUsers);
  console.log("Without Revistual in user list:");
  scan.signers.forEach(s => {
    console.log(" -", s.name, "isAlreadySigned:", s.isAlreadySigned, "title:", s.title);
  });
  process.exit(0);
}

testScan().catch((e) => {
  console.error(e);
  process.exit(1);
});
