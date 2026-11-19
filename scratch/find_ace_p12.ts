import fs from "fs";
import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const rs = await client.execute("SELECT id, user_id, signer_name, length(p12_data) as p12_len, password FROM pnpki_keystores WHERE signer_name LIKE '%Ace%' OR signer_name LIKE '%Malto%'");
  console.log("Found keystores:", rs.rows);
}

main().catch(console.error);
