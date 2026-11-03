import fs from "fs";
import { jsPDF } from "jspdf";
import { signPdfBuffer } from "./pnpkiSigningService.mjs";

async function testSigning() {
  console.log("Creating blank PDF...");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.text("Test PDF", 50, 50);
  const pdfBytes = Buffer.from(doc.output("arraybuffer"));

  const p12Buf = fs.readFileSync("scratch/rene_jane.p12");
  const p12Base64 = p12Buf.toString("base64");

  console.log("\n--- Pass 1 ---");
  const p1 = await signPdfBuffer(pdfBytes, p12Base64, "1234567890Aa!", {
    sigRect: [100, 200, 120, 25],
    fieldName: "Sig1"
  });
  console.log("Pass 1 size:", p1.signedBuffer.length);

  console.log("\n--- Pass 2 ---");
  const p2 = await signPdfBuffer(p1.signedBuffer, p12Base64, "1234567890Aa!", {
    sigRect: [300, 200, 120, 25],
    fieldName: "Sig2"
  });
  console.log("Pass 2 size:", p2.signedBuffer.length);

  console.log("\n--- Pass 3 ---");
  const p3 = await signPdfBuffer(p2.signedBuffer, p12Base64, "1234567890Aa!", {
    sigRect: [100, 150, 120, 25],
    fieldName: "Sig3"
  });
  console.log("Pass 3 size:", p3.signedBuffer.length);

  console.log("\n--- Pass 4 ---");
  const p4 = await signPdfBuffer(p3.signedBuffer, p12Base64, "1234567890Aa!", {
    sigRect: [300, 150, 120, 25],
    fieldName: "Sig4"
  });
  console.log("Pass 4 size:", p4.signedBuffer.length);

  console.log("\nSuccess! Verifying signatures in final buffer...");
  const finalStr = p4.signedBuffer.toString("latin1");
  const sigMatches = [...finalStr.matchAll(/\/Type\s*\/Sig\b/g)];
  console.log("Sig count:", sigMatches.length);
  const brMatches = [...finalStr.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)];
  console.log("ByteRanges:", brMatches.map(m => `[${m[1]}, ${m[2]}, ${m[3]}, ${m[4]}]`));
}

testSigning().catch(console.error);
