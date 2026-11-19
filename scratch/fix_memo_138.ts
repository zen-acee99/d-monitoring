import fs from "fs";
import { db } from "../server/db.js";
import { signPdfBuffer, decryptP12Password } from "../server/services/pnpkiSigningService.js";

async function fixMemo138() {
  const buf = fs.readFileSync("scratch/test_memo_138.pdf");

  // Get Annabel's P12
  const annabelP12Res = await db.execute({
    sql: "SELECT * FROM dtr_generator WHERE (Name LIKE '%Annabel%' OR Name LIKE '%ODO%') AND p12 IS NOT NULL LIMIT 1",
  });
  const p12Row = annabelP12Res.rows[0];
  const p12Base64 = String(p12Row.p12);
  const password = p12Row.p12_password ? decryptP12Password(String(p12Row.p12_password)) : undefined;
  const sigImg = p12Row.image_digiSigned ? String(p12Row.image_digiSigned) : undefined;

  const sigRect: [number, number, number, number] = [308, 348, 445, 366];

  console.log("Signing Memo 138 on Page 2 above Annabel:", sigRect);
  const signRes = await signPdfBuffer(buf, p12Base64, password, {
    signerName: "Annabel C. Odoño-Calimpong",
    signatureImage: sigImg,
    sigRect,
    pageIndex: 1, // Page 2
    isCounterSign: false,
    fieldName: "Signature_Annabel",
  });

  fs.writeFileSync("scratch/test_memo_138_perfect.pdf", signRes.signedBuffer);
  console.log("Saved scratch/test_memo_138_perfect.pdf! File size:", signRes.signedBuffer.length);

  const newB64 = `data:application/pdf;base64,${signRes.signedBuffer.toString("base64")}`;
  const notes = 'Signed directly ABOVE personnel "ANNABEL C. ODOÑO-CALIMPONG" on page 2 (box: [308, 348, 445, 366])';

  const row = await db.execute({
    sql: "SELECT remarks FROM dtr_storage WHERE id = ?",
    args: ["doc-upload-1794223582282-4-rokv"],
  });

  const remarksObj = row.rows[0]?.remarks ? JSON.parse(row.rows[0].remarks as string) : {};
  remarksObj.notes = notes;
  remarksObj.targetPersonnel = "ANNABEL C. ODOÑO-CALIMPONG";
  remarksObj.requiredSigners = ["ANNABEL C. ODOÑO-CALIMPONG"];
  remarksObj.signers = [
    {
      name: "ANNABEL C. ODOÑO-CALIMPONG",
      role: "Regional Director",
      status: "signed",
      position: "above",
      signedAt: "2026-11-09T16:00:00.000Z",
      p12CommonName: "Odoño-Calimpong Annabel Cortez",
      isCounterSign: false,
    },
  ];

  if (remarksObj.scannedInfo) {
    remarksObj.scannedInfo.primaryPersonnel = "ANNABEL C. ODOÑO-CALIMPONG";
    remarksObj.scannedInfo.existingSignatures = [
      { pageIndex: 1, rect: [313.227, 284.392, 341.607, 304.363], signerName: "Masareta Noelyn Maño", isSigned: true },
      { pageIndex: 1, rect: [351.708, 277.783, 379.635, 301.783], signerName: "Dy Leah Balderama", isSigned: true },
      { pageIndex: 1, rect: [308, 348, 445, 366], signerName: "Odoño-Calimpong Annabel Cortez", isSigned: true },
    ];
  }

  await db.execute({
    sql: "UPDATE dtr_storage SET pdf_data = ?, remarks = ?, status = 'signed' WHERE id = ?",
    args: [newB64, JSON.stringify(remarksObj), "doc-upload-1794223582282-4-rokv"],
  });

  console.log("Successfully updated Memo 138 in Turso with clean signature on Page 2 directly above Annabel!");
  process.exit(0);
}

fixMemo138().catch((e) => {
  console.error(e);
  process.exit(1);
});
