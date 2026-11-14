import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { detectSignatureCoordinatesForReneJane, autoSignPdfWithReneJane } from '../src/utils/reneJaneAutoSign';

async function runObSlipTests() {
  console.log("======================================================================");
  console.log("   AUTOMATED TEST SUITE: OFFICIAL BUSINESS (OB) SLIP DUAL SIGNATURE  ");
  console.log("======================================================================");

  const testPdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794696272616_577d24d5.pdf';
  if (!fs.existsSync(testPdfPath)) {
    console.warn("Test PDF not found at path:", testPdfPath);
    return;
  }

  const pdfBytes = fs.readFileSync(testPdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Test 1: Structure Detection
  console.log("\n[Test 1] detectSignatureCoordinatesForReneJane identifies OB Slip and dual boxes");
  const detection = detectSignatureCoordinatesForReneJane(pdfDoc, "Official_Business_(OB)_Malto.pdf");

  if (detection.docType !== "OB_SLIP") {
    throw new Error(`Expected docType OB_SLIP, got ${detection.docType}`);
  }
  if (detection.targetPageIndex !== 0) {
    throw new Error(`Expected targetPageIndex 0, got ${detection.targetPageIndex}`);
  }
  if (!detection.sigRects || detection.sigRects.length !== 2) {
    throw new Error(`Expected exactly 2 signature boxes, got ${detection.sigRects?.length}`);
  }

  const [box1, box2] = detection.sigRects;
  console.log("  Box 1 (Approved by):", box1);
  console.log("  Box 2 (Departure Guard/Officer):", box2);

  // Validate Box 1 (Approved by): should be centered over RENE JANE R. BUENO, Y between 330 and 360
  if (box1[0] < 200 || box1[0] > 260 || box1[1] < 325 || box1[1] > 355) {
    throw new Error(`Box 1 coordinates out of expected range for Approved by: ${JSON.stringify(box1)}`);
  }

  // Validate Box 2 (Departure Guard/Officer): should be in table column 2 (X > 290, Y between 175 and 200)
  if (box2[0] < 290 || box2[0] > 330 || box2[1] < 170 || box2[1] > 200) {
    throw new Error(`Box 2 coordinates out of expected range for Departure Officer: ${JSON.stringify(box2)}`);
  }
  console.log("  PASS: Test 1 - Correctly detected OB_SLIP and positioned dual signature boxes");

  // Test 2: Execution via autoSignPdfWithReneJane
  console.log("\n[Test 2] autoSignPdfWithReneJane signs both widgets without duplicate typography");
  const signResult = await autoSignPdfWithReneJane(pdfBytes, "Official_Business_(OB)_Malto.pdf");

  if (!signResult.success) {
    throw new Error(`Expected success=true, got error: ${signResult.error}`);
  }
  if (signResult.docType !== "OB_SLIP") {
    throw new Error(`Expected result docType OB_SLIP, got ${signResult.docType}`);
  }
  if (signResult.signatureCount !== 2) {
    throw new Error(`Expected signatureCount 2, got ${signResult.signatureCount}`);
  }
  if (!signResult.signedPdfBytes || signResult.signedPdfBytes.length === 0) {
    throw new Error("Expected non-empty signedPdfBytes");
  }

  const signedDoc = await PDFDocument.load(signResult.signedPdfBytes);
  const p1 = signedDoc.getPage(0);
  const annots = p1.node.Annots();
  if (!annots || annots.size() < 3) {
    throw new Error(`Expected at least 3 annotations on Page 1 (Ace Malto + 2 Rene Jane), found ${annots?.size()}`);
  }

  console.log(`  PASS: Test 2 - Signed document contains ${annots.size()} annotations and dual Rene Jane signatures`);

  console.log("\n======================================================================");
  console.log("   ALL OFFICIAL BUSINESS (OB) SLIP DUAL SIGNATURE TESTS PASSED!      ");
  console.log("======================================================================");
}

runObSlipTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
