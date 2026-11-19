import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { scanPdfForSigners } from '../src/utils/dtrVectorPdf';

async function main() {
  const buf = fs.readFileSync('scratch/test_pov.pdf');
  let str = buf.toString('latin1');
  
  // Find where /Pages 16 0 R was in the original Catalog
  const pagesMatch = str.match(/\/Pages\s+(\d+\s+0\s+R)/);
  console.log("Found original /Pages:", pagesMatch ? pagesMatch[0] : "none");

  // In the last Object 18 (Catalog), add /Pages 16 0 R if missing!
  // Find the last 18 0 obj
  const last18Idx = str.lastIndexOf("18 0 obj");
  console.log("Last 18 0 obj at:", last18Idx);
  const endobjIdx = str.indexOf("endobj", last18Idx);
  const obj18Body = str.slice(last18Idx, endobjIdx);
  console.log("Last obj 18 body:", obj18Body);

  // If obj18Body doesn't have /Pages:
  if (!obj18Body.includes("/Pages")) {
    const fixedObj18 = obj18Body.replace(/<<\s*/, "<<\n/Pages 16 0 R\n");
    // Replace just this occurrence:
    const fixedStr = str.slice(0, last18Idx) + fixedObj18 + str.slice(endobjIdx);
    const fixedBuf = Buffer.from(fixedStr, 'latin1');
    fs.writeFileSync('scratch/test_pov_fixed.pdf', fixedBuf);
    console.log("Wrote test_pov_fixed.pdf");

    // Now test PDFDocument.load on fixedBuf
    const doc = await PDFDocument.load(fixedBuf, { ignoreEncryption: true });
    console.log("Successfully loaded fixed PDF! Pages:", doc.getPageCount());
    for (let p = 0; p < doc.getPageCount(); p++) {
      console.log(`Page ${p+1}: ${doc.getPage(p).getWidth()} x ${doc.getPage(p).getHeight()}`);
    }

    const mockUsers = [
      { name: "Annabel C. Odoño-Calimpong", role: "OIC-Regional Director", email: "annabel.calimpong@dict.gov.ph" },
      { name: "Ace M. Malto", role: "Planning Officer", email: "ace.malto@dict.gov.ph" },
      { name: "Tabo Norly Avila", role: "Accountant", email: "norly.tabo@dict.gov.ph" },
      { name: "Ebuenga John Nomel Besid", role: "Chief", email: "john.ebuenga@dict.gov.ph" },
      { name: "Leah B. Dy", role: "Accountant III", email: "leah.dy@dict.gov.ph" },
    ];

    const scan = await scanPdfForSigners(fixedBuf, mockUsers);
    console.log("Scan result on fixed PDF:", {
      primary: scan.primaryPersonnel,
      required: scan.requiredSigners,
      signers: scan.signers.map(s => ({ name: s.name, status: s.status, isAlreadySigned: s.isAlreadySigned, page: s.pageIndex, x: s.x, y: s.y })),
    });
  }
}

main();
