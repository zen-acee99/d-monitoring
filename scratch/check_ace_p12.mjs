import fs from 'fs';
import { createClient } from '@libsql/client/web';
import dotenv from 'dotenv';
dotenv.config();

const fileP12 = fs.readFileSync('C:/Users/Ace/Downloads/MALTO+ACE+MATASign.p12');
console.log('Downloads MALTO p12 size:', fileP12.length);

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

import { decryptP12Password, getSignerIdentityFromP12 } from './pnpkiSigningService.mjs';

const res = await db.execute("SELECT p12, p12_filename, p12_password FROM dtr_generator WHERE id = 'dtr-sig-usr-mu3eob3l'");
const row = res.rows[0];
const pass = decryptP12Password(row.p12_password);
console.log('Turso DB pass length:', pass?.length);

try {
  const idDb = getSignerIdentityFromP12(row.p12, pass);
  console.log('Turso DB Identity:', idDb.commonName, idDb.serialNumber);
} catch (e) {
  console.log('Turso DB error:', e.message);
}

try {
  const idFile = getSignerIdentityFromP12(fileP12.toString('base64'), pass);
  console.log('Downloads Identity:', idFile.commonName, idFile.serialNumber);
} catch (e) {
  console.log('Downloads error:', e.message);
}
