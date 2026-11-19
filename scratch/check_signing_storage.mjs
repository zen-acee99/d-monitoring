import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
const authToken = process.env.VITE_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

async function check() {
  const client = createClient({ url, authToken });
  const res = await client.execute("SELECT id, pdfFileName, targetPersonnel, remarks, signerName FROM dtr_storage WHERE module = 'SIGNING_WORKSPACE' ORDER BY createdAt DESC LIMIT 10");
  console.log(`Found ${res.rows.length} records:`);
  for (const r of res.rows) {
    console.log(r.id, r.pdfFileName, r.targetPersonnel, r.signerName);
    if (r.remarks) {
      console.log('   remarks:', r.remarks.slice(0, 300));
    }
  }
}
check().catch(console.error);
