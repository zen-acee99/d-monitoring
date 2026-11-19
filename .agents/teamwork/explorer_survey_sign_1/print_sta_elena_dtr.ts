import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function run() {
  const rs = await client.execute("SELECT id, pdf_filename, status, employee_name, signer_name, remarks FROM dtr_storage WHERE id = 'doc-upload-1794895680225-38-cjzs'");
  console.log("dtr_storage row:", rs.rows[0]);
}

run().catch(console.error);
