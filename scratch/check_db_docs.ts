import { db } from '../server/db';

async function main() {
  try {
    const res = await db.execute("SELECT id, employee_name, pdf_filename, status, module FROM dtr_storage WHERE module = 'SIGNING_WORKSPACE' LIMIT 20");
    console.log(`Found ${res.rows.length} rows in dtr_storage with SIGNING_WORKSPACE:`);
    for (const r of res.rows) {
      console.log(`- [${r.id}] ${r.pdf_filename} | ${r.employee_name} | status: ${r.status}`);
    }
  } catch (e) {
    console.error("Error in dtr_storage:", e);
  }
}

main();
