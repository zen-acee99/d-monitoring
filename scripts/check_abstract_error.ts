import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { PDFDocument } from 'pdf-lib';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function run() {
  const rs = await client.execute({
    sql: "SELECT id, pdf_filename, status, length(pdf_data) as len, remarks, pdf_data FROM dtr_storage WHERE pdf_filename LIKE '%ABSTRACT%' OR pdf_filename LIKE '%Vehicle%' OR pdf_filename LIKE '%POV%'"
  });

  for (const row of rs.rows) {
    console.log(`\n--------------------------------------------`);
    console.log(`ID: ${row.id}`);
    console.log(`File: ${row.pdf_filename}`);
    console.log(`Status: ${row.status}, Data length: ${row.len}`);
    let rem: any = {};
    try { rem = JSON.parse(row.remarks as string); } catch {}
    console.log(`RequiredSigners:`, rem.requiredSigners);
    console.log(`Signers:`, rem.signers);
    console.log(`Notes:`, rem.notes);

    // Try parsing with pdf-lib to see if it loads or has errors
    let raw = row.pdf_data as string;
    if (raw) {
      if (raw.includes(",")) raw = raw.split(",")[1];
      try {
        const buf = Buffer.from(raw, 'base64');
        const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
        console.log(`PDF Pages: ${pdfDoc.getPageCount()}`);
        for (let i = 0; i < pdfDoc.getPageCount(); i++) {
          const p = pdfDoc.getPage(i);
          console.log(`  Page ${i + 1}: ${p.getWidth()} x ${p.getHeight()}`);
        }
      } catch (e: any) {
        console.error(`  ERROR LOADING PDF:`, e.message);
      }
    }
  }
}

run().catch(console.error);
