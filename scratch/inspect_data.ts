import { db } from "../server/db.js";
import { decryptP12Password, getSignerIdentityFromP12 } from "../server/services/pnpkiSigningService.js";
import fs from "fs";

async function run() {
  const genRes = await db.execute("SELECT id, user_Id, Name, p12_filename, p12_filesize, length(p12) as p12_len, length(image_digiSigned) as img_len, p12_password, image_digiSigned FROM dtr_generator");
  console.log("=== DTR GENERATOR PROFILES ===");
  for (const row of genRes.rows) {
    const pw = decryptP12Password(row.p12_password as string);
    console.log({
      id: row.id,
      user_Id: row.user_Id,
      Name: row.Name,
      p12_filename: row.p12_filename,
      p12_len: row.p12_len,
      img_len: row.img_len,
      has_pw: Boolean(pw),
      pw_len: pw ? pw.length : 0,
    });
    if (row.p12) {
      try {
        const iden = getSignerIdentityFromP12(row.p12 as string, pw);
        console.log(`  -> Signer CN: ${iden.commonName}, Issuer: ${iden.issuerCN}, Serial: ${iden.serialNumber}`);
      } catch (err: any) {
        console.log(`  -> Error reading cert: ${err.message}`);
      }
    }
  }

  // Inspect the uploaded 16-24 PDF
  const pdfPath = "C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1792147510144_81aae404.pdf";
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfStr = pdfBytes.toString("binary");
  const names = [...pdfStr.matchAll(/\/Name\s*\(([^)]+)\)/g)].map(m => m[1]);
  const fields = [...pdfStr.matchAll(/\/T\s*\(([^)]+)\)/g)].map(m => m[1]);
  const sigMatches = [...pdfStr.matchAll(/\/Type\s*\/Sig\b/g)];
  console.log("\n=== UPLOADED 16-24 PDF SIGNATURES ===");
  console.log("Sig count:", sigMatches.length);
  console.log("Names:", names);
  console.log("Fields:", fields);
}

run().catch(console.error);
