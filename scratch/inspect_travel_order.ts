import { db } from "../server/db.js";
import fs from "fs";

async function run() {
  const rec = await db.execute({
    sql: "SELECT id, pdf_filename, status, module, remarks, substr(pdf_data, 1, 100) as prefix FROM dtr_storage WHERE pdf_filename LIKE '%TRAVEL%' OR pdf_filename LIKE '%SOR%'",
  });
  console.log(`Found ${rec.rows.length} records:`);
  for (const r of rec.rows) {
    console.log({
      id: r.id,
      file: r.pdf_filename,
      status: r.status,
      remarks: r.remarks ? JSON.parse(r.remarks as string) : null,
    });
  }

  if (rec.rows.length > 0) {
    const full = await db.execute({
      sql: "SELECT pdf_data FROM dtr_storage WHERE id = ?",
      args: [rec.rows[0].id],
    });
    let b64 = full.rows[0].pdf_data as string;
    if (b64.startsWith("data:")) b64 = b64.split(",")[1];
    fs.writeFileSync("scratch/test_to.pdf", Buffer.from(b64, "base64"));
    console.log("Saved scratch/test_to.pdf");
  }
}

run().catch(console.error);
