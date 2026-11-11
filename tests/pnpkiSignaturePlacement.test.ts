import fs from "fs";
import path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { findPersonnelSignatureCoordinates, findApprovalSectionCoordinates } from "../src/utils/dtrVectorPdf.js";
import { signPdfBuffer, normalizeSignatureBoundingBox } from "../server/services/pnpkiSigningService.js";

interface TestReport {
  name: string;
  passed: boolean;
  details: string;
}

const reports: TestReport[] = [];

function assert(condition: boolean, testName: string, detail: string) {
  if (!condition) {
    console.error(`  FAIL: ${testName} - ${detail}`);
    reports.push({ name: testName, passed: false, details: detail });
    throw new Error(`Test failed: ${testName} - ${detail}`);
  } else {
    console.log(`  PASS: ${testName} - ${detail}`);
    reports.push({ name: testName, passed: true, details: detail });
  }
}

async function createTestPdfWithText(
  width: number,
  height: number,
  textPlacements: Array<{ text: string; x: number; y: number; size?: number }>
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([width, height]);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const item of textPlacements) {
    page.drawText(item.text, {
      x: item.x,
      y: item.y,
      size: item.size || 10,
      font,
      color: rgb(0, 0, 0),
    });
  }

  return await doc.save({ useObjectStreams: false });
}

