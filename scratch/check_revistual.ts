import fs from "fs";
import { db } from "../server/db.js";

async function run() {
  const rs = await db.execute({
    sql: "SELECT id, pdf_filename, status, remarks, substr(pdf_data, 1, 60) as pfx FROM dtr_storage WHERE pdf_filename LIKE '%REVISTUAL%'",
  });
  console.log(`Found ${rs.rows.length} rows`);
  for (const r of rs.rows) {
    console.log("ID:", r.id);
    console.log("File:", r.pdf_filename);
    console.log("Status:", r.status);
    console.log("Remarks:", r.remarks);
  }

  if (rs.rows.length > 0) {
    const full = await db.execute({
      sql: "SELECT pdf_data FROM dtr_storage WHERE id = ?",
      args: [rs.rows[0].id],
    });
    let b64 = full.rows[0].pdf_data as string;
    if (b64.startsWith("data:")) b64 = b64.split(",")[1];
    fs.writeFileSync("scratch/test_revistual.pdf", Buffer.from(b64, "base64"));
    console.log("Saved scratch/test_revistual.pdf");
  }
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
