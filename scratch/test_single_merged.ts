import fs from 'fs';
import { PDFDocument, PDFName, PDFNumber, PDFArray, PDFString, PDFHexString, PDFDict, PDFInvalidObject } from 'pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client/web';
import { decryptP12Password } from '../server/services/pnpkiSigningService';

dotenv.config();

async function testSingleMerged() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL || "",
    authToken: process.env.TURSO_AUTH_TOKEN || "",
  });
  const rowRes = await db.execute("SELECT p12, p12_password, Name FROM dtr_generator WHERE id = 'dtr-sig-sup-01' LIMIT 1");
  const p12Base64 = String(rowRes.rows[0].p12);
  const password = decryptP12Password(String(rowRes.rows[0].p12_password));
  const signerName = String(rowRes.rows[0].Name);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);

  const minX = 54, minY = 184, maxX = 249, maxY = 216;
  const rw = maxX - minX;
  const rh = maxY - minY;

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
    Reason: PDFString.of("Civil Service Form No. 48 Daily Time Record Submission"),
    M: PDFString.fromDate(new Date()),
    Name: PDFString.of("Malto Ace Mata"),
    Prop_Build: {
      Filter: { Name: "Adobe.PPKLite" },
    },
  });

  const signatureBuffer = new Uint8Array(signatureDict.sizeInBytes());
  signatureDict.copyBytesInto(signatureBuffer, 0);
  const signatureObj = PDFInvalidObject.of(signatureBuffer);
  const signatureDictRef = pdfDoc.context.register(signatureObj);

  // Form XObject WITH Resources: {}
  const apStream = pdfDoc.context.formXObject([], {
    BBox: [0, 0, rw, rh],
    Resources: {},
  });
  const apRef = pdfDoc.context.register(apStream);

  const rect = pdfDoc.context.obj([minX, minY, maxX, maxY]);

  // Single merged Field + Widget
  const widgetDict = pdfDoc.context.obj({
    Type: "Annot",
    Subtype: "Widget",
    FT: "Sig",
    Rect: rect,
    V: signatureDictRef,
    T: PDFString.of("Personnel_Signature"),
    F: 132,
    P: page.ref,
    AP: { N: apRef },
  });
  const widgetRef = pdfDoc.context.register(widgetDict);

  page.node.set(PDFName.of("Annots"), pdfDoc.context.obj([widgetRef]));

  const acroForm = pdfDoc.context.obj({
    Fields: [widgetRef],
    SigFlags: 3,
  });
  pdfDoc.catalog.set(PDFName.of("AcroForm"), pdfDoc.context.register(acroForm));

  const savedBytes = await pdfDoc.save({ useObjectStreams: false });
  const p12Der = Buffer.from(p12Base64.replace(/^data:.*?;base64,/, ""), "base64");
  const signer = new P12Signer(p12Der, { passphrase: password });
  const signPdf = new SignPdf();
  const signedBuffer = await signPdf.sign(Buffer.from(savedBytes), signer);

  console.log("Single Merged Signed! Length:", signedBuffer.length);
  fs.writeFileSync('scratch/test_single_merged.pdf', signedBuffer);
}

testSingleMerged().catch(console.error);
