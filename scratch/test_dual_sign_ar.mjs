import fs from "fs";
import { createClient } from "@libsql/client/web";
import { decryptP12Password, signPdfBuffer } from "./pnpkiSigningService.mjs";
import dotenv from "dotenv";
dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function dualSignAR() {
  const inBuf = fs.readFileSync("c:/Users/Ace/Downloads/Documents/AR - Malto Sept 16-24_Signed.pdf");
  
  // Get Ace
  const aceRes = await db.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-usr-mu3eob3l'");
  const aceRow = aceRes.rows[0];
  const acePw = decryptP12Password(aceRow.p12_password);

  // Get Rene
  const reneRes = await db.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-sup-01'");
  const reneRow = reneRes.rows[0];
  const renePw = decryptP12Password(reneRow.p12_password);

  console.log("Pass 1: Signing AR with Ace M. Malto (Personnel)...");
  const rx1 = 35.7374;
  const ry1 = 483.495;
  const rw1 = 179.212 - rx1;
  const rh1 = 523.437 - ry1;

  const pass1 = await signPdfBuffer(
    inBuf,
    aceRow.p12,
    acePw,
    {
      sigRect: [rx1, ry1, rw1, rh1],
      pageIndex: 1,
      fieldName: "Personnel_Signature_AceMalto",
      reason: "Accomplishment Report Preparation & Digital Certification"
    }
  );

  console.log("Pass 2: Signing AR with Rene Jane R. Buena (Supervisor)...");
  const rx2 = 319.42;
  const ry2 = 480.609;
  const rw2 = 410.402 - rx2;
  const rh2 = 509.409 - ry2;

  const pass2 = await signPdfBuffer(
    pass1.signedBuffer,
    reneRow.p12,
    renePw,
    {
      sigRect: [rx2, ry2, rw2, rh2],
      pageIndex: 1,
      fieldName: "Supervisor_Signature_ReneJane",
      reason: "Accomplishment Report Verification & Official Approval"
    }
  );

  fs.writeFileSync("scratch/dual_signed_ar.pdf", pass2.signedBuffer);
  console.log("Successfully dual-signed AR! File size:", pass2.signedBuffer.length);
}

dualSignAR().catch(console.error);
