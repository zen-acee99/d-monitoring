import fs from 'fs';
import { PDFDocument, PDFName, PDFArray, PDFDict } from 'pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client/web';
import { decryptP12Password, signPdfBuffer } from '../server/services/pnpkiSigningService';

dotenv.config();

async function testIncrementalKids() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL || "",
    authToken: process.env.TURSO_AUTH_TOKEN || "",
  });
  const rowRes = await db.execute("SELECT p12, p12_password, Name FROM dtr_generator WHERE id = 'dtr-sig-sup-01' LIMIT 1");
  const p12Base64 = String(rowRes.rows[0].p12);
  const password = decryptP12Password(String(rowRes.rows[0].p12_password));
  const signerName = String(rowRes.rows[0].Name);

  const prevBuffer = fs.readFileSync('scratch/pass1_dtr_signed.pdf');

  // Sup rects for Copy 1 and Copy 2
  const supRects: [number, number, number, number][] = [
    [54, 80, 249, 112],
    [360, 80, 555, 112],
  ];

  const signRes = await signPdfBuffer(
    prevBuffer,
    p12Base64,
    password,
    {
      sigRects: supRects,
      fieldName: "Supervisor_Signature",
      signerName,
      reason: "Civil Service Form No. 48 Official Verification",
      skipVisualText: true,
    }
  );

  console.log("Pass 2 Signed! Length:", signRes.signedBuffer.length);
  fs.writeFileSync('scratch/pass2_dtr_signed.pdf', signRes.signedBuffer);

  const doc2 = await PDFDocument.load(signRes.signedBuffer);
  const af2 = doc2.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  const fields2 = af2?.lookupMaybe(PDFName.of("Fields"), PDFArray);
  console.log("Pass 2 AcroForm Fields count:", fields2?.size());
  for (let i = 0; i < (fields2?.size() || 0); i++) {
    const fRef = fields2!.get(i);
    const f = doc2.context.lookup(fRef) as PDFDict;
    const t = f.get(PDFName.of("T"))?.toString();
    const ft = f.get(PDFName.of("FT"))?.toString();
    const kids = f.lookupMaybe(PDFName.of("Kids"), PDFArray);
    console.log(`Field ${i+1}: T=${t}, FT=${ft}, Kids count=${kids?.size()}`);
  }
}

testIncrementalKids().catch(console.error);
