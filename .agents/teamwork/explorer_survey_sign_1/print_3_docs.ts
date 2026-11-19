import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function run() {
  const rs = await client.execute("SELECT id, file_name, status, target_personnel, required_signers, signers_matrix, scanned_info, notes FROM signing_workspace_documents WHERE id IN ('doc-upload-1794895680225-38-cjzs', 'doc-upload-1794895680225-39-0k4l', 'doc-upload-1794895680225-40-8ny3')");
  for (const row of rs.rows) {
    console.log("==========================================");
    console.log("ID:", row.id);
    console.log("FILE:", row.file_name);
    console.log("STATUS:", row.status);
    console.log("TARGET:", row.target_personnel);
    console.log("REQUIRED:", row.required_signers);
    console.log("SIGNERS:", row.signers_matrix);
    console.log("SCANNED:", row.scanned_info);
    console.log("NOTES:", row.notes);
  }
}

run().catch(console.error);
