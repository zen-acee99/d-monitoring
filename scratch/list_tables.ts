import { db } from '../server/db.js';

async function main() {
  const result = await db.execute({
    sql: `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
    args: []
  });
  console.log('Tables:', result.rows.map(r => r.name));
}

main().catch(console.error);
