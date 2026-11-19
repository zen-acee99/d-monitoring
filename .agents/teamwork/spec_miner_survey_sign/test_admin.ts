import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.TURSO_DATABASE_URL || "libsql://monitoring-zen1.aws-ap-northeast-1.turso.io";
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient({ url, authToken });

async function run() {
  const adminRows = await client.execute("SELECT id, name, email, role FROM administration WHERE id = 'usr-muxedv66' OR email LIKE '%calimpong%' OR name LIKE '%Annabel%'");
  console.log("Matching administration rows:", adminRows.rows);

  const allAdmin = await client.execute("SELECT id, name, email, role FROM administration");
  console.log("Total administration rows:", allAdmin.rows.length);
  for (const a of allAdmin.rows) {
    console.log(`  ${a.id} | ${a.name} | ${a.email} | ${a.role}`);
  }
}

run().catch(console.error);
