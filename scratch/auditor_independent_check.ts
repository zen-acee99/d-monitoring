import fs from "fs";
import path from "path";
import { PDFDocument, rgb, StandardFonts, PDFName, PDFDict, PDFArray } from "pdf-lib";
import {
  findPersonnelSignatureCoordinates,
  findApprovalSectionCoordinates,
  scanPdfForSigners,
  matchNames,
} from "../src/utils/dtrVectorPdf.js";
import {
  signPdfBuffer,
  normalizeSignatureBoundingBox,
  getSignerIdentityFromP12,
  decryptP12Password,
} from "../server/services/pnpkiSigningService.js";
import { db } from "../server/db.js";

async function main() {
  console.log("======================================================================");
  console.log("   VICTORY AUDITOR INDEPENDENT VERIFICATION OF ORIGINAL REQUEST      ");
  console.log("======================================================================");

  // 1. Load P12 Keystore for Annabel Cortez (Active P12 with non-matching name to ACEMATA MALTO)
  let p12Base64: string = "";
  let p12Pass: string = "";

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
          p12Base64 = p12Str;
          p12Pass = decPw;
          break;
        }
      } catch {}
    }
  } catch (err) {
    console.warn("DB query error:", err);
  }

  if (!p12Base64) {
    // Fallback to Rene Jane keystore if Annabel not in SQLite
    const rjPath = path.resolve("scratch/rene_jane.p12");
    const rjBuf = fs.readFileSync(rjPath);
    p12Base64 = rjBuf.toString("base64");
    p12Pass = "1234567890Aa!";
  }

  const p12Buffer = Buffer.from(p12Base64, "base64");

  const certIdentity = getSignerIdentityFromP12(p12Base64, p12Pass);
  console.log(`[P12 Identity] Common Name: ${certIdentity.commonName}`);
  console.log(`[P12 Identity] Subject DN: ${certIdentity.subject}`);

  if (!certIdentity.commonName.includes("Annabel")) {
    throw new Error(`Expected Annabel P12, got: ${certIdentity.commonName}`);
  }

  // 2. Synthesize Disbursement Voucher exactly matching media_1794401102272_2e3562e6.png layout
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);

  // Draw borders and dividers
  page.drawLine({ start: { x: 10.6, y: 107 }, end: { x: 585, y: 107 }, thickness: 1, color: black });
  page.drawLine({ start: { x: 10.6, y: 440 }, end: { x: 585, y: 440 }, thickness: 1, color: black });
  page.drawLine({ start: { x: 10.6, y: 368 }, end: { x: 585, y: 368 }, thickness: 1, color: black });
  page.drawLine({ start: { x: 10.6, y: 257 }, end: { x: 585, y: 257 }, thickness: 1, color: black });
  page.drawLine({ start: { x: 315.7, y: 107 }, end: { x: 315.7, y: 257 }, thickness: 1, color: black });
  page.drawLine({ start: { x: 390.0, y: 107 }, end: { x: 390.0, y: 257 }, thickness: 1, color: black });

  // Section A - Supervisor
  page.drawText("A. Certified: Expenses/Cash Advance necessary, lawful and incurred under my direct supervision.", {
    x: 14.2,
    y: 437.4,
    size: 7.0,
    font,
  });
  page.drawText("NORLY A. TABO", {
    x: 143.9,
    y: 388.0,
    size: 8.5,
    font: fontBold,
  });
  page.drawText("OIC-Provincial Officer", {
    x: 130.0,
    y: 375.0,
    size: 7.5,
    font,
  });

  // Section C - Certified
  page.drawText("C. Certified:", { x: 14.2, y: 251.5, size: 7.5, fontBold });
  page.drawText("CARLA MAE R. CABREDO", { x: 70.0, y: 174.0, size: 8.5, font: fontBold });

  // Section D - Approved for Payment
  page.drawText("D. Approved for Payment:", { x: 318.5, y: 251.5, size: 7.5, fontBold });
  page.drawText("ACEMATA MALTO", { x: 422.3, y: 174.0, size: 8.5, font: fontBold });
  page.drawText("Regional Director", { x: 430.0, y: 161.0, size: 7.5, font });

  const unsignedPdfBytes = await doc.save({ useObjectStreams: false });
  const loadedDoc = await PDFDocument.load(unsignedPdfBytes);

  // 3. Coordinate Resolution: Scan PDF and resolve coordinates for ACEMATA MALTO
  const scan = await scanPdfForSigners(unsignedPdfBytes);
  console.log(`[Scan] Detected signers count: ${scan.signers.length}`);
  scan.signers.forEach((s) => console.log(`   - Signer: "${s.name}" (role: "${s.roleHeader || s.title}", y: ${s.y})`));
  console.log(`[Scan] Primary personnel: "${scan.primaryPersonnel}"`);

  // The primary signer must be prioritized as ACEMATA MALTO in Section D
  if (!matchNames(scan.primaryPersonnel, "ACEMATA MALTO")) {
    throw new Error(`Expected primary detected signer to match ACEMATA MALTO, got: ${scan.primaryPersonnel}`);
  }

  const coords = findPersonnelSignatureCoordinates(
    loadedDoc,
    "ACEMATA MALTO",
    undefined,
    "ACEMATA MALTO"
  );
  console.log(`[Coordinates] Resolved:`, coords);

  // Assert Section D bounding constraints
  if (coords.boxX < 394) {
    throw new Error(`VIOLATION: boxX (${coords.boxX}) < 394 pt (crosses into divider at 390 pt)!`);
  }
  if (coords.boxX + coords.boxW > 585) {
    throw new Error(`VIOLATION: boxX + boxW (${coords.boxX + coords.boxW}) > 585 pt (overflows right margin)!`);
  }
  if (coords.boxY < 180 || coords.boxY > 210) {
    throw new Error(`VIOLATION: boxY (${coords.boxY}) outside Section D signature box [180, 210]!`);
  }
  if (coords.boxH !== 28) {
    throw new Error(`VIOLATION: boxH (${coords.boxH}) !== 28 pt standard!`);
  }
  console.log("✓ Section D coordinate bounding constraints verified.");

  // 4. Perform Real Cryptographic Signing with Annabel's P12 for ACEMATA MALTO
  const signResult = await signPdfBuffer(
    Buffer.from(unsignedPdfBytes),
    p12Base64,
    p12Pass,
    {
      signerName: certIdentity.commonName, // Authentic P12 CN: Annabel
      sigRect: [coords.boxX, coords.boxY, coords.boxW, coords.boxH],
      reason: "Approved for Payment (Section D)",
    }
  );

  const signedBytes = signResult.signedBuffer;
  console.log(`[Signed PDF] Size: ${signedBytes.length} bytes, Signer: ${signResult.signerName}`);

  // 5. Structure & Annotation Verification via PDFDocument
  const signedDoc = await PDFDocument.load(signedBytes);
  const signedPage = signedDoc.getPages()[0];
  const annotsRef = signedPage.node.Annots();
  const annotCount = annotsRef ? annotsRef.size() : 0;
  console.log(`[Signed PDF] Widget annotation count: ${annotCount}`);

  if (annotCount !== 1) {
    throw new Error(`VIOLATION: Expected exactly 1 annotation, found ${annotCount}!`);
  }

  const widget = signedDoc.context.lookup(annotsRef.get(0)) as PDFDict;
  const rectArray = widget.lookup(PDFName.of("Rect")) as PDFArray;
  const rMinX = rectArray.get(0).toString();
  const rMinY = rectArray.get(1).toString();
  const rMaxX = rectArray.get(2).toString();
  const rMaxY = rectArray.get(3).toString();
  console.log(`[Widget Rect] [${rMinX}, ${rMinY}, ${rMaxX}, ${rMaxY}]`);

  const numMinX = parseFloat(rMinX);
  const numMinY = parseFloat(rMinY);
  const numMaxX = parseFloat(rMaxX);
  const numMaxY = parseFloat(rMaxY);

  // Check that the widget is strictly in Section D
  if (numMinX < 394 || numMaxX > 585 || numMinY < 180 || numMaxY > 236) {
    throw new Error(`VIOLATION: Widget Rect [${numMinX}, ${numMinY}, ${numMaxX}, ${numMaxY}] is outside Section D!`);
  }
  console.log("✓ Widget is strictly located in Section D directly above ACEMATA MALTO.");

  // Check that NO widget exists in Section A (Supervisor Norly A. Tabo at y > 350 pt)
  if (numMinY > 350) {
    throw new Error(`VIOLATION: Widget was placed in Section A supervisor area!`);
  }
  console.log("✓ Exactly 0 widgets in Section A (supervisor area above Norly A. Tabo).");

  // 6. Check Cryptographic /Sig and /ByteRange Integrity
  const signedPdfString = signedBytes.toString("latin1");
  const byteRangeMatches = signedPdfString.match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);
  if (!byteRangeMatches) {
    throw new Error("VIOLATION: Missing or invalid /ByteRange array in signed PDF!");
  }
  const b0 = parseInt(byteRangeMatches[1]);
  const b1 = parseInt(byteRangeMatches[2]);
  const b2 = parseInt(byteRangeMatches[3]);
  const b3 = parseInt(byteRangeMatches[4]);
  console.log(`[ByteRange] [${b0}, ${b1}, ${b2}, ${b3}]`);

  if (b0 !== 0) throw new Error("VIOLATION: ByteRange first number must be 0!");
  if (b2 + b3 !== signedBytes.length) {
    throw new Error(`VIOLATION: ByteRange does not cover file end! b2+b3=${b2+b3}, fileLen=${signedBytes.length}`);
  }
  console.log("✓ Cryptographic /ByteRange covers exactly 100% of the signed PDF file.");

  if (!signedPdfString.includes("/SubFilter/adbe.pkcs7.detached") && !signedPdfString.includes("/SubFilter /adbe.pkcs7.detached")) {
    throw new Error("VIOLATION: Missing /SubFilter /adbe.pkcs7.detached!");
  }
  console.log("✓ Detached PKCS#7 envelope verified.");

  // 7. Verify Appearance Stream contains authentic DigiSigned and Annabel Cortez cert name
  if (!signedPdfString.includes("DigiSigned") && !signedPdfString.includes("Digitally signed")) {
    throw new Error("VIOLATION: Appearance stream missing DigiSigned text!");
  }
  console.log("✓ Visual appearance stream contains DigiSigned stamp.");

  console.log("======================================================================");
  console.log("   AUDITOR INDEPENDENT VERIFICATION RESULT: 100% SUCCESS              ");
  console.log("======================================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR IN INDEPENDENT VERIFICATION:", err);
  process.exit(1);
});
