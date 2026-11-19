import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

async function main() {
  try {
    const res = await client.execute('SELECT id, name, email, role FROM users');
    console.log('Users in DB (count:', res.rows.length, '):');
    for (const r of res.rows) {
      console.log(`- ${r.name} | ${r.role} | ${r.email} | id: ${r.id}`);
    }
  } catch (err) {
    console.error(err);
  }
}
main();
