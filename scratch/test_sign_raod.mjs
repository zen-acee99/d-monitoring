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
  console.log('1. Loading sample_pending_raod.pdf...');
  const baseBuf = fs.readFileSync('scratch/sample_pending_raod.pdf');
  console.log('Base size:', baseBuf.length);

  console.log('2. Fetching profile from Turso...');
  const res = await db.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-sup-01'");
  const row = res.rows[0];
  const pwd = decryptP12Password(row.p12_password);
  console.log('Signer:', row.Name);

  console.log('3. Signing with signPdfBuffer...');
  const result = await signPdfBuffer(
    baseBuf,
    row.p12,
    pwd,
    {
      signerName: "Ace M. Malto",
      sigRect: [619, 117, 125, 45],
      fieldName: "Signature_4_Ace_Malto",
      reason: "Official Digital Signature - DICT Region V Signing Workspace",
      signatureImage: row.image_digiSigned,
      pageIndex: 0
    }
  );

  console.log('4. Saving output to scratch/output_4_signed_raod.pdf...');
  fs.writeFileSync('scratch/output_4_signed_raod.pdf', result.signedBuffer);
  console.log('Output size:', result.signedBuffer.length);
}

main().catch(console.error);
