import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const rs1 = await client.execute("PRAGMA table_info(dtr_user_setup)");
  console.log("dtr_user_setup columns:", rs1.rows.map(r => r.name));

  const rs2 = await client.execute("PRAGMA table_info(users)");
  console.log("users columns:", rs2.rows.map(r => r.name));

  const rs3 = await client.execute("SELECT id, user_id, length(p12_data) as p12_len, length(signature_image) as sig_len FROM dtr_user_setup");
  console.log("dtr_user_setup rows:", rs3.rows);

  const rs4 = await client.execute("SELECT id, name, email FROM users WHERE name LIKE '%Ace%' OR name LIKE '%Malto%'");
  console.log("users Ace:", rs4.rows);
}

main().catch(console.error);
