import fs from 'fs';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFNumber, PDFString, PDFHexString } from 'pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client/web';
import { decryptP12Password } from '../server/services/pnpkiSigningService';

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

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);

  const rects: [number, number, number, number][] = [
    [54, 184, 249, 216],
    [360, 184, 555, 216]
  ];

  const signatureLength = 32768;
  const byteRange = PDFArray.withContext(pdfDoc.context);
  byteRange.push(PDFNumber.of(0));
  byteRange.push(PDFName.of("**********"));
  byteRange.push(PDFName.of("**********"));
  byteRange.push(PDFName.of("**********"));

  const placeholder = PDFHexString.of(String.fromCharCode(0).repeat(signatureLength));
  const sigDict = pdfDoc.context.obj({
    Type: "Sig",
    Filter: "Adobe.PPKLite",
    SubFilter: "adbe.pkcs7.detached",
    ByteRange: byteRange,
    Contents: placeholder,
    Reason: PDFString.of("Civil Service Form No. 48 Daily Time Record Submission"),
    M: PDFString.fromDate(new Date()),
    Name: PDFString.of(signerName),
  });
  const sigDictRef = pdfDoc.context.register(sigDict);

  const parentFieldRef = pdfDoc.context.nextRef();
  const childWidgetRefs: any[] = [];
  const annotations = pdfDoc.context.obj([]);

  for (let index = 0; index < rects.length; index++) {
    const [minX, minY, maxX, maxY] = rects[index];
    const rect = pdfDoc.context.obj([minX, minY, maxX, maxY]);
    const rw = maxX - minX;
    const rh = maxY - minY;

    const apStream = pdfDoc.context.stream("q\nQ\n", {
      Type: "XObject",
      Subtype: "Form",
      BBox: [0, 0, rw, rh],
      Resources: pdfDoc.context.obj({}),
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

    const widgetRef = pdfDoc.context.register(widgetDict);
    childWidgetRefs.push(widgetRef);
    annotations.push(widgetRef);
  }

  page.node.set(PDFName.of("Annots"), annotations);

  const parentFieldDict = pdfDoc.context.obj({
    FT: "Sig",
    T: PDFString.of("Personnel_Signature"),
    V: sigDictRef,
    Kids: childWidgetRefs,
  });
  pdfDoc.context.assign(parentFieldRef, parentFieldDict);

  const acroFormObj = pdfDoc.context.obj({
    Fields: [parentFieldRef],
    SigFlags: 3,
    DR: pdfDoc.context.obj({}),
    DA: PDFString.of("/Helv 0 Tf 0 g "),
  });
  pdfDoc.catalog.set(PDFName.of("AcroForm"), pdfDoc.context.register(acroFormObj));

  await pdfDoc.flush();
  for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
    const dict = (obj as any)?.dict || (obj instanceof PDFDict ? obj : null);
    if (dict && typeof dict.has === 'function' && typeof dict.get === 'function') {
      const subtype = dict.get(PDFName.of('Subtype'));
      if (
        (subtype === PDFName.of('Image') || subtype?.toString() === '/Image' ||
         subtype === PDFName.of('Form') || subtype?.toString() === '/Form') &&
        !dict.has(PDFName.of('Resources'))
      ) {
        dict.set(PDFName.of('Resources'), pdfDoc.context.obj({}));
      }
    }
  }

  const savedBytes = await pdfDoc.save({ useObjectStreams: false });
  const p12Der = Buffer.from(p12Base64.replace(/^data:.*?;base64,/, ""), "base64");
  const signer = new P12Signer(p12Der, { passphrase: password });
  const signPdfInstance = new SignPdf();
  const signedBuffer = await signPdfInstance.sign(Buffer.from(savedBytes), signer);

  fs.writeFileSync('scratch/parent_kids_both_widgets.pdf', signedBuffer);
  console.log('Saved scratch/parent_kids_both_widgets.pdf. Length:', signedBuffer.length);
}

main().catch(console.error);
