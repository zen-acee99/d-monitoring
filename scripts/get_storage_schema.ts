import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function main() {
  const rs = await client.execute("PRAGMA table_info(dtr_storage)");
  console.log("Columns in dtr_storage:");
  rs.rows.forEach(r => console.log(`  - ${r.name} (${r.type}) ${r.pk ? '[PRIMARY KEY]' : ''}`));

  const countRs = await client.execute("SELECT count(*) as total, sum(case when module = 'SIGNING_WORKSPACE' then 1 else 0 end) as signing_workspace_count FROM dtr_storage");
  console.log("Counts:", countRs.rows[0]);
}

main().catch(console.error);
