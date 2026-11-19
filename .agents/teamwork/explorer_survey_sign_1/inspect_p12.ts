import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { decryptP12Password, getSignerIdentityFromP12 } from '../../../server/services/pnpkiSigningService.js';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function run() {
  const rs = await client.execute("SELECT id, Name, user_Id, p12, p12_password FROM dtr_generator WHERE id = 'dtr-sig-usr-muxedv66'");
  if (rs.rows.length === 0) {
    console.log("No profile found");
    return;
  }
  const row = rs.rows[0];
  console.log("Name in DB:", row.Name);
  const pw = decryptP12Password(String(row.p12_password));
  console.log("Decrypted PW length:", pw.length);
  const identity = getSignerIdentityFromP12(String(row.p12), pw);
  console.log("Signer Identity from P12:", JSON.stringify(identity, null, 2));
}

run().catch(console.error);
