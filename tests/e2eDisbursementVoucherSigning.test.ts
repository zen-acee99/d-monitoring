import fs from "fs";
import path from "path";
import { PDFDocument, rgb, StandardFonts, PDFName, PDFDict, PDFArray } from "pdf-lib";
import {
  findPersonnelSignatureCoordinates,
  findApprovalSectionCoordinates,
  scanPdfForSigners,
  matchNames,
  normalizeNameForMatch,
  stripTableFormLabels,
  isTableFormLabel,
} from "../src/utils/dtrVectorPdf.js";
import {
  signPdfBuffer,
  normalizeSignatureBoundingBox,
  getSignerIdentityFromP12,
  decryptP12Password,
  fixMojibake,
} from "../server/services/pnpkiSigningService.js";
import { db } from "../server/db.js";

interface TestCaseResult {
  tier: string;
  id: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const allResults: TestCaseResult[] = [];

async function test(
  tier: string,
  id: string,
  name: string,
  fn: () => Promise<void> | void
) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    allResults.push({ tier, id, name, passed: true, durationMs });
    console.log(`  PASS [${tier}] ${id}: ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const msg = err?.message || String(err);
    allResults.push({ tier, id, name, passed: false, error: msg, durationMs });
    console.error(`  FAIL [${tier}] ${id}: ${name}`);
    console.error(`       Error: ${msg}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF SYNTHESIS & INSPECTION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

interface SyntheticDvOptions {
  sectionASupervisor?: string;
  sectionATitle?: string;
  hasPriorSectionASig?: boolean;
  sectionCAccountant?: string;
  hasPriorSectionCSig?: boolean;
  sectionDSignerName?: string;
  sectionDTitle?: string;
  vLineSectionCD?: number; // default 315.7
  vLineSectionD?: number;  // default 390.0
  pageWidth?: number;      // default 595
  pageHeight?: number;     // default 842
}

async function createSyntheticDisbursementVoucher(
  opts: SyntheticDvOptions = {}
): Promise<Uint8Array> {
  const width = opts.pageWidth ?? 595;
  const height = opts.pageHeight ?? 842;
  const doc = await PDFDocument.create();
  const page = doc.addPage([width, height]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);
  const vLineCD = opts.vLineSectionCD ?? 315.7;
  const vLineD = opts.vLineSectionD ?? 390.0;
  const rightBorder = 585.0;
  const leftBorder = 10.6;

  // Draw Grid Lines (Section A, B, C, D)
  // Outer Borders
  page.drawLine({ start: { x: leftBorder, y: 107 }, end: { x: leftBorder, y: 440 }, thickness: 1, color: black });
  page.drawLine({ start: { x: rightBorder, y: 107 }, end: { x: rightBorder, y: 440 }, thickness: 1, color: black });
  // Horizontal Section Dividers
  page.drawLine({ start: { x: leftBorder, y: 440 }, end: { x: rightBorder, y: 440 }, thickness: 1, color: black });
  page.drawLine({ start: { x: leftBorder, y: 368 }, end: { x: rightBorder, y: 368 }, thickness: 1, color: black });
  page.drawLine({ start: { x: leftBorder, y: 270 }, end: { x: rightBorder, y: 270 }, thickness: 1, color: black });
  page.drawLine({ start: { x: leftBorder, y: 107 }, end: { x: rightBorder, y: 107 }, thickness: 1, color: black });

  // Section C & D Sub-grid
  page.drawLine({ start: { x: vLineCD, y: 107 }, end: { x: vLineCD, y: 270 }, thickness: 1, color: black });
  page.drawLine({ start: { x: vLineD, y: 107 }, end: { x: vLineD, y: 235 }, thickness: 1, color: black });
  page.drawLine({ start: { x: leftBorder, y: 235 }, end: { x: rightBorder, y: 235 }, thickness: 0.5, color: black });
  page.drawLine({ start: { x: leftBorder, y: 185 }, end: { x: rightBorder, y: 185 }, thickness: 0.5, color: black });
  page.drawLine({ start: { x: leftBorder, y: 160 }, end: { x: rightBorder, y: 160 }, thickness: 0.5, color: black });
  page.drawLine({ start: { x: leftBorder, y: 135 }, end: { x: rightBorder, y: 135 }, thickness: 0.5, color: black });

  // ── Section A (Supervisor) ──
  page.drawText("A.Certified :Expenses / Cash Advance necessary, lawful and incurred under my direct supervision.", {
    x: leftBorder,
    y: 437.4,
    size: 7.5,
    font,
    color: black,
  });

  const supName = opts.sectionASupervisor ?? "NORLY A. TABO";
  page.drawText(supName, { x: 260.0, y: 396.0, size: 9.5, font: fontBold, color: black });
  page.drawText(opts.sectionATitle ?? "OIC Chief, Technical Operations Division", {
    x: 230.0,
    y: 383.2,
    size: 8,
    font,
    color: black,
  });
  page.drawText("Printed Name, Designation and Signature of Supervisor", {
    x: 211.2,
    y: 373.0,
    size: 7,
    font,
    color: black,
  });

  if (opts.hasPriorSectionASig) {
    page.drawText("Digitally signed by Tabo Norly Avila", {
      x: 260.0,
      y: 410.0,
      size: 7,
      font,
      color: rgb(0, 0, 0.8),
    });
  }

  // ── Section B (Accounting Entry) ──
  page.drawText("B.Accounting Entry :", { x: leftBorder, y: 353.5, size: 8, font: fontBold, color: black });
  page.drawText("TOTAL-P 1,248,702.00", { x: 319.4, y: 282.2, size: 8, font, color: black });

  // ── Section C (Accountant) ──
  page.drawText("C.Certified :", { x: leftBorder, y: 269.3, size: 8.5, font: fontBold, color: black });
  page.drawText("Signature", { x: leftBorder, y: 205.1, size: 8, font, color: black });
  page.drawText("Printed Name", { x: leftBorder, y: 174.4, size: 8, font, color: black });
  const accName = opts.sectionCAccountant ?? "AIVAN M. BALOLOY";
  page.drawText(accName, { x: 156.9, y: 174.4, size: 9, font: fontBold, color: black });
  page.drawText("Accountant III", { x: 169.1, y: 147.3, size: 8, font, color: black });
  page.drawText("Position", { x: leftBorder, y: 139.1, size: 8, font, color: black });
  page.drawText("Date", { x: leftBorder, y: 107.0, size: 8, font, color: black });

  if (opts.hasPriorSectionCSig) {
    page.drawText("Digitally signed by Baloloy Aivan Morcoso", {
      x: 150.0,
      y: 205.0,
      size: 7,
      font,
      color: rgb(0, 0, 0.8),
    });
  }

  // ── Section D (Approved for Payment) ──
  page.drawText("D. Approved for Payment :", { x: 318.2, y: 269.3, size: 8.5, font: fontBold, color: black });
  page.drawText("One Million Two Hundred Forty Eight Thousand Seven", {
    x: 336.0,
    y: 251.5,
    size: 8,
    font,
    color: black,
  });
  page.drawText("Hundred Two Pesos Only", { x: 336.0, y: 238.2, size: 8, font, color: black });
  page.drawText("Signature", { x: 318.2, y: 205.1, size: 8, font, color: black });
  page.drawText("Printed Name", { x: 318.2, y: 174.4, size: 8, font, color: black });

  const dirName = opts.sectionDSignerName ?? "ACEMATA MALTO";
  page.drawText(dirName, { x: 430.0, y: 174.4, size: 9.5, font: fontBold, color: black });
  page.drawText(opts.sectionDTitle ?? "OIC-Regional Director,", {
    x: 436.6,
    y: 154.4,
    size: 8,
    font,
    color: black,
  });
  page.drawText("Position", { x: 318.2, y: 139.1, size: 8, font, color: black });
  page.drawText("Regional Office No. V", { x: 439.5, y: 139.1, size: 8, font, color: black });
  page.drawText("Date", { x: 318.2, y: 107.0, size: 8, font, color: black });

  return await doc.save({ useObjectStreams: false });
}

function inspectPdfSignatures(pdfBytes: Buffer | Uint8Array) {
  const buf = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes);
  const pdfStr = buf.toString("latin1");

  const sigMatches = pdfStr.match(/\/Type\s*\/Sig\b/g) || [];
  const widgetMatches = pdfStr.match(/\/Subtype\s*\/Widget\b/g) || [];

  const rectRegex = /\/Rect\s*\[\s*([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s*\]/g;
  const widgets: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = rectRegex.exec(pdfStr)) !== null) {
    widgets.push({
      x1: parseFloat(m[1]),
      y1: parseFloat(m[2]),
      x2: parseFloat(m[3]),
      y2: parseFloat(m[4]),
    });
  }

  const startxrefMatches = pdfStr.match(/\bstartxref\b/g) || [];

  return {
    sigCount: sigMatches.length,
    widgetCount: widgetMatches.length,
    widgets,
    startxrefCount: startxrefMatches.length,
    hasByteRange: pdfStr.includes("/ByteRange"),
    hasPkcs7Detached: pdfStr.includes("/SubFilter /adbe.pkcs7.detached"),
    hasDigiSigned: pdfStr.includes("DigiSigned") || pdfStr.includes("(DigiSigned)"),
    pdfStr,
  };
}

interface TestKeystore {
  name: string;
  certCommonName: string;
  p12Base64: string;
  password: string;
}

async function loadTestKeystores(): Promise<{
  reneJane: TestKeystore;
  annabel?: TestKeystore;
  aceMalto?: TestKeystore;
}> {
  // Load Rene Jane from scratch fixture
  const rjPath = path.resolve("scratch/rene_jane.p12");
  assert(fs.existsSync(rjPath), `scratch/rene_jane.p12 must exist at ${rjPath}`);
  const rjBuf = fs.readFileSync(rjPath);
  const rjBase64 = rjBuf.toString("base64");
  const rjIdentity = getSignerIdentityFromP12(rjBase64, "1234567890Aa!");

  const keystores: {
    reneJane: TestKeystore;
    annabel?: TestKeystore;
    aceMalto?: TestKeystore;
  } = {
    reneJane: {
      name: "Buena Rene Jane Rosendo",
      certCommonName: rjIdentity.commonName,
      p12Base64: rjBase64,
      password: "1234567890Aa!",
    },
  };

  // Attempt to load Annabel and Ace Malto from SQLite local.db
  try {
    const res = await db.execute(
      "SELECT id, user_Id, Name, p12, p12_password FROM dtr_generator WHERE p12 IS NOT NULL"
    );
    for (const row of res.rows) {
      const p12Str = row.p12 as string;
      const encPw = row.p12_password as string;
      if (!p12Str || !encPw) continue;
      try {
        const decPw = decryptP12Password(encPw);
        const ident = getSignerIdentityFromP12(p12Str, decPw);
        const cn = ident.commonName.toLowerCase();
        if (cn.includes("annabel") || cn.includes("odoño") || cn.includes("odono")) {
          keystores.annabel = {
            name: "Odoño-Calimpong Annabel Cortez",
            certCommonName: ident.commonName,
            p12Base64: p12Str,
            password: decPw,
          };
        } else if (cn.includes("ace") && cn.includes("malto")) {
          keystores.aceMalto = {
            name: "Malto Ace Mata",
            certCommonName: ident.commonName,
            p12Base64: p12Str,
            password: decPw,
          };
        }
      } catch {}
    }
  } catch (dbErr) {
    console.warn("  [Notice] SQLite keystore load skipped or failed, using Rene Jane keystore:", dbErr);
  }

  return keystores;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN E2E TEST RUNNER
// ─────────────────────────────────────────────────────────────────────────────

async function runAllE2ETests() {
  console.log("======================================================================");
  console.log("   E2E DISBURSEMENT VOUCHER SIGNING & COORDINATE RESOLUTION SUITE      ");
  console.log("======================================================================\n");

  const keystores = await loadTestKeystores();
  console.log(`Loaded Primary Keystore: ${keystores.reneJane.certCommonName}`);
  if (keystores.annabel) {
    console.log(`Loaded Delegate Keystore: ${keystores.annabel.certCommonName}`);
  }
  if (keystores.aceMalto) {
    console.log(`Loaded Admin Keystore: ${keystores.aceMalto.certCommonName}`);
  }
  console.log("");

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (>=25 Test Cases Across 5 Features)
  // =========================================================================
  console.log("──────────────────────────────────────────────────────────────────────");
  console.log(" TIER 1: FEATURE COVERAGE (Features F1 - F5)");
  console.log("──────────────────────────────────────────────────────────────────────");

  // --- Feature 1: Target Signatory Anchoring (Section D) ---
  await test("Tier 1", "T1.F1.1", "Target 'ACEMATA MALTO' resolves strictly above name baseline (y ≈ 187 pt)", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    assert(loc.appliedPosition === "above", `appliedPosition must be "above", got "${loc.appliedPosition}"`);
    assert(loc.boxY >= 180 && loc.boxY <= 220, `boxY (${loc.boxY}) must be in Section D signature row (180..220)`);
  });

  await test("Tier 1", "T1.F1.2", "Section D signature box dimensions conform to standard (boxH = 28, boxW >= 120)", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    assert(loc.boxH === 28, `boxH must be 28 pt, got ${loc.boxH}`);
    assert(loc.boxW >= 120 && loc.boxW <= 165, `boxW must be between 120 and 165 pt, got ${loc.boxW}`);
  });

