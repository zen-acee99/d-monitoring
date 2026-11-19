import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const rs1 = await client.execute("PRAGMA table_info(signing_workspace_documents)");
  console.log("signing_workspace_documents columns:", rs1.rows.map(r => r.name));

  const rs2 = await client.execute("PRAGMA table_info(dtr_storage)");
  console.log("dtr_storage columns:", rs2.rows.map(r => r.name));

  const rs3 = await client.execute("SELECT id, file_name, file_size, status FROM signing_workspace_documents ORDER BY updated_at DESC LIMIT 5");
  console.log("latest signing_workspace_documents:", rs3.rows);

  const rs4 = await client.execute("SELECT id, original_filename, status FROM dtr_storage WHERE id LIKE '%doc-upload%' ORDER BY submitted_date DESC LIMIT 5");
  console.log("latest dtr_storage doc-uploads:", rs4.rows);
}

main().catch(console.error);
