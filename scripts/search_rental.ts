import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function main() {
  const rs = await client.execute({
    sql: "SELECT id, pdf_filename, status, created_at, substr(remarks, 1, 200) as rem FROM dtr_storage WHERE pdf_filename LIKE '%Rental%' OR remarks LIKE '%Rental%'",
    args: []
  });
  console.log(`Matched ${rs.rows.length} rows for 'Rental':`);
  for (const r of rs.rows) {
    console.log(r);
  }
}

main().catch(console.error);
