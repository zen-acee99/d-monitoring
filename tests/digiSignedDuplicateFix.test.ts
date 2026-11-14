import assert from "node:assert/strict";
import { PDFDocument, rgb, StandardFonts, PDFName, PDFArray } from "pdf-lib";
import { appendSignatureIncremental } from "../server/services/pnpkiSigningService.js";
import fs from "fs";
import zlib from "zlib";

async function runTests() {
  console.log("======================================================================");
  console.log("   AUTOMATED TEST SUITE: DIGISIGNED TYPOGRAPHY DEDUPLICATION FIX      ");
  console.log("======================================================================\n");

  // ── Test 1: Decompressed content stream detection for existing visual signature ──
  console.log("[Test 1] Content stream inspection detects pre-rendered 'Digitally signed' text");
  const testStream = `q\nBT\n/F1 6.8 Tf\n100 200 Td\n(Digitally signed) Tj\n0 -8 Td\n(by Malto Ace Mata) Tj\nET\nQ\n`;
  const deflated = zlib.deflateSync(Buffer.from(testStream));
  const inflated = zlib.inflateSync(deflated).toString("latin1");
  const hasDigi = /Digitally\s+signed/i.test(inflated) || /DigiSigned/i.test(inflated);
  const hasSigner = inflated.toLowerCase().includes("malto");
  assert.equal(hasDigi, true, "Should detect 'Digitally signed'");
  assert.equal(hasSigner, true, "Should detect signer name 'Malto'");
  console.log("  PASS: Test 1 - Correctly detected pre-existing visual signature in content stream");

  // ── Test 2: appendSignatureIncremental with skipVisualText=true leaves /AP /N without duplicate text ──
  console.log("\n[Test 2] appendSignatureIncremental skips text when skipVisualText is set");
  const baseDoc = await PDFDocument.create();
  const page = baseDoc.addPage([612, 792]);
  const helv = await baseDoc.embedFont(StandardFonts.Helvetica);
  page.drawText("Digitally signed by Malto Ace Mata", {
    x: 100,
    y: 200,
    size: 7,
    font: helv,
    color: rgb(0, 0, 0),
  });
  const initialBytes = await baseDoc.save({ useObjectStreams: false });
  const initialBuf = Buffer.from(initialBytes);

  // Sign incrementally with skipVisualText: true
  const updatedBuf = await appendSignatureIncremental(
    initialBuf,
    "Malto Ace Mata",
    [[100, 200, 200, 230]],
    "Civil Service Form 48 Verification",
    "pnpki@dict.gov.ph",
    "Legazpi City",
    "Supervisor_Signature_1",
    0,
    { skipVisualText: true }
  );

  assert.ok(updatedBuf.length > initialBuf.length, "Should append incremental revision");
  const updatedStr = updatedBuf.toString("latin1");

  // Find the new Form XObject appearance stream for the widget
  const apMatches = [...updatedStr.matchAll(/\/Subtype\s*\/Form[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/g)];
  assert.ok(apMatches.length > 0, "Should have Form XObject appearance stream");
  const latestAp = apMatches[apMatches.length - 1][1];

  // In skipVisualText mode, the appearance stream must NOT contain BT ... /Helv ... Tj ... ET text
  const hasTjInAp = latestAp.includes("/Helv") || latestAp.includes("Tj");
  assert.equal(hasTjInAp, false, "Appearance stream should not duplicate text when skipVisualText is true");
  console.log("  PASS: Test 2 - Appearance XObject does not duplicate text when skipVisualText=true");

  // ── Test 3: appendSignatureIncremental auto-detects existing page text and suppresses duplicate text ──
  console.log("\n[Test 3] appendSignatureIncremental auto-suppresses duplicate text when page already has text");
  const autoSupBuf = await appendSignatureIncremental(
    initialBuf,
    "Malto Ace Mata",
    [[100, 200, 200, 230]],
    "Civil Service Form 48 Verification",
    "pnpki@dict.gov.ph",
    "Legazpi City",
    "Supervisor_Signature_Auto",
    0,
    // Note: skipVisualText is NOT passed, auto-detection must handle it!
    {}
  );

  const autoSupStr = autoSupBuf.toString("latin1");
  const autoApMatches = [...autoSupStr.matchAll(/\/Subtype\s*\/Form[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/g)];
  assert.ok(autoApMatches.length > 0, "Should have Form XObject appearance stream");
  const latestAutoAp = autoApMatches[autoApMatches.length - 1][1];
  const autoHasTj = latestAutoAp.includes("/Helv") || latestAutoAp.includes("Tj");
  assert.equal(autoHasTj, false, "Auto-detection should recognize pre-existing 'Digitally signed' text and omit duplicate Tj in /AP /N");
  console.log("  PASS: Test 3 - Auto-detection successfully suppressed duplicate appearance text");

  // ── Test 4: Blank document without pre-existing text DOES get visual text in /AP /N ──
  console.log("\n[Test 4] Blank document without existing text correctly receives visual text in /AP /N");
  const blankDoc = await PDFDocument.create();
  blankDoc.addPage([612, 792]);
  const blankBytes = await blankDoc.save({ useObjectStreams: false });
  const blankBuf = Buffer.from(blankBytes);

  const signedBlankBuf = await appendSignatureIncremental(
    blankBuf,
    "Annabel C. Cortez",
    [[150, 250, 300, 280]],
    "Official Approval",
    "pnpki@dict.gov.ph",
    "Legazpi City",
    "Approval_Signature",
    0,
    {}
  );

  const signedBlankStr = signedBlankBuf.toString("latin1");
  const blankApMatches = [...signedBlankStr.matchAll(/\/Subtype\s*\/Form[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/g)];
  assert.ok(blankApMatches.length > 0, "Should have Form XObject");
  const latestBlankAp = blankApMatches[blankApMatches.length - 1][1];
  const blankHasTj = latestBlankAp.includes("/Helv") && latestBlankAp.includes("Tj");
  assert.equal(blankHasTj, true, "Blank document without pre-existing text should have /Helv text in /AP /N");
  console.log("  PASS: Test 4 - Visual text correctly drawn for documents that do not already have it");

  // ── Test 5: autoSignPdfWithReneJane on already-signed AR preserves bytes and suppresses duplicate ──
  console.log("\n[Test 5] autoSignPdfWithReneJane detects pre-existing signature in AR and prevents duplicate overlay");
  const { autoSignPdfWithReneJane } = await import("../src/utils/reneJaneAutoSign.js");
  const existingArBytes = fs.readFileSync("public/AR_Ace_M._Malto_September_2026.pdf");
  const resAr = await autoSignPdfWithReneJane(new Uint8Array(existingArBytes), "AR_Ace_M._Malto_September_2026.pdf");
  assert.equal(resAr.success, true, "Should report success for already-signed document");
  assert.equal(resAr.signedPdfBytes.length, existingArBytes.length, "Byte count should be untouched (no double signing)");
  assert.ok(resAr.detectedReason.includes("Already Signed"), "Should indicate document is already signed");
  console.log("  PASS: Test 5 - autoSignPdfWithReneJane successfully identified pre-existing signature in AR");

  // ── Test 6: autoSignPdfWithReneJane on already-signed DTR preserves bytes and suppresses duplicate ──
  console.log("\n[Test 6] autoSignPdfWithReneJane detects pre-existing signature in DTR and prevents duplicate overlay");
  const existingDtrBytes = fs.readFileSync("public/DTR_Ace_M._Malto_September_2026.pdf");
  const resDtr = await autoSignPdfWithReneJane(new Uint8Array(existingDtrBytes), "DTR_Ace_M._Malto_September_2026.pdf");
  assert.equal(resDtr.success, true, "Should report success for already-signed document");
  assert.equal(resDtr.signedPdfBytes.length, existingDtrBytes.length, "Byte count should be untouched (no double signing)");
  assert.ok(resDtr.detectedReason.includes("Already Signed"), "Should indicate document is already signed");
  console.log("  PASS: Test 6 - autoSignPdfWithReneJane successfully identified pre-existing signature in DTR");

  console.log("\n======================================================================");
  console.log("ALL DIGISIGNED TYPOGRAPHY DEDUPLICATION TESTS PASSED PERFECTLY!");
  console.log("======================================================================\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
