// server/services/pnpkiSigningService.ts
import crypto from "crypto";
import forge from "node-forge";
import { PDFDocument, PDFName, PDFNumber, PDFString, PDFHexString, PDFArray, PDFDict, PDFInvalidObject } from "pdf-lib";
import { SignPdf } from "@signpdf/signpdf";
import { P12Signer } from "@signpdf/signer-p12";
import { DEFAULT_BYTE_RANGE_PLACEHOLDER, ANNOTATION_FLAGS, SIG_FLAGS } from "@signpdf/utils";
var ENCRYPTION_KEY = crypto.scryptSync(
  process.env.PNPKI_KEY_SECRET || "dict-r5-pnpki-signing-vault-key-2026",
  "dict-pnpki-salt",
  32
);
function encryptP12Password(plainText) {
  if (!plainText) return "";
  if (plainText.startsWith("enc:")) return plainText;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `enc:${iv.toString("hex")}:${tag}:${encrypted}`;
}
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
function validatePasswordStrength(password) {
  const p = String(password || "").trim();
  if (p.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long." };
  }
  if (!/[A-Za-z]/.test(p)) {
    return { valid: false, message: "Password must contain at least one letter." };
  }
  if (!/[0-9]/.test(p) && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p)) {
    return { valid: false, message: "Password must contain at least one number or special character." };
  }
  const lower = p.toLowerCase();
  const commonWeak = ["password", "12345678", "admin123", "dict1234", "qwerty123"];
  if (commonWeak.some((w) => lower.includes(w))) {
    return {
      valid: false,
      message: "Password is too common or easily guessable. Please choose a stronger password."
    };
  }
  return { valid: true };
}
function hashPassword(plain) {
  const clean = String(plain || "").trim();
  if (!clean) return "";
  if (clean.startsWith("scrypt:")) return clean;
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(clean, salt, 64).toString("hex");
  return `scrypt:${salt}:${derivedKey}`;
}
function verifyPassword(plain, stored) {
  const cleanPlain = String(plain || "").trim();
  const cleanStored = String(stored || "").trim();
  if (!cleanPlain || !cleanStored) return false;
  if (cleanStored.startsWith("scrypt:")) {
    const parts = cleanStored.split(":");
    if (parts.length !== 3) return false;
    const [, salt, hashHex] = parts;
    if (!salt || !hashHex || hashHex.length < 64 || hashHex.length % 2 !== 0) return false;
    try {
      const expectedBuf = Buffer.from(hashHex, "hex");
      if (expectedBuf.length < 32) return false;
      const derivedBuf = crypto.scryptSync(cleanPlain, salt, expectedBuf.length);
      if (expectedBuf.length !== derivedBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, derivedBuf);
    } catch {
      return false;
    }
  }
  const plainDigest = crypto.createHash("sha256").update(cleanPlain, "utf8").digest();
  const storedDigest = crypto.createHash("sha256").update(cleanStored, "utf8").digest();
  return crypto.timingSafeEqual(plainDigest, storedDigest);
}
function getSignerIdentityFromP12(p12Base64, password) {
  const cleanBase64 = p12Base64.replace(/^data:.*?;base64,/, "").trim();
  const p12Der = forge.util.decode64(cleanBase64);
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password || "");
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [];
  if (keyBags.length === 0 || !keyBags[0]?.key) {
    throw new Error(
      "Could not find valid Private Key in this .p12 keystore. Check your password."
    );
  }
  const privateKey = keyBags[0].key;
  let signerCert = null;
  const caCerts = [];
  for (const bag of certBags) {
    if (bag.cert) {
      const pub = bag.cert.publicKey;
      if (privateKey.n && pub?.n && privateKey.n.compareTo(pub.n) === 0 && privateKey.e.compareTo(pub.e) === 0) {
        signerCert = bag.cert;
      } else {
        caCerts.push(bag.cert);
      }
    }
  }
  if (!signerCert && certBags.length > 0 && certBags[0].cert) {
    signerCert = certBags[0].cert;
  }
  if (!signerCert) {
    throw new Error(
      "Could not find valid Certificate and Private Key in this .p12 keystore. Check your password."
    );
  }
  const cnAttr = signerCert.subject.attributes.find(
    (a) => a.name === "commonName" || a.shortName === "CN"
  );
  const commonName = cnAttr ? String(cnAttr.value) : "DICT Authorized Signatory";
  const orgAttr = signerCert.subject.attributes.find(
    (a) => a.name === "organizationName" || a.shortName === "O"
  );
  const organization = orgAttr ? String(orgAttr.value) : void 0;
  const issuerCnAttr = signerCert.issuer.attributes.find(
    (a) => a.name === "commonName" || a.shortName === "CN"
  );
  const issuerCN = issuerCnAttr ? String(issuerCnAttr.value) : void 0;
  const subjectDN = signerCert.subject.attributes.map((a) => `${a.shortName || a.name}=${a.value}`).join(", ");
  const issuerDN = signerCert.issuer.attributes.map((a) => `${a.shortName || a.name}=${a.value}`).join(", ");
  const certDerBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(signerCert)).getBytes();
  const sha256Fingerprint = crypto.createHash("sha256").update(Buffer.from(certDerBytes, "binary")).digest("hex").match(/.{2}/g).join(":").toUpperCase();
  return {
    commonName,
    subjectDN,
    organization,
    issuerCN,
    issuerDN,
    serialNumber: signerCert.serialNumber,
    sha256Fingerprint,
    validFrom: signerCert.validity.notBefore,
    validTo: signerCert.validity.notAfter,
    rawCert: signerCert,
    privateKey,
    caCerts
  };
}
function parseP12Certificate(p12Base64, password) {
  return getSignerIdentityFromP12(p12Base64, password);
}
function parsePdfObjects(pdfStr) {
  const map = /* @__PURE__ */ new Map();
  const regex = /(\d+)\s+0\s+obj\s*([\s\S]*?)\s*endobj/g;
  let match;
  while ((match = regex.exec(pdfStr)) !== null) {
    const objNum = parseInt(match[1]);
    map.set(objNum, match[2]);
  }
  return map;
}
function appendSignatureIncremental(pdfBuffer, signerName, sigRects, reason, contactInfo = "pnpki@dict.gov.ph", location = "Legazpi City, Philippines", customFieldName, targetPageIndex = 0) {
  const pdfStr = pdfBuffer.toString("binary");
  const startXrefMatches = [...pdfStr.matchAll(/startxref\s+(\d+)\s+%%EOF/g)];
  if (startXrefMatches.length === 0) {
    throw new Error("Could not find startxref in PDF buffer for incremental update");
  }
  const prevStartXref = parseInt(startXrefMatches[startXrefMatches.length - 1][1]);
  const objMap = parsePdfObjects(pdfStr);
  let maxObj = 0;
  for (const objNum of objMap.keys()) {
    if (objNum > maxObj) maxObj = objNum;
  }
  const rootMatches = [...pdfStr.matchAll(/\/Root\s+(\d+)\s+0\s+R/g)];
  const rootObjNum = rootMatches.length > 0 ? parseInt(rootMatches[rootMatches.length - 1][1]) : 1;
  const catalogBody = objMap.get(rootObjNum) || "";
  const pageObjNums = [];
  for (const [objNum, body] of objMap.entries()) {
    if (/\/Type\s*\/Page\b/.test(body)) {
      pageObjNums.push(objNum);
    }
  }
  let pageObjNum = 3;
  if (pageObjNums.length > 0) {
    if (targetPageIndex >= 0 && targetPageIndex < pageObjNums.length) {
      pageObjNum = pageObjNums[targetPageIndex];
    } else if (targetPageIndex === -1 || targetPageIndex >= pageObjNums.length) {
      pageObjNum = pageObjNums[pageObjNums.length - 1];
    } else {
      pageObjNum = pageObjNums[0];
    }
  }
  const pageBody = objMap.get(pageObjNum) || "";
  let existingAnnots = "";
  const annotsDirectMatch = pageBody.match(/\/Annots\s*\[([^\]]*)\]/);
  if (annotsDirectMatch) {
    existingAnnots = annotsDirectMatch[1].trim();
  } else {
    const annotsRefMatch = pageBody.match(/\/Annots\s+(\d+)\s+0\s+R/);
    if (annotsRefMatch) {
      const annotsObjNum = parseInt(annotsRefMatch[1]);
      const annotsBody = objMap.get(annotsObjNum) || "";
      const arrMatch = annotsBody.match(/\[([^\]]*)\]/);
      if (arrMatch) existingAnnots = arrMatch[1].trim();
    }
  }
  let existingFields = "";
  const acroFormRefMatch = catalogBody.match(/\/AcroForm\s+(\d+)\s+0\s+R/);
  if (acroFormRefMatch) {
    const afObjNum = parseInt(acroFormRefMatch[1]);
    const afBody = objMap.get(afObjNum) || "";
    const fieldsMatch = afBody.match(/\/Fields\s*\[([^\]]*)\]/);
    if (fieldsMatch) existingFields = fieldsMatch[1].trim();
  } else {
    const acroFormDirectMatch = catalogBody.match(/\/AcroForm\s*<<([\s\S]*?)>>/);
    if (acroFormDirectMatch) {
      const fieldsMatch = acroFormDirectMatch[1].match(/\/Fields\s*\[([^\]]*)\]/);
      if (fieldsMatch) existingFields = fieldsMatch[1].trim();
    }
  }
  const sigDictObjNum = maxObj + 1;
  const signatureLength = 32768;
  const placeholderContents = "0".repeat(signatureLength * 2);
  const byteRangePlaceholder = "   0 /********** /********** /**********";
  let appendData = "\n";
  const objOffsets = /* @__PURE__ */ new Map();
  function appendObj(objNum, content) {
    const offset = pdfBuffer.length + Buffer.from(appendData, "binary").length;
    objOffsets.set(objNum, offset);
    appendData += `${objNum} 0 obj
${content}
endobj
`;
  }
  appendObj(
    sigDictObjNum,
    `<<
/Type /Sig
/Filter /Adobe.PPKLite
/SubFilter /adbe.pkcs7.detached
/ByteRange [${byteRangePlaceholder}]
/Contents <${placeholderContents}>
/Reason (${reason})
/M (D:${(/* @__PURE__ */ new Date()).toISOString().replace(/[-:T]/g, "").slice(0, 14)}+08'00')
/Name (${signerName})
/ContactInfo (${contactInfo})
/Location (${location})
/Prop_Build << /Filter << /Name /Adobe.PPKLite >> >>
>>`
  );
  const existingSigMatches = [...pdfStr.matchAll(/\/Type\s*\/Sig\b/g)];
  const existingSigCount = existingSigMatches.length;
  const cleanSignerTag = signerName.replace(/[^a-zA-Z0-9]/g, "_");
  const escapedSigner = signerName.replace(/[()\\]/g, "\\$&");
  const labelText = "Digitally signed";
  const now = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const pnpkiDateStr = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} +08'00'`;
  const newWidgetRefs = [];
  sigRects.forEach((rectCoords, idx) => {
    const wNum = maxObj + 2 + idx;
    const apNum = maxObj + 2 + sigRects.length + idx;
    newWidgetRefs.push(`${wNum} 0 R`);
    const rx = rectCoords[0];
    const ry = rectCoords[1];
    const rw = rectCoords[2];
    const rh = rectCoords[3];
    const minX = Math.min(rx, rx + rw);
    const minY = Math.min(ry, ry + rh);
    const maxX = Math.max(rx, rx + rw);
    const maxY = Math.max(ry, ry + rh);
    const bboxW = Math.max(20, maxX - minX);
    const bboxH = Math.max(14, maxY - minY);
    const sigIndex = existingSigCount + 1 + idx;
    const defaultFieldName = `Signature_${sigIndex}_${cleanSignerTag}`;
    const fieldName = customFieldName ? sigRects.length > 1 ? `${customFieldName}_${idx + 1}` : customFieldName : defaultFieldName;
    const streamContent = `q
