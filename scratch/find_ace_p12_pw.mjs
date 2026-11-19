import fs from 'fs';
import forge from 'node-forge';
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@libsql/client/web';
import { decryptP12Password } from './pnpkiSigningService.mjs';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function main() {
  const p12Buf = fs.readFileSync('C:/Users/Ace/Downloads/MALTO+ACE+MATASign.p12');
  const p12Der = p12Buf.toString('binary');
  const p12Asn1 = forge.asn1.fromDer(p12Der);

  // Check users table
  const uRes = await db.execute("SELECT * FROM users WHERE Name LIKE '%Malto%' OR email LIKE '%malto%'");
  console.log('Users found:', uRes.rows.map(r => ({ name: r.Name, email: r.email, password: r.password })));

  // Candidate passwords
  const candidates = [
    'Dict@1234', 'Dict@123', 'Dict1234', 'Pnpki@1234', 'Pnpki1234',
    'password', 'Password123!', '12345678', 'Malto@1234', 'AceMalto@1234',
    'Dict5@1234', 'DictRegion5', 'DICTRegionV', 'Region5@123', 'DictAdmin@2026',
    'admin123', 'Admin123!', 'maltoace9', 'acemm1599', 'Acemm1599!', 'Acemm@1599'
  ];

  for (const c of candidates) {
    try {
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, c);
      console.log('SUCCESS! Password is:', c);
      return;
    } catch {}
  }
  console.log('None of the basic candidates matched.');
}
main().catch(console.error);
