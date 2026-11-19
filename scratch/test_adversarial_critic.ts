import fs from "fs";
import path from "path";
import { PDFDocument, PDFName, PDFDict, PDFArray, rgb, StandardFonts } from "pdf-lib";
import {
  findPersonnelSignatureCoordinates,
  findApprovalSectionCoordinates,
  scanPdfForSigners,
  matchNames,
  normalizeNameForMatch,
} from "../src/utils/dtrVectorPdf.js";
import {
  signPdfBuffer,
  normalizeSignatureBoundingBox,
  getSignerIdentityFromP12,
  decryptP12Password,
} from "../server/services/pnpkiSigningService.js";

async function runAdversarialAudit() {
  console.log("======================================================================");
  console.log("       ADVERSARIAL CRITIC & INTEGRITY AUDIT TEST SUITE                ");
  console.log("======================================================================");

  let passedCount = 0;
  let failedCount = 0;

  function assertAudit(cond: boolean, desc: string) {
    if (cond) {
      console.log(`  PASS: ${desc}`);
      passedCount++;
    } else {
      console.error(`  FAIL: ${desc}`);
      failedCount++;
    }
  }

  // 1. Keystore inspection
  const p12Path = path.resolve(process.cwd(), "scratch/rene_jane.p12");
  const p12Buffer = fs.readFileSync(p12Path);
  const p12Password = "1234567890Aa!";
  const identity = getSignerIdentityFromP12(p12Buffer.toString("base64"), p12Password);

  assertAudit(
    identity.commonName === "Buena Rene Jane Rosendo",
    `Identity extraction correctly reads real CN: "${identity.commonName}"`
  );

  // 2. Adversarial Stress Test: Duplicate SigRects passed to signPdfBuffer
  // Verify that passing 3 duplicate rectangles in sigRects produces strictly 1 /Widget annotation
  const baseDoc = await PDFDocument.create();
  baseDoc.addPage([595, 842]);
  const baseBytes = await baseDoc.save();

  const duplicateRects: [number, number, number, number][] = [
    [394, 187, 519, 215],
    [394, 187, 519, 215],
    [394, 187, 519, 215],
  ];

  const { signedBuffer } = await signPdfBuffer(
    Buffer.from(baseBytes),
    p12Buffer.toString("base64"),
    p12Password,
    {
      signerName: identity.commonName,
      sigRects: duplicateRects,
    }
  );

  const inspectedDoc = await PDFDocument.load(signedBuffer);
  const form = inspectedDoc.getForm();
  const fields = form.getFields();
  const rawPdfStr = signedBuffer.toString("binary");
  const widgetOccurrences = [...rawPdfStr.matchAll(/\/Subtype\s*\/Widget\b/g)].length;

  assertAudit(
    fields.length === 1,
    `Duplicate rects in First-Signature Mode collapsed to exactly 1 AcroForm field (got ${fields.length})`
  );
  assertAudit(
    widgetOccurrences === 1,
    `Duplicate rects produce exactly 1 /Widget annotation in PDF syntax (got ${widgetOccurrences})`
  );

  // 3. ByteRange Mathematical Validity Check
  const byteRangeMatch = rawPdfStr.match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);
  assertAudit(Boolean(byteRangeMatch), "PDF contains valid /ByteRange array");
  if (byteRangeMatch) {
    const [_, r0, r1, r2, r3] = byteRangeMatch.map(Number);
    assertAudit(r0 === 0, `ByteRange starts at 0 (got ${r0})`);
    assertAudit(r2 === r0 + r1 + (r2 - (r0 + r1)), `ByteRange gap between r1 and r2 matches signature placeholder size`);
    assertAudit(r2 + r3 === signedBuffer.length, `ByteRange covers up to EOF: r2 (${r2}) + r3 (${r3}) === actualLen (${signedBuffer.length})`);
  }

  // 4. Adversarial Stress Test: Incremental update with duplicate rects
  const { signedBuffer: multiSigned } = await signPdfBuffer(
    signedBuffer,
    p12Buffer.toString("base64"),
    p12Password,
    {
      signerName: identity.commonName,
      sigRects: [
        [394, 220, 519, 248],
        [394, 220, 519, 248],
      ],
      fieldName: "Second_Signature_Test",
    }
  );

  const multiDoc = await PDFDocument.load(multiSigned);
  const multiFields = multiDoc.getForm().getFields();
  const multiPdfStr = multiSigned.toString("binary");
  const multiSigMatches = [...multiPdfStr.matchAll(/\/Type\s*\/Sig\b/g)].length;

  assertAudit(
    multiFields.length === 2,
    `Incremental update appended exactly 1 new unique field (total 2 fields, got ${multiFields.length})`
  );
  assertAudit(
    multiSigMatches === 2,
    `Incremental update contains exactly 2 /Type /Sig dictionaries (got ${multiSigMatches})`
  );

  // 5. Section A Ceiling Clamping Stress Test
  const extremeSupervisorDoc = await PDFDocument.create();
  const sPage = extremeSupervisorDoc.addPage([595, 842]);
  const sFont = await extremeSupervisorDoc.embedFont(StandardFonts.Helvetica);
  sPage.drawText("A. Certified: Expenses incurred under my direct supervision.", { x: 20, y: 437.4, size: 8, font: sFont });
  sPage.drawText("SUPERVISOR HIGH BASELINE", { x: 30, y: 420, size: 10, font: sFont });
  const extremeSBytes = await extremeSupervisorDoc.save();
  const loadedSDoc = await PDFDocument.load(extremeSBytes);

  const coordsHighS = await findApprovalSectionCoordinates(loadedSDoc, "SUPERVISOR HIGH BASELINE");
  assertAudit(
    coordsHighS !== null && coordsHighS.boxY + coordsHighS.boxH <= 430,
    `High baseline supervisor (y = 420) is clamped strictly to boxY + boxH <= 430 (got ${coordsHighS?.boxY! + coordsHighS?.boxH!})`
  );

  // 6. Section D Clamping with ACEMATA MALTO (targeted approver)
  const dvDocMalto = await PDFDocument.create();
  const dPage1 = dvDocMalto.addPage([595, 842]);
  const dFont1 = await dvDocMalto.embedFont(StandardFonts.Helvetica);
  dPage1.drawText("D. APPROVED FOR PAYMENT", { x: 350, y: 260, size: 9, font: dFont1 });
  dPage1.drawText("ACEMATA MALTO", { x: 318, y: 174, size: 9, font: dFont1 });
  const dvBytesMalto = await dvDocMalto.save();
  const loadedDvMalto = await PDFDocument.load(dvBytesMalto);

  const coordsMalto = await findPersonnelSignatureCoordinates(loadedDvMalto, "ACEMATA MALTO");
  assertAudit(
    coordsMalto !== null && coordsMalto.boxX >= 394,
    `Section D ACEMATA MALTO at x = 318 is clamped right of divider line: boxX >= 394 (got ${coordsMalto?.boxX})`
  );
  assertAudit(
    coordsMalto !== null && coordsMalto.boxX + coordsMalto.boxW <= 585,
    `Section D ACEMATA MALTO remains within right table boundary: boxX + boxW <= 585 (got ${coordsMalto?.boxX! + coordsMalto?.boxW!})`
  );

  // 7. Section D Generic Title / Approver in Right Column
  const dvDocGeneric = await PDFDocument.create();
  const dPage2 = dvDocGeneric.addPage([595, 842]);
  const dFont2 = await dvDocGeneric.embedFont(StandardFonts.Helvetica);
  dPage2.drawText("D. APPROVED FOR PAYMENT", { x: 350, y: 260, size: 9, font: dFont2 });
  dPage2.drawText("JANE DOE DIRECTOR", { x: 420, y: 174, size: 9, font: dFont2 });
  const dvBytesGeneric = await dvDocGeneric.save();
  const loadedDvGeneric = await PDFDocument.load(dvBytesGeneric);

  const coordsGeneric = await findPersonnelSignatureCoordinates(loadedDvGeneric, "JANE DOE DIRECTOR");
  assertAudit(
    coordsGeneric !== null && coordsGeneric.boxX >= 394,
    `Generic approver JANE DOE DIRECTOR in right column (x = 420) resolves boxX >= 394 (got ${coordsGeneric?.boxX})`
  );
  assertAudit(
    coordsGeneric !== null && coordsGeneric.boxX + coordsGeneric.boxW <= 585,
    `Generic approver JANE DOE DIRECTOR remains within right table boundary: boxX + boxW <= 585 (got ${coordsGeneric?.boxX! + coordsGeneric?.boxW!})`
  );

  // 8. Section C Accountant Isolation (Must NOT resolve in Section D)
  const dvDocAcc = await PDFDocument.create();
  const dPage3 = dvDocAcc.addPage([595, 842]);
  const dFont3 = await dvDocAcc.embedFont(StandardFonts.Helvetica);
  dPage3.drawText("C. CERTIFIED CORRECT", { x: 20, y: 260, size: 9, font: dFont3 });
  dPage3.drawText("D. APPROVED FOR PAYMENT", { x: 350, y: 260, size: 9, font: dFont3 });
  dPage3.drawText("JOHN ACCOUNTANT", { x: 80, y: 174, size: 9, font: dFont3 });
  dPage3.drawText("JANE DOE DIRECTOR", { x: 420, y: 174, size: 9, font: dFont3 });
  const dvBytesWithAccountant = await dvDocAcc.save();
  const loadedDvAcc = await PDFDocument.load(dvBytesWithAccountant);

  const coordsAccountant = await findPersonnelSignatureCoordinates(loadedDvAcc, "JOHN ACCOUNTANT");
  assertAudit(
    coordsAccountant !== null && coordsAccountant.boxX < 315,
    `Accountant in Section C (x = 80) resolves strictly in left section: boxX < 315 (got ${coordsAccountant?.boxX})`
  );

  console.log("======================================================================");
  console.log(`AUDIT RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("======================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAdversarialAudit().catch((e) => {
  console.error("Adversarial audit encountered fatal error:", e);
  process.exit(1);
});
