import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const rs = await client.execute({
    sql: "SELECT id, employee_name, pdf_filename, status, length(pdf_data) as pdf_len, remarks FROM dtr_storage WHERE id = ?",
    args: ["doc-upload-1794277438673-0-d1i5"],
  });
  console.log("dtr_storage row:", rs.rows[0]);
}

main().catch(console.error);
