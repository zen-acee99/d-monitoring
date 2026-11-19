import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function run() {
  const rs = await client.execute("SELECT id, file_name, length(pdf_data) as sw_len, status FROM signing_workspace_documents WHERE file_name LIKE '%Labo%' OR file_name LIKE '%Sta. Elena%' OR file_name LIKE '%Irosin%'");
  console.log("signing_workspace_documents:", rs.rows);
  const rs2 = await client.execute("SELECT id, pdf_filename, length(pdf_data) as dtr_len, status FROM dtr_storage WHERE pdf_filename LIKE '%Labo%' OR pdf_filename LIKE '%Sta. Elena%' OR pdf_filename LIKE '%Irosin%'");
  console.log("dtr_storage:", rs2.rows);
}

run().catch(console.error);
