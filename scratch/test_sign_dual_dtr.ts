import fs from "fs";
import { db } from "../server/db.js";
import { signPdfBuffer, decryptP12Password } from "../server/services/pnpkiSigningService.js";

async function testSignDualDtr() {
  const buf = fs.readFileSync("scratch/test_revistual.pdf");

  // Get Annabel's P12
  const annabelP12Res = await db.execute({
    sql: "SELECT * FROM dtr_generator WHERE (Name LIKE '%Annabel%' OR Name LIKE '%ODO%') AND p12 IS NOT NULL LIMIT 1",
  });
  const p12Row = annabelP12Res.rows[0];
  const p12Base64 = String(p12Row.p12);
  const password = p12Row.p12_password ? decryptP12Password(String(p12Row.p12_password)) : undefined;
  const sigImg = p12Row.image_digiSigned ? String(p12Row.image_digiSigned) : undefined;

  const sigRects: [number, number, number, number][] = [
    [102, 88, 239, 106],
    [412, 88, 549, 106],
  ];

  console.log("Signing DTR with dual boxes:", sigRects);
  const signRes = await signPdfBuffer(buf, p12Base64, password, {
    signerName: "Annabel C. Odoño-Calimpong",
    signatureImage: sigImg,
    sigRects,
    pageIndex: 0,
    isCounterSign: false,
    fieldName: "Signature_Annabel",
  });

  fs.writeFileSync("scratch/test_revistual_signed_dual.pdf", signRes.signedBuffer);
  console.log("Saved scratch/test_revistual_signed_dual.pdf! File size:", signRes.signedBuffer.length);
  process.exit(0);
}

testSignDualDtr().catch((e) => {
  console.error(e);
  process.exit(1);
});
