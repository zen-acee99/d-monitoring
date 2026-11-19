import fs from 'fs';
import zlib from 'zlib';
import crypto from 'crypto';
import forge from 'node-forge';
import { PDFDocument } from 'pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://dict-region-v-acemm1599.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN
});

const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.PNPKI_KEY_SECRET || "dict-r5-pnpki-signing-vault-key-2026",
  "dict-pnpki-salt",
  32
);
function decryptP12Password(cipherText) {
  if (!cipherText) return "";
  if (!cipherText.startsWith("enc:")) return cipherText;
  const parts = cipherText.split(":");
  if (parts.length !== 4) return "";
  try {
    const iv = Buffer.from(parts[1], "hex");
    const tag = Buffer.from(parts[2], "hex");
    if (tag.length !== 16 || iv.length !== 12) return "";
    const encrypted = parts[3];
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return "";
  }
}

function getSignerIdentityFromP12(p12Base64, password) {
  const cleanBase64 = p12Base64.replace(/^data:.*?;base64,/, "").trim();
  const p12Der = forge.util.decode64(cleanBase64);
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password || "");
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
  const cert = certBags[0].cert;
  return {
    commonName: cert.subject.getField("CN") ? cert.subject.getField("CN").value : "Unknown Signer"
  };
}

async function testIncrementalVisual() {
  console.log('1. Loading DB and test PDF...');
  const resDb = await db.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-sup-01'");
  const row = resDb.rows[0];
  const pwd = row.p12_password ? decryptP12Password(row.p12_password) : '';
  const p12Base64 = String(row.p12);

  const pdfBuf = fs.readFileSync('C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf');
  const signerIdentity = getSignerIdentityFromP12(p12Base64, pwd);
  const signerName = signerIdentity.commonName;
  console.log('Signer identity:', signerName);

  console.log('2. Preparing signature image...');
  let defRGB = null;
  let defAlpha = null;
  let imgW = 0;
  let imgH = 0;

  if (row.image_digiSigned) {
    const rawImg = row.image_digiSigned.replace(/^data:.*?;base64,/, '');
    const imgBuf = Buffer.from(rawImg, 'base64');
    const tempDoc = await PDFDocument.create();
    const embedded = await tempDoc.embedPng(imgBuf);
    imgW = embedded.width;
    imgH = embedded.height;
    if (embedded.embedder.image.rgbChannel) {
      defRGB = zlib.deflateSync(embedded.embedder.image.rgbChannel);
    }
    if (embedded.embedder.image.alphaChannel) {
      defAlpha = zlib.deflateSync(embedded.embedder.image.alphaChannel);
    }
  }

  console.log('3. Constructing incremental update with visual appearance...');
  const pdfStr = pdfBuf.toString('binary');
  const maxObjMatch = [...pdfStr.matchAll(/(\d+)\s+0\s+obj/g)];
  let maxObj = 0;
  for (const m of maxObjMatch) {
    const n = parseInt(m[1]);
    if (n > maxObj) maxObj = n;
  }

  const startXrefMatches = [...pdfStr.matchAll(/startxref\s*(\d+)/g)];
  const prevStartXref = parseInt(startXrefMatches[startXrefMatches.length - 1][1]);

  const sigDictObjNum = maxObj + 1;
  const apNum = maxObj + 2;
  const wNum = maxObj + 3;
  const fontObjNum = maxObj + 4;
  let curObj = fontObjNum;

  let imgObjNum = 0;
  let smaskObjNum = 0;
  if (defRGB) {
    if (defAlpha) {
      curObj++;
      smaskObjNum = curObj;
    }
    curObj++;
    imgObjNum = curObj;
  }

  const newAcroFormNum = curObj + 1;
  curObj = newAcroFormNum;

  const rootMatches = [...pdfStr.matchAll(/\/Root\s+(\d+)\s+0\s+R/g)];
  const rootObjNum = parseInt(rootMatches[rootMatches.length - 1][1]);

  const rootRegex = new RegExp(`${rootObjNum}\\s+0\\s+obj\\s*<<([\\s\\S]*?)>>\\s*endobj`);
  const rootMatch = pdfStr.match(rootRegex);
  const catalogBody = rootMatch ? rootMatch[1] : '';

  const pagesRefMatch = catalogBody.match(/\/Pages\s+(\d+)\s+0\s+R/);
  const pagesObjNum = parseInt(pagesRefMatch[1]);
  const pagesRegex = new RegExp(`${pagesObjNum}\\s+0\\s+obj\\s*<<([\\s\\S]*?)>>\\s*endobj`);
  const pagesMatch = pdfStr.match(pagesRegex);
  const pagesBody = pagesMatch ? pagesMatch[1] : '';

  const kidsMatch = pagesBody.match(/\/Kids\s*\[\s*(\d+)\s+0\s+R/);
  const pageObjNum = parseInt(kidsMatch[1]);
  const pageRegex = new RegExp(`${pageObjNum}\\s+0\\s+obj\\s*<<([\\s\\S]*?)>>\\s*endobj`);
  const pageMatch = pdfStr.match(pageRegex);
  const pageBody = pageMatch ? pageMatch[1] : '';

  let existingAnnots = '';
  const annotsDirectMatch = pageBody.match(/\/Annots\s*\[([^\]]*)\]/);
  if (annotsDirectMatch) {
    existingAnnots = annotsDirectMatch[1].trim();
  }

  let existingFields = '';
  const acroFormRefMatch = catalogBody.match(/\/AcroForm\s+(\d+)\s+0\s+R/);
  if (acroFormRefMatch) {
    const afObjNum = parseInt(acroFormRefMatch[1]);
    const afRegex = new RegExp(`${afObjNum}\\s+0\\s+obj\\s*<<([\\s\\S]*?)>>\\s*endobj`);
    const afMatch = pdfStr.match(afRegex);
    if (afMatch) {
      const fieldsMatch = afMatch[1].match(/\/Fields\s*\[([^\]]*)\]/);
      if (fieldsMatch) existingFields = fieldsMatch[1].trim();
    }
  }

  const minX = 250, minY = 200, maxX = 375, maxY = 228;
  const bboxW = 125, bboxH = 28;

  let appendData = '\n';
  const objOffsets = new Map();

  function appendObj(objNum, content) {
    const offset = pdfBuf.length + Buffer.from(appendData, 'binary').length;
    objOffsets.set(objNum, offset);
    appendData += `${objNum} 0 obj\n${content}\nendobj\n`;
  }

  const signatureLength = 32768;
  const placeholderContents = '0'.repeat(signatureLength * 2);
  const byteRangePlaceholder = '   0 /********** /********** /**********';
  appendObj(
    sigDictObjNum,
    `<<\n/Type /Sig\n/Filter /Adobe.PPKLite\n/SubFilter /adbe.pkcs7.detached\n/ByteRange [${byteRangePlaceholder}]\n/Contents <${placeholderContents}>\n/Reason (Official Digital Signature - DICT Region V Signing Workspace)\n/M (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}+08'00')\n/Name (${signerName})\n/ContactInfo (pnpki@dict.gov.ph)\n/Location (Legazpi City, Philippines)\n/Prop_Build << /Filter << /Name /Adobe.PPKLite >> >>\n>>`
  );

  appendObj(
    fontObjNum,
    `<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n/Encoding /WinAnsiEncoding\n>>`
  );

  if (defRGB) {
    if (defAlpha) {
      appendObj(
        smaskObjNum,
        `<<\n/Type /XObject\n/Subtype /Image\n/Width ${imgW}\n/Height ${imgH}\n/ColorSpace /DeviceGray\n/BitsPerComponent 8\n/Filter /FlateDecode\n/Length ${defAlpha.length}\n>>\nstream\n${defAlpha.toString('binary')}\nendstream`
      );
    }
    const smaskEntry = smaskObjNum ? `/SMask ${smaskObjNum} 0 R\n` : '';
    appendObj(
      imgObjNum,
      `<<\n/Type /XObject\n/Subtype /Image\n/Width ${imgW}\n/Height ${imgH}\n/ColorSpace /DeviceRGB\n/BitsPerComponent 8\n${smaskEntry}/Filter /FlateDecode\n/Length ${defRGB.length}\n>>\nstream\n${defRGB.toString('binary')}\nendstream`
    );
  }

  let streamContent = 'q\n';
  if (imgObjNum) {
    streamContent += `q\n38 0 0 22 2 3 cm\n/SigImg Do\nQ\n`;
  }
  const textX = imgObjNum ? 44 : 6;
  const escapedSigner = signerName.replace(/[()\\]/g, '\\$&');
  streamContent += `q\nBT\n/Helv 6.5 Tf\n0 0 0 rg\n${textX} 15 Td\n(Digitally signed) Tj\n0 -8 Td\n(by ${escapedSigner}) Tj\nET\nQ\nQ\n`;
  const streamLen = Buffer.from(streamContent, 'binary').length;

  const imgResourceEntry = imgObjNum ? `/XObject << /SigImg ${imgObjNum} 0 R >>\n` : '';
  appendObj(
    apNum,
    `<<\n/Type /XObject\n/Subtype /Form\n/BBox [0 0 ${bboxW} ${bboxH}]\n/Resources <<\n/ProcSet [/PDF /Text /ImageC]\n/Font << /Helv ${fontObjNum} 0 R >>\n${imgResourceEntry}>>\n/Length ${streamLen}\n>>\nstream\n${streamContent}\nendstream`
  );

  const fieldName = `Signature_4_${signerName.replace(/[^a-zA-Z0-9]/g, '_')}`;
  appendObj(
    wNum,
    `<<\n/Type /Annot\n/Subtype /Widget\n/FT /Sig\n/Rect [${minX} ${minY} ${maxX} ${maxY}]\n/V ${sigDictObjNum} 0 R\n/T (${fieldName})\n/F 132\n/P ${pageObjNum} 0 R\n/AP << /N ${apNum} 0 R >>\n>>`
  );

  const combinedFields = [existingFields, `${wNum} 0 R`].filter(Boolean).join(' ');
  appendObj(
    newAcroFormNum,
    `<<\n/Fields [${combinedFields}]\n/SigFlags 3\n>>`
  );

  const combinedAnnots = [existingAnnots, `${wNum} 0 R`].filter(Boolean).join(' ');
  const cleanedPageBody = pageBody
    .replace(/^\s*<<\s*/, '')
    .replace(/\s*>>\s*$/, '')
    .replace(/\/Annots\s*\[[^\]]*\]/g, '')
    .replace(/\/Annots\s+\d+\s+0\s+R/g, '')
    .trim();
  appendObj(
    pageObjNum,
    `<<\n${cleanedPageBody}\n/Annots [${combinedAnnots}]\n>>`
  );

  const cleanedCatalogBody = catalogBody
    .replace(/^\s*<<\s*/, '')
    .replace(/\s*>>\s*$/, '')
    .replace(/\/AcroForm\s+\d+\s+0\s+R/g, '')
    .replace(/\/AcroForm\s*<<[\s\S]*?>>/g, '')
    .trim();
  appendObj(
    rootObjNum,
    `<<\n${cleanedCatalogBody}\n/AcroForm ${newAcroFormNum} 0 R\n>>`
  );

  const xrefOffset = pdfBuf.length + Buffer.from(appendData, 'binary').length;
  let xrefData = `xref\n0 1\n0000000000 65535 f \n`;
  const sortedObjs = [...objOffsets.keys()].sort((a, b) => a - b);
  let i = 0;
  while (i < sortedObjs.length) {
    const startObj = sortedObjs[i];
    let count = 1;
    while (i + count < sortedObjs.length && sortedObjs[i + count] === startObj + count) {
      count++;
    }
    xrefData += `${startObj} ${count}\n`;
    for (let j = 0; j < count; j++) {
      const oNum = startObj + j;
      const off = objOffsets.get(oNum);
      xrefData += `${String(off).padStart(10, '0')} 00000 n \n`;
    }
    i += count;
  }

  const maxTotalObj = Math.max(...objOffsets.keys(), maxObj) + 1;
  const trailerData = `trailer\n<<\n/Size ${maxTotalObj}\n/Root ${rootObjNum} 0 R\n/Prev ${prevStartXref}\n>>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  appendData += xrefData + trailerData;

  const pdfWithPlaceholder = Buffer.concat([pdfBuf, Buffer.from(appendData, 'binary')]);

  console.log('4. Signing with @signpdf...');
  const cleanBase64 = p12Base64.replace(/^data:.*?;base64,/, '').trim();
  const p12DerBuffer = Buffer.from(cleanBase64, 'base64');
  const signer = new P12Signer(p12DerBuffer, { passphrase: pwd || '' });
  const signPdfInstance = new SignPdf();
  const signedBuffer = await signPdfInstance.sign(pdfWithPlaceholder, signer);

  console.log('5. Verification of signed result:');
  console.log('Original length:', pdfBuf.length);
  console.log('Final length:', signedBuffer.length);
  console.log('Is original bytes untouched:', pdfBuf.equals(signedBuffer.subarray(0, pdfBuf.length)));

  fs.writeFileSync('./scratch/test_perfect_4th_signed.pdf', signedBuffer);
  console.log('✓ Successfully written to ./scratch/test_perfect_4th_signed.pdf');
}

testIncrementalVisual().catch(console.error);
