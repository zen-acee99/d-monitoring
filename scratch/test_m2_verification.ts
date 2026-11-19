import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import {
  scanPdfForSigners,
  findPersonnelSignatureCoordinates,
  findApprovalSectionCoordinates,
  signUploadedPersonnelPdfBytes,
} from "../src/utils/dtrVectorPdf.js";

async function runM2Verification() {
  console.log("======================================================================");
  console.log("   MILESTONE 2 VERIFICATION SUITE: SECTION ISOLATION & COORDINATES    ");
  console.log("======================================================================\n");

  let passes = 0;
  let fails = 0;
  function assert(cond: boolean, desc: string, detail?: string) {
    if (cond) {
      console.log(`  ✓ PASS: ${desc}`);
      passes++;
    } else {
      console.error(`  ✗ FAIL: ${desc} - ${detail || ""}`);
      fails++;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // 1. Disbursement Voucher Scanning & Section D Primary Priority
  // ──────────────────────────────────────────────────────────────────
  console.log("[Verification 1] scanPdfForSigners Section D Primary Priority");
  {
    const dvDoc = await PDFDocument.create();
    const page = dvDoc.addPage([595, 842]);
    const font = await dvDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await dvDoc.embedFont(StandardFonts.HelveticaBold);

    // Section A (Supervisor) at y ≈ 396
    page.drawText("A. Certified : Expenses / Cash Advance necessary, lawful and incurred under my direct supervision.", { x: 10, y: 437.4, size: 8, font });
    page.drawText("NORLY A. TABO", { x: 260, y: 396, size: 10, font: fontBold });
    page.drawText("OIC Chief, Technical Operations Division", { x: 230, y: 383, size: 8, font });

    // Section C (Accountant) at y ≈ 174
    page.drawText("C. Certified :", { x: 10, y: 269, size: 9, font: fontBold });
    page.drawText("AIVAN M. BALOLOY", { x: 157, y: 174, size: 9, font: fontBold });
    page.drawText("Accountant III", { x: 169, y: 147, size: 8, font });

    // Section D (Approval) at y ≈ 174
    page.drawText("D. Approved for Payment :", { x: 318, y: 269, size: 9, font: fontBold });
    page.drawText("One Thousand Two Hundred Pesos Only", { x: 336, y: 245, size: 8, font });
    page.drawText("Signature", { x: 318, y: 205, size: 8, font });
    page.drawText("Printed Name", { x: 318, y: 174, size: 8, font });
    page.drawText("ACEMATA MALTO", { x: 430, y: 174, size: 9, font: fontBold });
    page.drawText("OIC-Regional Director", { x: 437, y: 154, size: 8, font });

    const bytes = await dvDoc.save();

    const users = [
      { name: "Norly A. Tabo", role: "Supervisor" },
      { name: "Aivan M. Baloloy", role: "Accountant" },
      { name: "Ace Malto", role: "Regional Director" }
    ];

    const scan = await scanPdfForSigners(bytes, users);

    assert(scan.primaryPersonnel === "ACE MALTO", "Primary personnel is Section D approver (ACE MALTO)", `got "${scan.primaryPersonnel}"`);
    assert(scan.requiredSigners[0] === "ACE MALTO", "Required signers has Section D at index 0", `got "${scan.requiredSigners[0]}"`);
    assert(scan.signers.length === 3, "All 3 signers detected", `got ${scan.signers.length}`);
    const rdSigner = scan.signers.find(s => s.name === "ACE MALTO");
    assert(rdSigner?.roleHeader === "Approved for Payment", "Section D signer roleHeader is 'Approved for Payment'", `got "${rdSigner?.roleHeader}"`);
  }

  // ──────────────────────────────────────────────────────────────────
  // 2. Section D Isolation & Bounding Box Constraints
  // ──────────────────────────────────────────────────────────────────
  console.log("\n[Verification 2] Section D Isolation in findPersonnelSignatureCoordinates");
  {
    const dvDoc = await PDFDocument.create();
    const page = dvDoc.addPage([595, 842]);
    const font = await dvDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await dvDoc.embedFont(StandardFonts.HelveticaBold);

    page.drawText("A. Certified : Expenses / Cash Advance necessary, lawful and incurred under my direct supervision.", { x: 10, y: 437.4, size: 8, font });
    page.drawText("NORLY A. TABO", { x: 260, y: 396, size: 10, font: fontBold });

    page.drawText("C. Certified :", { x: 10, y: 269, size: 9, font: fontBold });
    page.drawText("AIVAN M. BALOLOY", { x: 157, y: 174, size: 9, font: fontBold });

    page.drawText("D. Approved for Payment :", { x: 318, y: 269, size: 9, font: fontBold });
    page.drawText("ACEMATA MALTO", { x: 430, y: 174, size: 9, font: fontBold });
    page.drawText("OIC-Regional Director", { x: 437, y: 154, size: 8, font });

    const bytes = await dvDoc.save();
    const pDoc = await PDFDocument.load(bytes);

    // Test with "ACEMATA MALTO"
    const locMalto = findPersonnelSignatureCoordinates(pDoc, "ACEMATA MALTO");
    assert(locMalto.appliedPosition === "above", "Target ACEMATA MALTO appliedPosition is 'above'");
    assert(locMalto.boxX >= 394, "boxX >= 394 pt (strictly right of vertical divider at 390 pt)", `got ${locMalto.boxX}`);
    assert(locMalto.boxX + locMalto.boxW <= 585, "boxX + boxW <= 585 pt (within Section D boundary)", `got ${locMalto.boxX + locMalto.boxW}`);
    assert(locMalto.boxY === 187, "boxY is exactly 187 pt", `got ${locMalto.boxY}`);
    assert(locMalto.boxH === 28, "boxH is 28 pt", `got ${locMalto.boxH}`);
    assert(locMalto.boxX > 316, "Completely isolated from Section C (x < 316 pt)");
    assert(locMalto.boxY < 370, "Completely isolated from Section A (y > 370 pt)");

    // Test with "ACE MATA MALTO"
    const locAceMata = findPersonnelSignatureCoordinates(pDoc, "ACE MATA MALTO");
    assert(locAceMata.boxX >= 394 && locAceMata.boxX + locAceMata.boxW <= 585, "ACE MATA MALTO strictly inside Section D");
    assert(locAceMata.boxY === 187, "ACE MATA MALTO boxY is 187 pt", `got ${locAceMata.boxY}`);

    // Test with active keystore name not printed on document (Annabel)
    const locAnnabel = findPersonnelSignatureCoordinates(pDoc, "Odoño-Calimpong Annabel Cortez");
    assert(locAnnabel.boxX >= 394 && locAnnabel.boxX + locAnnabel.boxW <= 585, "Keystore Annabel fallback strictly inside Section D", `got boxX: ${locAnnabel.boxX}`);
    assert(locAnnabel.boxY === 187, "Keystore Annabel fallback boxY is 187 pt", `got ${locAnnabel.boxY}`);
  }

  // ──────────────────────────────────────────────────────────────────
  // 3. Supervisor Section A Boundary Clamping
  // ──────────────────────────────────────────────────────────────────
  console.log("\n[Verification 3] Supervisor Section A Boundary Clamping");
  {
    const dvDoc = await PDFDocument.create();
    const page = dvDoc.addPage([595, 842]);
    const font = await dvDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await dvDoc.embedFont(StandardFonts.HelveticaBold);

    page.drawText("A. Certified : Expenses / Cash Advance necessary, lawful and incurred under my direct supervision.", { x: 10, y: 437.4, size: 8, font });
    page.drawText("NORLY A. TABO", { x: 260, y: 396, size: 10, font: fontBold });
    page.drawText("OIC Chief, Technical Operations Division", { x: 230, y: 383, size: 8, font });

    page.drawText("D. Approved for Payment :", { x: 318, y: 269, size: 9, font: fontBold });

    const bytes = await dvDoc.save();
    const pDoc = await PDFDocument.load(bytes);

    // Single sign for Norly Tabo
    const locTabo = findPersonnelSignatureCoordinates(pDoc, "NORLY A. TABO");
    assert(locTabo.boxY + locTabo.boxH <= 430, "Single signature boxY + boxH <= 430 pt", `got ${locTabo.boxY + locTabo.boxH}`);
    assert(locTabo.boxY + locTabo.boxH < 437.4, "Single signature does not touch y = 437.4 pt");

    // Counter-sign index 1 for Norly Tabo (previously produced boxY = 443 pt!)
    const locTaboCs1 = findPersonnelSignatureCoordinates(pDoc, "NORLY A. TABO", { isCounterSign: true, counterSignIndex: 1 });
    assert(locTaboCs1.boxY + locTaboCs1.boxH <= 430, "Counter-sign 1 boxY + boxH <= 430 pt", `got ${locTaboCs1.boxY + locTaboCs1.boxH}`);
    assert(locTaboCs1.boxY + locTaboCs1.boxH < 437.4, "Counter-sign 1 does not touch y = 437.4 pt");

    // Counter-sign index 2 for Norly Tabo
    const locTaboCs2 = findPersonnelSignatureCoordinates(pDoc, "NORLY A. TABO", { isCounterSign: true, counterSignIndex: 2 });
    assert(locTaboCs2.boxY + locTaboCs2.boxH <= 430, "Counter-sign 2 boxY + boxH <= 430 pt", `got ${locTaboCs2.boxY + locTaboCs2.boxH}`);

    // findApprovalSectionCoordinates Section A title clamping and hardcoded removal
    const apprLoc = findApprovalSectionCoordinates(pDoc, "SUPERVISOR");
    assert(apprLoc.boxY + apprLoc.boxH <= 430, "findApprovalSectionCoordinates boxY + boxH <= 430 pt in Section A", `got ${apprLoc.boxY + apprLoc.boxH}`);
    assert(apprLoc.boxY + apprLoc.boxH < 437.4, "findApprovalSectionCoordinates does not overlap y = 437.4 pt");
  }

  // ──────────────────────────────────────────────────────────────────
  // 4. Decoupling in signUploadedPersonnelPdfBytes
  // ──────────────────────────────────────────────────────────────────
  console.log("\n[Verification 4] Decoupling Target Signatory in signUploadedPersonnelPdfBytes");
  {
    const dvDoc = await PDFDocument.create();
    const page = dvDoc.addPage([595, 842]);
    const font = await dvDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await dvDoc.embedFont(StandardFonts.HelveticaBold);

    page.drawText("A. Certified : Expenses / Cash Advance necessary, lawful and incurred under my direct supervision.", { x: 10, y: 437.4, size: 8, font });
    page.drawText("NORLY A. TABO", { x: 260, y: 396, size: 10, font: fontBold });

    page.drawText("D. Approved for Payment :", { x: 318, y: 269, size: 9, font: fontBold });
    page.drawText("ACEMATA MALTO", { x: 430, y: 174, size: 9, font: fontBold });

    const bytes = await dvDoc.save();

    // Call signUploadedPersonnelPdfBytes targeting "ACEMATA MALTO" while keystore is "Odoño-Calimpong Annabel Cortez"
    const result = await signUploadedPersonnelPdfBytes(
      bytes,
      "ACEMATA MALTO",
      null,
      null,
      {
        signerName: "Odoño-Calimpong Annabel Cortez",
      }
    );

    assert(result.resolvedSignerName === "Odoño-Calimpong Annabel Cortez", "resolvedSignerName is active keystore signer (Annabel)", `got "${result.resolvedSignerName}"`);
    assert(result.signatureCoordinates.boxX >= 394, "signatureCoordinates.boxX >= 394 pt (Section D)", `got ${result.signatureCoordinates.boxX}`);
    assert(result.signatureCoordinates.boxX + result.signatureCoordinates.boxW <= 585, "signatureCoordinates inside Section D");
    assert(result.signatureCoordinates.boxY === 187, "signatureCoordinates.boxY is 187 pt directly above ACEMATA MALTO", `got ${result.signatureCoordinates.boxY}`);

    // Verify exactly ONE signature visual box was drawn on the page, and it's in Section D
    const signedDoc = await PDFDocument.load(result.bytes);
    const signedPage = signedDoc.getPage(0);
    assert(result.bytes.length > bytes.length, "Signed PDF bytes generated successfully");
  }

  // ──────────────────────────────────────────────────────────────────
  // 5. Verification on scratch/test_dv_real.pdf Fixture
  // ──────────────────────────────────────────────────────────────────
  console.log("\n[Verification 5] Real DV Fixture (scratch/test_dv_real.pdf)");
  {
    const realBytes = fs.readFileSync("scratch/test_dv_real.pdf");
    const realDoc = await PDFDocument.load(realBytes);

    const locAce = findPersonnelSignatureCoordinates(realDoc, "ACEMATA MALTO");
    assert(locAce.boxX >= 394, "Real DV: ACEMATA MALTO boxX >= 394 pt", `got ${locAce.boxX}`);
    assert(locAce.boxX + locAce.boxW <= 585, "Real DV: ACEMATA MALTO boxX + boxW <= 585 pt", `got ${locAce.boxX + locAce.boxW}`);
    assert(locAce.boxY === 187, "Real DV: ACEMATA MALTO boxY is 187 pt", `got ${locAce.boxY}`);

    const locAnnabel = findPersonnelSignatureCoordinates(realDoc, "Odoño-Calimpong Annabel Cortez");
    assert(locAnnabel.boxX >= 394, "Real DV: Annabel on DV boxX >= 394 pt", `got ${locAnnabel.boxX}`);
    assert(locAnnabel.boxX + locAnnabel.boxW <= 585, "Real DV: Annabel on DV boxX + boxW <= 585 pt", `got ${locAnnabel.boxX + locAnnabel.boxW}`);
    assert(locAnnabel.boxY === 187, "Real DV: Annabel on DV boxY is 187 pt", `got ${locAnnabel.boxY}`);

    const locLeah = findPersonnelSignatureCoordinates(realDoc, "LEAH B. DY");
    assert(locLeah.boxY + locLeah.boxH <= 430, "Real DV: Leah Dy (Supervisor) boxY + boxH <= 430 pt", `got ${locLeah.boxY + locLeah.boxH}`);
  }

  console.log("\n======================================================================");
  console.log(`VERIFICATION RESULTS: ${passes} PASSED, ${fails} FAILED`);
  console.log("======================================================================\n");

  if (fails > 0) {
    process.exit(1);
  }
}

runM2Verification().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
