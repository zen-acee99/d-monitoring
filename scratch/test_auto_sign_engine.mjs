import fs from "fs";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createClient } from "@libsql/client/web";
import { decryptP12Password, signPdfBuffer, getSignerIdentityFromP12 } from "./pnpkiSigningService.mjs";
import dotenv from "dotenv";
dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function run() {
  console.log("=== TESTING AUTO-SIGN ENGINE FOR RENE JANE ===");
  const reneRes = await db.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-sup-01' OR user_Id = 'usr-mu72vs2b'");
  const reneRow = reneRes.rows[0];
  const renePw = decryptP12Password(reneRow.p12_password);
  const reneSigImg = fs.readFileSync("scratch/rene_sig_correct.png");

  // Test 1: DTR
  console.log("\n1. Testing DTR Auto-Sign...");
  const dtrBytes = fs.readFileSync("public/DTR_Ace_M._Malto_September_2026.pdf");
  const dtrDoc = await PDFDocument.load(dtrBytes, { ignoreEncryption: true });
  const dtrPage = dtrDoc.getPage(0);
  const img1 = await dtrDoc.embedPng(reneSigImg);
  const fontBold = await dtrDoc.embedFont(StandardFonts.HelveticaBold);
  const fontNorm = await dtrDoc.embedFont(StandardFonts.Helvetica);

  // 2 Copies on DTR
  const sigRects = [
    [96, 52, 125, 26],
    [390, 52, 125, 26]
  ];

  sigRects.forEach(([rx, ry, rw, rh]) => {
    dtrPage.drawImage(img1, { x: rx + 2, y: ry + 2, width: 38, height: rh - 4 });
    dtrPage.drawText("Digitally signed", { x: rx + 44, y: ry + 14.5, size: 5.8, font: fontBold, color: rgb(0.08, 0.20, 0.50) });
    dtrPage.drawText("by Buena Rene Jane Rosendo", { x: rx + 44, y: ry + 8, size: 5.5, font: fontBold, color: rgb(0, 0, 0) });
    dtrPage.drawText("Date: 2026.10.17 10:45:00 +08'00'", { x: rx + 44, y: ry + 2, size: 4.8, font: fontNorm, color: rgb(0.25, 0.30, 0.40) });
  });

  const modifiedDtrBytes = await dtrDoc.save({ useObjectStreams: false });
  const signedDtr = await signPdfBuffer(
    Buffer.from(modifiedDtrBytes),
    reneRow.p12,
    renePw,
    {
      sigRect: sigRects[0],
      sigRects: sigRects,
      fieldName: "Supervisor_Signature_Copy1",
      reason: "Civil Service Form No. 48 Official Verification",
      pageIndex: 0,
    }
  );
  console.log("✓ DTR Auto-Sign success! Output size:", signedDtr.signedBuffer.length, "bytes");

  // Test 2: AR
  console.log("\n2. Testing AR Auto-Sign...");
  const arBytes = fs.readFileSync("public/AR_Ace_M._Malto_September_2026.pdf");
  const arDoc = await PDFDocument.load(arBytes, { ignoreEncryption: true });
  const arTargetPage = arDoc.getPage(1);
  const img2 = await arDoc.embedPng(reneSigImg);
  const arFontBold = await arDoc.embedFont(StandardFonts.HelveticaBold);
  const arFontNorm = await arDoc.embedFont(StandardFonts.Helvetica);

  const arSigRect = [319, 480, 125, 26];
  arTargetPage.drawImage(img2, { x: arSigRect[0] + 2, y: arSigRect[1] + 2, width: 38, height: arSigRect[3] - 4 });
  arTargetPage.drawText("Digitally signed", { x: arSigRect[0] + 44, y: arSigRect[1] + 14.5, size: 5.8, font: arFontBold, color: rgb(0.08, 0.20, 0.50) });
  arTargetPage.drawText("by Buena Rene Jane Rosendo", { x: arSigRect[0] + 44, y: arSigRect[1] + 8, size: 5.5, font: arFontBold, color: rgb(0, 0, 0) });
  arTargetPage.drawText("Date: 2026.10.17 10:45:00 +08'00'", { x: arSigRect[0] + 44, y: arSigRect[1] + 2, size: 4.8, font: arFontNorm, color: rgb(0.25, 0.30, 0.40) });

  const modifiedArBytes = await arDoc.save({ useObjectStreams: false });
  const signedAr = await signPdfBuffer(
    Buffer.from(modifiedArBytes),
    reneRow.p12,
    renePw,
    {
      sigRect: arSigRect,
      sigRects: [arSigRect],
      fieldName: "Supervisor_Signature_ReneJane",
      reason: "Accomplishment Report Verification & Official Approval",
      pageIndex: 1,
    }
  );
  console.log("✓ AR Auto-Sign success! Output size:", signedAr.signedBuffer.length, "bytes");

  // Test 3: General 1-Page PDF
  console.log("\n3. Testing General Blank Document Auto-Sign...");
  const genDoc = await PDFDocument.create();
  const page = genDoc.addPage([612, 792]);
  page.drawText("OFFICIAL SPECIAL ORDER NO. 2026-100", { x: 50, y: 700, size: 14, font: fontBold });
  page.drawText("Republic of the Philippines", { x: 50, y: 720, size: 10, font: fontNorm });
  page.drawText("Department of Information and Communications Technology", { x: 50, y: 680, size: 10, font: fontNorm });
  page.drawText("Subject: Designation of Ace M. Malto for Technical Lead", { x: 50, y: 650, size: 11, font: fontBold });
  page.drawText("Approved by:", { x: 320, y: 200, size: 10, font: fontBold });
  page.drawText("RENE JANE R. BUENA", { x: 320, y: 150, size: 10, font: fontBold });
  page.drawText("Provincial Officer - DICT Albay", { x: 320, y: 135, size: 9, font: fontNorm });

  const genImg = await genDoc.embedPng(reneSigImg);
  const genSigRect = [320, 160, 125, 26];
  page.drawImage(genImg, { x: genSigRect[0] + 2, y: genSigRect[1] + 2, width: 38, height: genSigRect[3] - 4 });
  page.drawText("Digitally signed", { x: genSigRect[0] + 44, y: genSigRect[1] + 14.5, size: 5.8, font: fontBold, color: rgb(0.08, 0.20, 0.50) });
  page.drawText("by Buena Rene Jane Rosendo", { x: genSigRect[0] + 44, y: genSigRect[1] + 8, size: 5.5, font: fontBold, color: rgb(0, 0, 0) });
  page.drawText("Date: 2026.10.17 10:45:00 +08'00'", { x: genSigRect[0] + 44, y: genSigRect[1] + 2, size: 4.8, font: fontNorm, color: rgb(0.25, 0.30, 0.40) });

  const genBytes = await genDoc.save({ useObjectStreams: false });
  const signedGen = await signPdfBuffer(
    Buffer.from(genBytes),
    reneRow.p12,
    renePw,
    {
      sigRect: genSigRect,
      sigRects: [genSigRect],
      fieldName: "Supervisor_Signature_ReneJane",
      reason: "Official DICT Document Supervisor Verification & Approval",
      pageIndex: 0,
    }
  );
  console.log("✓ General Document Auto-Sign success! Output size:", signedGen.signedBuffer.length, "bytes");

  console.log("\nALL 3 TESTS PASSED PERFECTLY!");
}

run().catch(console.error);
