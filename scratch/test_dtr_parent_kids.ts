import fs from 'fs';
import { PDFDocument, PDFName, PDFNumber, PDFArray, PDFString, PDFHexString, PDFDict } from 'pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client/web';
import { decryptP12Password } from '../server/services/pnpkiSigningService';

dotenv.config();

async function testDtrStructure() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL || "",
    authToken: process.env.TURSO_AUTH_TOKEN || "",
  });
  const rowRes = await db.execute("SELECT p12, p12_password, Name FROM dtr_generator WHERE id = 'dtr-sig-sup-01' LIMIT 1");
  const p12Base64 = String(rowRes.rows[0].p12);
  const password = decryptP12Password(String(rowRes.rows[0].p12_password));
  const signerName = String(rowRes.rows[0].Name);

  // Create a blank 2-copy page like DTR
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);

  const widgetRects = [
    [54, 184, 249, 216],   // Copy 1
    [360, 184, 555, 216],  // Copy 2
  ];

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
    Name: PDFString.of(signerName),
  });
  const sigDictRef = pdfDoc.context.register(signatureDict);

  // Pre-allocate parent field ref
  const parentFieldRef = pdfDoc.context.nextRef();
  const childWidgetRefs: any[] = [];
  const annots = pdfDoc.context.obj([]);

  for (let i = 0; i < widgetRects.length; i++) {
    const [minX, minY, maxX, maxY] = widgetRects[i];
    const rect = pdfDoc.context.obj([minX, minY, maxX, maxY]);
    const apStream = pdfDoc.context.stream("q\nQ\n", {
      Type: "XObject",
      Subtype: "Form",
      BBox: [0, 0, maxX - minX, maxY - minY],
    });

    const widgetDict = pdfDoc.context.obj({
      Type: "Annot",
      Subtype: "Widget",
      Rect: rect,
      Parent: parentFieldRef,
      F: 132,
      P: page.ref,
      AP: { N: pdfDoc.context.register(apStream) },
    });
    const wRef = pdfDoc.context.register(widgetDict);
    childWidgetRefs.push(wRef);
    annots.push(wRef);
  }

  page.node.set(PDFName.of("Annots"), annots);

  const parentFieldDict = pdfDoc.context.obj({
    FT: "Sig",
    T: PDFString.of("Personnel_Signature"),
    V: sigDictRef,
    Kids: childWidgetRefs,
  });
  pdfDoc.context.assign(parentFieldRef, parentFieldDict);

  const acroForm = pdfDoc.context.obj({
    Fields: [parentFieldRef],
    SigFlags: 3,
  });
  pdfDoc.catalog.set(PDFName.of("AcroForm"), pdfDoc.context.register(acroForm));

  const savedBytes = await pdfDoc.save({ useObjectStreams: false });
  const p12Der = Buffer.from(p12Base64.replace(/^data:.*?;base64,/, ""), "base64");
  const signer = new P12Signer(p12Der, { passphrase: password });
  const signPdf = new SignPdf();
  const signedBuffer = await signPdf.sign(Buffer.from(savedBytes), signer);

  console.log("Signed buffer length:", signedBuffer.length);
  fs.writeFileSync('scratch/test_dtr_parent_kids.pdf', signedBuffer);

  // Inspect the generated PDF to verify:
  // 1. AcroForm /Fields has ONLY 1 field!
  const doc = await PDFDocument.load(signedBuffer);
  const af = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  const fields = af?.lookupMaybe(PDFName.of("Fields"), PDFArray);
  console.log("Fields count in AcroForm:", fields?.size());
  for (let i = 0; i < (fields?.size() || 0); i++) {
    const fRef = fields!.get(i);
    const f = doc.context.lookup(fRef) as PDFDict;
    const t = f.get(PDFName.of("T"))?.toString();
    const ft = f.get(PDFName.of("FT"))?.toString();
    const kids = f.lookupMaybe(PDFName.of("Kids"), PDFArray);
    console.log(`Field ${i+1}: T=${t}, FT=${ft}, Kids count=${kids?.size()}`);
  }

  // 2. Annots on page has 2 widgets!
  const p1Annots = doc.getPage(0).node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  console.log("Page 1 Annots count:", p1Annots?.size());
  for (let i = 0; i < (p1Annots?.size() || 0); i++) {
    const aRef = p1Annots!.get(i);
    const a = doc.context.lookup(aRef) as PDFDict;
    const parent = a.get(PDFName.of("Parent"))?.toString();
    const hasT = a.get(PDFName.of("T"));
    const hasV = a.get(PDFName.of("V"));
    console.log(`Annot ${i+1}: Parent=${parent}, hasT=${Boolean(hasT)}, hasV=${Boolean(hasV)}`);
  }
}

testDtrStructure().catch(console.error);
