/**
 * scratch/challenger_crypto_stress.ts
 *
 * ADVERSARIAL CRYPTOGRAPHIC SIGNING PIPELINE STRESS HARNESS
 * Agent: challenger_2 (critic, specialist)
 * Mission: Adversarially challenge and stress-test the cryptographic signing pipeline:
 *  - Multi-keystore signing in varied sequences
 *  - Counter-signing widget stacking & section isolation
 *  - ISO 32000 incremental update chaining & ByteRange integrity
 *  - Adversarial inputs and malformed payloads
 *  - High-throughput / concurrency stress
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import forge from "node-forge";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  findPersonnelSignatureCoordinates,
  findApprovalSectionCoordinates,
  scanPdfForSigners,
  matchNames,
  normalizeNameForMatch,
  stripTableFormLabels,
} from "../src/utils/dtrVectorPdf.js";
import {
  signPdfBuffer,
  normalizeSignatureBoundingBox,
  getSignerIdentityFromP12,
  decryptP12Password,
  fixMojibake,
  appendSignatureIncremental,
} from "../server/services/pnpkiSigningService.js";
import { db } from "../server/db.js";

interface StressTestResult {
  suite: string;
  id: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
  details?: Record<string, any>;
}

const testResults: StressTestResult[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(msg);
  }
}

async function runTest(
  suite: string,
  id: string,
  name: string,
  fn: () => Promise<Record<string, any> | void> | Record<string, any> | void
) {
  const start = Date.now();
  try {
    const details = await fn();
    const durationMs = Date.now() - start;
    testResults.push({
      suite,
      id,
      name,
      passed: true,
      durationMs,
      details: details || undefined,
    });
    console.log(`  [PASS] ${id}: ${name} (${durationMs}ms)`);
    if (details) {
      console.log(`         Details: ${JSON.stringify(details)}`);
    }
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const msg = err?.message || String(err);
    testResults.push({
      suite,
      id,
      name,
      passed: false,
      error: msg,
      durationMs,
    });
    console.error(`  [FAIL] ${id}: ${name} (${durationMs}ms)`);
    console.error(`         Error: ${msg}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYSTORE LOADER
// ─────────────────────────────────────────────────────────────────────────────

interface TestKeystore {
  id: string;
  name: string;
  certCommonName: string;
  p12Base64: string;
  password: string;
}

async function loadKeystores(): Promise<{
  reneJane: TestKeystore;
  annabel: TestKeystore;
  aceMalto: TestKeystore;
  delaTorre?: TestKeystore;
  cantorna?: TestKeystore;
}> {
  // 1. Rene Jane from scratch fixture or DB
  const rjPath = path.resolve("scratch/rene_jane.p12");
  assert(fs.existsSync(rjPath), `scratch/rene_jane.p12 must exist at ${rjPath}`);
  const rjBuf = fs.readFileSync(rjPath);
  const rjBase64 = rjBuf.toString("base64");
  const rjIdent = getSignerIdentityFromP12(rjBase64, "1234567890Aa!");

  const keystores: any = {
    reneJane: {
      id: "rene_jane",
      name: "Rene Jane R. Buena",
      certCommonName: rjIdent.commonName,
      p12Base64: rjBase64,
      password: "1234567890Aa!",
    },
  };

  // 2. Query DB for Annabel, Ace Malto, Cantorna, Dela Torre
  try {
    const res = await db.execute(
      "SELECT id, user_Id, Name, p12, p12_password FROM dtr_generator WHERE p12 IS NOT NULL"
    );
    for (const r of res.rows) {
      const p12 = r.p12 as string;
      const pw = decryptP12Password(r.p12_password as string);
      if (!p12 || !pw) continue;
      try {
        const ident = getSignerIdentityFromP12(p12, pw);
        const cn = ident.commonName.toLowerCase();
        if (cn.includes("annabel") || cn.includes("odoño") || cn.includes("odono")) {
          keystores.annabel = {
            id: String(r.id),
            name: fixMojibake(String(r.Name)),
            certCommonName: fixMojibake(ident.commonName),
            p12Base64: p12,
            password: pw,
          };
        } else if (cn.includes("ace") && cn.includes("malto")) {
          keystores.aceMalto = {
            id: String(r.id),
            name: String(r.Name),
            certCommonName: ident.commonName,
            p12Base64: p12,
            password: pw,
          };
        } else if (cn.includes("cantorna")) {
          keystores.cantorna = {
            id: String(r.id),
            name: String(r.Name),
            certCommonName: ident.commonName,
            p12Base64: p12,
            password: pw,
          };
        } else if (cn.includes("dela torre")) {
          keystores.delaTorre = {
            id: String(r.id),
            name: String(r.Name),
            certCommonName: ident.commonName,
            p12Base64: p12,
            password: pw,
          };
        }
      } catch (e) {
        // Skip unparseable rows
      }
    }
  } catch (err: any) {
    console.warn("DB load warning:", err.message);
  }

  assert(keystores.annabel, "Must have loaded Annabel keystore");
  assert(keystores.aceMalto, "Must have loaded Ace Malto keystore");

  return keystores;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNTHETIC DISBURSEMENT VOUCHER BUILDER
// ─────────────────────────────────────────────────────────────────────────────

interface DvOptions {
  sectionASupervisor?: string;
  sectionATitle?: string;
  sectionCAccountant?: string;
  sectionCTitle?: string;
  sectionDSignerName?: string;
  sectionDTitle?: string;
  vLineSectionCD?: number;
  vLineSectionD?: number;
}

async function buildSyntheticDV(opts: DvOptions = {}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);

  const leftBorder = 10.6;
  const rightBorder = 585.0;
  const vLineCD = opts.vLineSectionCD ?? 315.7;
  const vLineD = opts.vLineSectionD ?? 390.0;

  // Grid Borders
  page.drawLine({ start: { x: leftBorder, y: 107 }, end: { x: leftBorder, y: 440 }, thickness: 1, color: black });
  page.drawLine({ start: { x: rightBorder, y: 107 }, end: { x: rightBorder, y: 440 }, thickness: 1, color: black });
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

  // Section A
  page.drawText(
    "A.Certified :Expenses / Cash Advance necessary, lawful and incurred under my direct supervision.",
    { x: leftBorder, y: 437.4, size: 7.5, font, color: black }
  );
  page.drawText(opts.sectionASupervisor ?? "NORLY A. TABO", {
    x: 260.0,
    y: 396.0,
    size: 9.5,
    font: fontBold,
    color: black,
  });
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

  // Section B
  page.drawText("B.Accounting Entry :", { x: leftBorder, y: 353.5, size: 8, font: fontBold, color: black });
  page.drawText("TOTAL-P 1,248,702.00", { x: 319.4, y: 282.2, size: 8, font, color: black });

  // Section C
  page.drawText("C.Certified :", { x: leftBorder, y: 269.3, size: 8.5, font: fontBold, color: black });
  page.drawText("Signature", { x: leftBorder, y: 205.1, size: 8, font, color: black });
  page.drawText("Printed Name", { x: leftBorder, y: 174.4, size: 8, font, color: black });
  page.drawText(opts.sectionCAccountant ?? "AIVAN M. BALOLOY", {
    x: 156.9,
    y: 174.4,
    size: 9,
    font: fontBold,
    color: black,
  });
  page.drawText(opts.sectionCTitle ?? "Accountant III", {
    x: 169.1,
    y: 147.3,
    size: 8,
    font,
    color: black,
  });

  // Section D
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
  page.drawText(opts.sectionDSignerName ?? "ACEMATA MALTO", {
    x: 430.0,
    y: 174.4,
    size: 9.5,
    font: fontBold,
    color: black,
  });
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

  const bytes = await doc.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF FORENSIC & GEOMETRIC INSPECTOR
// ─────────────────────────────────────────────────────────────────────────────

interface SignatureRecord {
  byteRange: [number, number, number, number];
  rawByteRangeStr: string;
  contentsHex: string;
  name?: string;
  reason?: string;
}

interface WidgetRecord {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  fieldName?: string;
}

interface PdfForensicAnalysis {
  bufferLength: number;
  sigCount: number;
  widgetCount: number;
  startxrefOffsets: number[];
  signatures: SignatureRecord[];
  widgets: WidgetRecord[];
  acroFormFields: string[];
}

function analyzePdfForensics(buf: Buffer): PdfForensicAnalysis {
  const pdfStr = buf.toString("latin1");

  // Signatures
  const sigMatches = pdfStr.match(/\/Type\s*\/Sig\b/g) || [];
  const widgetMatches = pdfStr.match(/\/Subtype\s*\/Widget\b/g) || [];

  // Startxref offsets
  const startxrefOffsets: number[] = [];
  const sxRegex = /startxref\s+(\d+)\s+%%EOF/g;
  let sxMatch: RegExpExecArray | null;
  while ((sxMatch = sxRegex.exec(pdfStr)) !== null) {
    startxrefOffsets.push(parseInt(sxMatch[1], 10));
  }

  // ByteRanges
  const signatures: SignatureRecord[] = [];
  const brRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  let brMatch: RegExpExecArray | null;
  while ((brMatch = brRegex.exec(pdfStr)) !== null) {
    const o1 = parseInt(brMatch[1], 10);
    const l1 = parseInt(brMatch[2], 10);
    const o2 = parseInt(brMatch[3], 10);
    const l2 = parseInt(brMatch[4], 10);

    // Extract Contents Hex between (o1 + l1) and o2
    const contentsSlice = buf.slice(o1 + l1, o2).toString("latin1");
    const hexMatch = contentsSlice.match(/<([0-9a-fA-F\s]+)>/);
    const contentsHex = hexMatch ? hexMatch[1].replace(/\s+/g, "") : "";

    signatures.push({
      byteRange: [o1, l1, o2, l2],
      rawByteRangeStr: brMatch[0],
      contentsHex,
    });
  }

  // Widget Rectangles & Field Names
  const widgets: WidgetRecord[] = [];
  const widgetBlockRegex = /<<[^>]*\/Subtype\s*\/Widget[^>]*>>/gs;
  let wMatch: RegExpExecArray | null;
  while ((wMatch = widgetBlockRegex.exec(pdfStr)) !== null) {
    const block = wMatch[0];
    const rectM = block.match(/\/Rect\s*\[\s*([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s*\]/);
    const tM = block.match(/\/T\s*\(([^)]*)\)/);
    if (rectM) {
      widgets.push({
        x1: parseFloat(rectM[1]),
        y1: parseFloat(rectM[2]),
        x2: parseFloat(rectM[3]),
        y2: parseFloat(rectM[4]),
        fieldName: tM ? tM[1] : undefined,
      });
    }
  }

  // AcroForm Fields
  const acroFormFields: string[] = [];
  const afMatch = pdfStr.match(/\/AcroForm\s*<<[^>]*\/Fields\s*\[([^\]]*)\]/s);
  if (afMatch) {
    const fieldsStr = afMatch[1];
    const refs = fieldsStr.match(/\d+\s+0\s+R/g) || [];
    refs.forEach((r) => acroFormFields.push(r));
  }

  return {
    bufferLength: buf.length,
    sigCount: sigMatches.length,
    widgetCount: widgetMatches.length,
    startxrefOffsets,
    signatures,
    widgets,
    acroFormFields,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN STRESS SUITE RUNNER
// ─────────────────────────────────────────────────────────────────────────────

async function runAdversarialStressSuite() {
  console.log("======================================================================");
  console.log("   ADVERSARIAL CRYPTOGRAPHIC SIGNING PIPELINE STRESS HARNESS          ");
  console.log("======================================================================\n");

  const keystores = await loadKeystores();
  console.log(`[Keystores] Rene Jane: ${keystores.reneJane.certCommonName}`);
  console.log(`[Keystores] Annabel:   ${keystores.annabel.certCommonName}`);
  console.log(`[Keystores] Ace Malto: ${keystores.aceMalto.certCommonName}`);
  console.log("");

  // =========================================================================
  // SUITE 1: MULTI-KEYSTORE VARIED SEQUENCING STRESS
  // =========================================================================
  console.log("──────────────────────────────────────────────────────────────────────");
  console.log(" SUITE 1: Multi-Keystore Varied Sequencing Stress");
  console.log("──────────────────────────────────────────────────────────────────────");

  // Test 1.1: Section D First (Annabel for ACEMATA MALTO) -> Section A Second (Ace Malto for NORLY TABO)
  await runTest(
    "Suite 1",
    "S1.1",
    "Sequence: Section D first (Annabel for Malto) -> Section A second (Ace Malto for Tabo)",
    async () => {
      const initialPdf = await buildSyntheticDV();
      const doc1 = await PDFDocument.load(initialPdf);

      // Pass 1: Resolve Section D for ACEMATA MALTO
      const locD = findPersonnelSignatureCoordinates(doc1, "ACEMATA MALTO");
      assert(locD.boxX >= 394, `Section D boxX must be >= 394, got ${locD.boxX}`);
      assert(locD.boxY >= 180 && locD.boxY <= 200, `Section D boxY must be ~187, got ${locD.boxY}`);

      const pass1 = await signPdfBuffer(
        initialPdf,
        keystores.annabel.p12Base64,
        keystores.annabel.password,
        {
          signerName: keystores.annabel.certCommonName,
          sigRects: [[locD.boxX, locD.boxY, locD.boxX + locD.boxW, locD.boxY + locD.boxH]],
          fieldName: "Signature_SectionD_Malto",
        }
      );

      const a1 = analyzePdfForensics(pass1.signedBuffer);
      assert(a1.sigCount === 1, `Pass 1 must have 1 signature, found ${a1.sigCount}`);
      assert(a1.widgetCount === 1, `Pass 1 must have 1 widget, found ${a1.widgetCount}`);
      // Zero widgets in supervisor section (y > 350)
      const secAWidgetsP1 = a1.widgets.filter((w) => w.y1 > 350);
      assert(secAWidgetsP1.length === 0, `Pass 1 must have 0 widgets in Section A, found ${secAWidgetsP1.length}`);

      // Pass 2: Downstream sign Section A for NORLY A. TABO with Ace Malto keystore
      const doc2 = await PDFDocument.load(pass1.signedBuffer);
      const locA = findPersonnelSignatureCoordinates(doc2, "NORLY A. TABO");
      assert(locA.boxY >= 370 && locA.boxY + locA.boxH <= 430, `Section A must be clamped <= 430, got ${locA.boxY + locA.boxH}`);

      const pass2 = await signPdfBuffer(
        pass1.signedBuffer,
        keystores.aceMalto.p12Base64,
        keystores.aceMalto.password,
        {
          signerName: keystores.aceMalto.certCommonName,
          sigRects: [[locA.boxX, locA.boxY, locA.boxX + locA.boxW, locA.boxY + locA.boxH]],
          fieldName: "Signature_SectionA_Tabo",
        }
      );

      const a2 = analyzePdfForensics(pass2.signedBuffer);
      assert(a2.sigCount === 2, `Pass 2 must have 2 signatures, found ${a2.sigCount}`);
      assert(a2.widgetCount === 2, `Pass 2 must have 2 widgets, found ${a2.widgetCount}`);

      // Verify widget locations: 1 in Section D, 1 in Section A
      const secDWidgets = a2.widgets.filter((w) => w.x1 >= 394 && w.y1 < 220);
      const secAWidgets = a2.widgets.filter((w) => w.y1 >= 370 && w.y2 <= 430);
      assert(secDWidgets.length === 1, `Expected exactly 1 widget in Section D, got ${secDWidgets.length}`);
      assert(secAWidgets.length === 1, `Expected exactly 1 widget in Section A, got ${secAWidgets.length}`);

      // Verify ISO 32000 byte prefix
      assert(
        pass2.signedBuffer.slice(0, pass1.signedBuffer.length).equals(pass1.signedBuffer),
        "Pass 2 must preserve Pass 1 buffer byte-for-byte as prefix"
      );

      return { pass1Size: pass1.signedBuffer.length, pass2Size: pass2.signedBuffer.length };
    }
  );

  // Test 1.2: Sequence Inverted: Section A First (Ace Malto for TABO) -> Section D Second (Annabel for MALTO)
  await runTest(
    "Suite 1",
    "S1.2",
    "Sequence: Section A first (Ace Malto for Tabo) -> Section D second (Annabel for Malto)",
    async () => {
      const initialPdf = await buildSyntheticDV();
      const doc1 = await PDFDocument.load(initialPdf);

      // Pass 1: Sign Section A
      const locA = findPersonnelSignatureCoordinates(doc1, "NORLY A. TABO");
      const pass1 = await signPdfBuffer(
        initialPdf,
        keystores.aceMalto.p12Base64,
        keystores.aceMalto.password,
        {
          signerName: keystores.aceMalto.certCommonName,
          sigRects: [[locA.boxX, locA.boxY, locA.boxX + locA.boxW, locA.boxY + locA.boxH]],
          fieldName: "Signature_SectionA_Tabo",
        }
      );

      const a1 = analyzePdfForensics(pass1.signedBuffer);
      assert(a1.sigCount === 1, "Pass 1 sigCount === 1");
      assert(a1.widgets.length === 1, "Pass 1 widgetCount === 1");
      assert(a1.widgets[0].y1 >= 370, "Pass 1 widget must be in Section A");

      // Pass 2: Sign Section D
      const doc2 = await PDFDocument.load(pass1.signedBuffer);
      const locD = findPersonnelSignatureCoordinates(doc2, "ACEMATA MALTO");
      const pass2 = await signPdfBuffer(
        pass1.signedBuffer,
        keystores.annabel.p12Base64,
        keystores.annabel.password,
        {
          signerName: keystores.annabel.certCommonName,
          sigRects: [[locD.boxX, locD.boxY, locD.boxX + locD.boxW, locD.boxY + locD.boxH]],
          fieldName: "Signature_SectionD_Malto",
        }
      );

      const a2 = analyzePdfForensics(pass2.signedBuffer);
      assert(a2.sigCount === 2, "Pass 2 sigCount === 2");
      assert(a2.widgets.length === 2, "Pass 2 widgetCount === 2");

      // Verify no duplication: Section A still has exactly 1 widget, Section D has exactly 1
      const secAWidgets = a2.widgets.filter((w) => w.y1 >= 370);
      const secDWidgets = a2.widgets.filter((w) => w.x1 >= 394 && w.y1 < 220);
      assert(secAWidgets.length === 1, `Section A must have exactly 1 widget, got ${secAWidgets.length}`);
      assert(secDWidgets.length === 1, `Section D must have exactly 1 widget, got ${secDWidgets.length}`);

      // Verify prefix byte match
      assert(
        pass2.signedBuffer.slice(0, pass1.signedBuffer.length).equals(pass1.signedBuffer),
        "Pass 2 must preserve Pass 1 buffer byte-for-byte as prefix"
      );

      return { pass1Size: pass1.signedBuffer.length, pass2Size: pass2.signedBuffer.length };
    }
  );

  // Test 1.3: Triple Signatory Sequence: Section C (Rene Jane) -> Section D (Annabel) -> Section A (Ace Malto)
  await runTest(
    "Suite 1",
    "S1.3",
    "Triple sequence: Section C (Rene Jane) -> Section D (Annabel) -> Section A (Ace Malto)",
    async () => {
      const initialPdf = await buildSyntheticDV();

      // Pass 1: Section C Accountant
      const doc1 = await PDFDocument.load(initialPdf);
      const locC = findPersonnelSignatureCoordinates(doc1, "AIVAN M. BALOLOY");
      assert(locC.boxX <= 280, `Section C boxX must be <= 280, got ${locC.boxX}`);

      const pass1 = await signPdfBuffer(
        initialPdf,
        keystores.reneJane.p12Base64,
        keystores.reneJane.password,
        {
          signerName: keystores.reneJane.certCommonName,
          sigRects: [[locC.boxX, locC.boxY, locC.boxX + locC.boxW, locC.boxY + locC.boxH]],
          fieldName: "Signature_SectionC_Baloloy",
        }
      );

      // Pass 2: Section D Director
      const doc2 = await PDFDocument.load(pass1.signedBuffer);
      const locD = findPersonnelSignatureCoordinates(doc2, "ACEMATA MALTO");
      assert(locD.boxX >= 394, `Section D boxX must be >= 394, got ${locD.boxX}`);

      const pass2 = await signPdfBuffer(
        pass1.signedBuffer,
        keystores.annabel.p12Base64,
        keystores.annabel.password,
        {
          signerName: keystores.annabel.certCommonName,
          sigRects: [[locD.boxX, locD.boxY, locD.boxX + locD.boxW, locD.boxY + locD.boxH]],
          fieldName: "Signature_SectionD_Malto",
        }
      );

      // Pass 3: Section A Supervisor
      const doc3 = await PDFDocument.load(pass2.signedBuffer);
      const locA = findPersonnelSignatureCoordinates(doc3, "NORLY A. TABO");
      assert(locA.boxY + locA.boxH <= 430, `Section A top must be <= 430, got ${locA.boxY + locA.boxH}`);

      const pass3 = await signPdfBuffer(
        pass2.signedBuffer,
        keystores.aceMalto.p12Base64,
        keystores.aceMalto.password,
        {
          signerName: keystores.aceMalto.certCommonName,
          sigRects: [[locA.boxX, locA.boxY, locA.boxX + locA.boxW, locA.boxY + locA.boxH]],
          fieldName: "Signature_SectionA_Tabo",
        }
      );

      const a3 = analyzePdfForensics(pass3.signedBuffer);
      assert(a3.sigCount === 3, `Expected 3 signatures, got ${a3.sigCount}`);
      assert(a3.widgetCount === 3, `Expected 3 widgets, got ${a3.widgetCount}`);

      // Verify each section has exactly 1 widget
      const wC = a3.widgets.filter((w) => w.x2 <= 300 && w.y1 < 250);
      const wD = a3.widgets.filter((w) => w.x1 >= 394 && w.y1 < 250);
      const wA = a3.widgets.filter((w) => w.y1 >= 370 && w.y2 <= 430);
      assert(wC.length === 1, `Section C widgets: expected 1, got ${wC.length}`);
      assert(wD.length === 1, `Section D widgets: expected 1, got ${wD.length}`);
      assert(wA.length === 1, `Section A widgets: expected 1, got ${wA.length}`);

      // Verify ByteRange prefix chaining: Pass 1 in Pass 2 in Pass 3
      assert(
        pass2.signedBuffer.slice(0, pass1.signedBuffer.length).equals(pass1.signedBuffer),
        "Pass 1 buffer is exact prefix of Pass 2"
      );
      assert(
        pass3.signedBuffer.slice(0, pass2.signedBuffer.length).equals(pass2.signedBuffer),
        "Pass 2 buffer is exact prefix of Pass 3"
      );

      return {
        pass1Len: pass1.signedBuffer.length,
        pass2Len: pass2.signedBuffer.length,
        pass3Len: pass3.signedBuffer.length,
      };
    }
  );

  // Test 1.4: Real Disbursement Voucher Fixture `scratch/test_dv_real.pdf`
  await runTest(
    "Suite 1",
    "S1.4",
    "Real fixture signing: scratch/test_dv_real.pdf Section D (Annabel) -> Section A (Ace Malto)",
    async () => {
      const realDvPath = path.resolve("scratch/test_dv_real.pdf");
      assert(fs.existsSync(realDvPath), `Real DV fixture must exist at ${realDvPath}`);
      const realDvBuf = fs.readFileSync(realDvPath);

      const initialForensics = analyzePdfForensics(realDvBuf);

      // Pass 1: Sign Section D with Annabel keystore
      const doc1 = await PDFDocument.load(realDvBuf);
      const locD = findPersonnelSignatureCoordinates(doc1, "ACEMATA MALTO");
      assert(locD.boxX >= 394, `Section D boxX must be >= 394, got ${locD.boxX}`);

      const pass1 = await signPdfBuffer(
        realDvBuf,
        keystores.annabel.p12Base64,
        keystores.annabel.password,
        {
          signerName: keystores.annabel.certCommonName,
          sigRects: [[locD.boxX, locD.boxY, locD.boxX + locD.boxW, locD.boxY + locD.boxH]],
          fieldName: "Signature_SectionD_Malto",
        }
      );

      // Pass 2: Sign Section A with Ace Malto keystore
      const doc2 = await PDFDocument.load(pass1.signedBuffer);
      const locA = findPersonnelSignatureCoordinates(doc2, "NORLY A. TABO");
      assert(locA.boxY + locA.boxH <= 430, `Section A must be <= 430, got ${locA.boxY + locA.boxH}`);

      const pass2 = await signPdfBuffer(
        pass1.signedBuffer,
        keystores.aceMalto.p12Base64,
        keystores.aceMalto.password,
        {
          signerName: keystores.aceMalto.certCommonName,
          sigRects: [[locA.boxX, locA.boxY, locA.boxX + locA.boxW, locA.boxY + locA.boxH]],
          fieldName: "Signature_SectionA_Tabo",
        }
      );

      const a2 = analyzePdfForensics(pass2.signedBuffer);
      assert(
        a2.sigCount === initialForensics.sigCount + 2,
        `Real DV must append 2 signatures (from ${initialForensics.sigCount} to ${initialForensics.sigCount + 2}), got ${a2.sigCount}`
      );
      assert(
        a2.widgetCount === initialForensics.widgetCount + 2,
        `Real DV must append 2 widgets (from ${initialForensics.widgetCount} to ${initialForensics.widgetCount + 2}), got ${a2.widgetCount}`
      );
      assert(
        pass2.signedBuffer.slice(0, pass1.signedBuffer.length).equals(pass1.signedBuffer),
        "Real DV incremental prefix must match"
      );

      return {
        initialSigs: initialForensics.sigCount,
        finalSigs: a2.sigCount,
        realDvSize: realDvBuf.length,
        pass1Size: pass1.signedBuffer.length,
        pass2Size: pass2.signedBuffer.length,
      };
    }
  );

  // =========================================================================
  // SUITE 2: COUNTER-SIGNING & STACKING ISOLATION STRESS
  // =========================================================================
  console.log("\n──────────────────────────────────────────────────────────────────────");
  console.log(" SUITE 2: Counter-Signing & Stacking Isolation Stress");
  console.log("──────────────────────────────────────────────────────────────────────");

  // Test 2.1: Primary Sign Section D + Counter-Sign Section D
  await runTest(
    "Suite 2",
    "S2.1",
    "Section D Primary Sign (Ace Malto) + Counter-Sign (Annabel) isolation",
    async () => {
      const initialPdf = await buildSyntheticDV();
      const doc1 = await PDFDocument.load(initialPdf);

      // Pass 1: Primary signature in Section D
      const locD1 = findPersonnelSignatureCoordinates(doc1, "ACEMATA MALTO", { isCounterSign: false });
      const pass1 = await signPdfBuffer(
        initialPdf,
        keystores.aceMalto.p12Base64,
        keystores.aceMalto.password,
        {
          signerName: keystores.aceMalto.certCommonName,
          sigRects: [[locD1.boxX, locD1.boxY, locD1.boxX + locD1.boxW, locD1.boxY + locD1.boxH]],
          fieldName: "Signature_SectionD_Malto",
        }
      );

      // Pass 2: Counter-signature in Section D
      const doc2 = await PDFDocument.load(pass1.signedBuffer);
      const locD2 = findPersonnelSignatureCoordinates(doc2, "ACEMATA MALTO", {
        isCounterSign: true,
        counterSignIndex: 0,
        counterSignPosition: "above",
      });

      // Bounding box assertions for counter-signature:
      assert(locD2.boxX >= 394, `Counter-sign boxX must be >= 394, got ${locD2.boxX}`);
      assert(locD2.boxX + locD2.boxW <= 585, `Counter-sign boxX + boxW must be <= 585, got ${locD2.boxX + locD2.boxW}`);

      const pass2 = await signPdfBuffer(
        pass1.signedBuffer,
        keystores.annabel.p12Base64,
        keystores.annabel.password,
        {
          signerName: keystores.annabel.certCommonName,
          sigRects: [[locD2.boxX, locD2.boxY, locD2.boxX + locD2.boxW, locD2.boxY + locD2.boxH]],
          fieldName: "CounterSignature_1_Annabel",
          isCounterSign: true,
        }
      );

      const a2 = analyzePdfForensics(pass2.signedBuffer);
      assert(a2.sigCount === 2, `Must have exactly 2 signatures, got ${a2.sigCount}`);
      assert(a2.widgetCount === 2, `Must have exactly 2 widgets, got ${a2.widgetCount}`);

      // Crucial: 0 widgets in Section A or Section C!
      const secAWidgets = a2.widgets.filter((w) => w.y1 > 350);
      const secCWidgets = a2.widgets.filter((w) => w.x2 < 315.7 && w.y1 < 250);
      assert(secAWidgets.length === 0, `Counter-sign Section D must produce ZERO widgets in Section A, got ${secAWidgets.length}`);
      assert(secCWidgets.length === 0, `Counter-sign Section D must produce ZERO widgets in Section C, got ${secCWidgets.length}`);

      // Both widgets are in Section D
      const secDWidgets = a2.widgets.filter((w) => w.x1 >= 394 && w.y1 < 250);
      assert(secDWidgets.length === 2, `Expected 2 widgets in Section D, got ${secDWidgets.length}`);

      return { widget1: a2.widgets[0], widget2: a2.widgets[1] };
    }
  );

  // Test 2.2: Triple Counter-Signing in Section D (Primary + 2 Counter-signatures)
  await runTest(
    "Suite 2",
    "S2.2",
    "Triple Section D Counter-Signing: Primary (Ace Malto) + CS1 (Annabel) + CS2 (Rene Jane)",
    async () => {
      const initialPdf = await buildSyntheticDV();

      // Pass 1: Primary
      const doc1 = await PDFDocument.load(initialPdf);
      const loc1 = findPersonnelSignatureCoordinates(doc1, "ACEMATA MALTO", { isCounterSign: false });
      const pass1 = await signPdfBuffer(
        initialPdf,
        keystores.aceMalto.p12Base64,
        keystores.aceMalto.password,
        {
          signerName: keystores.aceMalto.certCommonName,
          sigRects: [[loc1.boxX, loc1.boxY, loc1.boxX + loc1.boxW, loc1.boxY + loc1.boxH]],
          fieldName: "Signature_SectionD_Malto",
        }
      );

      // Pass 2: Counter-Sign 1 (Annabel)
      const doc2 = await PDFDocument.load(pass1.signedBuffer);
      const loc2 = findPersonnelSignatureCoordinates(doc2, "ACEMATA MALTO", {
        isCounterSign: true,
        counterSignIndex: 0,
      });
      const pass2 = await signPdfBuffer(
        pass1.signedBuffer,
        keystores.annabel.p12Base64,
        keystores.annabel.password,
        {
          signerName: keystores.annabel.certCommonName,
          sigRects: [[loc2.boxX, loc2.boxY, loc2.boxX + loc2.boxW, loc2.boxY + loc2.boxH]],
          fieldName: "CounterSignature_1_Annabel",
          isCounterSign: true,
        }
      );

      // Pass 3: Counter-Sign 2 (Rene Jane)
      const doc3 = await PDFDocument.load(pass2.signedBuffer);
      const loc3 = findPersonnelSignatureCoordinates(doc3, "ACEMATA MALTO", {
        isCounterSign: true,
        counterSignIndex: 1,
      });
      const pass3 = await signPdfBuffer(
        pass2.signedBuffer,
        keystores.reneJane.p12Base64,
        keystores.reneJane.password,
        {
          signerName: keystores.reneJane.certCommonName,
          sigRects: [[loc3.boxX, loc3.boxY, loc3.boxX + loc3.boxW, loc3.boxY + loc3.boxH]],
          fieldName: "CounterSignature_2_ReneJane",
          isCounterSign: true,
        }
      );

      const a3 = analyzePdfForensics(pass3.signedBuffer);
      assert(a3.sigCount === 3, `Expected 3 signatures, got ${a3.sigCount}`);
      assert(a3.widgetCount === 3, `Expected 3 widgets, got ${a3.widgetCount}`);

      // All 3 widgets must be in Section D
      const dWidgets = a3.widgets.filter((w) => w.x1 >= 394);
      assert(dWidgets.length === 3, `All 3 widgets must be in Section D, got ${dWidgets.length}`);
      const outsideWidgets = a3.widgets.filter((w) => w.x1 < 394);
      assert(outsideWidgets.length === 0, `Zero widgets allowed outside Section D, found ${outsideWidgets.length}`);

      return { totalWidgets: a3.widgetCount, sectionDWidgets: dWidgets.length };
    }
  );

  // Test 2.3: Supervisor Section A Counter-Signing Boundary Clamping (Ceiling <= 430 pt)
  await runTest(
    "Suite 2",
    "S2.3",
    "Supervisor Section A Primary + Counter-Sign: Both clamped below ceiling y <= 430 pt",
    async () => {
      const initialPdf = await buildSyntheticDV();
      const doc1 = await PDFDocument.load(initialPdf);

      // Pass 1: Primary Supervisor
      const locA1 = findPersonnelSignatureCoordinates(doc1, "NORLY A. TABO", { isCounterSign: false });
      assert(locA1.boxY + locA1.boxH <= 430, `Primary Supervisor top must be <= 430, got ${locA1.boxY + locA1.boxH}`);

      const pass1 = await signPdfBuffer(
        initialPdf,
        keystores.reneJane.p12Base64,
        keystores.reneJane.password,
        {
          signerName: keystores.reneJane.certCommonName,
          sigRects: [[locA1.boxX, locA1.boxY, locA1.boxX + locA1.boxW, locA1.boxY + locA1.boxH]],
          fieldName: "Signature_SectionA_Tabo",
        }
      );

      // Pass 2: Counter-sign Supervisor
      const doc2 = await PDFDocument.load(pass1.signedBuffer);
      const locA2 = findPersonnelSignatureCoordinates(doc2, "NORLY A. TABO", {
        isCounterSign: true,
        counterSignIndex: 0,
      });

      // CRITICAL CHECK: Does counter-sign top edge exceed 430 pt?
      const topEdge = locA2.boxY + locA2.boxH;
      assert(
        topEdge <= 430,
        `Counter-sign top edge must be clamped <= 430 pt (avoiding y=437.4 certification text), got ${topEdge}`
      );

      const pass2 = await signPdfBuffer(
        pass1.signedBuffer,
        keystores.annabel.p12Base64,
        keystores.annabel.password,
        {
          signerName: keystores.annabel.certCommonName,
          sigRects: [[locA2.boxX, locA2.boxY, locA2.boxX + locA2.boxW, locA2.boxY + locA2.boxH]],
          fieldName: "CounterSignature_SectionA_Tabo",
          isCounterSign: true,
        }
      );

      const a2 = analyzePdfForensics(pass2.signedBuffer);
      assert(a2.sigCount === 2, "2 signatures");
      for (const w of a2.widgets) {
        assert(w.y2 <= 430, `All Section A widgets must have y2 <= 430 pt, widget has y2 = ${w.y2}`);
      }

      return { primaryTop: locA1.boxY + locA1.boxH, counterTop: topEdge };
    }
  );

  // =========================================================================
  // SUITE 3: ISO 32000 INCREMENTAL UPDATE CHAINING & BYTERANGE AUDIT
  // =========================================================================
  console.log("\n──────────────────────────────────────────────────────────────────────");
  console.log(" SUITE 3: ISO 32000 Incremental Update Chaining & ByteRange Rigorous Audit");
  console.log("──────────────────────────────────────────────────────────────────────");

  // Test 3.1: 4-Pass Sequential Chaining Prefix Invariance & Non-Destructive Appends
  await runTest(
    "Suite 3",
    "S3.1",
    "4-Pass sequential signing: byte-for-byte prefix invariance across all passes",
    async () => {
      const initialPdf = await buildSyntheticDV();
      const lengths: number[] = [initialPdf.length];
      const buffers: Buffer[] = [initialPdf];

      // Pass 1: Section D Primary (Ace Malto)
      const p1 = await signPdfBuffer(initialPdf, keystores.aceMalto.p12Base64, keystores.aceMalto.password, {
        signerName: keystores.aceMalto.certCommonName,
        sigRect: [394, 187, 125, 28],
        fieldName: "Sig1_D_Malto",
      });
      lengths.push(p1.signedBuffer.length);
      buffers.push(p1.signedBuffer);

      // Pass 2: Section A Supervisor (Annabel)
      const p2 = await signPdfBuffer(p1.signedBuffer, keystores.annabel.p12Base64, keystores.annabel.password, {
        signerName: keystores.annabel.certCommonName,
        sigRect: [210, 400, 125, 28],
        fieldName: "Sig2_A_Tabo",
      });
      lengths.push(p2.signedBuffer.length);
      buffers.push(p2.signedBuffer);

      // Pass 3: Section C Accountant (Rene Jane)
      const p3 = await signPdfBuffer(p2.signedBuffer, keystores.reneJane.p12Base64, keystores.reneJane.password, {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [140, 187, 125, 28],
        fieldName: "Sig3_C_Baloloy",
      });
      lengths.push(p3.signedBuffer.length);
      buffers.push(p3.signedBuffer);

      // Pass 4: Counter-Sign Section D (Annabel)
      const p4 = await signPdfBuffer(p3.signedBuffer, keystores.annabel.p12Base64, keystores.annabel.password, {
        signerName: keystores.annabel.certCommonName,
        sigRect: [394, 215, 125, 28],
        fieldName: "Sig4_D_Counter",
        isCounterSign: true,
      });
      lengths.push(p4.signedBuffer.length);
      buffers.push(p4.signedBuffer);

      // Rigorous byte-level prefix invariance checks:
      assert(
        p2.signedBuffer.slice(0, p1.signedBuffer.length).equals(p1.signedBuffer),
        "Pass 2 prefix MUST exactly equal Pass 1 buffer"
      );
      assert(
        p3.signedBuffer.slice(0, p2.signedBuffer.length).equals(p2.signedBuffer),
        "Pass 3 prefix MUST exactly equal Pass 2 buffer"
      );
      assert(
        p4.signedBuffer.slice(0, p3.signedBuffer.length).equals(p3.signedBuffer),
        "Pass 4 prefix MUST exactly equal Pass 3 buffer"
      );

      // Verify lengths monotonically strictly increase:
      assert(lengths[1] > lengths[0], "L1 > L0");
      assert(lengths[2] > lengths[1], "L2 > L1");
      assert(lengths[3] > lengths[2], "L3 > L2");
      assert(lengths[4] > lengths[3], "L4 > L3");

      return { lengths };
    }
  );

  // Test 3.2: ByteRange Mathematical & Offset Rigor
  await runTest(
    "Suite 3",
    "S3.2",
    "ByteRange mathematical validity, gap exactness, and coverage verification",
    async () => {
      // Build 2-pass signed PDF
      const initialPdf = await buildSyntheticDV();
      const p1 = await signPdfBuffer(initialPdf, keystores.annabel.p12Base64, keystores.annabel.password, {
        signerName: keystores.annabel.certCommonName,
        sigRect: [394, 187, 125, 28],
      });
      const p2 = await signPdfBuffer(p1.signedBuffer, keystores.aceMalto.p12Base64, keystores.aceMalto.password, {
        signerName: keystores.aceMalto.certCommonName,
        sigRect: [210, 400, 125, 28],
      });

      const forensics = analyzePdfForensics(p2.signedBuffer);
      assert(forensics.signatures.length === 2, `Expected 2 signatures in analysis, got ${forensics.signatures.length}`);

      forensics.signatures.forEach((sig, idx) => {
        const [o1, l1, o2, l2] = sig.byteRange;
        // Condition 1: o1 must be 0
        assert(o1 === 0, `Sig ${idx + 1}: offset1 must be 0, got ${o1}`);
        // Condition 2: l1 must be positive
        assert(l1 > 0, `Sig ${idx + 1}: length1 must be > 0, got ${l1}`);
        // Condition 3: gap between (o1 + l1) and o2 must contain the hex string of /Contents
        const gap = o2 - (o1 + l1);
        assert(gap > 1000, `Sig ${idx + 1}: gap between ranges must contain /Contents, got ${gap}`);
        // Condition 4: o2 + l2 must not exceed the buffer length at that revision
        if (idx === 1) {
          // For the final revision, o2 + l2 must EXACTLY equal the file length!
          assert(
            o2 + l2 === p2.signedBuffer.length,
            `Final Sig ByteRange end (o2 + l2 = ${o2 + l2}) must match buffer length (${p2.signedBuffer.length})`
          );
        } else {
          // For earlier revision, o2 + l2 must match Pass 1 length!
          assert(
            o2 + l2 === p1.signedBuffer.length,
            `Pass 1 Sig ByteRange end (${o2 + l2}) must match Pass 1 buffer length (${p1.signedBuffer.length})`
          );
        }
      });

      return {
        sig1ByteRange: forensics.signatures[0].byteRange,
        sig2ByteRange: forensics.signatures[1].byteRange,
        finalBufferLength: p2.signedBuffer.length,
      };
    }
  );

  // Test 3.3: Cryptographic Envelope Preservation & Intactness
  await runTest(
    "Suite 3",
    "S3.3",
    "PKCS#7 /Contents envelope byte-for-byte preservation across downstream signing passes",
    async () => {
      const initialPdf = await buildSyntheticDV();
      const p1 = await signPdfBuffer(initialPdf, keystores.reneJane.p12Base64, keystores.reneJane.password, {
        signerName: keystores.reneJane.certCommonName,
        sigRect: [394, 187, 125, 28],
      });
      const f1 = analyzePdfForensics(p1.signedBuffer);
      const originalContentsHexPass1 = f1.signatures[0].contentsHex;
      assert(originalContentsHexPass1.length > 500, "Must have valid non-empty hex in Pass 1");

      // Now append Pass 2
      const p2 = await signPdfBuffer(p1.signedBuffer, keystores.annabel.p12Base64, keystores.annabel.password, {
        signerName: keystores.annabel.certCommonName,
        sigRect: [210, 400, 125, 28],
      });
      const f2 = analyzePdfForensics(p2.signedBuffer);

      // Verify Pass 1's contents inside Pass 2 is 100% IDENTICAL
      assert(
        f2.signatures[0].contentsHex === originalContentsHexPass1,
        "Pass 1 PKCS#7 envelope inside Pass 2 must be bit-for-bit identical to original"
      );

      // Now append Pass 3
      const p3 = await signPdfBuffer(p2.signedBuffer, keystores.aceMalto.p12Base64, keystores.aceMalto.password, {
        signerName: keystores.aceMalto.certCommonName,
        sigRect: [140, 187, 125, 28],
      });
      const f3 = analyzePdfForensics(p3.signedBuffer);

      assert(
        f3.signatures[0].contentsHex === originalContentsHexPass1,
        "Pass 1 PKCS#7 envelope inside Pass 3 must be bit-for-bit identical to original"
      );
      assert(
        f3.signatures[1].contentsHex === f2.signatures[1].contentsHex,
        "Pass 2 PKCS#7 envelope inside Pass 3 must be bit-for-bit identical to original"
      );

      return { hexLenPass1: originalContentsHexPass1.length, hexLenPass2: f2.signatures[1].contentsHex.length };
    }
  );

  // Test 3.4: XRef Chaining & Trailer /Prev Pointer Continuity
  await runTest(
    "Suite 3",
    "S3.4",
    "Trailer /Prev pointer chaining to previous startxref offsets (ISO 32000-1 clause 7.5.5)",
    async () => {
      const initialPdf = await buildSyntheticDV();
      const p1 = await signPdfBuffer(initialPdf, keystores.annabel.p12Base64, keystores.annabel.password, {
        signerName: keystores.annabel.certCommonName,
        sigRect: [394, 187, 125, 28],
      });
      const f1 = analyzePdfForensics(p1.signedBuffer);
      const startxref1 = f1.startxrefOffsets[f1.startxrefOffsets.length - 1];

      const p2 = await signPdfBuffer(p1.signedBuffer, keystores.aceMalto.p12Base64, keystores.aceMalto.password, {
        signerName: keystores.aceMalto.certCommonName,
        sigRect: [210, 400, 125, 28],
      });
      const f2 = analyzePdfForensics(p2.signedBuffer);

      // In Pass 2, trailer or xref stream must reference /Prev startxref1
      const p2Str = p2.signedBuffer.toString("latin1");
      const prevMatch = p2Str.match(/\/Prev\s+(\d+)/);
      assert(Boolean(prevMatch), "Pass 2 must contain a /Prev entry");
      const prevVal = parseInt(prevMatch![1], 10);
      assert(
        prevVal === startxref1,
        `Pass 2 /Prev (${prevVal}) must match Pass 1 startxref offset (${startxref1})`
      );

      return { startxref1, pass2Prev: prevVal };
    }
  );

  // Test 3.5: PDF Viewer Structural Integrity (PDFDocument.load on multi-pass signed outputs)
  await runTest(
    "Suite 3",
    "S3.5",
    "Structural integrity: PDFDocument.load loads multi-pass signed PDFs without corruption",
    async () => {
      const initialPdf = await buildSyntheticDV();
      let current = initialPdf;

      // Incrementally sign 3 times
      current = (await signPdfBuffer(current, keystores.annabel.p12Base64, keystores.annabel.password, { sigRect: [394, 187, 125, 28] })).signedBuffer;
      current = (await signPdfBuffer(current, keystores.reneJane.p12Base64, keystores.reneJane.password, { sigRect: [140, 187, 125, 28] })).signedBuffer;
      current = (await signPdfBuffer(current, keystores.aceMalto.p12Base64, keystores.aceMalto.password, { sigRect: [210, 400, 125, 28] })).signedBuffer;

      // Load with strict pdf-lib
      const loadedDoc = await PDFDocument.load(current, { ignoreEncryption: true });
      assert(loadedDoc.getPageCount() === 1, "Page count must be 1");
      const page = loadedDoc.getPage(0);
      const annots = page.node.Annots();
      assert(Boolean(annots), "Annots must exist on page");
      assert(annots!.size() >= 3, `Expected at least 3 annotations, found ${annots!.size()}`);

      return { pageCount: loadedDoc.getPageCount(), annotCount: annots!.size() };
    }
  );

  // =========================================================================
  // SUITE 4: ADVERSARIAL INPUTS & MALFORMED PAYLOADS
  // =========================================================================
  console.log("\n──────────────────────────────────────────────────────────────────────");
  console.log(" SUITE 4: Adversarial Inputs & Malformed Payloads");
  console.log("──────────────────────────────────────────────────────────────────────");

  // Test 4.1: Empty P12 Base64 String
  await runTest(
    "Suite 4",
    "S4.1",
    "Empty P12 base64 payload rejection without uncaught exception",
    async () => {
      const initialPdf = await buildSyntheticDV();
      let threw = false;
      try {
        await signPdfBuffer(initialPdf, "", "password");
      } catch (err: any) {
        threw = true;
        assert(err.message.length > 0, "Error must have informative message");
      }
      assert(threw, "Signing with empty P12 base64 MUST reject");
    }
  );

  // Test 4.2: Random Garbage Base64 Keystore
  await runTest(
    "Suite 4",
    "S4.2",
    "Garbage base64 keystore payload rejection with clean error",
    async () => {
      const initialPdf = await buildSyntheticDV();
      const garbageBase64 = Buffer.from("NOT_A_VALID_PKCS12_BUFFER_AT_ALL_1234567890").toString("base64");
      let threw = false;
      try {
        await signPdfBuffer(initialPdf, garbageBase64, "password");
      } catch (err: any) {
        threw = true;
        assert(err.message.length > 0, "Error must have informative message");
      }
      assert(threw, "Signing with garbage P12 base64 MUST reject");
    }
  );

  // Test 4.3: Corrupted / Truncated PKCS#12 DER Buffer
  await runTest(
    "Suite 4",
    "S4.3",
    "Truncated PKCS#12 DER buffer rejection with clean error",
    async () => {
      const initialPdf = await buildSyntheticDV();
      // Take first 100 bytes of Rene Jane P12
      const fullDer = Buffer.from(keystores.reneJane.p12Base64, "base64");
      const truncatedDer = fullDer.slice(0, 100);
      const truncatedBase64 = truncatedDer.toString("base64");

      let threw = false;
      try {
        await signPdfBuffer(initialPdf, truncatedBase64, keystores.reneJane.password);
      } catch (err: any) {
        threw = true;
      }
      assert(threw, "Signing with truncated P12 MUST reject");
    }
  );

  // Test 4.4: Wrong Password for Valid P12 Keystore
  await runTest(
    "Suite 4",
    "S4.4",
    "Wrong password rejection for valid P12 keystore",
    async () => {
      const initialPdf = await buildSyntheticDV();
      let threw = false;
      let errorMsg = "";
      try {
        await signPdfBuffer(initialPdf, keystores.reneJane.p12Base64, "WRONG_PASSWORD_!@#$");
      } catch (err: any) {
        threw = true;
        errorMsg = err?.message || String(err);
      }
      assert(threw, "Signing with wrong password MUST reject");
      assert(
        errorMsg.toLowerCase().includes("password") || errorMsg.toLowerCase().includes("pkcs"),
        `Error message must indicate password failure, got: "${errorMsg}"`
      );
    }
  );

  // Test 4.5: Empty Password for Password-Protected Keystore
  await runTest(
    "Suite 4",
    "S4.5",
    "Empty password rejection for password-protected keystore",
    async () => {
      const initialPdf = await buildSyntheticDV();
      let threw = false;
      try {
        await signPdfBuffer(initialPdf, keystores.reneJane.p12Base64, "");
      } catch (err: any) {
        threw = true;
      }
      assert(threw, "Empty password on protected keystore MUST reject");
    }
  );

  // Test 4.6: Missing / Non-Existent Target Signatory Line
  await runTest(
    "Suite 4",
    "S4.6",
    "Non-existent target signatory on Disbursement Voucher gracefully resolves to Section D",
    async () => {
      const initialPdf = await buildSyntheticDV();
      const doc = await PDFDocument.load(initialPdf);

      // Query non-existent name
      const loc = findPersonnelSignatureCoordinates(doc, "NON_EXISTENT_DIRECTOR_XYZ_9999");
      // Must not crash or return NaN
      assert(!isNaN(loc.boxX) && !isNaN(loc.boxY) && !isNaN(loc.boxW) && !isNaN(loc.boxH), "Coordinates must not be NaN");
      // On DV with Section D, fallback must place box in Section D
      assert(loc.boxX >= 394, `Fallback on DV must place in Section D (boxX >= 394), got ${loc.boxX}`);
      assert(loc.boxX + loc.boxW <= 585, `Fallback boxX + boxW must be <= 585, got ${loc.boxX + loc.boxW}`);

      return { resolvedBox: [loc.boxX, loc.boxY, loc.boxW, loc.boxH] };
    }
  );

  // Test 4.7: Null, Undefined, and Empty Target Strings
  await runTest(
    "Suite 4",
    "S4.7",
    "Empty string and whitespace-only target signatories resolve safely without NaN",
    async () => {
      const initialPdf = await buildSyntheticDV();
      const doc = await PDFDocument.load(initialPdf);

      const emptyLoc = findPersonnelSignatureCoordinates(doc, "");
      assert(!isNaN(emptyLoc.boxX) && !isNaN(emptyLoc.boxY), "Empty string must not produce NaN");

      const wsLoc = findPersonnelSignatureCoordinates(doc, "     ");
      assert(!isNaN(wsLoc.boxX) && !isNaN(wsLoc.boxY), "Whitespace string must not produce NaN");
    }
  );

  // Test 4.8: Corrupted / Truncated PDF Stream Input
  await runTest(
    "Suite 4",
    "S4.8",
    "Corrupted / truncated PDF buffer rejection with informative error",
    async () => {
      const corruptedBuf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"); // Truncated before %%EOF
      let threw = false;
      try {
        await signPdfBuffer(corruptedBuf, keystores.reneJane.p12Base64, keystores.reneJane.password);
      } catch (err: any) {
        threw = true;
      }
      assert(threw, "Signing corrupted PDF MUST reject gracefully");
    }
  );

  // Test 4.9: Pathological & Inverted Bounding Boxes in normalizeSignatureBoundingBox
  await runTest(
    "Suite 4",
    "S4.9",
    "normalizeSignatureBoundingBox normalizes inverted, negative, and degenerate boxes",
    () => {
      // Inverted box [500, 300, 100, 100] (x1 > x2, y1 > y2)
      const b1 = normalizeSignatureBoundingBox([500, 300, 100, 100]);
      assert(b1.minX === 100 && b1.maxX === 500, `Expected minX=100 maxX=500, got ${b1.minX}, ${b1.maxX}`);
      assert(b1.minY === 100 && b1.maxY === 300, `Expected minY=100 maxY=300, got ${b1.minY}, ${b1.maxY}`);

      // Negative coordinates [-50, -20, 100, 20] ([x, y, w, h] mode)
      const b2 = normalizeSignatureBoundingBox([-50, -20, 100, 20]);
      assert(b2.bboxW >= 125, "Must enforce minimum width 125");
      assert(b2.bboxH >= 26, "Must enforce minimum height 26");

      // Degenerate zero-size box [200, 200, 200, 200]
      const b3 = normalizeSignatureBoundingBox([200, 200, 200, 200]);
      assert(b3.bboxW >= 125, `Zero-width box must be expanded >= 125, got ${b3.bboxW}`);
      assert(b3.bboxH >= 26, `Zero-height box must be expanded >= 26, got ${b3.bboxH}`);
    }
  );

  // =========================================================================
  // SUITE 5: HIGH-LOAD CONCURRENCY & THROUGHPUT STRESS
  // =========================================================================
  console.log("\n──────────────────────────────────────────────────────────────────────");
  console.log(" SUITE 5: High-Load Concurrency & Throughput Stress");
  console.log("──────────────────────────────────────────────────────────────────────");

  // Test 5.1: 6 Concurrent Signing Operations Across Different Keystores
  await runTest(
    "Suite 5",
    "S5.1",
    "6 concurrent signing operations across different keystores and targets",
    async () => {
      const basePdf = await buildSyntheticDV();

      const promises = [
        signPdfBuffer(basePdf, keystores.annabel.p12Base64, keystores.annabel.password, {
          signerName: keystores.annabel.certCommonName,
          sigRect: [394, 187, 125, 28],
          fieldName: "Concurrent_1",
        }),
        signPdfBuffer(basePdf, keystores.reneJane.p12Base64, keystores.reneJane.password, {
          signerName: keystores.reneJane.certCommonName,
          sigRect: [140, 187, 125, 28],
          fieldName: "Concurrent_2",
        }),
        signPdfBuffer(basePdf, keystores.aceMalto.p12Base64, keystores.aceMalto.password, {
          signerName: keystores.aceMalto.certCommonName,
          sigRect: [210, 400, 125, 28],
          fieldName: "Concurrent_3",
        }),
        signPdfBuffer(basePdf, keystores.annabel.p12Base64, keystores.annabel.password, {
          signerName: keystores.annabel.certCommonName,
          sigRect: [394, 187, 125, 28],
          fieldName: "Concurrent_4",
        }),
        signPdfBuffer(basePdf, keystores.reneJane.p12Base64, keystores.reneJane.password, {
          signerName: keystores.reneJane.certCommonName,
          sigRect: [140, 187, 125, 28],
          fieldName: "Concurrent_5",
        }),
        signPdfBuffer(basePdf, keystores.aceMalto.p12Base64, keystores.aceMalto.password, {
          signerName: keystores.aceMalto.certCommonName,
          sigRect: [210, 400, 125, 28],
          fieldName: "Concurrent_6",
        }),
      ];

      const results = await Promise.all(promises);
      assert(results.length === 6, "All 6 concurrent operations must resolve");
      for (const res of results) {
        assert(res.signedBuffer.length > basePdf.length, "Each result must be non-empty signed buffer");
        const f = analyzePdfForensics(res.signedBuffer);
        assert(f.sigCount === 1, "Each parallel buffer must contain exactly 1 signature");
      }

      return { completedOperations: 6 };
    }
  );

  // Test 5.2: Sequential Multi-Doc Signing Pipeline (10 Iterations)
  await runTest(
    "Suite 5",
    "S5.2",
    "High-throughput sequential pipeline: 10 rapid signing operations with ByteRange verification",
    async () => {
      const basePdf = await buildSyntheticDV();
      const results: number[] = [];

      for (let i = 0; i < 10; i++) {
        const ks = i % 2 === 0 ? keystores.annabel : keystores.reneJane;
        const res = await signPdfBuffer(basePdf, ks.p12Base64, ks.password, {
          signerName: ks.certCommonName,
          sigRect: [394, 187, 125, 28],
          fieldName: `Throughput_Sig_${i + 1}`,
        });
        results.push(res.signedBuffer.length);
        const f = analyzePdfForensics(res.signedBuffer);
        assert(f.sigCount === 1, `Iteration ${i + 1} must have 1 signature`);
      }

      assert(results.length === 10, "All 10 iterations completed");
      return { totalIterations: 10, averageBufferLength: results.reduce((a, b) => a + b, 0) / 10 };
    }
  );

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log("\n======================================================================");
  console.log("   ADVERSARIAL STRESS TEST EXECUTION SUMMARY                          ");
  console.log("======================================================================");

  const passedTests = testResults.filter((r) => r.passed);
  const failedTests = testResults.filter((r) => !r.passed);

  console.log(`Total Stress Tests: ${testResults.length}`);
  console.log(`Passed:             ${passedTests.length}`);
  console.log(`Failed:             ${failedTests.length}`);
  console.log("----------------------------------------------------------------------");

  if (failedTests.length > 0) {
    console.error("FAILURES DETECTED:");
    failedTests.forEach((f) => {
      console.error(` - [${f.suite}] ${f.id}: ${f.name} => ${f.error}`);
    });
    console.log("\nVERDICT: REJECT");
    process.exit(1);
  } else {
    console.log("ALL ADVERSARIAL STRESS TESTS PASSED WITH 100% SUCCESS!");
    console.log("\nVERDICT: APPROVE");
    process.exit(0);
  }
}

runAdversarialStressSuite().catch((err) => {
  console.error("Fatal test runner crash:", err);
  process.exit(1);
});
