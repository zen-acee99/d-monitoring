/**
 * scratch/challenger_stress_test.ts
 *
 * ADVERSARIAL STRESS TEST & BOUNDARY HARNESS
 * Agent: challenger_1 (critic, specialist)
 * Mission: Adversarially challenge and stress-test the Section D / DTR signature placement solution.
 *
 * Core Attack Surfaces:
 * 1. Extreme geometry variations (page sizes, divider X coords, horizontal shifts, name lengths).
 * 2. Multi-signatory forms with identical and near-identical names across Section A, C, and D.
 * 3. Boundary collision & Certification Line Immunity (y = 437.4 pt, boxY + boxH <= 430 pt).
 * 4. Section D bounds & Label column invasion immunity (boxX >= 394 pt, x < 390 pt forbidden).
 * 5. Cryptographic decoupling & multi-stage sequential signing stress with real P12 keystores.
 * 6. Malicious, empty, and adversarial string inputs.
 */

import fs from "fs";
import path from "path";
import { PDFDocument, rgb, StandardFonts, PDFName, PDFDict, PDFArray, PDFNumber } from "pdf-lib";
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
} from "../server/services/pnpkiSigningService.js";

interface ProbeResult {
  group: string;
  id: string;
  name: string;
  passed: boolean;
  error?: string;
  metrics?: Record<string, any>;
}

const probeResults: ProbeResult[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(msg);
  }
}

