import fs from 'fs';
import { PDFDocument, PDFName, PDFNumber, PDFArray, PDFString, PDFHexString, PDFDict, PDFInvalidObject } from 'pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client/web';
import { decryptP12Password } from '../server/services/pnpkiSigningService';
import zlib from 'zlib';

dotenv.config();

// Custom incremental signer implementing single terminal widget on uniqueRects[0]
// and visual /Subtype /Stamp on uniqueRects[1]
async function appendSignatureIncrementalFixed(
  pdfBuffer: Buffer,
  signerName: string,
  sigRects: [number, number, number, number][],
  reason: string,
  contactInfo: string = "pnpki@dict.gov.ph",
  location: string = "Legazpi City, Philippines",
  customFieldName?: string,
  targetPageIndex: number = 0
): Promise<Buffer> {
  const pdfStr = pdfBuffer.toString("latin1");

  const startXrefMatches = [...pdfStr.matchAll(/startxref\s*(\d+)/g)];
  if (startXrefMatches.length === 0) {
    throw new Error("Could not find startxref in PDF buffer");
  }
  const prevStartXref = parseInt(startXrefMatches[startXrefMatches.length - 1][1]);
  const prevXrefSlice = pdfStr.slice(prevStartXref, prevStartXref + 300);
  const prevWasXRefStream = /\/Type\s*\/XRef\b/.test(prevXrefSlice);

  // Simple obj parser
  const objMap = new Map<number, string>();
  const regex = /(\d+)\s+0\s+obj\s*([\s\S]*?)\s*endobj/g;
  let match;
  let maxObj = 0;
  while ((match = regex.exec(pdfStr)) !== null) {
    const objNum = parseInt(match[1]);
    objMap.set(objNum, match[2]);
    if (objNum > maxObj) maxObj = objNum;
  }

  let rootObjNum = 1;
  const rootMatches = [...pdfStr.matchAll(/\/Root\s+(\d+)\s+0\s+R/g)];
  if (rootMatches.length > 0) {
    rootObjNum = parseInt(rootMatches[rootMatches.length - 1][1]);
  }
  const catalogBody = objMap.get(rootObjNum) || "";

  let pageObjNum = 13;
  for (const [num, body] of objMap.entries()) {
    if (/\/Type\s*\/Page\b/.test(body) && !/\/Type\s*\/Pages\b/.test(body)) {
      pageObjNum = num;
      break;
    }
  }
  const pageBody = objMap.get(pageObjNum) || "";

  let existingAnnots = "";
  const annotsDirectMatch = pageBody.match(/\/Annots\s*\[([^\]]*)\]/);
  if (annotsDirectMatch) {
    existingAnnots = annotsDirectMatch[1].trim();
  }

  let existingFields = "";
  let existingAcroFormObjNum: number | null = null;
  const acroFormRefMatch = catalogBody.match(/\/AcroForm\s+(\d+)\s+0\s+R/);
  if (acroFormRefMatch) {
    existingAcroFormObjNum = parseInt(acroFormRefMatch[1]);
    const afBody = objMap.get(existingAcroFormObjNum) || "";
    const fieldsMatch = afBody.match(/\/Fields\s*\[([^\]]*)\]/);
    if (fieldsMatch) existingFields = fieldsMatch[1].trim();
  }

  const fieldRefsSet = new Set<string>();
  if (existingFields) {
    const refs = existingFields.match(/\d+\s+0\s+R/g) || [];
    refs.forEach((r) => fieldRefsSet.add(r));
  }

  const sigDictObjNum = maxObj + 1;
  const signatureLength = 32768;
  const placeholderContents = "0".repeat(signatureLength * 2);
  const byteRangePlaceholder = "   0 /********** /********** /**********";

  let appendData = "\n";
  const objOffsets = new Map<number, number>();

  function appendObj(objNum: number, content: string) {
    const offset = pdfBuffer.length + Buffer.from(appendData, "binary").length;
    objOffsets.set(objNum, offset);
    appendData += `${objNum} 0 obj\n${content}\nendobj\n`;
  }

  appendObj(
    sigDictObjNum,
    `<<\n/Type /Sig\n/Filter /Adobe.PPKLite\n/SubFilter /adbe.pkcs7.detached\n/ByteRange [${byteRangePlaceholder}]\n/Contents <${placeholderContents}>\n/Reason (${reason})\n/M (D:${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}+08'00')\n/Name (${signerName})\n/ContactInfo (${contactInfo})\n/Location (${location})\n/Prop_Build << /Filter << /Name /Adobe.PPKLite >> >>\n>>`
  );

  let nextFreeObj = maxObj + 2;
  const fontObjNum = nextFreeObj++;
  appendObj(
    fontObjNum,
    `<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n/Encoding /WinAnsiEncoding\n>>`
  );

  const newWidgetRefs: string[] = [];
  const baseFieldName = customFieldName || "Supervisor_Signature";

  sigRects.forEach(([minX, minY, maxX, maxY], idx) => {
    const wNum = nextFreeObj++;
    const apNum = nextFreeObj++;
    newWidgetRefs.push(`${wNum} 0 R`);

    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    let streamContent = `q\nBT\n/Helv 6.5 Tf\n0 0 0 rg\n6 16.0 Td\n(Digitally signed by) Tj\n0 -9.0 Td\n/Helv 6.2 Tf\n(${signerName}) Tj\nET\nQ\n`;
    const streamLen = Buffer.from(streamContent, "binary").length;

    appendObj(
      apNum,
      `<<\n/Type /XObject\n/Subtype /Form\n/BBox [0 0 ${bboxW} ${bboxH}]\n/Resources <<\n/ProcSet [/PDF /Text]\n/Font << /Helv ${fontObjNum} 0 R >>\n>>\n/Length ${streamLen}\n>>\nstream\n${streamContent}\nendstream`
    );

    if (idx === 0) {
      // Primary signature widget (Terminal Field)
      appendObj(
        wNum,
        `<<\n/Type /Annot\n/Subtype /Widget\n/FT /Sig\n/Rect [${minX} ${minY} ${maxX} ${maxY}]\n/V ${sigDictObjNum} 0 R\n/T (${baseFieldName})\n/F 132\n/P ${pageObjNum} 0 R\n/AP << /N ${apNum} 0 R >>\n>>`
      );
      fieldRefsSet.add(`${wNum} 0 R`);
    } else {
      // Secondary copy: visual stamp annotation (NOT a /FT /Sig field)
      appendObj(
        wNum,
        `<<\n/Type /Annot\n/Subtype /Stamp\n/Rect [${minX} ${minY} ${maxX} ${maxY}]\n/F 4\n/P ${pageObjNum} 0 R\n/AP << /N ${apNum} 0 R >>\n>>`
      );
    }
  });

  const finalFieldsStr = Array.from(fieldRefsSet).join(" ");
  const acroFormObjNum = existingAcroFormObjNum || nextFreeObj++;
  appendObj(
    acroFormObjNum,
    `<<\n/Fields [${finalFieldsStr}]\n/DR << /Font << /Helv ${fontObjNum} 0 R >> >>\n/DA (/Helv 0 Tf 0 g )\n/SigFlags 3\n>>`
  );

  const annotRefsSet = new Set<string>();
  if (existingAnnots) {
    const matches = existingAnnots.match(/\d+\s+0\s+R/g) || [];
    matches.forEach((r) => annotRefsSet.add(r));
  }
  newWidgetRefs.forEach((r) => annotRefsSet.add(r));
  const finalAnnotsStr = Array.from(annotRefsSet).join(" ");

  let cleanedPageBody = pageBody
    .replace(/^\s*<<\s*/, "")
    .replace(/\s*>>\s*$/, "")
    .replace(/\/Annots\s*\[[^\]]*\]/g, "")
    .replace(/\/Annots\s+\d+\s+0\s+R/g, "")
    .trim();

  appendObj(
    pageObjNum,
    `<<\n${cleanedPageBody}\n/Annots [${finalAnnotsStr}]\n>>`
  );

  if (!existingAcroFormObjNum) {
    let cleanedCatalogBody = catalogBody.trim();
    cleanedCatalogBody = cleanedCatalogBody.replace(/^\d+\s+\d+\s+obj\s*/, "");
    const firstDictOpen = cleanedCatalogBody.indexOf("<<");
    const lastDictClose = cleanedCatalogBody.lastIndexOf(">>");
    if (firstDictOpen !== -1 && lastDictClose !== -1 && lastDictClose > firstDictOpen) {
      cleanedCatalogBody = cleanedCatalogBody.slice(firstDictOpen + 2, lastDictClose).trim();
    }
    cleanedCatalogBody = cleanedCatalogBody.replace(/>>\s*$/, "").trim();
    cleanedCatalogBody = cleanedCatalogBody.replace(/\/AcroForm\s+\d+\s+0\s+R/g, "").trim();

    appendObj(
      rootObjNum,
      `<<\n${cleanedCatalogBody}\n/AcroForm ${acroFormObjNum} 0 R\n>>`
    );
  }

  // Cross-reference table
  const startXrefOffset = pdfBuffer.length + Buffer.from(appendData, "binary").length;
  const sortedObjs = Array.from(objOffsets.keys()).sort((a, b) => a - b);
  let xrefTable = "xref\n0 1\n0000000000 65535 f \n";

  let i = 0;
  while (i < sortedObjs.length) {
    let j = i;
    while (j + 1 < sortedObjs.length && sortedObjs[j + 1] === sortedObjs[j] + 1) {
      j++;
    }
    const sectionStart = sortedObjs[i];
    const sectionCount = j - i + 1;
    xrefTable += `${sectionStart} ${sectionCount}\n`;
    for (let k = i; k <= j; k++) {
      const off = objOffsets.get(sortedObjs[k])!;
      xrefTable += `${off.toString().padStart(10, "0")} 00000 n \n`;
    }
    i = j + 1;
  }

  const trailer = `trailer\n<<\n/Size ${nextFreeObj}\n/Root ${rootObjNum} 0 R\n/Prev ${prevStartXref}\n>>\nstartxref\n${startXrefOffset}\n%%EOF\n`;
  const fullAppend = appendData + xrefTable + trailer;
  return Buffer.concat([pdfBuffer, Buffer.from(fullAppend, "binary")]);
}

