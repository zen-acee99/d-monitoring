import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function main() {
  const rs = await client.execute({
    sql: "SELECT id, pdf_filename, status, created_at FROM dtr_storage WHERE created_at >= '2026-11-09 00:00:00' ORDER BY created_at DESC",
    args: []
  });
  console.log(`Matched ${rs.rows.length} rows created on or after 2026-11-09:`);
  for (const r of rs.rows) {
    console.log(r);
  }
}

main().catch(console.error);
