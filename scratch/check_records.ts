import { db } from "../server/db.js";

async function run() {
  const rec = await db.execute({
    sql: "SELECT id, pdf_filename, status, module, remarks FROM dtr_storage WHERE pdf_filename LIKE '%1793971939962%' OR pdf_filename LIKE '%Vehicle%' OR pdf_filename LIKE '%POV%' OR pdf_filename LIKE '%ABSTRACT%'",
  });
  console.log(`Found ${rec.rows.length} records:`);
  for (const r of rec.rows) {
    console.log({ id: r.id, file: r.pdf_filename, status: r.status, module: r.module });
  }
}

run().catch(console.error);
