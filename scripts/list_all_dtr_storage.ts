import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function main() {
  const rs = await client.execute({
    sql: "SELECT id, pdf_filename, status, length(pdf_data) as len, created_at FROM dtr_storage ORDER BY created_at DESC"
  });
  console.log(`Total rows in dtr_storage: ${rs.rows.length}`);
  rs.rows.forEach((r, i) => {
    console.log(`[${i+1}] ${r.id} | ${r.pdf_filename} | ${r.status} | len=${r.len} | ${r.created_at}`);
  });
}

main().catch(console.error);
