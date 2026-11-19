import fs from "fs";
import { db } from "../server/db.js";

async function main() {
  const rs = await db.execute({
    sql: "SELECT id, pdf_filename, status, employee_name, remarks, pdf_data FROM dtr_storage WHERE id = 'doc-upload-1794277438673-0-d1i5'",
    args: []
  });

  if (rs.rows.length === 0) {
    console.log("Record not found!");
    return;
  }

  const row = rs.rows[0];
  console.log("ID:", row.id);
  console.log("File:", row.pdf_filename);
  console.log("Status:", row.status);
  console.log("Employee:", row.employee_name);
  console.log("Remarks:", row.remarks);

  let b64 = row.pdf_data as string;
  if (b64.startsWith("data:")) b64 = b64.split(",")[1];
  const buf = Buffer.from(b64, "base64");
  fs.writeFileSync("scratch/uploaded_ace_dtr.pdf", buf);
  console.log("Saved scratch/uploaded_ace_dtr.pdf! Size:", buf.length);
}

main().catch(console.error);
