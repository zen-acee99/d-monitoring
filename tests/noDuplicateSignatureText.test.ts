import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { signPdfBuffer, fixMojibake } from "../server/services/pnpkiSigningService";

async function run() {
  console.log("======================================================================");
  console.log("   AUTOMATED VERIFICATION: NO DUPLICATE SIGNATURE TEXT & CLEAN 'ñ'    ");
  console.log("======================================================================");

  // Check fixMojibake for corrupted "Odoæo"
  assert.strictEqual(
    fixMojibake("Odoæo-Calimpong Annabel Cortez"),
    "Odoño-Calimpong Annabel Cortez",
    "fixMojibake must correct 'Odoæo' to 'Odoño'"
  );
  assert.strictEqual(
    fixMojibake("ODOÆO-CALIMPONG"),
    "ODOÑO-CALIMPONG",
    "fixMojibake must correct 'ODOÆO' to 'ODOÑO'"
  );
  console.log("  PASS: fixMojibake correctly repairs 'Odoæo' to 'Odoño'");

  const p12Path = path.resolve("scratch/rene_jane.p12");
  if (!fs.existsSync(p12Path)) {
    console.warn("Skipping test: scratch/rene_jane.p12 not found");
    return;
  }

  const p12Buf = fs.readFileSync(p12Path);
  const p12Base64 = p12Buf.toString("base64");

  // Create clean blank PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  page.drawText("DISBURSEMENT VOUCHER", { x: 50, y: 700, size: 14 });
  page.drawText("ANNABEL C. ODOÑO-CALIMPONG", { x: 220, y: 150, size: 10 });
  const rawBytes = await pdfDoc.save();

  // Sign PDF with P12 (First-signature mode)
  const signerName = "Odoño-Calimpong Annabel Cortez";
  const { signedBuffer } = await signPdfBuffer(
    Buffer.from(rawBytes),
    p12Base64,
    "1234567890Aa!",
    {
      signerName,
      sigRect: [200, 163, 145, 28],
      reason: "Official Digital Signature",
      isCounterSign: false,
    }
  );

  const signedDoc = await PDFDocument.load(signedBuffer);
  const signedStr = signedBuffer.toString("latin1");

  // Count occurrences of "Digitally signed" in the raw PDF
  const matches = signedStr.match(/\(Digitally signed\)/g) || [];
  console.log(`[Check 1] "(Digitally signed)" occurrences in PDF binary: ${matches.length}`);

  // It must occur exactly ONCE (inside the /AP /N stream), NOT twice (page + /AP /N)
  assert.strictEqual(
    matches.length,
    1,
    `"(Digitally signed)" must occur exactly 1 time in the PDF (found ${matches.length})`
  );
  console.log("  PASS: Exact 1 occurrence of '(Digitally signed)' in PDF binary (no duplicate page text)");

  // Count occurrences of "by Odo" or signer name lines in PDF binary
  const signerMatches = signedStr.match(/by Odo/g) || [];
  console.log(`[Check 2] "by Odo" occurrences in PDF binary: ${signerMatches.length}`);
  assert.strictEqual(
    signerMatches.length,
    1,
    `"by Odo" must occur exactly 1 time in the PDF (found ${signerMatches.length})`
  );
  console.log("  PASS: Exact 1 occurrence of 'by Odo' in PDF binary (no duplicate page text)");

  // Check 3: Font dictionary MUST explicitly declare /Encoding /WinAnsiEncoding so 'ñ' renders as 'ñ' and NOT 'æ'
  assert(
    signedStr.includes("/Encoding /WinAnsiEncoding"),
    "Type1 font dictionary must explicitly declare /Encoding /WinAnsiEncoding"
  );
  console.log("  PASS: Font dictionary explicitly defines /Encoding /WinAnsiEncoding (prevents 'Odoæo' glitch)");

  // Check 4: The string must NOT contain 'Odoæo'
  assert(!signedStr.includes("Odoæo"), "PDF binary must not contain corrupted 'Odoæo'");
  console.log("  PASS: PDF binary cleanly renders 'Odoño' with 0 occurrences of 'Odoæo'");

  console.log("\nALL NO-DUPLICATE SIGNATURE & CLEAN 'ñ' CHECKS PASSED PERFECTLY!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
