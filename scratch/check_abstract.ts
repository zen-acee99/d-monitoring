import { db } from "../server/db.js";
import fs from "fs";
import { PDFDocument } from "pdf-lib";

async function run() {
  const rec = await db.execute({
    sql: "SELECT id, pdf_filename, status, pdf_data FROM dtr_storage WHERE id = ?",
    args: ["doc-upload-1794144126251-0-dqsa"],
  });
  const row = rec.rows[0];
  console.log("Checking abstract record:", row ? row.id : "none", row?.pdf_filename);
  if (!row?.pdf_data) return;

  let base64 = row.pdf_data as string;
  if (base64.startsWith("data:")) base64 = base64.split(",")[1];
  const buf = Buffer.from(base64, "base64");
  fs.writeFileSync("scratch/test_abstract.pdf", buf);
  console.log("Saved scratch/test_abstract.pdf, byte length:", buf.length);

  try {
    const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
    console.log("Abstract PDF loaded successfully! Pages:", pdfDoc.getPageCount());
  } catch (err: any) {
    console.error("Abstract PDF failed to load in pdf-lib:", err.message);
  }
}

run().catch(console.error);
