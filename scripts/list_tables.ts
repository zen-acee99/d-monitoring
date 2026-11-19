import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function main() {
  const rs = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log("Tables in database:", rs.rows.map(r => r.name));
}

main().catch(console.error);
