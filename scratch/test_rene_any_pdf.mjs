import fs from "fs";
import { createClient } from "@libsql/client/web";
import { decryptP12Password, signPdfBuffer, getSignerIdentityFromP12 } from "./pnpkiSigningService.mjs";
import dotenv from "dotenv";
dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function test() {
  console.log("Checking Rene Jane profile in Turso...");
  const res = await db.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-sup-01' OR user_Id = 'usr-mu72vs2b'");
  if (res.rows.length === 0) {
    console.error("No Rene Jane found!");
    return;
  }
  const row = res.rows[0];
  const pw = decryptP12Password(row.p12_password);
  console.log("Found Rene Jane. P12 length:", row.p12?.length, "Decrypted PW:", pw);

  const identity = getSignerIdentityFromP12(row.p12, pw);
  console.log("Signer identity:", identity.commonName, "Serial:", identity.serialNumber);

  // Test signing a sample PDF (e.g. public/DTR_Ace_M._Malto_September_2026.pdf)
  const samplePdf = fs.readFileSync("public/DTR_Ace_M._Malto_September_2026.pdf");
  const signed = await signPdfBuffer(samplePdf, row.p12, pw, {
    reason: "Official Auto-Sign Test",
    sigRect: [100, 100, 150, 40],
    fieldName: "ReneJane_AutoSign_Test",
  });
  console.log("Signing success! Signed buffer size:", signed.signedBuffer.length, "Signer:", signed.signerName);
}

test().catch(console.error);
