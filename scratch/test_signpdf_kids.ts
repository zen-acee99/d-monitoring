import fs from 'fs';
import { PDFDocument, PDFName, PDFNumber, PDFArray, PDFString, PDFHexString } from 'pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client/web';
import { decryptP12Password } from '../server/services/pnpkiSigningService';

dotenv.config();

async function testKids() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL || "",
    authToken: process.env.TURSO_AUTH_TOKEN || "",
  });
  const rowRes = await db.execute("SELECT p12, p12_password FROM dtr_generator WHERE id = 'dtr-sig-sup-01' LIMIT 1");
  const p12Base64 = String(rowRes.rows[0].p12);
  const password = decryptP12Password(String(rowRes.rows[0].p12_password));

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);

  const signatureLength = 32768;
  const byteRange = PDFArray.withContext(pdfDoc.context);
  byteRange.push(PDFNumber.of(0));
  byteRange.push(PDFName.of("**********"));
  byteRange.push(PDFName.of("**********"));
  byteRange.push(PDFName.of("**********"));

  const placeholder = PDFHexString.of(String.fromCharCode(0).repeat(signatureLength));
  const signatureDict = pdfDoc.context.obj({
    Type: "Sig",
    Filter: "Adobe.PPKLite",
    SubFilter: "adbe.pkcs7.detached",
    ByteRange: byteRange,
    Contents: placeholder,
    Reason: PDFString.of("Verification"),
    M: PDFString.fromDate(new Date()),
    Name: PDFString.of("Buena Rene Jane Rosendo"),
  });
  const sigDictRef = pdfDoc.context.register(signatureDict);

  // Widget 1
  const w1 = pdfDoc.context.obj({
    Type: "Annot",
    Subtype: "Widget",
    Rect: [50, 100, 200, 150],
    P: page.ref,
    F: 132,
  });
  const w1Ref = pdfDoc.context.register(w1);

  // Widget 2
  const w2 = pdfDoc.context.obj({
    Type: "Annot",
    Subtype: "Widget",
    Rect: [300, 100, 450, 150],
    P: page.ref,
    F: 132,
  });
  const w2Ref = pdfDoc.context.register(w2);

  // Parent Signature Field
  const parentField = pdfDoc.context.obj({
    FT: "Sig",
    T: PDFString.of("Personnel_Signature"),
    V: sigDictRef,
    Kids: [w1Ref, w2Ref],
  });
  const parentRef = pdfDoc.context.register(parentField);

  // Link children to parent
  w1.set(PDFName.of("Parent"), parentRef);
  w2.set(PDFName.of("Parent"), parentRef);

  page.node.set(PDFName.of("Annots"), pdfDoc.context.obj([w1Ref, w2Ref]));

  const acroForm = pdfDoc.context.obj({
    Fields: [parentRef],
    SigFlags: 3,
  });
  pdfDoc.catalog.set(PDFName.of("AcroForm"), pdfDoc.context.register(acroForm));

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  console.log("PDF with placeholder saved, length:", pdfBytes.length);

  // Now sign with @signpdf
  const p12Der = Buffer.from(p12Base64.replace(/^data:.*?;base64,/, ""), "base64");
  const signer = new P12Signer(p12Der, { passphrase: password });
  const signPdf = new SignPdf();
  const signedBuffer = await signPdf.sign(Buffer.from(pdfBytes), signer);
  console.log("Successfully signed with @signpdf! Buffer length:", signedBuffer.length);
  fs.writeFileSync('scratch/test_kids_signed.pdf', signedBuffer);
  console.log("Wrote scratch/test_kids_signed.pdf");
}

testKids().catch(console.error);