Q`;
    const streamLen = Buffer.from(streamContent, "binary").length;
    appendObj(
      apNum,
      `<<
/Type /XObject
/Subtype /Form
/BBox [0 0 ${bboxW} ${bboxH}]
/Resources <<>>
/Length ${streamLen}
>>
stream
${streamContent}
endstream`
    );
    appendObj(
      wNum,
      `<<
/Type /Annot
/Subtype /Widget
/FT /Sig
/Rect [${minX} ${minY} ${maxX} ${maxY}]
/V ${sigDictObjNum} 0 R
/T (${fieldName})
/F 132
/P ${pageObjNum} 0 R
/AP << /N ${apNum} 0 R >>
>>`
    );
  });
  const newAcroFormNum = maxObj + 2 + sigRects.length * 2;
  const combinedFields = [existingFields, ...newWidgetRefs].filter(Boolean).join(" ");
  appendObj(
    newAcroFormNum,
    `<<
/Fields [${combinedFields}]
/SigFlags 3
>>`
  );
  const combinedAnnots = [existingAnnots, ...newWidgetRefs].filter(Boolean).join(" ");
  let cleanedPageBody = pageBody.replace(/^\s*<<\s*/, "").replace(/\s*>>\s*$/, "").replace(/\/Annots\s*\[[^\]]*\]/g, "").replace(/\/Annots\s+\d+\s+0\s+R/g, "").trim();
  appendObj(
    pageObjNum,
    `<<
