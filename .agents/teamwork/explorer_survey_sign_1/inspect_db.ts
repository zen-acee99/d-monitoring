import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function run() {
  const rs = await client.execute("SELECT count(*) as cnt FROM signing_workspace_documents");
  console.log("signing_workspace_documents count:", rs.rows[0].cnt);

  const rs2 = await client.execute("SELECT status, count(*) as cnt FROM signing_workspace_documents GROUP BY status");
  console.log("status in signing_workspace_documents:", rs2.rows);

  const rs3 = await client.execute("SELECT status, count(*) as cnt FROM dtr_storage WHERE module = 'SIGNING_WORKSPACE' GROUP BY status");
  console.log("status in dtr_storage:", rs3.rows);

  const pending = await client.execute("SELECT id, file_name, status, target_personnel FROM signing_workspace_documents WHERE status = 'pending'");
  console.log("Pending docs in signing_workspace_documents:", pending.rows);
}

run().catch(console.error);
