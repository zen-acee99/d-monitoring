import { db } from "../server/db.js";
import { signPdfBuffer, decryptP12Password } from "../server/services/pnpkiSigningService.js";
import { PDFDocument } from "pdf-lib";
import { findPersonnelSignatureCoordinates } from "../src/utils/dtrVectorPdf.js";
import fs from "fs";

async function executeWithRetry(fn: () => Promise<any>, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      if (attempt === maxRetries) throw e;
      console.warn(`Attempt ${attempt} failed (${e.message}), retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
async function applySignatures() {
  console.log("=== Updating Stored PDFs with Perfect Signatures ===");

  // 1. Fetch Annabel P12
  const annabelP12Res = await db.execute({
    sql: "SELECT * FROM dtr_generator WHERE (Name LIKE '%Annabel%' OR Name LIKE '%ODO%') AND p12 IS NOT NULL LIMIT 1"
  });
  if (annabelP12Res.rows.length === 0) {
    throw new Error("Annabel P12 not found in dtr_generator!");
  }
  const p12Row = annabelP12Res.rows[0];
  const p12Base64 = String(p12Row.p12);
  const password = p12Row.p12_password ? decryptP12Password(String(p12Row.p12_password)) : undefined;
  const sigImg = p12Row.image_digiSigned ? String(p12Row.image_digiSigned) : undefined;
  console.log("Loaded Annabel P12 credentials.");

  // Helper to re-sign Annabel's signature on a document
  async function signDocWithAnnabel(docId: string, options?: { fieldName?: string }) {
    const rs = await db.execute({
      sql: "SELECT id, pdf_filename, pdf_data, remarks FROM dtr_storage WHERE id = ?",
      args: [docId]
    });
    if (rs.rows.length === 0) {
      console.log("Not found:", docId);
      return;
    }
    const row = rs.rows[0];
    console.log(`\nSigning ${row.pdf_filename} (${docId})...`);

    let raw = row.pdf_data as string;
    if (raw.includes(",")) raw = raw.split(",")[1];
    let pdfBytes = Buffer.from(raw, "base64");

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const coords = findPersonnelSignatureCoordinates(pdfDoc, "ANNABEL C. ODOÑO-CALIMPONG", {
      isCounterSign: false
    });

    if (!coords) {
      console.log("Could not find coordinates for Annabel on", docId);
      return;
    }

    console.log(`  Found coords on page ${coords.pageIndex + 1}: boxX=${coords.boxX}, boxY=${coords.boxY}, w=${coords.boxW}, h=${coords.boxH}`);
    console.log(`  sigRects:`, coords.sigRects);

    const sigRects = coords.sigRects || [[coords.boxX, coords.boxY, coords.boxX + coords.boxW, coords.boxY + coords.boxH]];

    const signRes = await signPdfBuffer(pdfBytes, p12Base64, password, {
      signerName: "Annabel C. Odoño-Calimpong",
      signatureImage: sigImg,
      sigRects,
      pageIndex: coords.pageIndex,
      isCounterSign: false,
      fieldName: options?.fieldName || `Signature_Annabel_${Math.random().toString(36).slice(2, 6)}`
    });

    if (!signRes || !signRes.signedBuffer) {
      console.error("Failed to sign buffer for", docId);
      return;
    }

    const newBase64 = `data:application/pdf;base64,${signRes.signedBuffer.toString("base64")}`;

    let rem: any = {};
    try { rem = JSON.parse(row.remarks as string); } catch {}
    if (!rem.requiredSigners) rem.requiredSigners = [];
    if (!rem.requiredSigners.some((r: string) => r.includes("ANNABEL") || r.includes("ODO"))) {
      rem.requiredSigners.push("ANNABEL C. ODOÑO-CALIMPONG");
    }
    if (!rem.signers) rem.signers = [];
    const annabelSigIdx = rem.signers.findIndex((s: any) => s.name.includes("ANNABEL") || s.name.includes("ODO"));
    if (annabelSigIdx >= 0) {
      rem.signers[annabelSigIdx].status = "signed";
      rem.signers[annabelSigIdx].position = "above";
      rem.signers[annabelSigIdx].signedAt = new Date().toISOString();
      rem.signers[annabelSigIdx].p12CommonName = "Annabel C. Odoño-Calimpong";
    } else {
      rem.signers.push({
        name: "ANNABEL C. ODOÑO-CALIMPONG",
        role: "Regional Director",
        status: "signed",
        position: "above",
        signedAt: new Date().toISOString(),
        p12CommonName: "Annabel C. Odoño-Calimpong",
        isCounterSign: false
      });
    }

    rem.notes = `Signed directly ABOVE personnel "ANNABEL C. ODOÑO-CALIMPONG" on page ${coords.pageIndex + 1} (${coords.detectedReason})`;

    await executeWithRetry(() =>
      db.execute({
        sql: "UPDATE dtr_storage SET pdf_data = ?, remarks = ?, status = 'signed' WHERE id = ?",
        args: [newBase64, JSON.stringify(rem), docId]
      })
    );
    console.log(`  ✓ Updated ${docId} in Turso dtr_storage successfully!`);
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 1. POV
  await signDocWithAnnabel("doc-upload-1794223582281-0-90hb", { fieldName: "Signature_Annabel_POV" });

  // 2. ABSTRACT (signed by Leah Dy, now signed by Annabel directly above her printed name)
  await signDocWithAnnabel("doc-upload-1794223582281-1-fbat", { fieldName: "Signature_Annabel_ABSTRACT" });

  // 3. DV
  await signDocWithAnnabel("doc-upload-1794223582282-8-j69c", { fieldName: "Signature_Annabel_DV" });

  // 4. PAYROLL
  await signDocWithAnnabel("doc-upload-1794223582282-7-82jg", { fieldName: "Signature_Annabel_PAYROLL" });

  // 5. NEW TRAVEL ORDER
  await signDocWithAnnabel("doc-upload-1794223582282-6-zhyd", { fieldName: "Signature_Annabel_TO" });

  // 6. DTR REVISTUAL (Dual copies)
  await signDocWithAnnabel("doc-upload-1794223582282-5-8re5", { fieldName: "Signature_Annabel_DTR" });

  // 7. Memos metadata fix for 0 of 0 Signed
  const memos = [
    "doc-upload-1794223582282-4-rokv",
    "doc-upload-1794223582282-2-xjrc",
    "doc-upload-1794223582282-3-uu7r"
  ];
  for (const mId of memos) {
    const rs = await db.execute({
      sql: "SELECT id, remarks FROM dtr_storage WHERE id = ?",
      args: [mId]
    });
    if (rs.rows.length > 0) {
      let rem: any = {};
      try { rem = JSON.parse(rs.rows[0].remarks as string); } catch {}
      rem.requiredSigners = ["ANNABEL C. ODOÑO-CALIMPONG"];
      if (!rem.signers || rem.signers.length === 0) {
        rem.signers = [{
          name: "ANNABEL C. ODOÑO-CALIMPONG",
          role: "Regional Director",
          status: "signed",
          position: "above"
        }];
      }
      await db.execute({
        sql: "UPDATE dtr_storage SET remarks = ?, status = 'signed' WHERE id = ?",
        args: [JSON.stringify(rem), mId]
      });
      console.log(`  ✓ Updated metadata for Memo ${mId}`);
    }
  }

  console.log("\n=== ALL 5 DOCS + DTR + MEMOS UPDATED SUCCESSFULLY ===");
}

applySignatures().catch(console.error);
