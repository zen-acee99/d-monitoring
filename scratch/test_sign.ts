import fs from 'fs';
import { signPdfBuffer, decryptP12Password } from '../server/services/pnpkiSigningService.js';
import { db } from '../server/db.js';

async function main() {
  try {
    const resDb = await db.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-sup-01'");
    const row: any = resDb.rows[0];
    console.log('Row Name:', row.Name);
    console.log('Row has p12:', !!row.p12, 'length:', row.p12 ? row.p12.length : 0);
    const pwd = row.p12_password ? decryptP12Password(row.p12_password) : '';
    console.log('Decrypted password length:', pwd.length);

    const pdfBuf = fs.readFileSync('C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf');
    const p12Base64 = String(row.p12);

    const res = await signPdfBuffer(pdfBuf, p12Base64, pwd, {
      reason: 'Official 4th Signature Test',
      sigRect: [100, 100, 150, 30],
      pageIndex: 0
    });

    console.log('Signed length:', res.signedBuffer.length);
    console.log('Signer:', res.signerName);
    fs.writeFileSync('./scratch/test_4th_signed.pdf', res.signedBuffer);
    console.log('Done writing test_4th_signed.pdf');
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
