import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function main() {
  const rs = await client.execute({
    sql: "SELECT id, pdf_filename, status, signer_name, employee_name, created_at, module, substr(remarks, 1, 150) as rem FROM dtr_storage WHERE module = 'SIGNING_WORKSPACE' ORDER BY created_at DESC",
    args: []
  });
  console.log(`Found ${rs.rows.length} rows with module = 'SIGNING_WORKSPACE':`);
  for (let i = 0; i < rs.rows.length; i++) {
    const r = rs.rows[i];
    console.log(`[${i+1}] ID: ${r.id} | File: ${r.pdf_filename} | Status: ${r.status}`);
  }
}

main().catch(console.error);
