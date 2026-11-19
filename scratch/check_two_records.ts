import { db } from "../server/db.js";

async function run() {
  const rs = await db.execute({
    sql: "SELECT id, pdf_filename, status, remarks FROM dtr_storage WHERE id IN (?, ?)",
    args: ["doc-upload-1794223582282-6-zhyd", "doc-upload-1794223582282-8-j69c"]
  });
  for (const r of rs.rows) {
    console.log("ID:", r.id, r.pdf_filename);
    console.log("Remarks:", r.remarks);
  }
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
