import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function main() {
  const rs = await client.execute({
    sql: "SELECT id, pdf_filename, status, created_at, remarks FROM dtr_storage WHERE pdf_filename LIKE '%0111%' OR pdf_filename LIKE '%Vehicle%' OR remarks LIKE '%0111%' OR remarks LIKE '%Vehicle%'",
    args: []
  });
  console.log('Results:', rs.rows.map(r => ({
    id: r.id,
    pdf_filename: r.pdf_filename,
    status: r.status,
    created_at: r.created_at,
    remarks: r.remarks
  })));
}

main().catch(console.error);
