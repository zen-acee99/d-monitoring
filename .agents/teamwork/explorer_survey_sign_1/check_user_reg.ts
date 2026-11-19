import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function run() {
  const rs1 = await client.execute("SELECT id, name, email, role FROM administration WHERE id = 'usr-muxedv66' OR email LIKE '%annabel%' OR name LIKE '%annabel%' OR name LIKE '%odo%'");
  console.log("administration matches:", rs1.rows);
  const rs2 = await client.execute("SELECT id, name, email, role FROM users WHERE id = 'usr-muxedv66' OR email LIKE '%annabel%' OR name LIKE '%annabel%' OR name LIKE '%odo%'");
  console.log("users matches:", rs2.rows);
}

run().catch(console.error);