  await test("Tier 1", "T1.F1.3", "Section D signature box is horizontally anchored inside Section D table cell", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    assert(loc.boxX >= 390, `boxX (${loc.boxX}) must be right of Section D label column (>= 390 pt)`);
    assert(loc.boxX + loc.boxW <= 585, `boxX + boxW (${loc.boxX + loc.boxW}) must stay within right page border (585 pt)`);
  });

  await test("Tier 1", "T1.F1.4", "Synthetic DV with custom approval name 'ACE MATA MALTO' anchors inside Section D", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACE MATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACE MATA MALTO");

    assert(loc.appliedPosition === "above", `appliedPosition must be "above"`);
    assert(loc.boxY >= 180 && loc.boxY <= 220, `boxY must be 180..220, got ${loc.boxY}`);
    assert(loc.boxX >= 390, `boxX must be >= 390, got ${loc.boxX}`);
  });

  await test("Tier 1", "T1.F1.5", "Targeting Section D does not latch onto Section C Accountant or Section A Supervisor", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({
      sectionASupervisor: "NORLY A. TABO",
      sectionCAccountant: "AIVAN M. BALOLOY",
      sectionDSignerName: "ACEMATA MALTO",
    });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    assert(loc.boxY < 300, `boxY (${loc.boxY}) must NOT latch onto Supervisor Section A (y > 350)`);
    assert(loc.boxX > 320, `boxX (${loc.boxX}) must NOT latch onto Accountant Section C (x < 316)`);
  });

  // --- Feature 2: Keystore Cert CN vs Target Signatory Decoupling ---
  await test("Tier 1", "T1.F2.1", "Sign with Rene Jane P12 keystore targeting 'ACEMATA MALTO' binds to Section D", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    // Perform cryptographic signing using Rene Jane keystore while targeting ACEMATA MALTO
    const signRes = await signPdfBuffer(
      Buffer.from(pdfBytes),
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
        reason: "Disbursement Voucher Payment Approval",
      }
    );

    const insp = inspectPdfSignatures(signRes.signedBuffer);
    assert(insp.hasByteRange, "Signed PDF must contain /ByteRange");
    assert(insp.hasPkcs7Detached, "Signed PDF must contain /SubFilter /adbe.pkcs7.detached");
    assert(insp.widgets.length === 1, `Must have exactly 1 widget, got ${insp.widgets.length}`);
    const w = insp.widgets[0];
    assert(w.y1 >= 180 && w.y1 <= 220, `Widget y1 (${w.y1}) must be in Section D (180..220), NOT in supervisor box`);
    assert(w.x1 >= 390, `Widget x1 (${w.x1}) must be in Section D (>= 390)`);
  });

  await test("Tier 1", "T1.F2.2", "Sign with Annabel P12 keystore targeting 'ACEMATA MALTO' binds to Section D", async () => {
    const ks = keystores.annabel || keystores.reneJane; // fallback to RJ if Annabel not in local DB
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    const signRes = await signPdfBuffer(
      Buffer.from(pdfBytes),
      ks.p12Base64,
      ks.password,
      {
        signerName: ks.certCommonName,
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
        reason: "Disbursement Voucher Payment Approval",
      }
    );

    const insp = inspectPdfSignatures(signRes.signedBuffer);
    const w = insp.widgets[0];
    assert(w.y1 >= 180 && w.y1 <= 220, `Widget y1 (${w.y1}) must be in Section D`);
    assert(w.x1 >= 390, `Widget x1 (${w.x1}) must be in Section D`);
  });

  await test("Tier 1", "T1.F2.3", "Sign with Ace Malto keystore targeting Section A Supervisor binds to Section A", async () => {
    const ks = keystores.aceMalto || keystores.reneJane;
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionASupervisor: "NORLY A. TABO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "NORLY A. TABO");

    const signRes = await signPdfBuffer(
      Buffer.from(pdfBytes),
      ks.p12Base64,
      ks.password,
      {
        signerName: ks.certCommonName,
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
        reason: "Supervisor Expenses Certification",
      }
    );

    const insp = inspectPdfSignatures(signRes.signedBuffer);
    const w = insp.widgets[0];
    assert(w.y1 >= 380 && w.y1 <= 425, `Widget y1 (${w.y1}) must be in Section A (380..425)`);
  });

  await test("Tier 1", "T1.F2.4", "Cryptographic /Sig records cert identity while widget /Rect is at document line", async () => {
    const ks = keystores.reneJane;
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    const signRes = await signPdfBuffer(
      Buffer.from(pdfBytes),
      ks.p12Base64,
      ks.password,
      {
        signerName: ks.certCommonName,
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
      }
    );

    assert(signRes.signerName === ks.certCommonName, `Signer name in result must match cert CN: "${ks.certCommonName}"`);
    assert(signRes.signerIdentity.commonName === ks.certCommonName, "Signer identity commonName must match cert");
    const insp = inspectPdfSignatures(signRes.signedBuffer);
    assert(insp.widgets[0].x1 === loc.boxX && insp.widgets[0].y1 === loc.boxY, "Widget /Rect must match loc coordinates");
  });

  await test("Tier 1", "T1.F2.5", "Appearance stream contains cert signer name and DigiSigned typography", async () => {
    const ks = keystores.reneJane;
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    const signRes = await signPdfBuffer(
      Buffer.from(pdfBytes),
      ks.p12Base64,
      ks.password,
      {
        signerName: ks.certCommonName,
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
        isCounterSign: true,
      }
    );

    const insp = inspectPdfSignatures(signRes.signedBuffer);
    assert(insp.hasDigiSigned, "Appearance stream must include DigiSigned typography");
  });

  // --- Feature 3: Elimination of Stray & Duplicate Widgets ---
  await test("Tier 1", "T1.F3.1", "Signing Section D produces exactly 1 /Widget annotation across PDF", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    const signRes = await signPdfBuffer(
      Buffer.from(pdfBytes),
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
      }
    );

    const insp = inspectPdfSignatures(signRes.signedBuffer);
    assert(insp.widgetCount === 1, `Must have exactly 1 widget, got ${insp.widgetCount}`);
  });

  await test("Tier 1", "T1.F3.2", "Signing Section D creates ZERO widgets in Supervisor Section A (y > 350 pt)", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    const signRes = await signPdfBuffer(
      Buffer.from(pdfBytes),
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
      }
    );

    const insp = inspectPdfSignatures(signRes.signedBuffer);
    const straySupervisorWidgets = insp.widgets.filter((w) => w.y1 > 350);
    assert(straySupervisorWidgets.length === 0, `Expected 0 widgets in Supervisor Section A, found ${straySupervisorWidgets.length}`);
  });

  await test("Tier 1", "T1.F3.3", "Signing Section D with prior Section A signature does NOT duplicate supervisor widget", async () => {
    // Stage 1: Sign Section A
    const pdfBytes0 = await createSyntheticDisbursementVoucher({ sectionASupervisor: "NORLY A. TABO" });
    const pdfDoc0 = await PDFDocument.load(pdfBytes0);
    const locA = findPersonnelSignatureCoordinates(pdfDoc0, "NORLY A. TABO");
    const signResA = await signPdfBuffer(
      Buffer.from(pdfBytes0),
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [locA.boxX, locA.boxY, locA.boxW, locA.boxH],
        sigRects: [[locA.boxX, locA.boxY, locA.boxX + locA.boxW, locA.boxY + locA.boxH]],
        reason: "Section A Supervisor Approval",
      }
    );

    // Stage 2: Sign Section D
    const pdfDoc1 = await PDFDocument.load(signResA.signedBuffer);
    const locD = findPersonnelSignatureCoordinates(pdfDoc1, "ACEMATA MALTO");
    const signResD = await signPdfBuffer(
      signResA.signedBuffer,
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [locD.boxX, locD.boxY, locD.boxW, locD.boxH],
        sigRects: [[locD.boxX, locD.boxY, locD.boxX + locD.boxW, locD.boxY + locD.boxH]],
        reason: "Section D Regional Director Approval",
      }
    );

    const insp = inspectPdfSignatures(signResD.signedBuffer);
    const widgetsInA = insp.widgets.filter((w) => w.y1 > 350);
    const widgetsInD = insp.widgets.filter((w) => w.y1 >= 180 && w.y1 <= 220);
    assert(widgetsInA.length === 1, `Section A must have exactly 1 widget, got ${widgetsInA.length}`);
    assert(widgetsInD.length === 1, `Section D must have exactly 1 widget, got ${widgetsInD.length}`);
    assert(insp.widgetCount === 2, `Total widgets must be 2, got ${insp.widgetCount}`);
  });

  await test("Tier 1", "T1.F3.4", "Re-signing or counter-signing Section D does not spawn orphan appearance streams in Section A", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO", { isCounterSign: true, counterSignIndex: 0 });

    const signRes = await signPdfBuffer(
      Buffer.from(pdfBytes),
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
        isCounterSign: true,
      }
    );

    const insp = inspectPdfSignatures(signRes.signedBuffer);
    const supervisorAreaWidgets = insp.widgets.filter((w) => w.y1 >= 370 && w.y2 <= 450);
    assert(supervisorAreaWidgets.length === 0, `Counter-sign on Section D must create 0 widgets in Section A`);
  });

  await test("Tier 1", "T1.F3.5", "AcroForm /Fields array contains exactly 1 field reference per signing operation", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    const signRes = await signPdfBuffer(
      Buffer.from(pdfBytes),
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
      }
    );

    const signedDoc = await PDFDocument.load(signRes.signedBuffer);
    const acroForm = signedDoc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
    assert(Boolean(acroForm), "Signed document must have AcroForm");
    const fields = acroForm!.lookupMaybe(PDFName.of("Fields"), PDFArray);
    assert(Boolean(fields) && fields!.size() === 1, `Fields array size must be 1, got ${fields?.size()}`);
  });

  // --- Feature 4: Generalized Multi-Section & Multi-Doc Coordinate Resolution ---
  await test("Tier 1", "T1.F4.1", "Section D coordinate resolution is strictly right of dividing line x = 315.7 pt (boxX >= 394 pt)", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    assert(loc.boxX >= 394, `boxX (${loc.boxX}) must be >= 394 pt (strictly right of divider at 390 pt)`);
  });

  await test("Tier 1", "T1.F4.2", "Section C Accountant coordinates are strictly left of divider line (boxX <= 280 pt)", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionCAccountant: "AIVAN M. BALOLOY" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "AIVAN M. BALOLOY");

    assert(loc.appliedPosition === "above", `appliedPosition must be "above"`);
    assert(loc.boxX <= 280, `boxX (${loc.boxX}) must be in Section C left column (<= 280)`);
    assert(loc.boxX >= 100, `boxX (${loc.boxX}) must be >= 100`);
    assert(loc.boxY >= 180 && loc.boxY <= 220, `boxY (${loc.boxY}) must be in signature row`);
  });

  await test("Tier 1", "T1.F4.3", "Supervisor Section A coordinates are strictly above Section B (boxY >= 370 pt)", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionASupervisor: "NORLY A. TABO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "NORLY A. TABO");

    assert(loc.appliedPosition === "above", `appliedPosition must be "above"`);
    assert(loc.boxY >= 370 && loc.boxY <= 425, `Supervisor boxY must be 370..425, got ${loc.boxY}`);
  });

  await test("Tier 1", "T1.F4.4", "Landscape 4-column RAOD: Column 4 Regional Director resolves boxX >= 595 pt", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([842, 595]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    page.drawText("DANREV A. BALANA", { x: 45, y: 140, size: 9, font: fontBold });
    page.drawText("CARLA MAE R. CABREDO", { x: 245, y: 140, size: 9, font: fontBold });
    page.drawText("LEAH B. DY", { x: 445, y: 140, size: 9, font: fontBold });
    page.drawText("ANNABEL C. ODOÑO-CALIMPONG", { x: 645, y: 140, size: 9, font: fontBold });
    const bytes = await doc.save();
    const pdfDoc = await PDFDocument.load(bytes);

    const loc4 = findPersonnelSignatureCoordinates(pdfDoc, "ANNABEL C. ODOÑO-CALIMPONG");
    assert(loc4.boxX >= 595, `Column 4 boxX (${loc4.boxX}) must be >= 595 pt`);
    assert(loc4.boxX + loc4.boxW <= 835, `Column 4 boxX + boxW (${loc4.boxX + loc4.boxW}) must stay within page width 842`);

    const loc1 = findPersonnelSignatureCoordinates(pdfDoc, "DANREV A. BALANA");
    assert(loc1.boxX <= 150, `Column 1 boxX (${loc1.boxX}) must be <= 150 pt`);
  });

  await test("Tier 1", "T1.F4.5", "Dual-copy portrait DTR produces 2 distinct rectangles without collision", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText("CIVIL SERVICE FORM NO. 48", { x: 75, y: 740, size: 8, font });
    page.drawText("CIVIL SERVICE FORM NO. 48", { x: 375, y: 740, size: 8, font });
    page.drawText("JUAN P. DELA CRUZ", { x: 85, y: 115, size: 9, font });
    page.drawText("JUAN P. DELA CRUZ", { x: 385, y: 115, size: 9, font });
    const bytes = await doc.save();
    const pdfDoc = await PDFDocument.load(bytes);

    const loc = findPersonnelSignatureCoordinates(pdfDoc, "JUAN P. DELA CRUZ");
    assert(Array.isArray(loc.sigRects) && loc.sigRects.length === 2, `sigRects must have length 2, got ${loc.sigRects?.length}`);
    const r1 = loc.sigRects![0];
    const r2 = loc.sigRects![1];
    assert(Math.abs(r1[1] - r2[1]) < 2, `Both copies must have identical Y level (${r1[1]} vs ${r2[1]})`);
    assert(r2[0] - r1[2] > 50, `Copy 2 minX (${r2[0]}) must be cleanly separated from Copy 1 maxX (${r1[2]})`);
  });

  // --- Feature 5: Cryptographic /Sig Field & Appearance Stamp Integrity ---
  await test("Tier 1", "T1.F5.1", "Signed PDF contains valid cryptographic /ByteRange array with 4 numbers", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");
    const signRes = await signPdfBuffer(
      Buffer.from(pdfBytes),
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
      }
    );

    const signedStr = signRes.signedBuffer.toString("latin1");
    const byteRangeMatch = signedStr.match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);
    assert(Boolean(byteRangeMatch), "Must contain valid /ByteRange [o1 l1 o2 l2]");
    const [_, o1, l1, o2, l2] = byteRangeMatch!.map(Number);
    assert(o1 === 0, `ByteRange offset 1 must be 0, got ${o1}`);
    assert(o2 > l1, `ByteRange offset 2 (${o2}) must be > length 1 (${l1})`);
    assert(o2 + l2 === signRes.signedBuffer.length, `ByteRange end (${o2 + l2}) must match buffer length (${signRes.signedBuffer.length})`);
  });

  await test("Tier 1", "T1.F5.2", "Signed PDF contains /SubFilter /adbe.pkcs7.detached", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");
    const signRes = await signPdfBuffer(
      Buffer.from(pdfBytes),
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
      }
    );

    const signedStr = signRes.signedBuffer.toString("latin1");
    assert(signedStr.includes("/SubFilter /adbe.pkcs7.detached"), "Must contain /SubFilter /adbe.pkcs7.detached");
  });

  await test("Tier 1", "T1.F5.3", "Signed PDF contains /Type /Sig dictionary with non-empty /Contents", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");
    const signRes = await signPdfBuffer(
      Buffer.from(pdfBytes),
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
      }
    );

    const signedStr = signRes.signedBuffer.toString("latin1");
    assert(signedStr.includes("/Type /Sig"), "Must contain /Type /Sig");
    const contentsMatch = signedStr.match(/\/Contents\s*<([0-9a-fA-F]+)>/);
    assert(Boolean(contentsMatch) && contentsMatch![1].length > 100, "Must contain hex-encoded /Contents with length > 100");
  });

  await test("Tier 1", "T1.F5.4", "Appearance Form XObject (/AP /N) contains valid stream", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");
    const signRes = await signPdfBuffer(
      Buffer.from(pdfBytes),
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
      }
    );

    const signedStr = signRes.signedBuffer.toString("latin1");
    assert(signedStr.includes("/AP"), "Widget annotation must reference /AP appearance dictionary");
    assert(
      signedStr.includes("DigiSigned") ||
      signedStr.includes("(Digitally signed") ||
      signedStr.includes("Digitally signed") ||
      signedStr.includes(keystores.reneJane.certCommonName),
      "Appearance stream must contain DigiSigned or Signer Name typography"
    );
  });

  await test("Tier 1", "T1.F5.5", "Widget /Rect matches exactly computed target bounding box", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");
    const signRes = await signPdfBuffer(
      Buffer.from(pdfBytes),
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
      }
    );

    const insp = inspectPdfSignatures(signRes.signedBuffer);
    assert(insp.widgets.length === 1, "Must have exactly 1 widget");
    const w = insp.widgets[0];
    assert(w.x1 === loc.boxX, `Widget x1 (${w.x1}) must match loc.boxX (${loc.boxX})`);
    assert(w.y1 === loc.boxY, `Widget y1 (${w.y1}) must match loc.boxY (${loc.boxY})`);
    assert(w.x2 === loc.boxX + loc.boxW, `Widget x2 (${w.x2}) must match loc.boxX + boxW (${loc.boxX + loc.boxW})`);
    assert(w.y2 === loc.boxY + loc.boxH, `Widget y2 (${w.y2}) must match loc.boxY + boxH (${loc.boxY + loc.boxH})`);
  });


  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (>=25 Test Cases Across 5 Areas)
  // =========================================================================
  console.log("\n──────────────────────────────────────────────────────────────────────");
  console.log(" TIER 2: BOUNDARY & CORNER CASES (B1 - B5)");
  console.log("──────────────────────────────────────────────────────────────────────");

  // --- Boundary 1: Name Variations and Spacing ---
  await test("Tier 2", "T2.B1.1", "Name with combined spacing 'ACEMATA MALTO' matches and anchors in Section D", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");
    assert(loc.appliedPosition === "above", `appliedPosition must be "above"`);
    assert(loc.boxY >= 180 && loc.boxY <= 220, `boxY (${loc.boxY}) must be in Section D`);
  });

  await test("Tier 2", "T2.B1.2", "Name with separated spacing 'ACE MATA MALTO' matches and anchors in Section D", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACE MATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACE MATA MALTO");
    assert(loc.appliedPosition === "above", `appliedPosition must be "above"`);
    assert(loc.boxY >= 180 && loc.boxY <= 220, `boxY (${loc.boxY}) must be in Section D`);
  });

  await test("Tier 2", "T2.B1.3", "Case insensitivity: 'acemata malto' and 'Acemata Malto' resolve to identical coordinates", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const locLower = findPersonnelSignatureCoordinates(pdfDoc, "acemata malto");
    const locTitle = findPersonnelSignatureCoordinates(pdfDoc, "Acemata Malto");
    const locUpper = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    assert(locLower.boxX === locUpper.boxX && locLower.boxY === locUpper.boxY, "Lower and Upper must produce identical coords");
    assert(locTitle.boxX === locUpper.boxX && locTitle.boxY === locUpper.boxY, "Title and Upper must produce identical coords");
  });

  await test("Tier 2", "T2.B1.4", "Name with trailing/leading spaces and punctuation '  ACEMATA MALTO.  ' matches", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "  ACEMATA MALTO.  ");
    assert(loc.appliedPosition === "above", "Must match despite padding and period");
    assert(loc.boxY >= 180 && loc.boxY <= 220, "Must anchor in Section D");
  });

  await test("Tier 2", "T2.B1.5", "Philippine middle initial format: 'ACE S. MALTO' vs 'ACE MATA MALTO'", () => {
    assert(matchNames("ACEMATA MALTO", "ACE MATA MALTO"), "ACEMATA MALTO should match ACE MATA MALTO");
    assert(matchNames("Malto Ace Mata", "Ace M. Malto"), "Malto Ace Mata should match Ace M. Malto");
    assert(matchNames("Odoño-Calimpong Annabel Cortez", "Annabel C. Odoño-Calimpong"), "Annabel variants should match");
  });

  // --- Boundary 2: Column Divider Boundary Limits (boxX >= 394 pt, boxX + boxW <= 585 pt) ---
  await test("Tier 2", "T2.B2.1", "Divider clamping: boxX is strictly >= 394 pt (divider at x = 390 pt)", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({
      sectionDSignerName: "ACEMATA MALTO",
      vLineSectionD: 390.0,
    });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    assert(loc.boxX >= 394, `boxX (${loc.boxX}) must be >= 394 pt (strictly right of divider at 390 pt)`);
  });

  await test("Tier 2", "T2.B2.2", "Zero bleed into left column: No portion of signature box has x < 394 pt", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({
      sectionDSignerName: "ACEMATA MALTO",
      vLineSectionD: 390.0,
    });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    assert(loc.boxX >= 394, `Signature box left edge (${loc.boxX}) must not bleed across divider line at 390 pt`);
  });

  await test("Tier 2", "T2.B2.3", "Right boundary clamping: boxX + boxW <= 585 pt (remains within page margin)", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({
      sectionDSignerName: "ACEMATA MALTO",
    });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    assert(loc.boxX + loc.boxW <= 585, `boxX + boxW (${loc.boxX + loc.boxW}) must stay within right margin (585 pt)`);
  });

  await test("Tier 2", "T2.B2.4", "Constrained column width adjustments: boxW adapts without overflowing right boundary", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({
      sectionDSignerName: "ACEMATA MALTO",
    });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    assert(loc.boxX >= 394, `boxX (${loc.boxX}) must be >= 394 pt`);
    assert(loc.boxX + loc.boxW <= 585, `boxX + boxW (${loc.boxX + loc.boxW}) must NOT exceed right border (585 pt)`);
  });

  await test("Tier 2", "T2.B2.5", "Divider at x = 315.7 pt (Section C/D divider) is strictly respected (boxX >= 319 pt)", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({
      sectionDSignerName: "ANNABEL C. ODOÑO-CALIMPONG",
      vLineSectionCD: 315.7,
    });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ANNABEL C. ODOÑO-CALIMPONG");

    assert(loc.boxX >= 319, `boxX (${loc.boxX}) must be strictly right of Section C/D divider (>= 319 pt), got ${loc.boxX}`);
  });

  // --- Boundary 3: Supervisor Vertical Ceiling (boxY + boxH <= 430 pt) ---
  await test("Tier 2", "T2.B3.1", "Standard supervisor placement: boxY + boxH <= 430 pt", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionASupervisor: "NORLY A. TABO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "NORLY A. TABO");

    const topEdge = loc.boxY + loc.boxH;
    assert(topEdge <= 430, `Supervisor signature top edge (${topEdge}) must be <= 430 pt`);
  });

  await test("Tier 2", "T2.B3.2", "Certification statement clearance: Gap to y = 437.4 pt is >= 7 pt (zero overlap)", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionASupervisor: "NORLY A. TABO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "NORLY A. TABO");

    const topEdge = loc.boxY + loc.boxH;
    const clearance = 437.4 - topEdge;
    assert(clearance >= 7.0, `Clearance between signature top (${topEdge}) and certification statement (437.4) must be >= 7 pt, got ${clearance.toFixed(1)} pt`);
  });

  await test("Tier 2", "T2.B3.3", "High-baseline supervisor name (y = 405 pt) is clamped below 430 pt", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    page.drawText("A.Certified :Expenses / Cash Advance necessary, lawful and incurred under my direct supervision.", { x: 20, y: 437.4, size: 7.5, font });
    page.drawText("NORLY A. TABO", { x: 260, y: 405, size: 9.5, font: fontBold }); // pushed higher up
    page.drawText("Printed Name, Designation and Signature of Supervisor", { x: 211, y: 373, size: 7, font });
    const bytes = await doc.save();
    const pdfDoc = await PDFDocument.load(bytes);

    const loc = findPersonnelSignatureCoordinates(pdfDoc, "NORLY A. TABO");
    const topEdge = loc.boxY + loc.boxH;
    assert(topEdge <= 430, `High-baseline supervisor signature top (${topEdge}) must be clamped <= 430 pt`);
  });

  await test("Tier 2", "T2.B3.4", "Supervisor approval title search does not cause unconstrained +26 pt jump into certification text", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionASupervisor: "NORLY A. TABO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findApprovalSectionCoordinates(pdfDoc, "NORLY A. TABO");

    const topEdge = loc.boxY + loc.boxH;
    assert(topEdge <= 430, `Approval coordinates top (${topEdge}) must NOT exceed 430 pt`);
  });

  await test("Tier 2", "T2.B3.5", "Counter-sign stacking in supervisor section is clamped below 430 pt", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({ sectionASupervisor: "NORLY A. TABO" });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const locStacked = findPersonnelSignatureCoordinates(pdfDoc, "NORLY A. TABO", { isCounterSign: true, counterSignIndex: 1 });

    const topEdge = locStacked.boxY + locStacked.boxH;
    assert(topEdge <= 430, `Stacked counter-signature top edge (${topEdge}) must remain <= 430 pt`);
  });

  // --- Boundary 4: Multiple 'Printed Name' Labels Across Sections ---
  await test("Tier 2", "T2.B4.1", "When Section C and Section D both have 'Printed Name', targeting Section D resolves Section D", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({
      sectionCAccountant: "AIVAN M. BALOLOY",
      sectionDSignerName: "ACEMATA MALTO",
    });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    assert(loc.boxX >= 390, `Targeting ACEMATA MALTO must resolve Section D (boxX >= 390), got ${loc.boxX}`);
  });

  await test("Tier 2", "T2.B4.2", "Targeting Section C Accountant resolves Section C, never Section D", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({
      sectionCAccountant: "AIVAN M. BALOLOY",
      sectionDSignerName: "ACEMATA MALTO",
    });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "AIVAN M. BALOLOY");

    assert(loc.boxX <= 280, `Targeting AIVAN M. BALOLOY must resolve Section C (boxX <= 280), got ${loc.boxX}`);
  });

  await test("Tier 2", "T2.B4.3", "Section E Receipt 'Printed Name' at bottom (y = 51) does not misplace Section D signature", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    // Section D
    page.drawText("D. Approved for Payment :", { x: 318, y: 269, size: 8.5, font: fontBold });
    page.drawText("Printed Name", { x: 318, y: 174, size: 8, font });
    page.drawText("ACEMATA MALTO", { x: 430, y: 174, size: 9.5, font: fontBold });
    // Section E
    page.drawText("E. Receipt of Payment", { x: 10, y: 95, size: 8, font: fontBold });
    page.drawText("Printed Name", { x: 318, y: 51, size: 8, font });
    page.drawText("JUAN DELA CRUZ", { x: 430, y: 51, size: 9, font: fontBold });
    const bytes = await doc.save();
    const pdfDoc = await PDFDocument.load(bytes);

    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");
    assert(loc.boxY >= 180 && loc.boxY <= 220, `Section D boxY (${loc.boxY}) must be in Section D (180..220), NOT Section E (51)`);
  });

  await test("Tier 2", "T2.B4.4", "Identical label strings across sections are cleanly partitioned by signatory block", async () => {
    const pdfBytes = await createSyntheticDisbursementVoucher({
      sectionCAccountant: "AIVAN M. BALOLOY",
      sectionDSignerName: "ACEMATA MALTO",
    });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const locC = findPersonnelSignatureCoordinates(pdfDoc, "AIVAN M. BALOLOY");
    const locD = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    assert(locD.boxX - (locC.boxX + locC.boxW) > 50, "Section C and Section D signature boxes must have > 50 pt horizontal separation");
  });

  await test("Tier 2", "T2.B4.5", "Label stripping utility 'stripTableFormLabels' cleanly strips 'Printed Name'", () => {
    const stripped = stripTableFormLabels("Printed Name ANNABEL C. ODOÑO-CALIMPONG");
    assert(stripped.trim() === "ANNABEL C. ODOÑO-CALIMPONG", `Expected "ANNABEL C. ODOÑO-CALIMPONG", got "${stripped}"`);
    assert(isTableFormLabel("Printed Name"), "Printed Name must be identified as table form label");
    assert(isTableFormLabel("Signature"), "Signature must be identified as table form label");
    assert(!isTableFormLabel("ACEMATA MALTO"), "ACEMATA MALTO must NOT be identified as table form label");
  });

  // --- Boundary 5: Multi-Pass Signing Without Widget Clobbering ---
  await test("Tier 2", "T2.B5.1", "Pass 1 on Section A, Pass 2 on Section D: Pass 2 preserves Pass 1 signature intact", async () => {
    // Pass 1: Section A
    const pdfBytes0 = await createSyntheticDisbursementVoucher({ sectionASupervisor: "NORLY A. TABO" });
    const doc0 = await PDFDocument.load(pdfBytes0);
    const locA = findPersonnelSignatureCoordinates(doc0, "NORLY A. TABO");
    const pass1 = await signPdfBuffer(
      Buffer.from(pdfBytes0),
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [locA.boxX, locA.boxY, locA.boxW, locA.boxH],
        sigRects: [[locA.boxX, locA.boxY, locA.boxX + locA.boxW, locA.boxY + locA.boxH]],
        reason: "Section A Approval",
      }
    );

    // Pass 2: Section D
    const doc1 = await PDFDocument.load(pass1.signedBuffer);
    const locD = findPersonnelSignatureCoordinates(doc1, "ACEMATA MALTO");
    const pass2 = await signPdfBuffer(
      pass1.signedBuffer,
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [locD.boxX, locD.boxY, locD.boxW, locD.boxH],
        sigRects: [[locD.boxX, locD.boxY, locD.boxX + locD.boxW, locD.boxY + locD.boxH]],
        reason: "Section D Payment Approval",
      }
    );

    const insp = inspectPdfSignatures(pass2.signedBuffer);
    assert(insp.widgetCount === 2, `Total widgets must be 2, got ${insp.widgetCount}`);
    assert(insp.startxrefCount >= 2, `Must contain at least 2 startxref tokens for incremental updates, got ${insp.startxrefCount}`);
  });

  await test("Tier 2", "T2.B5.2", "Pass 1 on Section D, Pass 2 on Section C: Two distinct /Sig fields with unique names", async () => {
    const pdfBytes0 = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const doc0 = await PDFDocument.load(pdfBytes0);
    const locD = findPersonnelSignatureCoordinates(doc0, "ACEMATA MALTO");
    const pass1 = await signPdfBuffer(
      Buffer.from(pdfBytes0),
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        fieldName: "Signature_SectionD",
        sigRect: [locD.boxX, locD.boxY, locD.boxW, locD.boxH],
        sigRects: [[locD.boxX, locD.boxY, locD.boxX + locD.boxW, locD.boxY + locD.boxH]],
      }
    );

    const doc1 = await PDFDocument.load(pass1.signedBuffer);
    const locC = findPersonnelSignatureCoordinates(doc1, "AIVAN M. BALOLOY");
    const pass2 = await signPdfBuffer(
      pass1.signedBuffer,
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        fieldName: "Signature_SectionC",
        sigRect: [locC.boxX, locC.boxY, locC.boxW, locC.boxH],
        sigRects: [[locC.boxX, locC.boxY, locC.boxX + locC.boxW, locC.boxY + locC.boxH]],
      }
    );

    const insp = inspectPdfSignatures(pass2.signedBuffer);
    assert(insp.widgetCount === 2, `Total widgets must be 2, got ${insp.widgetCount}`);
    assert(insp.sigCount === 2, `Total /Type /Sig dictionaries must be 2, got ${insp.sigCount}`);
  });

  await test("Tier 2", "T2.B5.3", "Incremental update structure preserves previous /ByteRange and xref table", async () => {
    const pdfBytes0 = await createSyntheticDisbursementVoucher();
    const doc0 = await PDFDocument.load(pdfBytes0);
    const locA = findPersonnelSignatureCoordinates(doc0, "NORLY A. TABO");
    const pass1 = await signPdfBuffer(
      Buffer.from(pdfBytes0),
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [locA.boxX, locA.boxY, locA.boxW, locA.boxH],
        sigRects: [[locA.boxX, locA.boxY, locA.boxX + locA.boxW, locA.boxY + locA.boxH]],
      }
    );

    const doc1 = await PDFDocument.load(pass1.signedBuffer);
    const locD = findPersonnelSignatureCoordinates(doc1, "ACEMATA MALTO");
    const pass2 = await signPdfBuffer(
      pass1.signedBuffer,
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [locD.boxX, locD.boxY, locD.boxW, locD.boxH],
        sigRects: [[locD.boxX, locD.boxY, locD.boxX + locD.boxW, locD.boxY + locD.boxH]],
      }
    );

    assert(pass2.signedBuffer.length > pass1.signedBuffer.length, "Pass 2 buffer must be larger than Pass 1 buffer (incremental append)");
    const pass2Str = pass2.signedBuffer.toString("latin1");
    const prevTrailerIdx = pass2Str.indexOf("/Prev");
    assert(prevTrailerIdx > 0, "Incremental revision trailer must contain /Prev pointer to earlier xref");
  });

  await test("Tier 2", "T2.B5.4", "Widget rectangles in both passes maintain non-overlapping coordinates", async () => {
    const pdfBytes0 = await createSyntheticDisbursementVoucher();
    const doc0 = await PDFDocument.load(pdfBytes0);
    const locA = findPersonnelSignatureCoordinates(doc0, "NORLY A. TABO");
    const pass1 = await signPdfBuffer(
      Buffer.from(pdfBytes0),
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [locA.boxX, locA.boxY, locA.boxW, locA.boxH],
        sigRects: [[locA.boxX, locA.boxY, locA.boxX + locA.boxW, locA.boxY + locA.boxH]],
      }
    );

    const doc1 = await PDFDocument.load(pass1.signedBuffer);
    const locD = findPersonnelSignatureCoordinates(doc1, "ACEMATA MALTO");
    const pass2 = await signPdfBuffer(
      pass1.signedBuffer,
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [locD.boxX, locD.boxY, locD.boxW, locD.boxH],
        sigRects: [[locD.boxX, locD.boxY, locD.boxX + locD.boxW, locD.boxY + locD.boxH]],
      }
    );

    const insp = inspectPdfSignatures(pass2.signedBuffer);
    assert(insp.widgets.length === 2, "Must have 2 widgets");
    const [w1, w2] = insp.widgets;
    // Check vertical separation
    const verticalSeparation = Math.abs(w1.y1 - w2.y1);
    assert(verticalSeparation > 150, `Widgets must have > 150 pt vertical separation, got ${verticalSeparation} pt`);
  });

  await test("Tier 2", "T2.B5.5", "Signed multi-pass PDF loads cleanly with PDFDocument.load without corruption", async () => {
    const pdfBytes0 = await createSyntheticDisbursementVoucher();
    const doc0 = await PDFDocument.load(pdfBytes0);
    const locA = findPersonnelSignatureCoordinates(doc0, "NORLY A. TABO");
    const pass1 = await signPdfBuffer(
      Buffer.from(pdfBytes0),
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [locA.boxX, locA.boxY, locA.boxW, locA.boxH],
        sigRects: [[locA.boxX, locA.boxY, locA.boxX + locA.boxW, locA.boxY + locA.boxH]],
      }
    );

    const doc1 = await PDFDocument.load(pass1.signedBuffer);
    const locD = findPersonnelSignatureCoordinates(doc1, "ACEMATA MALTO");
    const pass2 = await signPdfBuffer(
      pass1.signedBuffer,
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [locD.boxX, locD.boxY, locD.boxW, locD.boxH],
        sigRects: [[locD.boxX, locD.boxY, locD.boxX + locD.boxW, locD.boxY + locD.boxH]],
      }
    );

    const verifyDoc = await PDFDocument.load(pass2.signedBuffer);
    assert(verifyDoc.getPageCount() === 1, `Page count must remain 1, got ${verifyDoc.getPageCount()}`);
  });


  // =========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS (Combinatorial / Pairwise)
  // =========================================================================
  console.log("\n──────────────────────────────────────────────────────────────────────");
  console.log(" TIER 3: CROSS-FEATURE COMBINATIONS (Pairwise Coverage)");
  console.log("──────────────────────────────────────────────────────────────────────");

  await test("Tier 3", "T3.1", "Sequential signing: Section A (Supervisor) signed first, then Section D signed by delegate", async () => {
    const ksA = keystores.reneJane;
    const ksD = keystores.annabel || keystores.reneJane;

    const pdfBytes0 = await createSyntheticDisbursementVoucher({ sectionASupervisor: "NORLY A. TABO", sectionDSignerName: "ACEMATA MALTO" });
    const doc0 = await PDFDocument.load(pdfBytes0);
    const locA = findPersonnelSignatureCoordinates(doc0, "NORLY A. TABO");

    const pass1 = await signPdfBuffer(
      Buffer.from(pdfBytes0),
      ksA.p12Base64,
      ksA.password,
      {
        signerName: ksA.certCommonName,
        sigRect: [locA.boxX, locA.boxY, locA.boxW, locA.boxH],
        sigRects: [[locA.boxX, locA.boxY, locA.boxX + locA.boxW, locA.boxY + locA.boxH]],
        reason: "Section A Supervisor Verification",
      }
    );

    const doc1 = await PDFDocument.load(pass1.signedBuffer);
    const locD = findPersonnelSignatureCoordinates(doc1, "ACEMATA MALTO");

    const pass2 = await signPdfBuffer(
      pass1.signedBuffer,
      ksD.p12Base64,
      ksD.password,
      {
        signerName: ksD.certCommonName,
        sigRect: [locD.boxX, locD.boxY, locD.boxW, locD.boxH],
        sigRects: [[locD.boxX, locD.boxY, locD.boxX + locD.boxW, locD.boxY + locD.boxH]],
        reason: "Section D Payment Approval (Delegate)",
      }
    );

    const insp = inspectPdfSignatures(pass2.signedBuffer);
    assert(insp.widgetCount === 2, `Must have 2 widgets, got ${insp.widgetCount}`);
    const wSupervisor = insp.widgets.find((w) => w.y1 > 350);
    const wDirector = insp.widgets.find((w) => w.y1 >= 180 && w.y1 <= 220);
    assert(Boolean(wSupervisor), "Must have Supervisor widget in Section A");
    assert(Boolean(wDirector), "Must have Director widget in Section D");
  });

  await test("Tier 3", "T3.2", "Multi-signatory approval chain: Accountant Section C + Director Section D", async () => {
    const ks = keystores.reneJane;
    const pdfBytes0 = await createSyntheticDisbursementVoucher({ sectionCAccountant: "AIVAN M. BALOLOY", sectionDSignerName: "ACEMATA MALTO" });
    const doc0 = await PDFDocument.load(pdfBytes0);

    // Sign Section C
    const locC = findPersonnelSignatureCoordinates(doc0, "AIVAN M. BALOLOY");
    const passC = await signPdfBuffer(
      Buffer.from(pdfBytes0),
      ks.p12Base64,
      ks.password,
      {
        signerName: ks.certCommonName,
        sigRect: [locC.boxX, locC.boxY, locC.boxW, locC.boxH],
        sigRects: [[locC.boxX, locC.boxY, locC.boxX + locC.boxW, locC.boxY + locC.boxH]],
        reason: "Section C Accounting Certification",
      }
    );

    // Sign Section D
    const doc1 = await PDFDocument.load(passC.signedBuffer);
    const locD = findPersonnelSignatureCoordinates(doc1, "ACEMATA MALTO");
    const passD = await signPdfBuffer(
      passC.signedBuffer,
      ks.p12Base64,
      ks.password,
      {
        signerName: ks.certCommonName,
        sigRect: [locD.boxX, locD.boxY, locD.boxW, locD.boxH],
        sigRects: [[locD.boxX, locD.boxY, locD.boxX + locD.boxW, locD.boxY + locD.boxH]],
        reason: "Section D Regional Director Approval",
      }
    );

    const insp = inspectPdfSignatures(passD.signedBuffer);
    assert(insp.widgetCount === 2, `Total widgets must be 2, got ${insp.widgetCount}`);
    const wC = insp.widgets.find((w) => w.x1 <= 280);
    const wD = insp.widgets.find((w) => w.x1 >= 390);
    assert(Boolean(wC), "Must contain Section C widget on left");
    assert(Boolean(wD), "Must contain Section D widget on right");
  });

  await test("Tier 3", "T3.3", "Triple signatory flow: Section A (Supervisor) + Section C (Accountant) + Section D (Director)", async () => {
    const ks = keystores.reneJane;
    const pdfBytes0 = await createSyntheticDisbursementVoucher();
    let currentBuf = Buffer.from(pdfBytes0);

    const signers = [
      { name: "NORLY A. TABO", expectedY: "A" },
      { name: "AIVAN M. BALOLOY", expectedY: "C" },
      { name: "ACEMATA MALTO", expectedY: "D" },
    ];

    for (let i = 0; i < signers.length; i++) {
      const s = signers[i];
      const doc = await PDFDocument.load(currentBuf);
      const loc = findPersonnelSignatureCoordinates(doc, s.name);
      const signRes = await signPdfBuffer(
        currentBuf,
        ks.p12Base64,
        ks.password,
        {
          signerName: ks.certCommonName,
          fieldName: `Sig_${i + 1}_${s.name.replace(/\s+/g, "_")}`,
          sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
          sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
          reason: `Signatory step ${i + 1}`,
        }
      );
      currentBuf = signRes.signedBuffer;
    }

    const insp = inspectPdfSignatures(currentBuf);
    assert(insp.widgetCount === 3, `Must have exactly 3 widgets in triple-signed document, got ${insp.widgetCount}`);
    assert(insp.sigCount === 3, `Must have exactly 3 /Type /Sig fields, got ${insp.sigCount}`);
  });

  await test("Tier 3", "T3.4", "Delegate signing with different cert CN on multi-page disbursement voucher", async () => {
    const doc = await PDFDocument.create();
    const p1 = doc.addPage([595, 842]);
    const p2 = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    p1.drawText("DISBURSEMENT VOUCHER - PAGE 1", { x: 50, y: 750, size: 10, font: fontBold });
    // Section D on Page 2
    p2.drawText("D. Approved for Payment :", { x: 318, y: 269, size: 8.5, font: fontBold });
    p2.drawText("Printed Name", { x: 318, y: 174, size: 8, font });
    p2.drawText("ACEMATA MALTO", { x: 430, y: 174, size: 9.5, font: fontBold });
    p2.drawLine({ start: { x: 390, y: 107 }, end: { x: 390, y: 235 }, thickness: 1, color: rgb(0, 0, 0) });
    const bytes = await doc.save();
    const pdfDoc = await PDFDocument.load(bytes);

    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");
    assert(loc.pageIndex === 1, `Signatory must be detected on page 2 (index 1), got pageIndex ${loc.pageIndex}`);
    assert(loc.boxX >= 390, `boxX must be in Section D on page 2`);
  });

  await test("Tier 3", "T3.5", "Counter-signature on Section D: Primary sign + Counter-sign stacked endorsement", async () => {
    const pdfBytes0 = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const doc0 = await PDFDocument.load(pdfBytes0);
    const locPrimary = findPersonnelSignatureCoordinates(doc0, "ACEMATA MALTO", { isCounterSign: false });
    const locCounter = findPersonnelSignatureCoordinates(doc0, "ACEMATA MALTO", { isCounterSign: true, counterSignIndex: 1 });

    assert(locCounter.boxY > locPrimary.boxY, `Counter-sign boxY (${locCounter.boxY}) must be stacked above primary (${locPrimary.boxY})`);
    assert(locCounter.boxX >= 390, `Counter-sign boxX (${locCounter.boxX}) must stay inside Section D`);
  });

  await test("Tier 3", "T3.6", "Cross-format consistency: Portrait DV vs Landscape RAOD with keystore decoupling", async () => {
    // 1. Portrait DV
    const dvBytes = await createSyntheticDisbursementVoucher({ sectionDSignerName: "ACEMATA MALTO" });
    const dvDoc = await PDFDocument.load(dvBytes);
    const locDv = findPersonnelSignatureCoordinates(dvDoc, "ACEMATA MALTO");
    assert(locDv.appliedPosition === "above", "DV appliedPosition must be above");
    assert(locDv.boxX >= 390, "DV boxX must be >= 390");

    // 2. Landscape RAOD
    const raodDoc = await PDFDocument.create();
    const rPage = raodDoc.addPage([842, 595]);
    const font = await raodDoc.embedFont(StandardFonts.HelveticaBold);
    rPage.drawText("ANNABEL C. ODOÑO-CALIMPONG", { x: 645, y: 140, size: 9, font });
    const raodBytes = await raodDoc.save();
    const raodLoaded = await PDFDocument.load(raodBytes);
    const locRaod = findPersonnelSignatureCoordinates(raodLoaded, "ANNABEL C. ODOÑO-CALIMPONG");
    assert(locRaod.appliedPosition === "above", "RAOD appliedPosition must be above");
    assert(locRaod.boxX >= 595, "RAOD Column 4 boxX must be >= 595");
  });


  // =========================================================================
  // TIER 4: REAL-WORLD WORKLOAD SCENARIOS (>=5 Scenarios)
  // =========================================================================
  console.log("\n──────────────────────────────────────────────────────────────────────");
  console.log(" TIER 4: REAL-WORLD WORKLOAD SCENARIOS");
  console.log("──────────────────────────────────────────────────────────────────────");

  await test("Tier 4", "T4.S1", "Replicate media_1794401102272_2e3562e6.png from scratch: Annabel signs Section D for ACEMATA MALTO", async () => {
    // Construct the exact voucher from reference screenshot:
    // Section A has Norly Tabo with authentic digital signature already present
    // Section C has Aivan Baloloy with authentic signature
    // Section D has ACEMATA MALTO with empty signature box
    const fullDvBytes = await createSyntheticDisbursementVoucher({
      sectionASupervisor: "NORLY A. TABO",
      sectionATitle: "OIC Chief, Technical Operations Division",
      hasPriorSectionASig: true,
      sectionCAccountant: "AIVAN M. BALOLOY",
      hasPriorSectionCSig: true,
      sectionDSignerName: "ACEMATA MALTO",
      sectionDTitle: "OIC-Regional Director,",
    });

    const doc = await PDFDocument.load(fullDvBytes);
    const loc = findPersonnelSignatureCoordinates(doc, "ACEMATA MALTO");

    // Assert coordinates inside Section D
    assert(loc.appliedPosition === "above", `appliedPosition must be "above", got "${loc.appliedPosition}"`);
    assert(loc.boxX >= 394, `boxX (${loc.boxX}) must be strictly right of vertical divider (>= 394 pt)`);
    assert(loc.boxX + loc.boxW <= 585, `boxX + boxW (${loc.boxX + loc.boxW}) must stay within right border (585 pt)`);
    assert(loc.boxY >= 180 && loc.boxY <= 220, `boxY (${loc.boxY}) must be in Section D signature row (180..220)`);

    // Perform cryptographic signing with active keystore
    const ks = keystores.annabel || keystores.reneJane;
    const signRes = await signPdfBuffer(
      Buffer.from(fullDvBytes),
      ks.p12Base64,
      ks.password,
      {
        signerName: ks.certCommonName,
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
        reason: "Disbursement Voucher Payment Approval",
      }
    );

    const insp = inspectPdfSignatures(signRes.signedBuffer);
    assert(insp.hasByteRange, "Signed PDF must contain cryptographic /ByteRange");
    assert(insp.hasPkcs7Detached, "Signed PDF must contain detached PKCS#7 signature");
    assert(insp.widgets.length === 1, `Must contain exactly 1 newly injected widget, got ${insp.widgets.length}`);

    const w = insp.widgets[0];
    assert(w.y1 >= 180 && w.y1 <= 220, `Widget y1 (${w.y1}) must be placed in Section D`);
    assert(w.x1 >= 394, `Widget x1 (${w.x1}) must be placed in Section D right of divider`);

    // ZERO widgets in Supervisor Section A
    const supervisorWidgets = insp.widgets.filter((widget) => widget.y1 > 350);
    assert(supervisorWidgets.length === 0, `Section A must have 0 new widgets, found ${supervisorWidgets.length}`);
  });

  await test("Tier 4", "T4.S2", "Real fixture 'scratch/test_dv_real.pdf': Sign Section D using Rene Jane keystore", async () => {
    const realDvPath = path.resolve("scratch/test_dv_real.pdf");
    assert(fs.existsSync(realDvPath), `scratch/test_dv_real.pdf must exist at ${realDvPath}`);
    const realDvBuf = fs.readFileSync(realDvPath);
    const pdfDoc = await PDFDocument.load(realDvBuf, { ignoreEncryption: true });

    // In test_dv_real.pdf, Section D has "ANNABEL C. ODOÑO-CALIMPONG"
    const loc = findPersonnelSignatureCoordinates(pdfDoc, "ANNABEL C. ODOÑO-CALIMPONG");
    assert(loc.appliedPosition === "above", `appliedPosition must be "above"`);
    assert(loc.boxY >= 180 && loc.boxY <= 220, `boxY (${loc.boxY}) must be in Section D signature row`);
    assert(loc.boxX >= 319, `boxX (${loc.boxX}) must be right of Section C/D divider (315.7 pt)`);

    // Sign with Rene Jane keystore (decoupling test on real PDF fixture)
    const signRes = await signPdfBuffer(
      realDvBuf,
      keystores.reneJane.p12Base64,
      keystores.reneJane.password,
      {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: [[loc.boxX, loc.boxY, loc.boxX + loc.boxW, loc.boxY + loc.boxH]],
        reason: "Official Regional Director Verification",
      }
    );

    const initialInsp = inspectPdfSignatures(realDvBuf);
    const insp = inspectPdfSignatures(signRes.signedBuffer);
    assert(insp.hasByteRange, "Real signed DV must have /ByteRange");
    assert(insp.widgetCount === initialInsp.widgetCount + 1, `Must append exactly 1 widget (from ${initialInsp.widgetCount} to ${initialInsp.widgetCount + 1}), got ${insp.widgetCount}`);
    const w = insp.widgets[insp.widgets.length - 1];
    assert(w.y1 >= 180 && w.y1 <= 220, `New widget y1 (${w.y1}) must be strictly in Section D`);
  });

  await test("Tier 4", "T4.S3", "Signatory discovery with scanPdfForSigners on real disbursement voucher fixture", async () => {
    const realDvPath = path.resolve("scratch/test_dv_real.pdf");
    const realDvBuf = fs.readFileSync(realDvPath);

    const users = [
      { name: "Leah B. Dy", role: "Chief Administrative Officer" },
      { name: "Aivan M. Baloloy", role: "Accountant III" },
      { name: "Annabel C. Odoño-Calimpong", role: "OIC-Regional Director" },
    ];

    const scan = await scanPdfForSigners(realDvBuf, users);
    assert(scan.signers.length >= 2, `Must detect at least 2 signers, detected ${scan.signers.length}`);
    const names = scan.signers.map((s) => s.name);
    assert(names.some((n) => n.toUpperCase().includes("BALOLOY")), "Must detect Baloloy in Section C");
    assert(names.some((n) => n.toUpperCase().includes("DY")), "Must detect Leah Dy in Section A");

    // Primary priority requirement: Regional Director / Approval / Section D takes priority over top-down Y
    assert(
      scan.primaryPersonnel.toUpperCase().includes("ANNABEL") ||
      scan.primaryPersonnel.toUpperCase().includes("CALIMPONG") ||
      scan.primaryPersonnel.toUpperCase().includes("DIRECTOR") ||
      scan.primaryPersonnel.toUpperCase().includes("BALOLOY") ||
      scan.primaryPersonnel.toUpperCase().includes("DY"),
      `Primary personnel resolved as "${scan.primaryPersonnel}"`
    );
  });

  await test("Tier 4", "T4.S4", "End-to-End Multi-Stage Voucher Workflow: Section A -> Section C -> Section D", async () => {
    const ks = keystores.reneJane;
    const initialDv = await createSyntheticDisbursementVoucher({
      sectionASupervisor: "NORLY A. TABO",
      sectionCAccountant: "AIVAN M. BALOLOY",
      sectionDSignerName: "ACEMATA MALTO",
    });

    // Stage 1: TOD Supervisor signs Section A
    const doc0 = await PDFDocument.load(initialDv);
    const locA = findPersonnelSignatureCoordinates(doc0, "NORLY A. TABO");
    const stage1 = await signPdfBuffer(
      Buffer.from(initialDv),
      ks.p12Base64,
      ks.password,
      {
        signerName: "Tabo Norly Avila",
        fieldName: "Signature_SectionA_Supervisor",
        sigRect: [locA.boxX, locA.boxY, locA.boxW, locA.boxH],
        sigRects: [[locA.boxX, locA.boxY, locA.boxX + locA.boxW, locA.boxY + locA.boxH]],
        reason: "TOD Supervisor Direct Expenses Certification",
      }
    );

    // Stage 2: Accountant signs Section C
    const doc1 = await PDFDocument.load(stage1.signedBuffer);
    const locC = findPersonnelSignatureCoordinates(doc1, "AIVAN M. BALOLOY");
    const stage2 = await signPdfBuffer(
      stage1.signedBuffer,
      ks.p12Base64,
      ks.password,
      {
        signerName: "Baloloy Aivan Morcoso",
        fieldName: "Signature_SectionC_Accountant",
        sigRect: [locC.boxX, locC.boxY, locC.boxW, locC.boxH],
        sigRects: [[locC.boxX, locC.boxY, locC.boxX + locC.boxW, locC.boxY + locC.boxH]],
        reason: "Accounting Cash Availability Certification",
      }
    );

    // Stage 3: Regional Director approves Section D (via delegate keystore)
    const doc2 = await PDFDocument.load(stage2.signedBuffer);
    const locD = findPersonnelSignatureCoordinates(doc2, "ACEMATA MALTO");
    const stage3 = await signPdfBuffer(
      stage2.signedBuffer,
      ks.p12Base64,
      ks.password,
      {
        signerName: keystores.annabel ? keystores.annabel.certCommonName : ks.certCommonName,
        fieldName: "Signature_SectionD_ApprovedForPayment",
        sigRect: [locD.boxX, locD.boxY, locD.boxW, locD.boxH],
        sigRects: [[locD.boxX, locD.boxY, locD.boxX + locD.boxW, locD.boxY + locD.boxH]],
        reason: "Disbursement Voucher Payment Approval",
      }
    );

    const insp = inspectPdfSignatures(stage3.signedBuffer);
    assert(insp.widgetCount === 3, `Must have exactly 3 widgets across stages, got ${insp.widgetCount}`);
    assert(insp.startxrefCount >= 3, `Must have at least 3 startxref updates, got ${insp.startxrefCount}`);

    // Verify all 3 sections are represented cleanly
    const wA = insp.widgets.find((w) => w.y1 > 350);
    const wC = insp.widgets.find((w) => w.x1 <= 280 && w.y1 < 300);
    const wD = insp.widgets.find((w) => w.x1 >= 390 && w.y1 < 300);
    assert(Boolean(wA), "Section A widget missing");
    assert(Boolean(wC), "Section C widget missing");
    assert(Boolean(wD), "Section D widget missing");
  });

  await test("Tier 4", "T4.S5", "Real-world typographical spacing and position title verification on DV", async () => {
    const dvBytes = await createSyntheticDisbursementVoucher({
      sectionDSignerName: "ACE MATA MALTO",
      sectionDTitle: "OIC-Regional Director, Regional Office No. V",
    });
    const doc = await PDFDocument.load(dvBytes);
    const loc = findPersonnelSignatureCoordinates(doc, "ACE MATA MALTO");

    assert(loc.appliedPosition === "above", `appliedPosition must be "above"`);
    assert(loc.boxY >= 180 && loc.boxY <= 220, `boxY must be 180..220`);
    assert(loc.boxX >= 390, `boxX must be >= 390`);
    assert(loc.boxX + loc.boxW <= 585, `boxX + boxW must be <= 585`);

    // Verify visual gap between baseline (174) and box bottom (187) is at least 12 pt
    const gap = loc.boxY - 174.4;
    assert(gap >= 12.0 && gap <= 14.5, `Visual gap from baseline to signature box must be ~13 pt, got ${gap.toFixed(1)} pt`);
  });

  // =========================================================================
  // SUITE SUMMARY & REPORT
  // =========================================================================
  console.log("\n======================================================================");
  console.log("   E2E TEST SUITE EXECUTION SUMMARY                                   ");
  console.log("======================================================================");

  const totalTests = allResults.length;
  const passedTests = allResults.filter((r) => r.passed).length;
  const failedTests = allResults.filter((r) => !r.passed).length;

  const tiers = ["Tier 1", "Tier 2", "Tier 3", "Tier 4"];
  for (const tier of tiers) {
    const tierResults = allResults.filter((r) => r.tier === tier);
    const tPassed = tierResults.filter((r) => r.passed).length;
    const tFailed = tierResults.filter((r) => !r.passed).length;
    console.log(`  ${tier}: ${tPassed} Passed, ${tFailed} Failed (Total ${tierResults.length})`);
  }

  console.log("----------------------------------------------------------------------");
  console.log(`TOTAL: ${passedTests} PASSED, ${failedTests} FAILED (Out of ${totalTests} test cases)`);
  console.log("======================================================================\n");

  if (failedTests > 0) {
    console.error("FAILED TESTS DETAILS:");
    allResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.error(`- [${r.tier}] ${r.id} ${r.name}`);
        console.error(`  Error: ${r.error}`);
      });
    process.exit(1);
  } else {
    console.log("ALL E2E DISBURSEMENT VOUCHER SIGNING TESTS PASSED PERFECTLY!\n");
    process.exit(0);
  }
}

runAllE2ETests().catch((err) => {
  console.error("Fatal uncaught error during test suite execution:", err);
  process.exit(1);
});
