import { db } from '../server/db';

async function main() {
  const res = await db.execute("SELECT id, employee_name, pdf_filename, status, module, created_at, submitted_date FROM dtr_storage ORDER BY id DESC LIMIT 50");
  console.log(`Found ${res.rows.length} rows in dtr_storage:`);
  for (const r of res.rows) {
    console.log(`- [${r.id}] ${r.pdf_filename} | ${r.employee_name} | mod: ${r.module} | status: ${r.status}`);
  }
}

main();
