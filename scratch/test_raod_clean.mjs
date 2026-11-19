import fs from 'fs';
import { createClient } from '@libsql/client/web';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const res = await client.execute("SELECT id, pdf_filename, remarks FROM dtr_storage WHERE pdf_filename LIKE '%RAOD%' ORDER BY id DESC LIMIT 1");
if (res.rows.length > 0) {
  const rawDoc = JSON.parse(res.rows[0].remarks);
  rawDoc.id = res.rows[0].id;
  rawDoc.fileName = res.rows[0].pdf_filename;

  const userStore = fs.readFileSync('src/data/userStore.ts', 'utf8');
  const userMatches = userStore.match(/name:\s*["']([^"']+)["']/g) || [];
  const users = userMatches.map(m => {
    const name = m.replace(/name:\s*["']/, '').replace(/["']$/, '');
    return { name, role: 'Staff' };
  });

  import('./scratch/test_recheck_clean.mjs').then(({ recheckDocWithLatestUsers }) => {
    // recheck
  });
}
