import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function run() {
  const rs = await client.execute("SELECT id, file_name, length(pdf_data) as pdf_len, status, target_personnel, required_signers, signers_matrix FROM signing_workspace_documents WHERE id = 'doc-upload-1794895680225-38-cjzs'");
  console.log("signing_workspace_documents:", rs.rows);

  const rs2 = await client.execute("SELECT id, pdf_filename, length(pdf_data) as pdf_len, status, employee_name FROM dtr_storage WHERE id = 'doc-upload-1794895680225-38-cjzs'");
  console.log("dtr_storage:", rs2.rows);
}

run().catch(console.error);
