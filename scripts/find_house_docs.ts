import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();
const client = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! });
async function run() {
  const rs = await client.execute({
    sql: "SELECT id, pdf_filename, status, length(pdf_data) as len, remarks, created_at FROM dtr_storage WHERE pdf_filename LIKE '%House%' OR pdf_filename LIKE '%0111%' OR pdf_filename LIKE '%Represent%' ORDER BY created_at DESC"
  });
  console.log("Count:", rs.rows.length);
  for (const r of rs.rows) {
    let rem: any = {};
    try { rem = JSON.parse(r.remarks as string); } catch {}
    console.log({
      id: r.id,
      name: r.pdf_filename,
      status: r.status,
      len: r.len,
      created_at: r.created_at,
      required: rem.requiredSigners,
      signers: rem.signers,
      notes: rem.notes
    });
  }
}
run().catch(console.error);
