import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { PDFDocument } from 'pdf-lib';
import { findPersonnelSignatureCoordinates } from '../src/utils/dtrVectorPdf';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function testDocCoords(id: string, personnel: string) {
  const rs = await client.execute({
    sql: "SELECT id, pdf_filename, pdf_data FROM dtr_storage WHERE id = ?",
    args: [id]
  });
  if (rs.rows.length === 0) {
    console.log("Not found:", id);
    return;
  }
  const row = rs.rows[0];
  let raw = row.pdf_data as string;
  if (raw.includes(",")) raw = raw.split(",")[1];
  const pdfBytes = Buffer.from(raw, 'base64');
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const coords = findPersonnelSignatureCoordinates(pdfDoc, personnel, { isCounterSign: false });
  console.log(`\n======================================================`);
  console.log(`Doc: ${row.pdf_filename} (${id})`);
  console.log(`Personnel: ${personnel}`);
  console.log(`Coordinates:`, coords);
}

async function main() {
  // 1. POV
  await testDocCoords('doc-upload-1794223582281-0-90hb', 'ANNABEL C. ODOÑO-CALIMPONG');
  // 2. ABSTRACT
  await testDocCoords('doc-upload-1794223582281-1-fbat', 'ANNABEL C. ODOÑO-CALIMPONG');
  await testDocCoords('doc-upload-1794223582281-1-fbat', 'LEAH B. DY');
  // 3. DV
  await testDocCoords('doc-upload-1794223582282-8-j69c', 'ANNABEL C. ODOÑO-CALIMPONG');
  // 4. PAYROLL
  await testDocCoords('doc-upload-1794223582282-7-82jg', 'ANNABEL C. ODOÑO-CALIMPONG');
  await testDocCoords('doc-upload-1794223582282-7-82jg', 'LEAH B. DY');
  // 5. NEW TRAVEL ORDER
  await testDocCoords('doc-upload-1794223582282-6-zhyd', 'ANNABEL C. ODOÑO-CALIMPONG');
  // 6. DTR REVISTUAL
  await testDocCoords('doc-upload-1794223582282-5-8re5', 'ANNABEL C. ODOÑO-CALIMPONG');
}

main().catch(console.error);