async function probe(
  group: string,
  id: string,
  name: string,
  fn: () => Promise<void | Record<string, any>> | void | Record<string, any>
) {
  try {
    const res = await fn();
    probeResults.push({ group, id, name, passed: true, metrics: res || undefined });
    console.log(`  [PASS] ${id}: ${name}`);
    if (res) {
      console.log(`         Metrics: ${JSON.stringify(res)}`);
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    probeResults.push({ group, id, name, passed: false, error: msg });
    console.error(`  [FAIL] ${id}: ${name}`);
    console.error(`         Reason: ${msg}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNTHETIC PDF BUILDER
// ─────────────────────────────────────────────────────────────────────────────

interface DvGeometryOptions {
  pageWidth?: number;
  pageHeight?: number;
  vLineCD?: number;
  vLineD?: number;
  secASupName?: string;
  secABaselineY?: number;
  secCSignerName?: string;
  secCBaselineX?: number;
  secCBaselineY?: number;
  secDSignerName?: string;
  secDBaselineX?: number;
  secDBaselineY?: number;
  includeSecA?: boolean;
  includeSecC?: boolean;
  includeSecD?: boolean;
  customTextItems?: Array<{ text: string; x: number; y: number; bold?: boolean; size?: number }>;
}

async function buildSyntheticDV(opts: DvGeometryOptions = {}): Promise<Uint8Array> {
  const width = opts.pageWidth ?? 595.0;
  const height = opts.pageHeight ?? 842.0;
  const doc = await PDFDocument.create();
  const page = doc.addPage([width, height]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);

  const leftBorder = 10.6;
  const rightBorder = Math.min(width - 10, 585.0);
  const vLineCD = opts.vLineCD ?? 315.7;
  const vLineD = opts.vLineD ?? 390.0;

  // Outer and section dividers
  page.drawLine({ start: { x: leftBorder, y: 107 }, end: { x: leftBorder, y: 440 }, thickness: 1, color: black });
  page.drawLine({ start: { x: rightBorder, y: 107 }, end: { x: rightBorder, y: 440 }, thickness: 1, color: black });
  page.drawLine({ start: { x: leftBorder, y: 440 }, end: { x: rightBorder, y: 440 }, thickness: 1, color: black });
  page.drawLine({ start: { x: leftBorder, y: 368 }, end: { x: rightBorder, y: 368 }, thickness: 1, color: black });
  page.drawLine({ start: { x: leftBorder, y: 270 }, end: { x: rightBorder, y: 270 }, thickness: 1, color: black });
  page.drawLine({ start: { x: leftBorder, y: 107 }, end: { x: rightBorder, y: 107 }, thickness: 1, color: black });

  // Vertical divider between C and D
  page.drawLine({ start: { x: vLineCD, y: 107 }, end: { x: vLineCD, y: 270 }, thickness: 1, color: black });
  // Vertical divider inside D (between label column and signature box)
  page.drawLine({ start: { x: vLineD, y: 107 }, end: { x: vLineD, y: 235 }, thickness: 1, color: black });

  if (opts.includeSecA !== false) {
    // Certification line at y = 437.4 pt
    page.drawText("A. Certified : Expenses / Cash Advance necessary, lawful and incurred under my direct supervision.", {
      x: leftBorder,
      y: 437.4,
      size: 7.5,
      font,
      color: black,
    });
    const supName = opts.secASupName ?? "NORLY A. TABO";
    const supY = opts.secABaselineY ?? 396.0;
    page.drawText(supName, { x: 260.0, y: supY, size: 9.5, font: fontBold, color: black });
    page.drawText("OIC Chief, Technical Operations Division", { x: 230.0, y: supY - 12.8, size: 8, font, color: black });
    page.drawText("Printed Name, Designation and Signature of Supervisor", { x: 211.2, y: supY - 23.0, size: 7, font, color: black });
  }

  // Section B
  page.drawText("B. Accounting Entry :", { x: leftBorder, y: 353.5, size: 8, font: fontBold, color: black });

  if (opts.includeSecC !== false) {
    page.drawText("C. Certified :", { x: leftBorder, y: 269.3, size: 8.5, font: fontBold, color: black });
    page.drawText("Signature", { x: leftBorder, y: 205.1, size: 8, font, color: black });
    page.drawText("Printed Name", { x: leftBorder, y: 174.4, size: 8, font, color: black });
    const accName = opts.secCSignerName ?? "AIVAN M. BALOLOY";
    const accX = opts.secCBaselineX ?? 156.9;
    const accY = opts.secCBaselineY ?? 174.4;
    page.drawText(accName, { x: accX, y: accY, size: 9, font: fontBold, color: black });
    page.drawText("Accountant III", { x: accX, y: accY - 27.1, size: 8, font, color: black });
  }

  if (opts.includeSecD !== false) {
    page.drawText("D. Approved for Payment :", { x: vLineCD + 2.5, y: 269.3, size: 8.5, font: fontBold, color: black });
    page.drawText("One Million Two Hundred Forty Eight Thousand Seven Hundred Two Pesos Only", {
      x: vLineCD + 20,
      y: 251.5,
      size: 7.5,
      font,
      color: black,
    });
    page.drawText("Signature", { x: vLineCD + 2.5, y: 205.1, size: 8, font, color: black });
    page.drawText("Printed Name", { x: vLineCD + 2.5, y: 174.4, size: 8, font, color: black });
    const dirName = opts.secDSignerName ?? "ACEMATA MALTO";
    const dirX = opts.secDBaselineX ?? 430.0;
    const dirY = opts.secDBaselineY ?? 174.4;
    page.drawText(dirName, { x: dirX, y: dirY, size: 9.5, font: fontBold, color: black });
    page.drawText("OIC-Regional Director,", { x: dirX, y: dirY - 20, size: 8, font, color: black });
    page.drawText("Regional Office No. V", { x: dirX, y: dirY - 35, size: 8, font, color: black });
  }

  if (opts.customTextItems) {
    for (const item of opts.customTextItems) {
      page.drawText(item.text, {
        x: item.x,
        y: item.y,
        size: item.size ?? 9,
        font: item.bold ? fontBold : font,
        color: black,
      });
    }
  }

  return await doc.save({ useObjectStreams: false });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTE ADVERSARIAL STRESS TESTS
// ─────────────────────────────────────────────────────────────────────────────

async function runAdversarialStressSuite() {
  console.log("======================================================================");
  console.log("    ADVERSARIAL STRESS TEST & ATTACK HARNESS — CHALLENGER_1          ");
  console.log("======================================================================\n");

  // ───────────────────────────────────────────────────────────────────────────
  // GROUP 1: EXTREME GEOMETRY VARIATIONS & PAGE SIZES
  // ───────────────────────────────────────────────────────────────────────────
  console.log("─── GROUP 1: EXTREME GEOMETRY VARIATIONS & PAGE SIZES ───────────────");

  // Standard Government Accounting Manual document formats (A4, Letter, Legal)
  const standardPageDimensions = [
    { name: "A4 Portrait", w: 595.28, h: 841.89 },
    { name: "US Letter Portrait", w: 612.0, h: 792.0 },
    { name: "US Legal Portrait", w: 612.0, h: 1008.0 },
  ];

  for (const dims of standardPageDimensions) {
    await probe("Geometry", `ADV.GEO.PAGE.${dims.name.replace(/\s+/g, "_")}`, `Standard document page size: ${dims.name}`, async () => {
      const pdfBytes = await buildSyntheticDV({ pageWidth: dims.w, pageHeight: dims.h });
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const coords = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

      assert(coords.boxX >= 394, `boxX (${coords.boxX}) must be >= 394 on ${dims.name}`);
      assert(coords.boxX + coords.boxW <= 585, `boxX + boxW (${coords.boxX + coords.boxW}) must stay <= 585`);
      assert(coords.boxY >= 180 && coords.boxY + coords.boxH <= 236, `boxY (${coords.boxY}) must be in Section D band [180, 236] on ${dims.name}`);

      return { boxX: coords.boxX, boxY: coords.boxY, boxW: coords.boxW, boxH: coords.boxH };
    });
  }

  // Non-standard narrow page probe (testing behavioral boundaries under constrained page width)
  const narrowPages = [
    { name: "Executive Compact", w: 522.0, h: 756.0 },
    { name: "Narrow 500pt", w: 500.0, h: 700.0 },
  ];
  for (const dims of narrowPages) {
    await probe("Geometry", `ADV.GEO.NARROW.${dims.name.replace(/\s+/g, "_")}`, `Narrow non-GAM page probe: ${dims.name} (w=${dims.w})`, async () => {
      const pdfBytes = await buildSyntheticDV({ pageWidth: dims.w, pageHeight: dims.h });
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const coords = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

      const rightEdge = coords.boxX + coords.boxW;
      const overflowsPaper = rightEdge > dims.w;

      // In Section D, coordinates clamp to standard GAM table cell (394..585 pt).
      // On narrow pages (w < 585), record if box extends past page width.
      return {
        pageWidth: dims.w,
        boxX: coords.boxX,
        boxW: coords.boxW,
        rightEdge,
        overflowsPaper,
        note: overflowsPaper ? "Document width < 585 pt (GAM table width exceeds narrow paper)" : "Within paper",
      };
    });
  }

  // Varying Table Divider X Coordinates
  const dividerXList = [350, 370, 380, 390, 400, 410, 420];
  for (const divX of dividerXList) {
    await probe("Geometry", `ADV.GEO.DIVIDER_X_${divX}`, `Varying table divider X coordinate at ${divX} pt`, async () => {
      const pdfBytes = await buildSyntheticDV({ vLineD: divX, secDBaselineX: Math.max(divX + 20, 430) });
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const coords = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

      // Verify boxX never invades label column (x < 390 pt)
      assert(coords.boxX >= 390, `boxX (${coords.boxX}) must never invade label column (x < 390) when divider is at ${divX}`);
      assert(coords.boxX >= 394, `boxX (${coords.boxX}) must satisfy Section D minimum >= 394 pt`);
      assert(coords.boxX + coords.boxW <= 585, `boxX + boxW (${coords.boxX + coords.boxW}) must be <= 585 pt`);

      return { dividerX: divX, boxX: coords.boxX, clearanceTo390: coords.boxX - 390 };
    });
  }

  // Shifting Section D Horizontal Coordinates Across Wide Spectrum
  const xShifts = [318, 330, 350, 375, 390, 410, 430, 470, 500, 520, 540];
  for (const testX of xShifts) {
    await probe("Geometry", `ADV.GEO.SHIFT_X_${testX}`, `Shifting Section D text position to X = ${testX} pt`, async () => {
      const pdfBytes = await buildSyntheticDV({ secDBaselineX: testX });
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const coords = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

      assert(coords.boxX >= 394, `boxX (${coords.boxX}) must be strictly >= 394 pt when text is at X = ${testX}`);
      assert(coords.boxX + coords.boxW <= 585, `boxX + boxW (${coords.boxX + coords.boxW}) must stay <= 585 pt`);
      assert(coords.boxY >= 180 && coords.boxY + coords.boxH <= 236, `boxY must stay in Section D vertical band`);

      return { textX: testX, boxX: coords.boxX, boxW: coords.boxW, rightEdge: coords.boxX + coords.boxW };
    });
  }

  // Extreme Signatory Name Lengths
  const nameLengths = [
    { label: "Ultra Short", name: "ACE" },
    { label: "Short", name: "A. MALTO" },
    { label: "Standard", name: "ACEMATA MALTO" },
    { label: "Long With Titles", name: "DIR. ACEMATA MALTO JR., CESO III" },
    { label: "Extremely Long", name: "HON. ATTY. ACEMATA MATA MALTO JR., PH.D., CESO III, REGIONAL DIRECTOR" },
  ];

  for (const nItem of nameLengths) {
    await probe("Geometry", `ADV.GEO.NAME_LEN_${nItem.label.replace(/\s+/g, "_")}`, `Name length extreme: ${nItem.label} (${nItem.name.length} chars)`, async () => {
      const pdfBytes = await buildSyntheticDV({ secDSignerName: nItem.name, secDBaselineX: 400 });
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const coords = findPersonnelSignatureCoordinates(pdfDoc, nItem.name);

      assert(coords.boxX >= 394, `boxX (${coords.boxX}) must be >= 394 pt for '${nItem.label}'`);
      assert(coords.boxX + coords.boxW <= 585, `boxX + boxW (${coords.boxX + coords.boxW}) must NOT exceed right border 585 pt`);
      assert(coords.boxW >= 120, `boxW (${coords.boxW}) must satisfy minimum 120 pt`);

      return { length: nItem.name.length, boxX: coords.boxX, boxW: coords.boxW, rightEdge: coords.boxX + coords.boxW };
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GROUP 2: MULTI-SIGNATORY DISAMBIGUATION & IDENTICAL NAMES
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n─── GROUP 2: MULTI-SIGNATORY DISAMBIGUATION & IDENTICAL NAMES ────────");

  // Identical Name in Section A and Section D ("ACE MATA MALTO" is both Supervisor and Director)
  await probe("Disambiguation", "ADV.NAME.IDENTICAL_A_AND_D", "Identical name 'ACE MATA MALTO' in Section A and Section D", async () => {
    const pdfBytes = await buildSyntheticDV({
      secASupName: "ACE MATA MALTO",
      secDSignerName: "ACE MATA MALTO",
    });
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Call findPersonnelSignatureCoordinates: Must resolve to Section D (lowest Y baseline y ≈ 174 pt)
    const coords = findPersonnelSignatureCoordinates(pdfDoc, "ACE MATA MALTO");
    assert(coords.boxX >= 394, `boxX (${coords.boxX}) must be inside Section D >= 394 pt`);
    assert(coords.boxY >= 180 && coords.boxY + coords.boxH <= 236, `boxY (${coords.boxY}) must be in Section D [180, 236], NOT Section A (> 350)`);

    // Verify scanPdfForSigners prioritizes Section D as primaryPersonnel
    const scanned = await scanPdfForSigners(pdfBytes, [
      { name: "ACE MATA MALTO", role: "Authorized Signatory" },
    ]);
    assert(scanned.signers.length >= 1, "Must detect signers");
    assert(scanned.primaryPersonnel.toUpperCase().includes("MALTO"), `primaryPersonnel must be Malto, got ${scanned.primaryPersonnel}`);
    const secDSigner = scanned.signers.find((s) => (s.roleHeader || "").toUpperCase().includes("APPROVED FOR PAYMENT"));
    assert(Boolean(secDSigner), "Section D must be recognized with 'Approved for Payment' roleHeader");

    return { resolvedY: coords.boxY, primaryPersonnel: scanned.primaryPersonnel, secDRole: secDSigner?.roleHeader };
  });

  // Identical Name across ALL 3 Sections (Section A, Section C, Section D all named "ACEMATA MALTO")
  await probe("Disambiguation", "ADV.NAME.IDENTICAL_ALL_SECTIONS", "Triple identical name 'ACEMATA MALTO' in Section A, C, and D", async () => {
    const pdfBytes = await buildSyntheticDV({
      secASupName: "ACEMATA MALTO",
      secCSignerName: "ACEMATA MALTO",
      secDSignerName: "ACEMATA MALTO",
    });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const coords = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    assert(coords.boxX >= 394, `Section D must be prioritized; boxX (${coords.boxX}) >= 394 pt`);
    assert(coords.boxY >= 180 && coords.boxY + coords.boxH <= 236, `Section D must be prioritized; boxY (${coords.boxY}) in [180, 236]`);

    return { boxX: coords.boxX, boxY: coords.boxY };
  });

  // Distinct Signatories across Sections:
  // Section A: "NORLY A. TABO" (Supervisor)
  // Section C: "AIVAN M. BALOLOY" (Accountant)
  // Section D: "ACEMATA MALTO" (Director)
  await probe("Disambiguation", "ADV.NAME.DISTINCT_SECTIONS", "Distinct signatories across A ('NORLY A. TABO'), C ('AIVAN M. BALOLOY'), D ('ACEMATA MALTO')", async () => {
    const pdfBytes = await buildSyntheticDV({
      secASupName: "NORLY A. TABO",
      secCSignerName: "AIVAN M. BALOLOY",
      secDSignerName: "ACEMATA MALTO",
    });
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Target Section D explicitly
    const coordsD = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");
    assert(coordsD.boxX >= 394, `Targeting ACEMATA MALTO must resolve Section D; boxX (${coordsD.boxX}) >= 394 pt`);
    assert(coordsD.boxY >= 180 && coordsD.boxY + coordsD.boxH <= 236, `boxY (${coordsD.boxY}) must be in Section D [180, 236]`);

    // Target Section C explicitly
    const coordsC = findPersonnelSignatureCoordinates(pdfDoc, "AIVAN M. BALOLOY");
    assert(coordsC.boxX <= 280, `Targeting Section C 'AIVAN M. BALOLOY' must resolve Section C; boxX (${coordsC.boxX}) <= 280 pt`);

    // Target Section A explicitly
    const coordsA = findPersonnelSignatureCoordinates(pdfDoc, "NORLY A. TABO");
    assert(coordsA.boxY >= 350, `Targeting Section A 'NORLY A. TABO' must resolve Section A; boxY (${coordsA.boxY}) >= 350 pt`);
    assert(coordsA.boxY + coordsA.boxH <= 430, `Section A top boundary must be clamped <= 430 pt`);

    return { secD_boxX: coordsD.boxX, secC_boxX: coordsC.boxX, secA_boxY: coordsA.boxY };
  });

  // Shared Surname Probe: When an employee or supervisor shares the surname "MALTO"
  await probe("Disambiguation", "ADV.NAME.SHARED_SURNAME_PROBE", "Signatory with surname 'MALTO' in supervisor vs director", async () => {
    const pdfBytes = await buildSyntheticDV({
      secASupName: "NORLY A. TABO",
      secCSignerName: "AIVAN M. BALOLOY",
      secDSignerName: "ACEMATA MALTO",
    });
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Targeting "ACEMATA MALTO" vs "MALTO"
    const coordsDirector = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");
    const coordsSurnameOnly = findPersonnelSignatureCoordinates(pdfDoc, "MALTO");

    assert(coordsDirector.boxX >= 394, "ACEMATA MALTO binds to Section D");
    assert(coordsSurnameOnly.boxX >= 394, "MALTO binds to Section D");

    return { coordsDirector: coordsDirector.boxX, coordsSurnameOnly: coordsSurnameOnly.boxX };
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GROUP 3: BOUNDARY COLLISION & CERTIFICATION LINE IMMUNITY (y = 437.4 pt)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n─── GROUP 3: BOUNDARY COLLISION & CERTIFICATION LINE IMMUNITY ─────────");

  // Dense baseline sweep of Section A Supervisor name from 350 pt to 435 pt
  const supBaselines = [350, 360, 370, 380, 390, 396, 400, 405, 410, 415, 420, 425, 430, 435];
  for (const bY of supBaselines) {
    await probe("Boundary", `ADV.COLLISION.SEC_A_BASELINE_${bY}`, `Section A supervisor baseline at y = ${bY} pt`, async () => {
      const pdfBytes = await buildSyntheticDV({ secABaselineY: bY });
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const coords = findPersonnelSignatureCoordinates(pdfDoc, "NORLY A. TABO");

      const topEdge = coords.boxY + coords.boxH;
      const clearance = 437.4 - topEdge;

      assert(topEdge <= 430, `Top edge (${topEdge}) must NEVER exceed 430 pt at baseline ${bY}`);
      assert(clearance >= 7.39, `Clearance to certification line y = 437.4 (${clearance.toFixed(2)} pt) must be >= 7.4 pt`);

      return { baselineY: bY, boxY: coords.boxY, topEdge, clearance: Number(clearance.toFixed(2)) };
    });
  }

  // Section A Counter-Signature Stacking Ceiling
  const csIndices = [0, 1, 2, 3];
  for (const csIdx of csIndices) {
    await probe("Boundary", `ADV.COLLISION.SEC_A_COUNTERSIGN_${csIdx}`, `Section A counter-signature stacking index ${csIdx}`, async () => {
      const pdfBytes = await buildSyntheticDV({ secABaselineY: 396 });
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const coords = findPersonnelSignatureCoordinates(pdfDoc, "NORLY A. TABO", {
        isCounterSign: csIdx > 0,
        counterSignIndex: csIdx,
      });

      const topEdge = coords.boxY + coords.boxH;
      const clearance = 437.4 - topEdge;

      assert(topEdge <= 430, `Stacked counter-signature index ${csIdx} top edge (${topEdge}) must stay <= 430 pt`);
      assert(clearance >= 7.39, `Clearance to 437.4 pt (${clearance.toFixed(2)} pt) must be >= 7.4 pt`);

      return { csIndex: csIdx, boxY: coords.boxY, topEdge, clearance: Number(clearance.toFixed(2)) };
    });
  }

  // Supervisor Approval Coordinates Resolution across Titles at High Baselines
  const titles = [
    "PROVINCIAL OFFICER",
    "REGIONAL DIRECTOR",
    "OIC-REGIONAL DIRECTOR",
    "ASSISTANT REGIONAL DIRECTOR",
    "DIVISION CHIEF",
  ];
  for (const title of titles) {
    await probe("Boundary", `ADV.COLLISION.APPROVAL_TITLE_${title.replace(/[\s\-]+/g, "_")}`, `findApprovalSectionCoordinates matching title '${title}' at high baseline`, async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage([595, 842]);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText("A. Certified : Expenses / Cash Advance necessary, lawful and incurred under my direct supervision.", {
        x: 10.6,
        y: 437.4,
        size: 7.5,
        font,
      });
      page.drawText(title, { x: 230.0, y: 415.0, size: 8, font });

      const pdfDoc = await PDFDocument.load(await doc.save({ useObjectStreams: false }));
      const coords = findApprovalSectionCoordinates(pdfDoc, "TEST SUPERVISOR");

      const topEdge = coords.boxY + coords.boxH;
      const clearance = 437.4 - topEdge;

      assert(topEdge <= 430, `Approval section topEdge (${topEdge}) must stay <= 430 pt for title ${title}`);
      assert(clearance >= 7.39, `Clearance to 437.4 pt (${clearance.toFixed(2)} pt) must be >= 7.4 pt`);

      return { title, boxY: coords.boxY, topEdge, clearance: Number(clearance.toFixed(2)) };
    });
  }

  // Section D to Section A Absolute Spatial Isolation
  await probe("Boundary", "ADV.COLLISION.SEC_D_TO_SEC_A_ISOLATION", "Verify zero overlap and minimum gap between Section D and Section A", async () => {
    const pdfBytes = await buildSyntheticDV();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const coordsD = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");
    const coordsA = findPersonnelSignatureCoordinates(pdfDoc, "NORLY A. TABO");

    const secDTop = coordsD.boxY + coordsD.boxH;
    const secABottom = coordsA.boxY;
    const verticalGap = secABottom - secDTop;

    assert(secDTop <= 236, `Section D top edge (${secDTop}) must be <= 236 pt`);
    assert(secABottom >= 350, `Section A bottom edge (${secABottom}) must be >= 350 pt`);
    assert(verticalGap > 100, `Vertical gap between Section D and Section A (${verticalGap} pt) must be > 100 pt`);

    return { secDTop, secABottom, verticalGap };
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GROUP 4: SECTION D BOUNDS & LABEL COLUMN INVASION IMMUNITY (x < 390 pt)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n─── GROUP 4: SECTION D BOUNDS & LABEL COLUMN INVASION IMMUNITY ───────");

  // Dense sweep of Section D name X position from 316 pt to 520 pt
  const denseXPositions = [316, 320, 330, 340, 350, 360, 370, 380, 389, 390, 395, 410, 430, 460, 490, 510, 520];
  for (const pX of denseXPositions) {
    await probe("LabelInvasion", `ADV.SEC_D.X_SWEEP_${pX}`, `Section D text placed at X = ${pX} pt`, async () => {
      const pdfBytes = await buildSyntheticDV({ secDBaselineX: pX });
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const coords = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

      assert(coords.boxX >= 394, `boxX (${coords.boxX}) must be strictly >= 394 pt when text is at X = ${pX}`);
      assert(coords.boxX >= 390, `boxX (${coords.boxX}) must NEVER cross divider at 390 pt into label column`);
      assert(coords.boxX + coords.boxW <= 585, `boxX + boxW (${coords.boxX + coords.boxW}) must stay <= 585 pt`);

      const clearanceToLabelCol = coords.boxX - 390;
      assert(clearanceToLabelCol >= 4, `Clearance to label column (${clearanceToLabelCol} pt) must be >= 4 pt`);

      return { inputX: pX, boxX: coords.boxX, clearanceToLabelCol };
    });
  }

  // Concatenated Label + Name ("Printed Name ACEMATA MALTO" at x = 318.2 pt)
  await probe("LabelInvasion", "ADV.SEC_D.CONCATENATED_LABEL_NAME", "Concatenated 'Printed Name ACEMATA MALTO' text item starting at x = 318.2 pt", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    // Draw dividers
    page.drawLine({ start: { x: 315.7, y: 107 }, end: { x: 315.7, y: 270 }, thickness: 1, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: 390.0, y: 107 }, end: { x: 390.0, y: 235 }, thickness: 1, color: rgb(0, 0, 0) });

    page.drawText("D. Approved for Payment :", { x: 318.2, y: 269.3, size: 8.5, font: fontBold });
    // Single text item that contains both the label and the name starting on left side of divider
    page.drawText("Printed Name ACEMATA MALTO", { x: 318.2, y: 174.4, size: 9.5, font: fontBold });

    const pdfDoc = await PDFDocument.load(await doc.save({ useObjectStreams: false }));
    const coords = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    assert(coords.boxX >= 394, `boxX (${coords.boxX}) must NOT center on concatenated label; must be >= 394 pt`);
    assert(coords.boxX + coords.boxW <= 585, `boxX + boxW (${coords.boxX + coords.boxW}) must be <= 585 pt`);

    return { boxX: coords.boxX, boxW: coords.boxW, clearanceTo390: coords.boxX - 390 };
  });

  // Fallback Section D Resolution (Target name completely absent from document text)
  await probe("LabelInvasion", "ADV.SEC_D.FALLBACK_ABSENT_NAME", "Fallback Section D resolution when target name is completely missing from text stream", async () => {
    const pdfBytes = await buildSyntheticDV({ secDSignerName: "" }); // Blank name line
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Ask to sign for ACEMATA MALTO who is not printed on the document
    const coords = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    assert(coords.boxX >= 394, `Fallback boxX (${coords.boxX}) must be >= 394 pt`);
    assert(coords.boxX + coords.boxW <= 585, `Fallback boxX + boxW (${coords.boxX + coords.boxW}) must be <= 585 pt`);
    assert(coords.boxY >= 180 && coords.boxY + coords.boxH <= 236, `Fallback boxY (${coords.boxY}) must be in Section D band`);

    return { boxX: coords.boxX, boxY: coords.boxY, boxW: coords.boxW };
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GROUP 5: CRYPTOGRAPHIC DECOUPLING & MULTI-STAGE SIGNING STRESS
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n─── GROUP 5: CRYPTOGRAPHIC DECOUPLING & MULTI-STAGE SIGNING STRESS ───");

  // Load Rene Jane keystore fixture
  const rjPath = path.resolve("scratch/rene_jane.p12");
  assert(fs.existsSync(rjPath), `Keystore fixture scratch/rene_jane.p12 must exist`);
  const rjBytes = fs.readFileSync(rjPath);
  const rjBase64 = rjBytes.toString("base64");
  const rjPassword = "1234567890Aa!";
  const rjIdentity = getSignerIdentityFromP12(rjBase64, rjPassword);

  // Decoupled signing: Rene Jane signs Section D for ACEMATA MALTO
  await probe("CryptoStress", "ADV.CRYPTO.DECOUPLED_SIGNING", "Rene Jane keystore signs Section D targeting 'ACEMATA MALTO'", async () => {
    const initialPdfBytes = await buildSyntheticDV();
    const pdfDoc = await PDFDocument.load(initialPdfBytes);
    const coords = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    const signResult = await signPdfBuffer(Buffer.from(initialPdfBytes), rjBase64, rjPassword, {
      signerName: rjIdentity.commonName, // Rene Jane
      sigRects: [[coords.boxX, coords.boxY, coords.boxX + coords.boxW, coords.boxY + coords.boxH]],
      pageIndex: 0,
      fieldName: "Signature_SectionD_Malto",
    });

    const pdfStr = signResult.signedBuffer.toString("latin1");
    const widgetMatches = pdfStr.match(/\/Subtype\s*\/Widget\b/g) || [];
    const sigMatches = pdfStr.match(/\/Type\s*\/Sig\b/g) || [];

    assert(widgetMatches.length === 1, `Must have exactly 1 /Widget annotation, found ${widgetMatches.length}`);
    assert(sigMatches.length === 1, `Must have exactly 1 /Sig dictionary, found ${sigMatches.length}`);
    assert(pdfStr.includes("/ByteRange"), "Must have valid /ByteRange array");
    assert(pdfStr.includes("/SubFilter /adbe.pkcs7.detached"), "Must have detached PKCS#7 signature");
    assert(pdfStr.includes(rjIdentity.commonName), `Visual appearance must contain cert CN '${rjIdentity.commonName}'`);

    // Verify widget rect is in Section D, ZERO widgets in Section A
    const rectRegex = /\/Rect\s*\[\s*([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s*\]/g;
    let m = rectRegex.exec(pdfStr);
    assert(m !== null, "Widget must have /Rect");
    const [x1, y1, x2, y2] = [parseFloat(m![1]), parseFloat(m![2]), parseFloat(m![3]), parseFloat(m![4])];

    assert(x1 >= 394, `Widget x1 (${x1}) must be >= 394 pt`);
    assert(x2 <= 585, `Widget x2 (${x2}) must be <= 585 pt`);
    assert(y1 >= 180 && y2 <= 236, `Widget y1 (${y1}) and y2 (${y2}) must be in Section D [180, 236]`);

    // Verify Section A has ZERO widgets
    let nextM = rectRegex.exec(pdfStr);
    assert(nextM === null, "Section A must have ZERO widgets");

    return { signer: rjIdentity.commonName, widgetRect: [x1, y1, x2, y2] };
  });

  // Sequential Multi-Stage 3-Pass Voucher Signing Chain:
  // Pass 1: Section A (Supervisor Norly Tabo)
  // Pass 2: Section C (Accountant Aivan Baloloy)
  // Pass 3: Section D (Director ACEMATA MALTO by Rene Jane)
  await probe("CryptoStress", "ADV.CRYPTO.THREE_PASS_SIGNING_CHAIN", "Sequential 3-pass multi-signatory signing: Section A -> Section C -> Section D", async () => {
    const dvInitial = await buildSyntheticDV();

    // Pass 1: Sign Section A
    const doc1 = await PDFDocument.load(dvInitial);
    const coordsA = findPersonnelSignatureCoordinates(doc1, "NORLY A. TABO");
    const pass1Result = await signPdfBuffer(Buffer.from(dvInitial), rjBase64, rjPassword, {
      signerName: "Tabo Norly Avila",
      sigRects: [[coordsA.boxX, coordsA.boxY, coordsA.boxX + coordsA.boxW, coordsA.boxY + coordsA.boxH]],
      pageIndex: 0,
      fieldName: "Signature_SectionA_Tabo",
    });

    // Pass 2: Sign Section C
    const doc2 = await PDFDocument.load(pass1Result.signedBuffer);
    const coordsC = findPersonnelSignatureCoordinates(doc2, "AIVAN M. BALOLOY");
    const pass2Result = await signPdfBuffer(pass1Result.signedBuffer, rjBase64, rjPassword, {
      signerName: "Baloloy Aivan Morcoso",
      sigRects: [[coordsC.boxX, coordsC.boxY, coordsC.boxX + coordsC.boxW, coordsC.boxY + coordsC.boxH]],
      pageIndex: 0,
      fieldName: "Signature_SectionC_Baloloy",
    });

    // Pass 3: Sign Section D
    const doc3 = await PDFDocument.load(pass2Result.signedBuffer);
    const coordsD = findPersonnelSignatureCoordinates(doc3, "ACEMATA MALTO");
    const pass3Result = await signPdfBuffer(pass2Result.signedBuffer, rjBase64, rjPassword, {
      signerName: rjIdentity.commonName, // Rene Jane
      sigRects: [[coordsD.boxX, coordsD.boxY, coordsD.boxX + coordsD.boxW, coordsD.boxY + coordsD.boxH]],
      pageIndex: 0,
      fieldName: "Signature_SectionD_Malto",
    });

    // Verify 3 distinct signatures and incremental updates
    const str3 = pass3Result.signedBuffer.toString("latin1");
    const widgetMatches = str3.match(/\/Subtype\s*\/Widget\b/g) || [];
    const sigMatches = str3.match(/\/Type\s*\/Sig\b/g) || [];

    assert(widgetMatches.length === 3, `Expected exactly 3 widgets, got ${widgetMatches.length}`);
    assert(sigMatches.length === 3, `Expected exactly 3 /Sig entries, got ${sigMatches.length}`);

    // Parse all 3 widget rects
    const rectRegex = /\/Rect\s*\[\s*([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s*\]/g;
    const rects: Array<[number, number, number, number]> = [];
    let rm: RegExpExecArray | null;
    while ((rm = rectRegex.exec(str3)) !== null) {
      rects.push([parseFloat(rm[1]), parseFloat(rm[2]), parseFloat(rm[3]), parseFloat(rm[4])]);
    }
    assert(rects.length === 3, `Expected 3 parsed rects, got ${rects.length}`);

    // Check Section A: top <= 430
    const rectA = rects.find((r) => r[1] >= 350);
    assert(Boolean(rectA), "Must have Section A widget");
    assert(rectA![3] <= 430, `Section A top edge (${rectA![3]}) must be <= 430 pt`);

    // Check Section C: right <= 315
    const rectC = rects.find((r) => r[2] <= 315.7 && r[1] < 300);
    assert(Boolean(rectC), "Must have Section C widget");

    // Check Section D: left >= 394
    const rectD = rects.find((r) => r[0] >= 394);
    assert(Boolean(rectD), "Must have Section D widget");

    // Verify incremental update chain loads cleanly in PDFDocument
    const verifiedDoc = await PDFDocument.load(pass3Result.signedBuffer);
    assert(verifiedDoc.getPageCount() === 1, "Page count must remain 1");

    return { totalWidgets: widgetMatches.length, rectA, rectC, rectD };
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GROUP 6: MALICIOUS, EMPTY & PATHOLOGICAL STRING INPUTS
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n─── GROUP 6: MALICIOUS, EMPTY & PATHOLOGICAL STRING INPUTS ───────────");

  const adversarialInputs = [
    { label: "Empty string", val: "" },
    { label: "Whitespace only", val: "   \t\n  " },
    { label: "Regex metacharacters", val: "Malto [OIC] (Director) *+?^$" },
    { label: "SQL/Script injection attempt", val: "ACEMATA MALTO'; DROP TABLE users; -- <script>alert(1)</script>" },
    { label: "Leading & trailing punctuation", val: "... ACEMATA MALTO !!!" },
    { label: "Unicode diacritics & mojibake", val: "ACEMATA MALTO ñ Ñ é" },
  ];

  for (const adv of adversarialInputs) {
    await probe("AdversarialInputs", `ADV.INPUT.${adv.label.replace(/[\s\/\<\>\-\'\;\.]+/g, "_")}`, `Input: ${adv.label}`, async () => {
      const pdfBytes = await buildSyntheticDV();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const coords = findPersonnelSignatureCoordinates(pdfDoc, adv.val);

      assert(typeof coords.boxX === "number" && !isNaN(coords.boxX), "boxX must be valid number");
      assert(typeof coords.boxY === "number" && !isNaN(coords.boxY), "boxY must be valid number");
      assert(typeof coords.boxW === "number" && coords.boxW > 0, "boxW must be positive number");
      assert(typeof coords.boxH === "number" && coords.boxH > 0, "boxH must be positive number");
      assert(coords.boxX >= 0 && coords.boxY >= 0, "Coordinates must not be negative");

      return { input: adv.val.substring(0, 30), boxX: coords.boxX, boxY: coords.boxY, boxW: coords.boxW, boxH: coords.boxH };
    });
  }

  // Multi-page DV: Section D on Page 3
  await probe("MultiPage", "ADV.MULTIPAGE.PAGE_3_RESOLUTION", "Section D on Page 3 of 3-page disbursement voucher", async () => {
    const doc = await PDFDocument.create();
    // Add page 1 and page 2 (supporting documents / narrative)
    const p1 = doc.addPage([595, 842]);
    p1.drawText("Page 1: Project Justification & Line Item Budget", { x: 50, y: 750, size: 12 });
    const p2 = doc.addPage([595, 842]);
    p2.drawText("Page 2: Billing Statements and Receipts", { x: 50, y: 750, size: 12 });

    // Page 3: Disbursement voucher approval
    const p3 = doc.addPage([595, 842]);
    p3.drawText("D. Approved for Payment :", { x: 318.2, y: 269.3, size: 8.5 });
    p3.drawText("ACEMATA MALTO", { x: 430.0, y: 174.4, size: 9.5 });

    const multiPdfBytes = await doc.save({ useObjectStreams: false });
    const pdfDoc = await PDFDocument.load(multiPdfBytes);
    const coords = findPersonnelSignatureCoordinates(pdfDoc, "ACEMATA MALTO");

    assert(coords.pageIndex === 2, `coords.pageIndex (${coords.pageIndex}) must be 2 (Page 3)`);
    assert(coords.boxX >= 394, `boxX (${coords.boxX}) must be >= 394 pt on Page 3`);
    assert(coords.boxY >= 180 && coords.boxY + coords.boxH <= 236, `boxY (${coords.boxY}) must be in Section D on Page 3`);

    return { pageIndex: coords.pageIndex, boxX: coords.boxX, boxY: coords.boxY };
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUMMARY & EMPIRICAL VERDICT
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n======================================================================");
  console.log("   ADVERSARIAL STRESS TEST SUITE EXECUTION SUMMARY                    ");
  console.log("======================================================================");

  const totalProbes = probeResults.length;
  const passedProbes = probeResults.filter((p) => p.passed).length;
  const failedProbes = probeResults.filter((p) => !p.passed);

  console.log(`Total Adversarial Probes: ${totalProbes}`);
  console.log(`Passed:                   ${passedProbes}`);
  console.log(`Failed:                   ${failedProbes.length}`);

  if (failedProbes.length > 0) {
    console.error("\nFAILURES ENCOUNTERED:");
    for (const f of failedProbes) {
      console.error(`- [${f.group}] ${f.id}: ${f.name} => ${f.error}`);
    }
    console.log("\nEMPIRICAL VERDICT: REJECT");
    process.exit(1);
  } else {
    console.log("\nALL ADVERSARIAL STRESS PROBES PASSED PERFECTLY!");
    console.log("EMPIRICAL VERDICT: APPROVE");
  }
}

runAdversarialStressSuite().catch((err) => {
  console.error("FATAL HARNESS ERROR:", err);
  process.exit(1);
});
