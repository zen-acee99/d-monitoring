import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { autoSignPdfWithReneJane } from "../src/utils/reneJaneAutoSign.ts";

// Test end-to-end signing workflow
async function runE2E() {
  console.log("=== STARTING FULL E2E VERIFICATION SUITE ===");

  // Test 1: Upload a real DTR
  console.log("\n[Test 1] Uploading and Auto-Signing DTR...");
  const dtrBuffer = fs.readFileSync("public/DTR_Ace_M._Malto_September_2026.pdf");
  const res1 = await autoSignPdfWithReneJane(dtrBuffer, "My_Uploaded_DTR.pdf");
  console.log("Result 1 Success:", res1.success);
  console.log("Result 1 DocType:", res1.docType);
  console.log("Result 1 Output Filename:", res1.downloadFilename);
  console.log("Result 1 Detected Reason:", res1.detectedReason);
  console.log("Result 1 Signatures Applied:", res1.signatureCount);
  console.log("Result 1 Is Cryptographic:", res1.isCryptographic);
  console.log("Result 1 Signer Identity:", res1.signerIdentity.commonName, "Serial:", res1.signerIdentity.serialNumber);

  if (!res1.success || res1.docType !== "DTR" || res1.downloadFilename !== "My_Uploaded_DTR_Signed_ReneJane.pdf" || res1.signatureCount !== 2) {
    throw new Error("Test 1 (DTR auto-sign) failed verification!");
  }

  // Test 2: Upload a real AR
  console.log("\n[Test 2] Uploading and Auto-Signing AR...");
  const arBuffer = fs.readFileSync("public/AR_Ace_M._Malto_September_2026.pdf");
  const res2 = await autoSignPdfWithReneJane(arBuffer, "Accomplishment_Report_Q3.pdf");
  console.log("Result 2 Success:", res2.success);
  console.log("Result 2 DocType:", res2.docType);
  console.log("Result 2 Output Filename:", res2.downloadFilename);
  console.log("Result 2 Detected Reason:", res2.detectedReason);
  console.log("Result 2 Signatures Applied:", res2.signatureCount);
  console.log("Result 2 Is Cryptographic:", res2.isCryptographic);

  if (!res2.success || res2.docType !== "AR" || res2.downloadFilename !== "Accomplishment_Report_Q3_Signed_ReneJane.pdf") {
    throw new Error("Test 2 (AR auto-sign) failed verification!");
  }

  // Test 3: Upload a generic document with custom text
  console.log("\n[Test 3] Uploading and Auto-Signing Arbitrary Administrative Document...");
  const customDoc = await PDFDocument.create();
  const page = customDoc.addPage([612, 792]);
  page.drawText("SPECIAL ORDER NO. 2026-REG5-099", { x: 50, y: 720, size: 14 });
  page.drawText("Subject: Designation of Project Leads", { x: 50, y: 690, size: 12 });
  page.drawText("APPROVED BY:", { x: 340, y: 180, size: 11 });
  page.drawText("RENE JANE R. BUENA", { x: 340, y: 130, size: 12 });
  page.drawText("Provincial Officer", { x: 340, y: 115, size: 10 });
  const customBytes = await customDoc.save();

  const res3 = await autoSignPdfWithReneJane(customBytes, "Special_Order_2026.pdf");
  console.log("Result 3 Success:", res3.success);
  console.log("Result 3 DocType:", res3.docType);
  console.log("Result 3 Output Filename:", res3.downloadFilename);
  console.log("Result 3 Detected Reason:", res3.detectedReason);
  console.log("Result 3 Is Cryptographic:", res3.isCryptographic);

  if (!res3.success || res3.downloadFilename !== "Special_Order_2026_Signed_ReneJane.pdf") {
    throw new Error("Test 3 (Custom doc auto-sign) failed verification!");
  }

  // Test 4: Upload an empty document guard
  console.log("\n[Test 4] Uploading 0-byte file (Empty File Guard)...");
  const res4 = await autoSignPdfWithReneJane(new Uint8Array(0), "Empty.pdf");
  console.log("Result 4 Success (expected false):", res4.success);
  console.log("Result 4 Error:", res4.error);
  if (res4.success !== false) {
    throw new Error("Test 4 (Empty guard) failed verification!");
  }

  // Test 5: Verify the signed PDF structure of Test 1 with pdf-lib to ensure valid PDF
  console.log("\n[Test 5] Validating signed PDF integrity...");
  const parsedSignedDoc = await PDFDocument.load(res1.signedPdfBytes);
  console.log("Parsed signed PDF page count:", parsedSignedDoc.getPageCount());
  if (parsedSignedDoc.getPageCount() < 1) {
    throw new Error("Signed PDF is corrupt!");
  }

  console.log("\n========================================================");
  console.log("  >>> ALL 5 END-TO-END VERIFICATION TESTS PASSED! <<<   ");
  console.log("========================================================");
}

runE2E().catch((err) => {
  console.error("E2E Verification Failed:", err);
  process.exit(1);
});
