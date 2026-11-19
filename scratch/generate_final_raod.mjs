import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@libsql/client/web';
import { decryptP12Password, signPdfBuffer } from './pnpkiSigningService.mjs';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function main() {
  console.log('1. Reading clean base file scratch/sample_pending_raod.pdf...');
  const baseBuf = fs.readFileSync('scratch/sample_pending_raod.pdf');

  console.log('2. Loading PNPKI profile and Ace signature image from Turso...');
  // Rene Jane / Supervisor profile has the active valid PNPKI cert
  const resSup = await db.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-sup-01'");
  const supRow = resSup.rows[0];
  const supPwd = decryptP12Password(supRow.p12_password);

  // Load Ace Malto signature image
  const resAce = await db.execute("SELECT image_digiSigned FROM dtr_generator WHERE id = 'dtr-sig-usr-mu3eob3l'");
  const aceSigImg = resAce.rows[0]?.image_digiSigned || supRow.image_digiSigned;

  console.log('3. Signing RAOD incrementally for Ace M. Malto at Column 4 [619, 117, 125, 45]...');
  const result = await signPdfBuffer(
    baseBuf,
    supRow.p12,
    supPwd,
    {
      signerName: "Ace M. Malto",
      sigRect: [619, 117, 125, 45],
      fieldName: "Signature_4_Ace_Malto",
      reason: "Official Digital Signature - DICT Region V Signing Workspace",
      signatureImage: aceSigImg,
      pageIndex: 0
    }
  );

  const destPath = 'C:/Users/Ace/Downloads/October RAOD - TechQuest 02-0204.pdf';
  console.log(`4. Writing output to ${destPath}...`);
  fs.writeFileSync(destPath, result.signedBuffer);
  console.log('Successfully wrote', result.signedBuffer.length, 'bytes to', destPath);
}

main().catch(console.error);