async function run() {
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

  // Pass 1: Employee signature box
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

  // Single terminal field
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

  const savedPass1 = await pdfDoc.save({ useObjectStreams: false });
  const p12Der = Buffer.from(p12Base64.replace(/^data:.*?;base64,/, ""), "base64");
  const signer = new P12Signer(p12Der, { passphrase: password });
  const signPdf = new SignPdf();
  const pass1Signed = await signPdf.sign(Buffer.from(savedPass1), signer);

  console.log("Pass 1 Signed! Length:", pass1Signed.length);
  fs.writeFileSync('scratch/test_pass1_stamp.pdf', pass1Signed);

  // Pass 2: Incremental Signature (Supervisor) using 2 rects (Copy 1 and Copy 2)
  const supRect1: [number, number, number, number] = [54, 80, 249, 112];
  const supRect2: [number, number, number, number] = [360, 80, 555, 112];

  const incrementalWithPlaceholder = await appendSignatureIncrementalFixed(
    pass1Signed,
    signerName,
    [supRect1, supRect2],
    "Civil Service Form No. 48 Official Verification",
    "pnpki@dict.gov.ph",
    "Legazpi City, Philippines",
    "Supervisor_Signature",
    0
  );

  const signer2 = new P12Signer(p12Der, { passphrase: password });
  const signPdf2 = new SignPdf();
  const pass2Signed = await signPdf2.sign(incrementalWithPlaceholder, signer2);
  console.log("Pass 2 Signed! Length:", pass2Signed.length);
  fs.writeFileSync('scratch/test_pass2_stamp.pdf', pass2Signed);

  // Inspect structure
  const doc2 = await PDFDocument.load(pass2Signed);
  const af2 = doc2.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  const fields2 = af2?.lookupMaybe(PDFName.of("Fields"), PDFArray);
  console.log("Pass 2 AcroForm Fields count:", fields2?.size());
  for (let i = 0; i < (fields2?.size() || 0); i++) {
    const fRef = fields2!.get(i);
    const f = doc2.context.lookup(fRef) as PDFDict;
    const t = f.get(PDFName.of("T"))?.toString();
    const ft = f.get(PDFName.of("FT"))?.toString();
    const kids = f.lookupMaybe(PDFName.of("Kids"), PDFArray);
    console.log(`Field ${i+1}: T=${t}, FT=${ft}, Kids count=${kids?.size() || 0}`);
  }

  const p2Annots = doc2.getPages()[0].node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  console.log("Pass 2 Page Annots count:", p2Annots?.size());
  for (let i = 0; i < (p2Annots?.size() || 0); i++) {
    const a = doc2.context.lookup(p2Annots!.get(i)) as PDFDict;
    const subtype = a.get(PDFName.of("Subtype"))?.toString();
    const t = a.get(PDFName.of("T"))?.toString();
    console.log(`Annot ${i+1}: Subtype=${subtype}, T=${t}`);
  }
}

run().catch(console.error);
