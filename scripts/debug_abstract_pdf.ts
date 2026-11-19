import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function run() {
  const rs = await client.execute({
    sql: "SELECT id, pdf_filename, pdf_data FROM dtr_storage WHERE id = 'doc-upload-1794223582281-1-fbat'"
  });
  const row = rs.rows[0];
  let raw = row.pdf_data as string;
  if (raw.includes(",")) raw = raw.split(",")[1];
  const buf = Buffer.from(raw, 'base64');
  fs.writeFileSync("scratch/debug_abstract.pdf", buf);
  console.log("Wrote scratch/debug_abstract.pdf, size:", buf.length);

  // Check xref and trailer in buffer
  const str = buf.toString('binary');
  const xrefMatches = [...str.matchAll(/xref/g)];
  console.log("xref count:", xrefMatches.length);
  const startXrefMatches = [...str.matchAll(/startxref/g)];
  console.log("startxref count:", startXrefMatches.length);
  for (const m of startXrefMatches) {
    const slice = str.slice(m.index!, m.index! + 60);
    console.log("startxref at:", m.index, JSON.stringify(slice));
  }

  // Load in pdf-lib
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  console.log("pdfDoc pages:", pdfDoc.getPageCount());
  const page = pdfDoc.getPage(0);
  console.log("Page size:", page.getWidth(), "x", page.getHeight());
  console.log("Page rotation:", page.getRotation().angle);
  const annots = page.node.Annots();
  console.log("Annots count:", annots?.size());
  if (annots) {
    for (let i = 0; i < annots.size(); i++) {
      const a: any = annots.get(i);
      try {
        const rect = a.lookup(PDFDocument.name ? (pdfDoc as any).context.obj('Rect') : undefined);
        console.log(`Annot ${i}:`, a.toString());
      } catch (err) {
        console.log(`Annot ${i} err:`, err);
      }
    }
  }
}

run().catch(console.error);