${cleanedPageBody}
/Annots [${combinedAnnots}]
>>`
  );
  let cleanedCatalogBody = catalogBody.replace(/^\s*<<\s*/, "").replace(/\s*>>\s*$/, "").replace(/\/AcroForm\s+\d+\s+0\s+R/g, "").replace(/\/AcroForm\s*<<[\s\S]*?>>/g, "").trim();
  appendObj(
    rootObjNum,
    `<<
${cleanedCatalogBody}
/AcroForm ${newAcroFormNum} 0 R
>>`
  );
  const xrefOffset = pdfBuffer.length + Buffer.from(appendData, "binary").length;
  let xrefData = `xref
0 1
0000000000 65535 f 
`;
  const sortedObjs = [...objOffsets.keys()].sort((a, b) => a - b);
  let i = 0;
  while (i < sortedObjs.length) {
    const startObj = sortedObjs[i];
    let count = 1;
    while (i + count < sortedObjs.length && sortedObjs[i + count] === startObj + count) {
      count++;
    }
    xrefData += `${startObj} ${count}
`;
    for (let j = 0; j < count; j++) {
      const oNum = startObj + j;
      const off = objOffsets.get(oNum);
      xrefData += `${String(off).padStart(10, "0")} 00000 n 
`;
    }
    i += count;
  }
  const maxTotalObj = Math.max(...objOffsets.keys(), maxObj) + 1;
  const trailerData = `trailer
