import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function main() {
  const rs = await client.execute({
    sql: "SELECT id, pdf_filename, status, signer_name, remarks FROM dtr_storage WHERE id LIKE 'doc-upload-1794144126%'",
    args: []
  });
  console.log(`Found ${rs.rows.length} rows for 1794144126:`);
  for (const r of rs.rows) {
    console.log({
      id: r.id,
      pdf_filename: r.pdf_filename,
      status: r.status,
      signer_name: r.signer_name,
      remarks: r.remarks
    });
  }
}

main().catch(console.error);
