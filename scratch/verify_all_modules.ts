import fs from "fs";
import path from "path";
import { PDFDocument, PDFName, PDFArray, PDFDict, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import {
  checkVisualTypographyOnPage,
  appendSignatureIncremental,
  signPdfWithPdfLib,
} from "../server/services/pnpkiSigningService";
import { autoSignPdfWithReneJane } from "../src/utils/reneJaneAutoSign";

async function runAllVerifications() {
  console.log("===============================================================================");
  console.log("       COMPREHENSIVE END-TO-END VERIFICATION: DTR & COMBINE DTR MODULES         ");
  console.log("===============================================================================\n");

  let allPassed = true;

  // ── TEST 1: Check DTR_Malto-Nov(1-15).pdf (Employee signed, Supervisor unsigned) ──
  console.log("--- TEST 1: checkVisualTypographyOnPage on Single-Signed DTR ---");
  const p1 = "c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15).pdf";
  const b1 = fs.readFileSync(p1);
  const doc1 = await PDFDocument.load(b1);

  const empBox1 = { minX: 67, minY: 235, maxX: 252, maxY: 261 };
  const empBox2 = { minX: 361, minY: 235, maxX: 546, maxY: 261 };
  const supBox1 = { minX: 66, minY: 187, maxX: 261, maxY: 219 };
  const supBox2 = { minX: 371, minY: 187, maxX: 566, maxY: 219 };

  const res1_emp1 = checkVisualTypographyOnPage(doc1, 0, empBox1, "Malto");
  const res1_emp2 = checkVisualTypographyOnPage(doc1, 0, empBox2, "Malto");
  const res1_sup1 = checkVisualTypographyOnPage(doc1, 0, supBox1, "Buena");
  const res1_sup2 = checkVisualTypographyOnPage(doc1, 0, supBox2, "Buena");

  console.log("  Emp Copy 1 (expected true): ", res1_emp1.exists, res1_emp1.reason);
  console.log("  Emp Copy 2 (expected true): ", res1_emp2.exists, res1_emp2.reason);
  console.log("  Sup Copy 1 (expected false):", res1_sup1.exists, res1_sup1.reason);
  console.log("  Sup Copy 2 (expected false):", res1_sup2.exists, res1_sup2.reason);

  if (res1_emp1.exists && res1_emp2.exists && !res1_sup1.exists && !res1_sup2.exists) {
    console.log("  => TEST 1 PASSED: Correctly identified Employee present & Supervisor absent.\n");
  } else {
    console.error("  => TEST 1 FAILED!\n");
    allPassed = false;
  }

  // ── TEST 2: Check DTR_Malto-Nov(1-15) (1).pdf (Both signed) ──
  console.log("--- TEST 2: checkVisualTypographyOnPage on Fully-Signed DTR ---");
  const p2 = "c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15) (1).pdf";
  const b2 = fs.readFileSync(p2);
  const doc2 = await PDFDocument.load(b2);

  const res2_emp1 = checkVisualTypographyOnPage(doc2, 0, empBox1, "Malto");
  const res2_emp2 = checkVisualTypographyOnPage(doc2, 0, empBox2, "Malto");
  const res2_sup1 = checkVisualTypographyOnPage(doc2, 0, supBox1, "Buena");
  const res2_sup2 = checkVisualTypographyOnPage(doc2, 0, supBox2, "Buena");

  console.log("  Emp Copy 1 (expected true): ", res2_emp1.exists, res2_emp1.reason);
  console.log("  Emp Copy 2 (expected true): ", res2_emp2.exists, res2_emp2.reason);
  console.log("  Sup Copy 1 (expected true): ", res2_sup1.exists, res2_sup1.reason);
  console.log("  Sup Copy 2 (expected true): ", res2_sup2.exists, res2_sup2.reason);

  if (res2_emp1.exists && res2_emp2.exists && res2_sup1.exists && res2_sup2.exists) {
    console.log("  => TEST 2 PASSED: Correctly identified all 4 signatures present.\n");
  } else {
    console.error("  => TEST 2 FAILED!\n");
    allPassed = false;
  }

  // ── TEST 3: Incremental Supervisor Signing on DTR_Malto-Nov(1-15).pdf ──
  console.log("--- TEST 3: appendSignatureIncremental on Unsigned Supervisor Boxes ---");
  const signedIncrementalBuf = await appendSignatureIncremental(
    b1,
    "Buena Rene Jane Rosendo",
    [
      [66, 187, 195, 32],
      [372, 187, 195, 32],
    ],
    "Civil Service Form No. 48 Official Verification",
    "pnpki@dict.gov.ph",
    "Legazpi City, Philippines",
    "Supervisor_Signature_Copy1",
    0,
    { skipVisualText: false }
  );

  const docAfterInc = await PDFDocument.load(signedIncrementalBuf);
  const checkAfterInc1 = checkVisualTypographyOnPage(docAfterInc, 0, supBox1, "Buena");
  const checkAfterInc2 = checkVisualTypographyOnPage(docAfterInc, 0, supBox2, "Buena");

  console.log("  Signed Sup Copy 1 (expected true):", checkAfterInc1.exists, checkAfterInc1.reason);
  console.log("  Signed Sup Copy 2 (expected true):", checkAfterInc2.exists, checkAfterInc2.reason);

  // Inspect the generated /AP /N stream to verify it has typography
  const pdfStrInc = signedIncrementalBuf.toString("latin1");
  const apMatches = [...pdfStrInc.matchAll(/\/Subtype\s*\/Form[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/g)];
  const lastTwoApStreams = apMatches.slice(-2).map((m) => m[1]);
  const hasTextInAp = lastTwoApStreams.every((s) => s.includes("Digitally signed") && s.includes("Buena"));
  console.log("  AP streams contain rendered typography:", hasTextInAp);

  if (checkAfterInc1.exists && checkAfterInc2.exists && hasTextInAp) {
    console.log("  => TEST 3 PASSED: Supervisor signatures successfully rendered in AP streams.\n");
  } else {
    console.error("  => TEST 3 FAILED!\n");
    allPassed = false;
  }

  // ── TEST 4: Incremental Re-Signing on DTR_Malto-Nov(1-15) (1).pdf (Deduplication) ──
  console.log("--- TEST 4: appendSignatureIncremental Re-Signing Deduplication ---");
  const resignedBuf = await appendSignatureIncremental(
    b2,
    "Buena Rene Jane Rosendo",
    [
      [66, 187, 195, 32],
      [372, 187, 195, 32],
    ],
    "Civil Service Form No. 48 Official Verification",
    "pnpki@dict.gov.ph",
    "Legazpi City, Philippines",
    "Supervisor_Signature_Copy1",
    0
  );

  const resignedStr = resignedBuf.toString("latin1");
  const resignedApMatches = [...resignedStr.matchAll(/\/Subtype\s*\/Form[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/g)];
  const newApStreams = resignedApMatches.slice(-2).map((m) => m[1].trim());

  console.log("  New AP Stream 1:", JSON.stringify(newApStreams[0]));
  console.log("  New AP Stream 2:", JSON.stringify(newApStreams[1]));

  const streamsAreClean = newApStreams.every((s) => s === "q\nQ" || s === "q\r\nQ" || s === "q\nQ\n" || !s.includes("Tj"));
  console.log("  AP streams suppressed duplicate typography:", streamsAreClean);

  if (streamsAreClean) {
    console.log("  => TEST 4 PASSED: Zero duplicate typography in /AP /N streams on re-signing.\n");
  } else {
    console.error("  => TEST 4 FAILED: Duplicate typography found in appearance stream!\n");
    allPassed = false;
  }

  // ── TEST 5: Combine DTR autoSignPdfWithReneJane on DTR_Malto-Nov(1-15) (1).pdf ──
  console.log("--- TEST 5: Combine DTR autoSignPdfWithReneJane Bypass on Already-Signed PDF ---");
  const autoSignRes = await autoSignPdfWithReneJane(b2, "DTR_Malto-Nov(1-15) (1).pdf");
  console.log("  autoSign success:", autoSignRes.success);
  console.log("  detectedReason:  ", autoSignRes.detectedReason);
  console.log("  isAlreadySigned: ", autoSignRes.detectedReason.includes("Already Signed"));

  if (autoSignRes.success && autoSignRes.detectedReason.includes("Already Signed")) {
    console.log("  => TEST 5 PASSED: Combine DTR correctly bypassed already-signed document without re-rendering overlays.\n");
  } else {
    console.error("  => TEST 5 FAILED!\n");
    allPassed = false;
  }

  // ── FINAL SUMMARY ──
  console.log("===============================================================================");
  if (allPassed) {
    console.log("           ALL 5 COMPREHENSIVE VERIFICATION TESTS PASSED PERFECTLY!            ");
  } else {
    console.log("           SOME VERIFICATION TESTS FAILED! PLEASE REVIEW OUTPUT.              ");
  }
  console.log("===============================================================================");
}

runAllVerifications().catch((err) => {
  console.error("Verification execution error:", err);
  process.exit(1);
});