async function runTestSuite() {
  console.log("======================================================================");
  console.log("   AUTOMATED TEST SUITE: PNPKI P12 & DIGISIGNED PLACEMENT TESTS       ");
  console.log("======================================================================\n");

  // ─────────────────────────────────────────────────────────────────
  // TEST 1: LEFT COLUMN PLACEMENT (Bottom-Left)
  // ─────────────────────────────────────────────────────────────────
  console.log("[Test 1] Left Column Placement (Signatory on Bottom-Left)");
  {
    const targetName = "JUAN P. DELA CRUZ";
    const nameX = 60;
    const nameY = 100;
    const pdfBytes = await createTestPdfWithText(612, 792, [
      { text: "MEMORANDUM CIRCULAR NO. 2026-01", x: 60, y: 720, size: 12 },
      { text: "Prepared by:", x: 60, y: 125, size: 9 },
      { text: targetName, x: nameX, y: nameY, size: 10 },
      { text: "Administrative Officer IV", x: 60, y: 88, size: 8 },
    ]);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, targetName);

    assert(loc.appliedPosition === "above", "Test 1.1", `appliedPosition must be "above", got "${loc.appliedPosition}"`);
    assert(loc.boxY === Math.round(nameY + 13), "Test 1.2", `boxY must be nameY + 13 (${Math.round(nameY + 13)}), got ${loc.boxY}`);
    assert(Math.abs(loc.boxX - nameX) < 35, "Test 1.3", `boxX (${loc.boxX}) must be centered above name`);
    assert(loc.boxH === 28, "Test 1.4", `boxH must be 28pt (+5px corner padding), got ${loc.boxH}`);
    assert(loc.boxW >= 125, "Test 1.5", `boxW must be >= 125pt, got ${loc.boxW}`);
    const visualGap = (loc.boxY - nameY);
    assert(visualGap >= 12.0 && visualGap <= 14.5, "Test 1.6", `Visual gap between name baseline and box bottom is ~13pt (>= 5px gap from top of letters), got ${visualGap.toFixed(1)}pt`);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 2: CENTER COLUMN PLACEMENT (Middle horizontal)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n[Test 2] Center Column Placement (Signatory Centered)");
  {
    const targetName = "MARIA L. SANTOS";
    const nameX = 240;
    const nameY = 110;
    const pdfBytes = await createTestPdfWithText(612, 792, [
      { text: "DISBURSEMENT VOUCHER", x: 220, y: 720, size: 12 },
      { text: "Certified by:", x: 240, y: 135, size: 9 },
      { text: targetName, x: nameX, y: nameY, size: 10 },
      { text: "Accountant III", x: 240, y: 98, size: 8 },
    ]);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, targetName);

    assert(loc.appliedPosition === "above", "Test 2.1", `appliedPosition must be "above", got "${loc.appliedPosition}"`);
    assert(loc.boxY === Math.round(nameY + 13), "Test 2.2", `boxY must be nameY + 13 (${Math.round(nameY + 13)}), got ${loc.boxY}`);
    assert(Math.abs(loc.boxX - nameX) < 35, "Test 2.3", `boxX (${loc.boxX}) must be centered directly above name (${nameX})`);
    assert(loc.boxH === 28, "Test 2.4", `boxH must be 28pt, got ${loc.boxH}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 3: RIGHT COLUMN PLACEMENT (Bottom-Right Approval)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n[Test 3] Right Column Placement (Signatory on Bottom-Right)");
  {
    const targetName = "RENE JANE R. BUENA";
    const nameX = 420;
    const nameY = 95;
    const pdfBytes = await createTestPdfWithText(612, 792, [
      { text: "ACCOMPLISHMENT REPORT", x: 200, y: 720, size: 12 },
      { text: "APPROVED BY:", x: 420, y: 125, size: 9 },
      { text: targetName, x: nameX, y: nameY, size: 10 },
      { text: "Provincial Officer", x: 420, y: 83, size: 8 },
    ]);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, targetName);

    assert(loc.appliedPosition === "above", "Test 3.1", `appliedPosition must be "above", got "${loc.appliedPosition}"`);
    assert(loc.boxY === Math.round(nameY + 13), "Test 3.2", `boxY must be nameY + 13 (${Math.round(nameY + 13)}), got ${loc.boxY}`);
    assert(loc.boxX + loc.boxW <= 612 - 10, "Test 3.3", `boxX (${loc.boxX}) + boxW (${loc.boxW}) must NOT exceed page width (612 - 10)`);
    assert(loc.boxH === 28, "Test 3.4", `boxH must be 28pt, got ${loc.boxH}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 4: DUAL-COPY DTR (Civil Service Form 48 side-by-side copies)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n[Test 4] Dual-Copy DTR (Side-by-side Copy 1 & Copy 2)");
  {
    const targetName = "JUAN P. DELA CRUZ";
    const copy1X = 85;
    const copy2X = 385;
    const dtrY = 115;
    const pdfBytes = await createTestPdfWithText(612, 792, [
      { text: "CIVIL SERVICE FORM NO. 48", x: 75, y: 740, size: 8 },
      { text: "CIVIL SERVICE FORM NO. 48", x: 375, y: 740, size: 8 },
      { text: targetName, x: copy1X, y: dtrY, size: 9 },
      { text: targetName, x: copy2X, y: dtrY, size: 9 },
      { text: "In Charge", x: copy1X, y: 65, size: 8 },
      { text: "In Charge", x: copy2X, y: 65, size: 8 },
    ]);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, targetName);

    assert(loc.appliedPosition === "above", "Test 4.1", `appliedPosition must be "above"`);
    assert(Array.isArray(loc.sigRects) && loc.sigRects.length === 2, "Test 4.2", `sigRects must contain exactly 2 distinct copy rectangles, got ${loc.sigRects?.length}`);
    const rect1 = loc.sigRects![0];
    const rect2 = loc.sigRects![1];

    assert(rect1[1] === Math.round(dtrY + 13), "Test 4.3", `Copy 1 minY must be exactly dtrY + 13 (${Math.round(dtrY + 13)}), got ${rect1[1]}`);
    assert(rect2[1] === Math.round(dtrY + 13), "Test 4.4", `Copy 2 minY must be exactly dtrY + 13 (${Math.round(dtrY + 13)}), got ${rect2[1]}`);
    assert(Math.abs(rect1[0] - copy1X) < 25, "Test 4.5", `Copy 1 minX (${rect1[0]}) must be directly above Copy 1 name (${copy1X})`);
    assert(Math.abs(rect2[0] - copy2X) < 25, "Test 4.6", `Copy 2 minX (${rect2[0]}) must be directly above Copy 2 name (${copy2X})`);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 5: LANDSCAPE MULTI-COLUMN SHEET (e.g. RAOD 4 Columns)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n[Test 5] Landscape Multi-Column Sheet (RAOD Columns 1, 2, 3, 4)");
  {
    const landscapeW = 842;
    const landscapeH = 595;
    const rowY = 140;
    const signatories = [
      { name: "DANREV A. BALANA", colX: 45 },
      { name: "CARLA MAE R. CABREDO", colX: 245 },
      { name: "LEAH B. DY", colX: 445 },
      { name: "ANNABEL C. ODONO-CALIMPONG", colX: 645 },
    ];

    const pdfBytes = await createTestPdfWithText(
      landscapeW,
      landscapeH,
      signatories.flatMap((s) => [
        { text: s.name, x: s.colX, y: rowY, size: 9 },
        { text: "Signatory Title", x: s.colX, y: rowY - 12, size: 8 },
      ])
    );

    const pdfDoc = await PDFDocument.load(pdfBytes);

    for (let i = 0; i < signatories.length; i++) {
      const s = signatories[i];
      const loc = findPersonnelSignatureCoordinates(pdfDoc, s.name);
      assert(loc.appliedPosition === "above", `Test 5.${i + 1}a`, `Column ${i + 1} (${s.name}) appliedPosition must be "above"`);
      assert(loc.boxY === Math.round(rowY + 13), `Test 5.${i + 1}b`, `Column ${i + 1} boxY must be rowY + 13 (${Math.round(rowY + 13)}), got ${loc.boxY}`);
      assert(Math.abs(loc.boxX - s.colX) <= 45, `Test 5.${i + 1}c`, `Column ${i + 1} boxX (${loc.boxX}) must be directly above column name (${s.colX})`);
      assert(loc.boxX + loc.boxW <= landscapeW - 8, `Test 5.${i + 1}d`, `Column ${i + 1} boxX + boxW (${loc.boxX + loc.boxW}) must NOT exceed landscape width`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 6: VARYING VERTICAL HEIGHTS (Top, Middle, Bottom)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n[Test 6] Varying Vertical Heights (Top, Middle, Bottom)");
  {
    const heights = [
      { label: "Top Endorsement", y: 640 },
      { label: "Middle Routing Section", y: 380 },
      { label: "Bottom Signature Block", y: 75 },
    ];

    for (let i = 0; i < heights.length; i++) {
      const h = heights[i];
      const targetName = "ACE S. MALTO";
      const nameX = 310;
      const pdfBytes = await createTestPdfWithText(612, 792, [
        { text: h.label, x: nameX, y: h.y + 20, size: 9 },
        { text: targetName, x: nameX, y: h.y, size: 10 },
      ]);

      const pdfDoc = await PDFDocument.load(pdfBytes);
      const loc = findPersonnelSignatureCoordinates(pdfDoc, targetName);

      assert(loc.appliedPosition === "above", `Test 6.${i + 1}a`, `${h.label}: appliedPosition must be "above"`);
      assert(loc.boxY === Math.round(h.y + 13), `Test 6.${i + 1}b`, `${h.label}: boxY must be exactly h.y + 13 (${Math.round(h.y + 13)}), got ${loc.boxY}`);
      assert(Math.abs(loc.boxX - nameX) < 35, `Test 6.${i + 1}c`, `${h.label}: boxX (${loc.boxX}) directly above nameX (${nameX})`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 7: COUNTER-SIGNING STAMP ("DigiSigned") PLACED STRICTLY ABOVE
  // ─────────────────────────────────────────────────────────────────
  console.log("\n[Test 7] Counter-Signing (isCounterSign = true) Placement Strictly Above");
  {
    const targetName = "ROBERTO K. MENDOZA";
    const nameX = 180;
    const nameY = 130;
    const pdfBytes = await createTestPdfWithText(612, 792, [
      { text: "INSPECTION AND ACCEPTANCE REPORT", x: 180, y: 700, size: 12 },
      { text: targetName, x: nameX, y: nameY, size: 10 },
    ]);

    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Primary counter-signer (csIndex = 0)
    const locCs0 = findPersonnelSignatureCoordinates(pdfDoc, targetName, {
      isCounterSign: true,
      counterSignIndex: 0,
    });
    assert(locCs0.appliedPosition === "above", "Test 7.1", `Counter-sign 1 must be placed "above", got "${locCs0.appliedPosition}"`);
    assert(locCs0.boxY === Math.round(nameY + 13), "Test 7.2", `Counter-sign 1 boxY must be exactly nameY + 13 (${Math.round(nameY + 13)}), got ${locCs0.boxY}`);
    assert(locCs0.boxH === 28, "Test 7.3", `Counter-sign 1 boxH must be 28pt, got ${locCs0.boxH}`);
    assert(locCs0.boxW >= 125, "Test 7.4", `Counter-sign 1 boxW must be >= 125pt, got ${locCs0.boxW}`);

    // Subsequent stacked counter-signer (csIndex = 1)
    const locCs1 = findPersonnelSignatureCoordinates(pdfDoc, targetName, {
      isCounterSign: true,
      counterSignIndex: 1,
    });
    assert(locCs1.appliedPosition === "above", "Test 7.5", `Counter-sign 2 must be placed "above"`);
    assert(locCs1.boxY === Math.round(nameY + 13) + (28 + 6), "Test 7.6", `Counter-sign 2 boxY must be stacked above Counter-sign 1 (${Math.round(nameY + 13) + 34}), got ${locCs1.boxY}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 5: LANDSCAPE MULTI-COLUMN SHEET (e.g. RAOD 4 Columns)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n[Test 5] Landscape Multi-Column Sheet (RAOD Columns 1, 2, 3, 4)");
  {
    const landscapeW = 842;
    const landscapeH = 595;
    const rowY = 140;
    const signatories = [
      { name: "DANREV A. BALANA", colX: 45 },
      { name: "CARLA MAE R. CABREDO", colX: 245 },
      { name: "LEAH B. DY", colX: 445 },
      { name: "ANNABEL C. ODONO-CALIMPONG", colX: 645 },
    ];

    const pdfBytes = await createTestPdfWithText(
      landscapeW,
      landscapeH,
      signatories.flatMap((s) => [
        { text: s.name, x: s.colX, y: rowY, size: 9 },
        { text: "Signatory Title", x: s.colX, y: rowY - 12, size: 8 },
      ])
    );

    const pdfDoc = await PDFDocument.load(pdfBytes);

    for (let i = 0; i < signatories.length; i++) {
      const s = signatories[i];
      const loc = findPersonnelSignatureCoordinates(pdfDoc, s.name);
      assert(loc.appliedPosition === "above", `Test 5.${i + 1}a`, `Column ${i + 1} (${s.name}) appliedPosition must be "above"`);
      assert(loc.boxY === Math.round(rowY + 13), `Test 5.${i + 1}b`, `Column ${i + 1} boxY must be rowY + 13 (${Math.round(rowY + 13)}), got ${loc.boxY}`);
      assert(Math.abs(loc.boxX - s.colX) <= 45, `Test 5.${i + 1}c`, `Column ${i + 1} boxX (${loc.boxX}) must be directly above column name (${s.colX})`);
      assert(loc.boxX + loc.boxW <= landscapeW - 8, `Test 5.${i + 1}d`, `Column ${i + 1} boxX + boxW (${loc.boxX + loc.boxW}) must NOT exceed landscape width`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 6: VARYING VERTICAL HEIGHTS (Top, Middle, Bottom)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n[Test 6] Varying Vertical Heights (Top, Middle, Bottom)");
  {
    const heights = [
      { label: "Top Endorsement", y: 640 },
      { label: "Middle Routing Section", y: 380 },
      { label: "Bottom Signature Block", y: 75 },
    ];

    for (let i = 0; i < heights.length; i++) {
      const h = heights[i];
      const targetName = "ACE S. MALTO";
      const nameX = 310;
      const pdfBytes = await createTestPdfWithText(612, 792, [
        { text: h.label, x: nameX, y: h.y + 20, size: 9 },
        { text: targetName, x: nameX, y: h.y, size: 10 },
      ]);

      const pdfDoc = await PDFDocument.load(pdfBytes);
      const loc = findPersonnelSignatureCoordinates(pdfDoc, targetName);

      assert(loc.appliedPosition === "above", `Test 6.${i + 1}a`, `${h.label}: appliedPosition must be "above"`);
      assert(loc.boxY === Math.round(h.y + 13), `Test 6.${i + 1}b`, `${h.label}: boxY must be exactly h.y + 13 (${Math.round(h.y + 13)}), got ${loc.boxY}`);
      assert(Math.abs(loc.boxX - nameX) < 35, `Test 6.${i + 1}c`, `${h.label}: boxX (${loc.boxX}) directly above nameX (${nameX})`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 7: COUNTER-SIGNING STAMP ("DigiSigned") PLACED STRICTLY ABOVE
  // ─────────────────────────────────────────────────────────────────
  console.log("\n[Test 7] Counter-Signing (isCounterSign = true) Placement Strictly Above");
  {
    const targetName = "ROBERTO K. MENDOZA";
    const nameX = 180;
    const nameY = 130;
    const pdfBytes = await createTestPdfWithText(612, 792, [
      { text: "INSPECTION AND ACCEPTANCE REPORT", x: 180, y: 700, size: 12 },
      { text: targetName, x: nameX, y: nameY, size: 10 },
    ]);

    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Primary counter-signer (csIndex = 0)
    const locCs0 = findPersonnelSignatureCoordinates(pdfDoc, targetName, {
      isCounterSign: true,
      counterSignIndex: 0,
    });
    assert(locCs0.appliedPosition === "above", "Test 7.1", `Counter-sign 1 must be placed "above", got "${locCs0.appliedPosition}"`);
    assert(locCs0.boxY === Math.round(nameY + 13), "Test 7.2", `Counter-sign 1 boxY must be exactly nameY + 13 (${Math.round(nameY + 13)}), got ${locCs0.boxY}`);
    assert(locCs0.boxH === 28, "Test 7.3", `Counter-sign 1 boxH must be 28pt, got ${locCs0.boxH}`);
    assert(locCs0.boxW >= 125, "Test 7.4", `Counter-sign 1 boxW must be >= 125pt, got ${locCs0.boxW}`);

    // Subsequent stacked counter-signer (csIndex = 1)
    const locCs1 = findPersonnelSignatureCoordinates(pdfDoc, targetName, {
      isCounterSign: true,
      counterSignIndex: 1,
    });
    assert(locCs1.appliedPosition === "above", "Test 7.5", `Counter-sign 2 must be placed "above"`);
    assert(locCs1.boxY === Math.round(nameY + 13) + (28 + 6), "Test 7.6", `Counter-sign 2 boxY must be stacked above Counter-sign 1 (${Math.round(nameY + 13) + 34}), got ${locCs1.boxY}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 8: END-TO-END CRYPTOGRAPHIC PNPKI P12 SIGNING WIDGET POSITION
  // ─────────────────────────────────────────────────────────────────
  console.log("\n[Test 8] End-to-End Cryptographic PNPKI .p12 Signing Verification");
  {
    const p12Path = path.resolve("scratch/rene_jane.p12");
    if (!fs.existsSync(p12Path)) {
      console.warn("  Skipping Test 8: scratch/rene_jane.p12 not found.");
    } else {
      const p12Buf = fs.readFileSync(p12Path);
      const p12Base64 = p12Buf.toString("base64");
      const targetName = "RENE JANE R. BUENA";
      const nameX = 350;
      const nameY = 120;

      const pdfBytes = await createTestPdfWithText(612, 792, [
        { text: "OFFICIAL DICT TRANSMITTAL", x: 60, y: 720, size: 12 },
        { text: "APPROVED:", x: nameX, y: nameY + 30, size: 9 },
        { text: targetName, x: nameX, y: nameY, size: 10 },
        { text: "Provincial Officer", x: nameX, y: nameY - 12, size: 8 },
      ]);

      const pdfDoc = await PDFDocument.load(pdfBytes);
      const loc = findPersonnelSignatureCoordinates(pdfDoc, targetName, { isCounterSign: true });

      // Pass 1: Sign with P12 (DigiSigned counter-sign mode)
      const signRes = await signPdfBuffer(
        Buffer.from(pdfBytes),
        p12Base64,
        "1234567890Aa!",
        {
          signerName: targetName,
          sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
          sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
          reason: "Official Digital Certification",
          isCounterSign: true,
        }
      );

      assert(signRes.signedBuffer.length > pdfBytes.length, "Test 8.1", `Signed PDF size (${signRes.signedBuffer.length}) must exceed unsigned PDF size (${pdfBytes.length})`);

      const signedDoc = await PDFDocument.load(signRes.signedBuffer);
      assert(signedDoc.getPageCount() === 1, "Test 8.2", "Signed PDF page count must be 1");
      const signedStr = signRes.signedBuffer.toString("latin1");

      assert(signedStr.includes("/ByteRange"), "Test 8.3", "Signed PDF must contain cryptographic /ByteRange");
      assert(signedStr.includes("/SubFilter /adbe.pkcs7.detached"), "Test 8.4", "Signed PDF must contain PKCS#7 detached signature");

      // Verify that widget annotation Rect matches loc coordinates strictly above name
      const rectRegex = new RegExp(`/Rect\\s*\\[\\s*${loc.boxX}\\s+${loc.boxY}\\s+(${loc.boxX + loc.boxW})\\s+(${loc.boxY + loc.boxH})\\s*\\]`);
      assert(rectRegex.test(signedStr), "Test 8.4", `Signed PDF widget /Rect must be [${loc.boxX} ${loc.boxY} ${loc.boxX + loc.boxW} ${loc.boxY + loc.boxH}] strictly above name`);

      // Verify Appearance XObject contains DigiSigned typography
      assert(signedStr.includes("(DigiSigned)") || signedStr.includes("DigiSigned"), "Test 8.5", "Appearance stream must contain DigiSigned typography");
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 9: RECT FORMAT ROBUSTNESS NEAR PAGE BOTTOM (y < h boundary test)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n[Test 9] Rect Format Robustness Near Bottom Page Edge (y < h boundary)");
  {
    // Case 1: [x, y, w, h] where y=15, h=28, w=125, x=100
    const box1 = normalizeSignatureBoundingBox([100, 15, 125, 28]);
    assert(box1.minX === 100, "Test 9.1a", `minX must be 100, got ${box1.minX}`);
    assert(box1.minY === 15, "Test 9.1b", `minY must be 15, got ${box1.minY}`);
    assert(box1.maxX === 225, "Test 9.1c", `maxX must be 225, got ${box1.maxX}`);
    assert(box1.maxY === 43, "Test 9.1d", `maxY must be 43, got ${box1.maxY}`);
    assert(box1.bboxH === 28, "Test 9.1e", `bboxH must be exactly 28, got ${box1.bboxH}`);
    assert(box1.bboxW === 125, "Test 9.1f", `bboxW must be exactly 125, got ${box1.bboxW}`);

    // Case 2: [x1, y1, x2, y2] format near bottom edge
    const box2 = normalizeSignatureBoundingBox([100, 15, 225, 43]);
    assert(box2.minX === 100, "Test 9.2a", `minX must be 100, got ${box2.minX}`);
    assert(box2.minY === 15, "Test 9.2b", `minY must be 15, got ${box2.minY}`);
    assert(box2.maxX === 225, "Test 9.2c", `maxX must be 225, got ${box2.maxX}`);
    assert(box2.maxY === 43, "Test 9.2d", `maxY must be 43, got ${box2.maxY}`);
    assert(box2.bboxH === 28, "Test 9.2e", `bboxH must be exactly 28, got ${box2.bboxH}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 10: APPROVAL SECTION COORDINATES ACROSS ALL COLUMNS (Left, Center, Right)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n[Test 10] Approval Section Coordinates Across All Columns (Left, Center, Right)");
  {
    // Test 10.1: Left Column "Approved by:" (x < width * 0.35)
    const leftPdf = await createTestPdfWithText(612, 792, [
      { text: "Approved by:", x: 50, y: 120, size: 9 },
      { text: "RENE JANE R. BUENA", x: 50, y: 90, size: 10 },
      { text: "Provincial Officer", x: 50, y: 75, size: 8 },
    ]);
    const leftDoc = await PDFDocument.load(leftPdf);
    const leftLoc = findApprovalSectionCoordinates(leftDoc, "RENE JANE R. BUENA");
    assert(leftLoc.boxX < 200, "Test 10.1a", `Left column approval boxX (${leftLoc.boxX}) must be in the left region (< 200)`);
    assert(leftLoc.boxY >= 70 && leftLoc.boxY <= 110, "Test 10.1b", `Left column approval boxY (${leftLoc.boxY}) must be directly above supervisor name`);

    // Test 10.2: Center Column "Approved by:"
    const centerPdf = await createTestPdfWithText(612, 792, [
      { text: "Approved by:", x: 230, y: 120, size: 9 },
      { text: "RENE JANE R. BUENA", x: 230, y: 90, size: 10 },
      { text: "Provincial Officer", x: 230, y: 75, size: 8 },
    ]);
    const centerDoc = await PDFDocument.load(centerPdf);
    const centerLoc = findApprovalSectionCoordinates(centerDoc, "RENE JANE R. BUENA");
    assert(centerLoc.boxX >= 200 && centerLoc.boxX <= 260, "Test 10.2a", `Center column approval boxX (${centerLoc.boxX}) must be centered`);

    // Test 10.3: Left Column "PROVINCIAL OFFICER" title without explicit name
    const titlePdf = await createTestPdfWithText(612, 792, [
      { text: "PROVINCIAL OFFICER", x: 60, y: 80, size: 8 },
    ]);
    const titleDoc = await PDFDocument.load(titlePdf);
    const titleLoc = findApprovalSectionCoordinates(titleDoc, "UNKNOWN");
    assert(titleLoc.boxX >= 15 && titleLoc.boxX <= 80, "Test 10.3", `Left column title approval boxX (${titleLoc.boxX}) must match left title position`);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 11: FIRST-SIGNATURE MODE CRYPTOGRAPHIC SIGNING WITH APPEARANCE STREAM
  // ─────────────────────────────────────────────────────────────────
  console.log("\n[Test 11] First-Signature Mode Cryptographic P12 Signing Appearance Stream");
  {
    const p12Path = path.resolve("scratch/rene_jane.p12");
    if (!fs.existsSync(p12Path)) {
      console.warn("  Skipping Test 11: scratch/rene_jane.p12 not found.");
    } else {
      const p12Buf = fs.readFileSync(p12Path);
      const p12Base64 = p12Buf.toString("base64");
      const targetName = "BUENA RENE JANE ROSENDO";
      const nameX = 220;
      const nameY = 100;

      const pdfBytes = await createTestPdfWithText(612, 792, [
        { text: "DOCUMENT TRANSMISSION SLIP", x: 60, y: 720, size: 12 },
        { text: targetName, x: nameX, y: nameY, size: 10 },
      ]);

      // Sign in First-Signature Mode (isCounter = false, document has no prior signatures)
      const signRes = await signPdfBuffer(
        Buffer.from(pdfBytes),
        p12Base64,
        "1234567890Aa!",
        {
          signerName: targetName,
          sigRect: [nameX - 2, nameY + 2, 125, 28],
          sigRects: [[nameX - 2, nameY + 2, nameX - 2 + 125, nameY + 2 + 28]],
          reason: "Civil Service Form No. 48 Official Verification",
          isCounterSign: false,
        }
      );

      assert(signRes.signedBuffer.length > pdfBytes.length, "Test 11.1", "Signed PDF size must exceed unsigned size");
      const signedStr = signRes.signedBuffer.toString("latin1");
      assert(signedStr.includes("/ByteRange"), "Test 11.2", "Must contain /ByteRange");
      assert(signedStr.includes("/SubFilter /adbe.pkcs7.detached"), "Test 11.3", "Must contain detached signature");
      assert(signedStr.includes("(Digitally signed"), "Test 11.4", "Appearance stream must contain Digitally signed typography");
      assert(signedStr.includes("Buena Rene Jane Rosendo"), "Test 11.5", "Appearance stream must contain Signer Name typography");

      // Verify widget rect placed strictly directly above name
      const rectRegex = new RegExp(`/Rect\\s*\\[\\s*${nameX - 2}\\s+${nameY + 2}\\s+(${nameX - 2 + 125})\\s+(${nameY + 2 + 28})\\s*\\]`);
      assert(rectRegex.test(signedStr), "Test 11.6", `Widget /Rect must be strictly [${nameX - 2} ${nameY + 2} ${nameX - 2 + 125} ${nameY + 2 + 28}] above name`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 12: MIDDLE-OF-DOCUMENT & SCALED TM SIGNATURE PLACEMENT (OTAF / AR)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n[Test 12] Middle-of-Document & Scaled Tm Signature Placement (OTAF / AR)");
  {
    const masaretaPath = path.resolve("scratch/masareta_from_db.pdf");
    if (fs.existsSync(masaretaPath)) {
      const masaretaBytes = fs.readFileSync(masaretaPath);
      const mDoc = await PDFDocument.load(masaretaBytes);
      const targetName = "ANNABEL C. ODOÑO-CALIMPONG";
      const loc = findPersonnelSignatureCoordinates(mDoc, targetName);

      assert(loc.appliedPosition === "above", "Test 12.1", `appliedPosition must be "above", got "${loc.appliedPosition}"`);
      // Visual baseline of Annabel is ~358.42; boxY must be strictly above baseline and clear of OIC-Regional Director (343.13)
      assert(loc.boxY >= 358, "Test 12.2", `boxY (${loc.boxY}) must be >= 358 (strictly above name baseline, never on designation at 343)`);
      assert(loc.boxY <= 380, "Test 12.3", `boxY (${loc.boxY}) must be <= 380 (snug visual placement directly above name, not floating)`);
      assert(loc.boxX >= 180 && loc.boxX <= 260, "Test 12.4", `boxX (${loc.boxX}) must be centered horizontally over the signatory name`);
      assert(loc.boxH === 28, "Test 12.5", `boxH must be 28pt (+5px padding), got ${loc.boxH}`);
      assert(loc.sigRects && loc.sigRects.length > 0, "Test 12.6", "Must produce valid sigRects");
      const r = loc.sigRects![0];
      assert(r[1] >= 358 && r[3] <= 408, "Test 12.7", `Signature rect [${r.join(", ")}] must sit cleanly above name and below header`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 13: MULTI-COLUMN FORM WITH TABLE LABELS (Strict Personnel Anchor)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n[Test 13] Multi-Column Form with Table Labels (Strict Personnel Anchor)");
  {
    // Reproducing exact layout from user screenshot media_1794374637435_fe4e4b01.png:
    // Left column: "Signature", "Printed Name", "Position", "Date"
    // Right column: target personnel name "ANNABEL C. ODOÑO-CALIMPONG"
    const targetName = "ANNABEL C. ODOÑO-CALIMPONG";
    const labelX = 60;
    const nameX = 260;
    const rowY = 120;
    const pdfBytes = await createTestPdfWithText(612, 792, [
      { text: "Signature", x: labelX, y: rowY + 35, size: 9 },
      { text: "Printed Name", x: labelX, y: rowY, size: 9 },
      { text: targetName, x: nameX, y: rowY, size: 10 },
      { text: "Position", x: labelX, y: rowY - 20, size: 9 },
      { text: "OIC-Regional Director, Regional Office No. V", x: nameX, y: rowY - 20, size: 8 },
      { text: "Date", x: labelX, y: rowY - 40, size: 9 },
    ]);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, targetName);

    assert(loc.appliedPosition === "above", "Test 13.1", `appliedPosition must be "above", got "${loc.appliedPosition}"`);
    assert(loc.boxY === Math.round(rowY + 13), "Test 13.2", `boxY must be rowY + 13 (${Math.round(rowY + 13)}), got ${loc.boxY}`);
    assert(loc.boxH === 28, "Test 13.3", `boxH must be 28pt, got ${loc.boxH}`);
    assert(loc.boxW >= 125, "Test 13.4", `boxW must be >= 125pt, got ${loc.boxW}`);
    // MOST CRITICAL ASSERTION: The signature MUST be placed directly over Column 2 (nameX = 260),
    // and NEVER over the label in Column 1 (labelX = 60)!
    assert(loc.boxX >= 210, "Test 13.5", `boxX (${loc.boxX}) MUST be centered over Column 2 personnel name (>= 210), never in label column 1 (~60)`);
    assert(loc.boxX <= 310, "Test 13.6", `boxX (${loc.boxX}) must be centered directly above "${targetName}"`);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 14: Side-by-Side Dual Personnel Table (AIVAN M. BALOLOY on Left vs ANNABEL C. ODOÑO-CALIMPONG on Right)
  // Replicating media_1794380078101_c30e299d.png
  // ─────────────────────────────────────────────────────────────────
  console.log("\n[Test 14] Side-by-Side Dual Personnel Table (Aivan Baloloy Left vs Annabel Odoño-Calimpong Right)");
  {
    const rowY = 120;
    // Left Box
    const leftLabelX = 40;
    const aivanX = 200;
    // Right Box
    const rightLabelX = 340;
    const annabelX = 480;

    const pdfBytes = await createTestPdfWithText(612, 792, [
      // Left Box (Accountant)
      { text: "Signature", x: leftLabelX, y: rowY + 35, size: 9 },
      { text: "Printed Name", x: leftLabelX, y: rowY, size: 9 },
      { text: "AIVAN M. BALOLOY", x: aivanX, y: rowY, size: 10 },
      { text: "Position", x: leftLabelX, y: rowY - 20, size: 9 },
      { text: "Accountant III / Agency Chief Accountant", x: aivanX, y: rowY - 20, size: 8 },

      // Right Box (Regional Director)
      { text: "Signature", x: rightLabelX, y: rowY + 35, size: 9 },
      { text: "Printed Name", x: rightLabelX, y: rowY, size: 9 },
      { text: "ANNABEL C. ODOÑO-CALIMPONG", x: annabelX, y: rowY, size: 10 },
      { text: "Position", x: rightLabelX, y: rowY - 20, size: 9 },
      { text: "OIC-Regional Director, Regional Office No. V", x: annabelX, y: rowY - 20, size: 8 },
    ]);

    const pdfDoc = await PDFDocument.load(pdfBytes);

    // 1. Target: ANNABEL C. ODOÑO-CALIMPONG (MUST BE ON THE RIGHT BOX)
    const locAnnabel = findPersonnelSignatureCoordinates(pdfDoc, "ANNABEL C. ODOÑO-CALIMPONG");
    assert(locAnnabel.appliedPosition === "above", "Test 14.1a", `Annabel appliedPosition must be "above", got "${locAnnabel.appliedPosition}"`);
    assert(locAnnabel.boxY === Math.round(rowY + 13), "Test 14.1b", `Annabel boxY must be rowY + 13 (${Math.round(rowY + 13)}), got ${locAnnabel.boxY}`);
    assert(locAnnabel.boxH === 28, "Test 14.1c", `Annabel boxH must be 28pt, got ${locAnnabel.boxH}`);
    assert(locAnnabel.boxW >= 125, "Test 14.1d", `Annabel boxW must be >= 125pt, got ${locAnnabel.boxW}`);
    // Annabel's signature MUST be on the right side (>= 430), NEVER on the left (< 340) over Aivan!
    assert(locAnnabel.boxX >= 430, "Test 14.1e", `Annabel boxX (${locAnnabel.boxX}) MUST be on the right side (>= 430), NEVER on the left over Aivan`);
    assert(locAnnabel.boxX <= 540, "Test 14.1f", `Annabel boxX (${locAnnabel.boxX}) must be centered directly above Annabel (annabelX = 480)`);

    // 2. Target: AIVAN M. BALOLOY (MUST BE ON THE LEFT BOX)
    const locAivan = findPersonnelSignatureCoordinates(pdfDoc, "AIVAN M. BALOLOY");
    assert(locAivan.appliedPosition === "above", "Test 14.2a", `Aivan appliedPosition must be "above", got "${locAivan.appliedPosition}"`);
    assert(locAivan.boxY === Math.round(rowY + 13), "Test 14.2b", `Aivan boxY must be rowY + 13 (${Math.round(rowY + 13)}), got ${locAivan.boxY}`);
    // Aivan's signature MUST be on the left side (<= 280), NEVER on the right (> 340) over Annabel!
    assert(locAivan.boxX <= 280, "Test 14.2c", `Aivan boxX (${locAivan.boxX}) MUST be on the left side (<= 280), NEVER on the right over Annabel`);
    assert(locAivan.boxX >= 150, "Test 14.2d", `Aivan boxX (${locAivan.boxX}) must be centered directly above Aivan (aivanX = 200)`);
  }

  // ─────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────
  console.log("\n======================================================================");
  const passedCount = reports.filter((r) => r.passed).length;
  const failedCount = reports.filter((r) => !r.passed).length;
  console.log(`TEST SUITE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("======================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution encountered an error:", err);
  process.exit(1);
});
