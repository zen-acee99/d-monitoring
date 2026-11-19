import { db } from '../server/db.js';
import { decryptP12Password, getSignerIdentityFromP12 } from '../server/services/pnpkiSigningService.js';

async function main() {
  const rows = await db.execute('SELECT id, user_Id, Name, p12, p12_filename, p12_filesize, p12_password, length(image_digiSigned) as img_len FROM dtr_generator');
  console.log(`Found ${rows.rows.length} rows in dtr_generator:`);
  for (const r of rows.rows) {
    let certCN = 'N/A';
    let certSubject = 'N/A';
    let decryptedPw = '';
    if (r.p12 && r.p12_password) {
      try {
        decryptedPw = decryptP12Password(r.p12_password as string);
        const identity = getSignerIdentityFromP12(r.p12 as string, decryptedPw);
        certCN = identity.commonName;
        certSubject = identity.subjectDN;
      } catch (e) {
        certCN = 'Error decoding: ' + e.message;
      }
    }
    console.log({
      id: r.id,
      userId: r.user_Id,
      name: r.Name,
      p12_filename: r.p12_filename,
      p12_size: r.p12_filesize,
      has_p12: Boolean(r.p12),
      cert_cn: certCN,
      cert_subject: certSubject,
      has_img: Boolean(r.img_len)
    });
  }
}

main().catch(console.error);
