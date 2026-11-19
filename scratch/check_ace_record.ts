import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const rs = await client.execute({
    sql: "SELECT id, filename, uploaded_by, status, required_signers, signers, length(pdf_data) as pdf_len FROM signing_workspace_documents WHERE id = ?",
    args: ["doc-upload-1794277438673-0-d1i5"],
  });
  console.log("signing_workspace_documents:", rs.rows);

  const rs2 = await client.execute({
    sql: "SELECT id, filename, employee_name, status, length(pdf_data) as pdf_len FROM dtr_storage WHERE id = ?",
    args: ["doc-upload-1794277438673-0-d1i5"],
  });
  console.log("dtr_storage:", rs2.rows);
}

main().catch(console.error);
