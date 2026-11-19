import { db } from '../server/db';
import fs from 'fs';

async function main() {
  const res = await db.execute("SELECT id, file_name, pdf_data FROM signing_workspace_documents WHERE id = 'doc-upload-1794277438673-0-d1i5'");
  if (res.rows.length === 0) {
    console.log("No row found!");
    return;
  }
  const row = res.rows[0];
  const pdfData = row.pdf_data as string;
  console.log("PDF data length:", pdfData ? pdfData.length : 0);
  if (pdfData) {
    const base64 = pdfData.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync('scratch/current_dtr.pdf', buffer);
    console.log("Saved scratch/current_dtr.pdf, bytes:", buffer.length);
  }
}

main();
