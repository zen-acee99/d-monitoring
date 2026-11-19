import { db } from "../server/db.js";
import fs from "fs";

async function run() {
  const rec = await db.execute({
    sql: "SELECT id, pdf_filename, status, module, remarks, pdf_data FROM dtr_storage WHERE id = ?",
    args: ["doc-upload-1794144126251-1-nvny"],
  });
  const row = rec.rows[0];
  console.log("Record found:", row ? row.id : "none", row?.pdf_filename);

  if (row?.pdf_data) {
    let base64 = row.pdf_data as string;
    if (base64.startsWith("data:")) {
      base64 = base64.split(",")[1];
    }
    const buf = Buffer.from(base64, "base64");
    fs.writeFileSync("scratch/test_pov.pdf", buf);
    console.log("Saved scratch/test_pov.pdf, byte length:", buf.length);
  }
}

run().catch(console.error);
