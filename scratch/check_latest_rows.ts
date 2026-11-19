import { db } from "../server/db.js";

async function run() {
  const rec = await db.execute({
    sql: "SELECT id, pdf_filename, status, module, remarks, substr(pdf_data, 1, 50) as prefix FROM dtr_storage ORDER BY id DESC LIMIT 20",
  });
  console.log(`Found ${rec.rows.length} latest records:`);
  for (const r of rec.rows) {
    console.log({ id: r.id, file: r.pdf_filename, status: r.status, module: r.module });
  }
}

run().catch(console.error);
