import fs from 'fs';
import { PDFDocument, PDFName, PDFNumber, PDFArray, PDFString, PDFHexString, PDFDict } from 'pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client/web';
import { decryptP12Password } from '../server/services/pnpkiSigningService';

dotenv.config();

async function testFullTwoPassDtr() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL || "",
    authToken: process.env.TURSO_AUTH_TOKEN || "",
  });
  const rowRes = await db.execute("SELECT p12, p12_password, Name FROM dtr_generator WHERE id = 'dtr-sig-sup-01' LIMIT 1");
  const p12Base64 = String(rowRes.rows[0].p12);
  const password = decryptP12Password(String(rowRes.rows[0].p12_password));
  const signerName = String(rowRes.rows[0].Name);

  // 1. Create a blank 2-copy page like DTR
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);

  // Pass 1: Employee signature boxes (Copy 1 & Copy 2)
  const empRects = [
    [54, 184, 249, 216],
    [360, 184, 555, 216],
  ];

  const signatureLength = 32768;
  const byteRange = PDFArray.withContext(pdfDoc.context);
  byteRange.push(PDFNumber.of(0));
  byteRange.push(PDFName.of("**********"));
  byteRange.push(PDFName.of("**********"));
  byteRange.push(PDFName.of("**********"));

  const placeholder = PDFHexString.of(String.fromCharCode(0).repeat(signatureLength));
  const empSigDict = pdfDoc.context.obj({
    Type: "Sig",
    Filter: "Adobe.PPKLite",
    SubFilter: "adbe.pkcs7.detached",
    ByteRange: byteRange,
    Contents: placeholder,
    Reason: PDFString.of("Civil Service Form No. 48 Daily Time Record Submission"),
    M: PDFString.fromDate(new Date()),
    Name: PDFString.of("Malto Ace Mata"),
  });
  const empSigDictRef = pdfDoc.context.register(empSigDict);

  // Multi-widget Parent Field for Employee
  const empParentRef = pdfDoc.context.nextRef();
  const empChildRefs: any[] = [];
  const pageAnnots = pdfDoc.context.obj([]);

  for (let i = 0; i < empRects.length; i++) {
    const [minX, minY, maxX, maxY] = empRects[i];
    const rect = pdfDoc.context.obj([minX, minY, maxX, maxY]);
    const apStream = pdfDoc.context.stream("q\nQ\n", {
      Type: "XObject",
      Subtype: "Form",
      BBox: [0, 0, maxX - minX, maxY - minY],
    });

    const wDict = pdfDoc.context.obj({
      Type: "Annot",
      Subtype: "Widget",
      Rect: rect,
      Parent: empParentRef,
      F: 132,
      P: page.ref,
      AP: { N: pdfDoc.context.register(apStream) },
    });
    const wRef = pdfDoc.context.register(wDict);
    empChildRefs.push(wRef);
    pageAnnots.push(wRef);
  }

  page.node.set(PDFName.of("Annots"), pageAnnots);

  const empParentDict = pdfDoc.context.obj({
    FT: "Sig",
    T: PDFString.of("Personnel_Signature"),
    V: empSigDictRef,
    Kids: empChildRefs,
  });
  pdfDoc.context.assign(empParentRef, empParentDict);

  const acroForm = pdfDoc.context.obj({
    Fields: [empParentRef],
    SigFlags: 3,
  });
  pdfDoc.catalog.set(PDFName.of("AcroForm"), pdfDoc.context.register(acroForm));

  const savedPass1 = await pdfDoc.save({ useObjectStreams: false });
  const p12Der = Buffer.from(p12Base64.replace(/^data:.*?;base64,/, ""), "base64");
  const signer = new P12Signer(p12Der, { passphrase: password });
  const signPdf = new SignPdf();
  const pass1Signed = await signPdf.sign(Buffer.from(savedPass1), signer);
  console.log("Pass 1 Signed! Length:", pass1Signed.length);
  fs.writeFileSync('scratch/pass1_dtr_signed.pdf', pass1Signed);

  // Verify Pass 1
  const doc1 = await PDFDocument.load(pass1Signed);
  const af1 = doc1.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  const fields1 = af1?.lookupMaybe(PDFName.of("Fields"), PDFArray);
  console.log("Pass 1 AcroForm Fields count:", fields1?.size());
  console.log("Pass 1 Page Annots count:", doc1.getPage(0).node.lookupMaybe(PDFName.of("Annots"), PDFArray)?.size());
}

testFullTwoPassDtr().catch(console.error);
