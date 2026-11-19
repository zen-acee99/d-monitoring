import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function main() {
  const rs = await client.execute("SELECT id, pdf_filename, status, created_at FROM dtr_storage ORDER BY created_at DESC");
  console.log(`All ${rs.rows.length} rows:`);
  rs.rows.forEach((r, i) => console.log(`${i+1}. [${r.id}] "${r.pdf_filename}" (${r.status}) - ${r.created_at}`));
}

main().catch(console.error);
