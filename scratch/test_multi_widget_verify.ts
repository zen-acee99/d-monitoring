import fs from 'fs';
import { PDFDocument, PDFName, PDFDict, PDFArray } from 'pdf-lib';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client/web';
import { decryptP12Password, signPdfBuffer } from '../server/services/pnpkiSigningService';

dotenv.config();

async function main() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL || '',
    authToken: process.env.TURSO_AUTH_TOKEN || '',
  });
  const rowRes = await db.execute("SELECT p12, p12_password, Name FROM dtr_generator WHERE id = 'dtr-sig-sup-01' LIMIT 1");
  const p12Base64 = String(rowRes.rows[0].p12);
  const password = decryptP12Password(String(rowRes.rows[0].p12_password));
  const signerName = String(rowRes.rows[0].Name);

  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  const unsignedBytes = await doc.save();

  const rects: [number, number, number, number][] = [
    [54, 184, 249, 216],
    [360, 184, 555, 216]
  ];

  const res = await signPdfBuffer(
    Buffer.from(unsignedBytes),
    p12Base64,
    password,
    {
      sigRects: rects,
      fieldName: 'Personnel_Signature',
      signerName,
      reason: 'CS Form 48 DTR Verification'
    }
  );

  fs.writeFileSync('scratch/dual_copy_signed.pdf', res.signedBuffer);
  console.log('Signed dual copy. Length:', res.signedBuffer.length);

  const signedDoc = await PDFDocument.load(res.signedBuffer);
  const af = signedDoc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  const fields = af?.lookupMaybe(PDFName.of('Fields'), PDFArray);
  console.log('AcroForm Fields count:', fields?.size());
  for (let i = 0; i < (fields?.size() || 0); i++) {
    const fRef = fields!.get(i);
    const f = signedDoc.context.lookup(fRef) as PDFDict;
    const t = f.get(PDFName.of('T'))?.toString();
    const ft = f.get(PDFName.of('FT'))?.toString();
    const kids = f.lookupMaybe(PDFName.of('Kids'), PDFArray);
    console.log(`Field ${i+1}: T=${t}, FT=${ft}, Kids=${kids?.size()}`);
  }

  const p1 = signedDoc.getPage(0);
  const annots = p1.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  console.log('Page 1 Annots count:', annots?.size());
  for (let i = 0; i < (annots?.size() || 0); i++) {
    const aRef = annots!.get(i);
    const a = signedDoc.context.lookup(aRef) as PDFDict;
    const subtype = a.get(PDFName.of('Subtype'))?.toString();
    const rectVal = a.lookupMaybe(PDFName.of('Rect'), PDFArray);
    const parentVal = a.get(PDFName.of('Parent'))?.toString();
    console.log(`Annot ${i+1}: Subtype=${subtype}, Rect=[${rectVal?.asRectangle()?.x}, ${rectVal?.asRectangle()?.y}], Parent=${parentVal}`);
  }
}

main().catch(console.error);
