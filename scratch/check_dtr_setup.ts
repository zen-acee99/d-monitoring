import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const rs = await client.execute("SELECT id, name, email, p12_filename, length(p12_data) as p12_len, length(signature_image) as sig_len FROM dtr_user_setup WHERE name LIKE '%Ace%' OR name LIKE '%Malto%'");
  console.log("dtr_user_setup for Ace:", rs.rows);

  const rs2 = await client.execute("SELECT id, user_id, name, p12_filename, length(p12_data) as p12_len, length(signature_image) as sig_len FROM dtr_user_setup LIMIT 5");
  console.log("dtr_user_setup sample:", rs2.rows);
}

main().catch(console.error);
