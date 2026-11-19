import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const rs = await client.execute("PRAGMA table_info(dtr_generator)");
  console.log("dtr_generator columns:", rs.rows.map(r => r.name));

  const rs2 = await client.execute("SELECT id, user_id, p12_filename, length(p12) as p12_len FROM dtr_generator");
  console.log("dtr_generator rows:", rs2.rows);
}

main().catch(console.error);
