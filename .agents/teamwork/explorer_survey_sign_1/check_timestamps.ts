import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function run() {
  const rs = await client.execute("SELECT id, file_name, status, created_at, updated_at FROM signing_workspace_documents WHERE id = 'doc-upload-1794895680225-38-cjzs'");
  console.log("signing_workspace_documents timestamps:", rs.rows);
  const rs2 = await client.execute("SELECT id, pdf_filename, status, created_at, updated_at FROM dtr_storage WHERE id = 'doc-upload-1794895680225-38-cjzs'");
  console.log("dtr_storage timestamps:", rs2.rows);
}

run().catch(console.error);
