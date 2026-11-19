import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const rs = await client.execute("SELECT id, user_id, signer_name, signer_role, p12_filename, length(p12) as p12_len, length(signature_image) as sig_len FROM dtr_generator");
  console.log("dtr_generator rows:", rs.rows);
}

main().catch(console.error);
