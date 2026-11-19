import fs from "fs";
import { db } from "../server/db.js";
import { signPdfBuffer, decryptP12Password } from "../server/services/pnpkiSigningService.js";
import { PDFDocument } from "pdf-lib";
import { findPersonnelSignatureCoordinates, detectExistingPdfSignatures } from "../src/utils/dtrVectorPdf.js";

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

async function main() {
  console.log("=== Preparing and Seeding signing_workspace_documents ===");

  // 1. Fetch Annabel's P12 credentials
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
  console.log("✓ Loaded Annabel P12 credentials.");

  // Helper to upsert a document into signing_workspace_documents
  async function upsertSigningDoc(doc: {
    id: string;
    fileName: string;
    fileSize: string;
    uploadedBy: string;
    status: string;
    targetPersonnel: string;
    requiredSigners: string[];
    signers: any[];
    scannedInfo?: any;
    pdfBuffer: Buffer;
    province?: string;
    notes?: string;
  }) {
    const pdfDataUrl = `data:application/pdf;base64,${doc.pdfBuffer.toString("base64")}`;
    const requiredSignersStr = JSON.stringify(doc.requiredSigners);
    const signersMatrixStr = JSON.stringify(doc.signers);
    const scannedInfoStr = doc.scannedInfo ? JSON.stringify(doc.scannedInfo) : null;

    await executeWithRetry(() =>
      db.execute({
        sql: `INSERT INTO signing_workspace_documents (
          id, file_name, file_size, uploaded_by, status, target_personnel,
          required_signers, signers_matrix, scanned_info, pdf_data,
          province, section_division, notes, has_p12, signature_image,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          file_name = excluded.file_name,
          file_size = excluded.file_size,
          status = excluded.status,
          target_personnel = excluded.target_personnel,
          required_signers = excluded.required_signers,
          signers_matrix = excluded.signers_matrix,
          scanned_info = COALESCE(excluded.scanned_info, signing_workspace_documents.scanned_info),
          pdf_data = excluded.pdf_data,
          notes = excluded.notes,
          has_p12 = excluded.has_p12,
          signature_image = COALESCE(excluded.signature_image, signing_workspace_documents.signature_image),
          updated_at = CURRENT_TIMESTAMP`,
        args: [
          doc.id,
          doc.fileName,
          doc.fileSize,
          doc.uploadedBy,
          doc.status,
          doc.targetPersonnel,
          requiredSignersStr,
          signersMatrixStr,
          scannedInfoStr,
          pdfDataUrl,
          doc.province || "Regional Office",
          "Regional Office V",
          doc.notes || "",
          1,
          sigImg || null,
        ],
      })
    );
    console.log(`  ✓ Successfully stored "${doc.fileName}" (${doc.id}) in signing_workspace_documents (${doc.fileSize})`);
  }

  // --- Document 1: POV Vehicle Rental ---
  console.log("\n[1/7] Processing POV...");
  let povBytes: Buffer;
  if (fs.existsSync("scratch/test_pov_fixed.pdf")) {
    povBytes = fs.readFileSync("scratch/test_pov_fixed.pdf");
  } else {
    povBytes = fs.readFileSync("scratch/test_pov.pdf");
  }
  const povDoc = await PDFDocument.load(povBytes);
  const povSigs = detectExistingPdfSignatures(povDoc);
  await upsertSigningDoc({
    id: "doc-upload-1794223582281-0-90hb",
    fileName: "POV_2026_11_0111_Vehicle_Rental_for_the_House_of_Representatives.pdf",
    fileSize: `${(povBytes.length / 1024).toFixed(1)} KB`,
    uploadedBy: "ANNABEL C. ODOÑO-CALIMPONG",
    status: "signed",
    targetPersonnel: "ANNABEL C. ODOÑO-CALIMPONG",
    requiredSigners: ["ANNABEL C. ODOÑO-CALIMPONG"],
    signers: [
      {
        name: "ANNABEL C. ODOÑO-CALIMPONG",
        role: "Regional Director",
        status: "signed",
        position: "above",
        signedAt: "2026-11-09T14:30:00.000Z",
        p12CommonName: "Annabel C. Odoño-Calimpong",
      },
    ],
    scannedInfo: { existingSignatures: povSigs, primaryPersonnel: "ANNABEL C. ODOÑO-CALIMPONG" },
    pdfBuffer: povBytes,
    notes: 'Signed directly ABOVE personnel "ANNABEL C. ODOÑO-CALIMPONG" on page 1 (5-8px gap)',
  });

  // --- Document 2: ABSTRACT Vehicle Rental ---
  console.log("\n[2/7] Processing ABSTRACT...");
  let absBytes: Buffer;
  if (fs.existsSync("scratch/test_abstract_fixed.pdf")) {
    absBytes = fs.readFileSync("scratch/test_abstract_fixed.pdf");
  } else {
    absBytes = fs.readFileSync("scratch/test_abstract.pdf");
  }
  const absDoc = await PDFDocument.load(absBytes);
  const absSigs = detectExistingPdfSignatures(absDoc);
  await upsertSigningDoc({
    id: "doc-upload-1794223582281-1-fbat",
    fileName: "ABSTRACT_Vehicle_Rental_for_the_House_of_Representatives.pdf",
    fileSize: `${(absBytes.length / 1024).toFixed(1)} KB`,
    uploadedBy: "ANNABEL C. ODOÑO-CALIMPONG",
    status: "signed",
    targetPersonnel: "ANNABEL C. ODOÑO-CALIMPONG",
    requiredSigners: ["LEAH B. DY", "ANNABEL C. ODOÑO-CALIMPONG"],
    signers: [
      {
        name: "LEAH B. DY",
        role: "BAC Chairperson",
        status: "signed",
        position: "above",
        signedAt: "2026-11-09T12:00:00.000Z",
        p12CommonName: "Dy Leah Balderama",
      },
      {
        name: "ANNABEL C. ODOÑO-CALIMPONG",
        role: "Regional Director",
        status: "signed",
        position: "above",
        signedAt: "2026-11-09T14:35:00.000Z",
        p12CommonName: "Annabel C. Odoño-Calimpong",
      },
    ],
    scannedInfo: { existingSignatures: absSigs, primaryPersonnel: "ANNABEL C. ODOÑO-CALIMPONG" },
    pdfBuffer: absBytes,
    notes: 'Signed by Leah B. Dy and Annabel C. Odoño-Calimpong directly ABOVE their printed names',
  });

  // --- Document 3: DV Year-End Bonus ---
  console.log("\n[3/7] Processing DV Year-End Bonus...");
  const dvRaw = fs.readFileSync("scratch/test_dv_real.pdf");
  // Slice at 541675 to get pristine pre-Annabel DV (with Baloloy & Leah Dy)
  const dvPre = dvRaw.subarray(0, 541670 + 5);
  const dvPdfDoc = await PDFDocument.load(dvPre);
  const dvCoords = findPersonnelSignatureCoordinates(dvPdfDoc, "ANNABEL C. ODOÑO-CALIMPONG", {
    isCounterSign: false,
  });
  console.log("  DV Box D coords:", dvCoords);
  const dvSigRect: [number, number, number, number] = [
    dvCoords.boxX,
    dvCoords.boxY,
    dvCoords.boxX + dvCoords.boxW,
    dvCoords.boxY + dvCoords.boxH,
  ];
  const dvSignRes = await signPdfBuffer(dvPre, p12Base64, password, {
    signerName: "Annabel C. Odoño-Calimpong",
    signatureImage: sigImg,
    sigRect: dvSigRect,
    pageIndex: dvCoords.pageIndex,
    isCounterSign: false,
    fieldName: "Signature_Annabel",
  });
  const dvSignedBytes = dvSignRes.signedBuffer;
  fs.writeFileSync("scratch/signed_dv_perfect.pdf", dvSignedBytes);
  const dvFinalDoc = await PDFDocument.load(dvSignedBytes);
  const dvFinalSigs = detectExistingPdfSignatures(dvFinalDoc);
  await upsertSigningDoc({
    id: "doc-upload-1794223582282-8-j69c",
    fileName: "DV_DICT_Region_V_Organic_Personnel_Year_End_Bonus_and_Cash_Gift.pdf",
    fileSize: `${(dvSignedBytes.length / 1024).toFixed(1)} KB`,
    uploadedBy: "ANNABEL C. ODOÑO-CALIMPONG",
    status: "signed",
    targetPersonnel: "ANNABEL C. ODOÑO-CALIMPONG",
    requiredSigners: ["ANNABEL C. ODOÑO-CALIMPONG"],
    signers: [
      {
        name: "ANNABEL C. ODOÑO-CALIMPONG",
        role: "Regional Director",
        status: "signed",
        position: "above",
        signedAt: "2026-11-09T14:40:00.000Z",
        p12CommonName: "Annabel C. Odoño-Calimpong",
      },
    ],
    scannedInfo: { existingSignatures: dvFinalSigs, primaryPersonnel: "ANNABEL C. ODOÑO-CALIMPONG" },
    pdfBuffer: dvSignedBytes,
    notes: 'Signed directly ABOVE personnel "ANNABEL C. ODOÑO-CALIMPONG" on page 1 in Box D (5-8px gap)',
  });

  // --- Document 4: PAYROLL Year-End Bonus ---
  console.log("\n[4/7] Processing PAYROLL Year-End Bonus...");
  let payBytes: Buffer;
  if (fs.existsSync("scratch/test_perfect_4th_signed.pdf")) {
    payBytes = fs.readFileSync("scratch/test_perfect_4th_signed.pdf");
  } else if (fs.existsSync("scratch/signed_fixed_output.pdf")) {
    payBytes = fs.readFileSync("scratch/signed_fixed_output.pdf");
  } else {
    payBytes = fs.readFileSync("scratch/test_4th_signed.pdf");
  }
  const payDoc = await PDFDocument.load(payBytes);
  const paySigs = detectExistingPdfSignatures(payDoc);
  await upsertSigningDoc({
    id: "doc-upload-1794223582282-7-82jg",
    fileName: "PAYROLL_DICT_Region_V_Organic_Personnel_Year_End_Bonus_and_Cash.pdf",
    fileSize: `${(payBytes.length / 1024).toFixed(1)} KB`,
    uploadedBy: "ANNABEL C. ODOÑO-CALIMPONG",
    status: "signed",
    targetPersonnel: "ANNABEL C. ODOÑO-CALIMPONG",
    requiredSigners: ["LEAH B. DY", "ANNABEL C. ODOÑO-CALIMPONG"],
    signers: [
      {
        name: "LEAH B. DY",
        role: "Accountant III",
        status: "signed",
        position: "above",
        signedAt: "2026-11-09T12:15:00.000Z",
        p12CommonName: "Dy Leah Balderama",
      },
      {
        name: "ANNABEL C. ODOÑO-CALIMPONG",
        role: "Regional Director",
        status: "signed",
        position: "above",
        signedAt: "2026-11-09T14:45:00.000Z",
        p12CommonName: "Annabel C. Odoño-Calimpong",
      },
    ],
    scannedInfo: { existingSignatures: paySigs, primaryPersonnel: "ANNABEL C. ODOÑO-CALIMPONG" },
    pdfBuffer: payBytes,
    notes: 'Signed by Leah B. Dy and Annabel C. Odoño-Calimpong directly ABOVE their printed names',
  });

  // --- Document 5: NEW TRAVEL ORDER FORM ---
  console.log("\n[5/7] Processing NEW TRAVEL ORDER FORM...");
  const toRaw = fs.readFileSync("scratch/test_to_real.pdf");
  // Slice at 497584 to get pristine pre-Annabel TO (with John Nomel & Norly Avila)
  const toPre = toRaw.subarray(0, 497579 + 5);
  const toPdfDoc = await PDFDocument.load(toPre);
  const toCoords = findPersonnelSignatureCoordinates(toPdfDoc, "ANNABEL C. ODOÑO-CALIMPONG", {
    isCounterSign: false,
  });
  console.log("  Travel Order coords:", toCoords);
  const toSigRect: [number, number, number, number] = [
    toCoords.boxX,
    toCoords.boxY,
    toCoords.boxX + toCoords.boxW,
    toCoords.boxY + toCoords.boxH,
  ];
  const toSignRes = await signPdfBuffer(toPre, p12Base64, password, {
    signerName: "Annabel C. Odoño-Calimpong",
    signatureImage: sigImg,
    sigRect: toSigRect,
    pageIndex: toCoords.pageIndex,
    isCounterSign: false,
    fieldName: "Signature_Annabel",
  });
  const toSignedBytes = toSignRes.signedBuffer;
  fs.writeFileSync("scratch/signed_to_perfect.pdf", toSignedBytes);
  const toFinalDoc = await PDFDocument.load(toSignedBytes);
  const toFinalSigs = detectExistingPdfSignatures(toFinalDoc);
  await upsertSigningDoc({
    id: "doc-upload-1794223582282-6-zhyd",
    fileName: "NEW_TRAVEL_ORDER_FORM_TRAVEL_ORDER_IAA_SOR_D_SEP_7_TO_11_1signed.pdf",
    fileSize: `${(toSignedBytes.length / 1024).toFixed(1)} KB`,
    uploadedBy: "ANNABEL C. ODOÑO-CALIMPONG",
    status: "signed",
    targetPersonnel: "ANNABEL C. ODOÑO-CALIMPONG",
    requiredSigners: ["ANNABEL C. ODOÑO-CALIMPONG"],
    signers: [
      {
        name: "ANNABEL C. ODOÑO-CALIMPONG",
        role: "Regional Director",
        status: "signed",
        position: "above",
        signedAt: "2026-11-09T14:50:00.000Z",
        p12CommonName: "Annabel C. Odoño-Calimpong",
      },
    ],
    scannedInfo: { existingSignatures: toFinalSigs, primaryPersonnel: "ANNABEL C. ODOÑO-CALIMPONG" },
    pdfBuffer: toSignedBytes,
    notes: 'Signed directly ABOVE personnel "ANNABEL C. ODOÑO-CALIMPONG" on page 1 (5-8px gap, cleanly below APPROVED:)',
  });

  // --- Document 6: DTR REVISTUAL (Dual copies) ---
  console.log("\n[6/7] Processing DTR REVISTUAL...");
  let revBytes: Buffer;
  if (fs.existsSync("scratch/test_revistual_signed_dual.pdf")) {
    revBytes = fs.readFileSync("scratch/test_revistual_signed_dual.pdf");
  } else {
    revBytes = fs.readFileSync("scratch/test_revistual.pdf");
  }
  const revDoc = await PDFDocument.load(revBytes);
  const revSigs = detectExistingPdfSignatures(revDoc);
  await upsertSigningDoc({
    id: "doc-upload-1794223582282-5-8re5",
    fileName: "DTR_1-31Oct2026_REVISTUAL (rev).pdf",
    fileSize: `${(revBytes.length / 1024).toFixed(1)} KB`,
    uploadedBy: "ANNABEL C. ODOÑO-CALIMPONG",
    status: "signed",
    targetPersonnel: "ANNABEL C. ODOÑO-CALIMPONG",
    requiredSigners: ["ANNABEL C. ODOÑO-CALIMPONG"],
    signers: [
      {
        name: "ANNABEL C. ODOÑO-CALIMPONG",
        role: "Regional Director",
        status: "signed",
        position: "above",
        signedAt: "2026-11-09T15:00:00.000Z",
        p12CommonName: "Annabel C. Odoño-Calimpong",
      },
    ],
    scannedInfo: { existingSignatures: revSigs, primaryPersonnel: "ANNABEL C. ODOÑO-CALIMPONG" },
    pdfBuffer: revBytes,
    notes: 'Signed directly ABOVE "ANNABEL C. ODOÑO-CALIMPONG" on both dual copies of CSC Form 48 DTR (5-8px gap)',
  });

  // --- Document 7: 138 Memo Request for Fund Download ---
  console.log("\n[7/7] Processing 138 Memo...");
  const memoRaw = fs.readFileSync("scratch/test_memo_138.pdf");
  // Slice at 505086 to get pristine pre-Annabel Memo (with Masareta & Leah Dy on Page 2)
  const memoPre = memoRaw.subarray(0, 505081 + 5);
  const memoPdfDoc = await PDFDocument.load(memoPre);
  const memoCoords = findPersonnelSignatureCoordinates(memoPdfDoc, "ANNABEL C. ODOÑO-CALIMPONG", {
    isCounterSign: false,
  });
  console.log("  Memo 138 Page 2 coords:", memoCoords);
  const memoSigRect: [number, number, number, number] = [
    memoCoords.boxX,
    memoCoords.boxY,
    memoCoords.boxX + memoCoords.boxW,
    memoCoords.boxY + memoCoords.boxH,
  ];
  const memoSignRes = await signPdfBuffer(memoPre, p12Base64, password, {
    signerName: "Annabel C. Odoño-Calimpong",
    signatureImage: sigImg,
    sigRect: memoSigRect,
    pageIndex: memoCoords.pageIndex, // Page 2
    isCounterSign: false,
    fieldName: "Signature_Annabel",
  });
  const memoSignedBytes = memoSignRes.signedBuffer;
  fs.writeFileSync("scratch/test_memo_138_perfect.pdf", memoSignedBytes);
  const memoFinalDoc = await PDFDocument.load(memoSignedBytes);
  const memoFinalSigs = detectExistingPdfSignatures(memoFinalDoc);
  await upsertSigningDoc({
    id: "doc-upload-1794223582282-4-rokv",
    fileName: "138_Memo_2026_342_Request_for_Fund_Download_Jan_2026.pdf",
    fileSize: `${(memoSignedBytes.length / 1024).toFixed(1)} KB`,
    uploadedBy: "ANNABEL C. ODOÑO-CALIMPONG",
    status: "signed",
    targetPersonnel: "ANNABEL C. ODOÑO-CALIMPONG",
    requiredSigners: ["ANNABEL C. ODOÑO-CALIMPONG", "CHRISTIAN ROY N. MELAD"],
    signers: [
      {
        name: "ANNABEL C. ODOÑO-CALIMPONG",
        role: "Regional Director",
        status: "signed",
        position: "above",
        signedAt: "2026-11-09T15:10:00.000Z",
        p12CommonName: "Annabel C. Odoño-Calimpong",
      },
      {
        name: "CHRISTIAN ROY N. MELAD",
        role: "OIC, ROCS",
        status: "pending",
        position: "above",
      },
    ],
    scannedInfo: { existingSignatures: memoFinalSigs, primaryPersonnel: "ANNABEL C. ODOÑO-CALIMPONG" },
    pdfBuffer: memoSignedBytes,
    notes: 'Signed directly ABOVE personnel "ANNABEL C. ODOÑO-CALIMPONG" on page 2 (5-8px gap)',
  });

  console.log("\n=== ALL 7 DOCUMENTS SUCCESSFULLY SEEDED INTO signing_workspace_documents ===");
}

main().catch(console.error);