<<
/Size ${maxTotalObj}
/Root ${rootObjNum} 0 R
/Prev ${prevStartXref}
>>
startxref
${xrefOffset}
%%EOF
`;
  appendData += xrefData + trailerData;
  return Buffer.concat([pdfBuffer, Buffer.from(appendData, "binary")]);
}
async function signPdfBuffer(pdfBuffer, p12Base64, password, options) {
  const signerIdentity = getSignerIdentityFromP12(p12Base64, password);
  console.log("\n[pnpki] ========================================================");
  console.log("[pnpki]            DIGITAL SIGNER IDENTITY FROM P12             ");
  console.log("[pnpki] ========================================================");
  console.log("[pnpki] Common Name (CN):      ", signerIdentity.commonName);
  console.log("[pnpki] Subject DN:            ", signerIdentity.subjectDN);
  console.log("[pnpki] Organization:          ", signerIdentity.organization || "N/A");
  console.log("[pnpki] Issuer CN:             ", signerIdentity.issuerCN || "N/A");
  console.log("[pnpki] Issuer DN:             ", signerIdentity.issuerDN || "N/A");
  console.log("[pnpki] Serial Number:         ", signerIdentity.serialNumber);
  console.log("[pnpki] SHA-256 Fingerprint:   ", signerIdentity.sha256Fingerprint);
  console.log("[pnpki] Validity Period:       ", signerIdentity.validFrom.toISOString(), "to", signerIdentity.validTo.toISOString());
  console.log("[pnpki] ========================================================\n");
  const signerName = signerIdentity.commonName;
  const reason = options?.reason || "Civil Service Form No. 48 Official Daily Time Record Digital Certification";
  const contactInfo = options?.contactInfo || "pnpki@dict.gov.ph";
  const location = options?.location || "Legazpi City, Philippines";
  const rawRects = options?.sigRects && options.sigRects.length > 0 ? options.sigRects : [options?.sigRect || [98, 218, 122, 26]];
  const pdfStr = pdfBuffer.toString("binary");
  const isAlreadySigned = /\/Type\s*\/Sig/.test(pdfStr) && /startxref/.test(pdfStr);
  let pdfWithPlaceholder;
  if (isAlreadySigned) {
    console.log("[pnpki] Document already contains a digital signature. Appending revision incrementally...");
    pdfWithPlaceholder = appendSignatureIncremental(
      pdfBuffer,
      signerName,
      rawRects,
      reason,
      contactInfo,
      location,
      options?.fieldName,
      options?.pageIndex
    );
  } else {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const targetPageIndex = typeof options?.pageIndex === "number" && options.pageIndex >= 0 && options.pageIndex < pages.length ? options.pageIndex : options?.pageIndex === -1 ? pages.length - 1 : 0;
    const page = pages[targetPageIndex] || pages[0];
    const widgetRects = rawRects.map(([rx, ry, rw, rh]) => [rx, ry, rx + rw, ry + rh]);
    const signatureLength = 32768;
    const byteRange = PDFArray.withContext(pdfDoc.context);
    byteRange.push(PDFNumber.of(0));
    byteRange.push(PDFName.of(DEFAULT_BYTE_RANGE_PLACEHOLDER));
    byteRange.push(PDFName.of(DEFAULT_BYTE_RANGE_PLACEHOLDER));
    byteRange.push(PDFName.of(DEFAULT_BYTE_RANGE_PLACEHOLDER));
    const placeholder = PDFHexString.of(String.fromCharCode(0).repeat(signatureLength));
    const signatureDict = pdfDoc.context.obj({
      Type: "Sig",
      Filter: "Adobe.PPKLite",
      SubFilter: "adbe.pkcs7.detached",
      ByteRange: byteRange,
      Contents: placeholder,
      Reason: PDFString.of(reason),
      M: PDFString.fromDate(/* @__PURE__ */ new Date()),
      ContactInfo: PDFString.of(contactInfo),
      Name: PDFString.of(signerName),
      Location: PDFString.of(location),
      Prop_Build: {
        Filter: { Name: "Adobe.PPKLite" }
      }
    });
    const signatureBuffer = new Uint8Array(signatureDict.sizeInBytes());
    signatureDict.copyBytesInto(signatureBuffer, 0);
    const signatureObj = PDFInvalidObject.of(signatureBuffer);
    const signatureDictRef = pdfDoc.context.register(signatureObj);
    const widgetRefs = [];
    let annotations = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (!annotations) {
      annotations = pdfDoc.context.obj([]);
    } else {
      for (let i = 0; i < annotations.size(); i++) {
        const annotRef = annotations.get(i);
        const dict = pdfDoc.context.lookup(annotRef);
        if (dict && "lookupMaybe" in dict) {
          const rect = dict.lookupMaybe(PDFName.of("Rect"), PDFArray);
          if (rect && rect.size() === 4) {
            const x1 = rect.get(0).asNumber();
            const y1 = rect.get(1).asNumber();
            const x2 = rect.get(2).asNumber();
            const y2 = rect.get(3).asNumber();
            rect.set(0, PDFNumber.of(Math.min(x1, x2)));
            rect.set(1, PDFNumber.of(Math.min(y1, y2)));
            rect.set(2, PDFNumber.of(Math.max(x1, x2)));
            rect.set(3, PDFNumber.of(Math.max(y1, y2)));
          }
        }
      }
    }
    const sigUid = Math.random().toString(36).substring(2, 7);
    widgetRects.forEach((rectCoords, index) => {
      const minX = Math.min(rectCoords[0], rectCoords[2]);
      const minY = Math.min(rectCoords[1], rectCoords[3]);
      const maxX = Math.max(rectCoords[0], rectCoords[2]);
      const maxY = Math.max(rectCoords[1], rectCoords[3]);
      const rw = maxX - minX;
      const rh = maxY - minY;
      const rect = PDFArray.withContext(pdfDoc.context);
      rect.push(PDFNumber.of(minX));
      rect.push(PDFNumber.of(minY));
      rect.push(PDFNumber.of(maxX));
      rect.push(PDFNumber.of(maxY));
      const apStream = pdfDoc.context.formXObject([], {
        BBox: [0, 0, rw, rh],
        Resources: {}
      });
      const roleName = reason.toLowerCase().includes("verification") ? "Supervisor" : "Personnel";
      const fieldName = options?.fieldName ? widgetRects.length > 1 ? `${options.fieldName}_${index + 1}` : options.fieldName : `${roleName}_Signature_Copy${index + 1}`;
      const widgetDict = pdfDoc.context.obj({
        Type: "Annot",
        Subtype: "Widget",
        FT: "Sig",
        Rect: rect,
        V: signatureDictRef,
        T: PDFString.of(fieldName),
        F: ANNOTATION_FLAGS.PRINT | 128,
        // PRINT | LOCKED
        P: page.ref,
        AP: { N: pdfDoc.context.register(apStream) }
      });
      const widgetRef = pdfDoc.context.register(widgetDict);
      widgetRefs.push(widgetRef);
      annotations.push(widgetRef);
    });
    page.node.set(PDFName.of("Annots"), annotations);
    const existingAcroForm = pdfDoc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
    if (existingAcroForm) {
      let fields = existingAcroForm.lookupMaybe(PDFName.of("Fields"), PDFArray);
      if (!fields) {
        fields = pdfDoc.context.obj([]);
        existingAcroForm.set(PDFName.of("Fields"), fields);
      }
      widgetRefs.forEach((ref) => fields.push(ref));
      existingAcroForm.set(
        PDFName.of("SigFlags"),
        PDFNumber.of(SIG_FLAGS.SIGNATURES_EXIST | SIG_FLAGS.APPEND_ONLY)
      );
    } else {
      const acroFormObj = pdfDoc.context.obj({
        Fields: widgetRefs,
        SigFlags: SIG_FLAGS.SIGNATURES_EXIST | SIG_FLAGS.APPEND_ONLY
      });
      const acroFormRef = pdfDoc.context.register(acroFormObj);
      pdfDoc.catalog.set(PDFName.of("AcroForm"), acroFormRef);
    }
    const savedBytes = await pdfDoc.save({ useObjectStreams: false });
    pdfWithPlaceholder = Buffer.from(savedBytes);
  }
  const cleanBase64 = p12Base64.replace(/^data:.*?;base64,/, "").trim();
  const p12DerBuffer = Buffer.from(cleanBase64, "base64");
  const signer = new P12Signer(p12DerBuffer, { passphrase: password || "" });
  const signPdfInstance = new SignPdf();
  const signedBuffer = await signPdfInstance.sign(pdfWithPlaceholder, signer);
  console.log("[pnpki] \u2713 @signpdf signed. Size:", signedBuffer.length, "bytes, signer:", signerIdentity.commonName);
  return {
    signedBuffer,
    signerName: signerIdentity.commonName,
    certificateInfo: {
      commonName: signerIdentity.commonName,
      subjectDN: signerIdentity.subjectDN,
      organization: signerIdentity.organization,
      issuerCN: signerIdentity.issuerCN,
      issuerDN: signerIdentity.issuerDN,
      validFrom: signerIdentity.validFrom,
      validTo: signerIdentity.validTo,
      serialNumber: signerIdentity.serialNumber,
      sha256Fingerprint: signerIdentity.sha256Fingerprint
    },
    signerIdentity
  };
}
export {
  appendSignatureIncremental,
  decryptP12Password,
  encryptP12Password,
  getSignerIdentityFromP12,
  hashPassword,
  parseP12Certificate,
  signPdfBuffer,
  validatePasswordStrength,
  verifyPassword
};
