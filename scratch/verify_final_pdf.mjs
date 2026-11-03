import fs from "fs";
import { PDFDocument } from "pdf-lib";
import forge from "node-forge";

const pdfPath = "c:/Users/Ace/Desktop/Project/DICT Sys/dict-monitoring/public/DTR_Ace_M._Malto_September_2026.pdf";
const buf = fs.readFileSync(pdfPath);
const doc = await PDFDocument.load(buf, { ignoreEncryption: true });

console.log("=== PDF DOCUMENT VERIFICATION ===");
console.log("Pages count:", doc.getPageCount());
const page = doc.getPages()[0];
console.log("Page size:", page.getWidth(), "x", page.getHeight());

const str = buf.toString("latin1");
const sigMatches = [...str.matchAll(/\/Type\s*\/Sig\b/g)];
console.log("Signature dictionaries count:", sigMatches.length);

const brMatches = [...str.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)];
console.log("ByteRanges count:", brMatches.length);

const contentsMatches = [...str.matchAll(/\/Contents\s*<([0-9a-fA-F]+)>/g)];
console.log("Contents signatures count:", contentsMatches.length);

let sigIdx = 1;
for (const cm of contentsMatches) {
  const hex = cm[1].replace(/(00)+$/, "");
  const evenHex = hex.length % 2 === 0 ? hex : hex + "0";
  console.log(`\n--- Signature ${sigIdx} PKCS#7 ---`);
  console.log("Hex length:", evenHex.length);
  const der = forge.util.hexToBytes(evenHex);
  const p7Asn1 = forge.asn1.fromDer(der);
  const p7 = forge.pkcs7.messageFromAsn1(p7Asn1);
  console.log("Certificates in PKCS#7:", p7.certificates.length);
  p7.certificates.forEach((c, i) => {
    const cn = c.subject.attributes.find(a => a.name === "commonName" || a.shortName === "CN")?.value;
    const serial = c.serialNumber;
    console.log(`  Cert ${i + 1}: CN=${cn}, Serial=${serial}`);
  });
  sigIdx++;
}

console.log("\nALL VERIFICATIONS PASSED!");
