import crypto from "crypto";
import forge from "node-forge";
import { PDFDocument, PDFName, PDFNumber, PDFString, PDFHexString, PDFArray, PDFDict, PDFInvalidObject } from "pdf-lib";
import { SignPdf } from "@signpdf/signpdf";
import { P12Signer } from "@signpdf/signer-p12";
import { DEFAULT_BYTE_RANGE_PLACEHOLDER, ANNOTATION_FLAGS, SIG_FLAGS } from "@signpdf/utils";

const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.PNPKI_KEY_SECRET || "dict-r5-pnpki-signing-vault-key-2026",
  "dict-pnpki-salt",
  32
);

export function encryptP12Password(plainText: string): string {
  if (!plainText) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `enc:${iv.toString("hex")}:${tag}:${encrypted}`;
}

export function decryptP12Password(cipherText: string): string {
  if (!cipherText) return "";
  if (!cipherText.startsWith("enc:")) return cipherText; // legacy fallback
  const parts = cipherText.split(":");
  if (parts.length !== 4) return "";
  const iv = Buffer.from(parts[1], "hex");
  const tag = Buffer.from(parts[2], "hex");
  const encrypted = parts[3];
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export interface SignerIdentity {
  commonName: string;
  subjectDN: string;
  organization?: string;
  issuerCN?: string;
  issuerDN?: string;
  serialNumber?: string;
  sha256Fingerprint: string;
  validFrom: Date;
  validTo: Date;
  rawCert: forge.pki.Certificate;
  privateKey: any;
  caCerts: forge.pki.Certificate[];
}

/**
 * Extracts the true cryptographic signer identity strictly from the P12 certificate.
 * The signer identity is derived purely from the P12 keystore and cannot be forged
 * or overridden by form fields, personnel records, or database names.
 */
export function getSignerIdentityFromP12(
  p12Base64: string,
  password?: string
): SignerIdentity {
  const cleanBase64 = p12Base64.replace(/^data:.*?;base64,/, "").trim();
  const p12Der = forge.util.decode64(cleanBase64);
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password || "");

  // Extract all certificate bags and private key bags
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ||
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ||
    [];

  if (keyBags.length === 0 || !keyBags[0]?.key) {
    throw new Error(
      "Could not find valid Private Key in this .p12 keystore. Check your password."
    );
  }

  const privateKey = keyBags[0].key;
  let signerCert: forge.pki.Certificate | null = null;
  const caCerts: forge.pki.Certificate[] = [];

  // Match private key with the corresponding signer certificate by public key modulus & exponent
  for (const bag of certBags) {
    if (bag.cert) {
      const pub = bag.cert.publicKey as any;
      if (
        privateKey.n &&
        pub?.n &&
        privateKey.n.compareTo(pub.n) === 0 &&
        privateKey.e.compareTo(pub.e) === 0
      ) {
        signerCert = bag.cert;
      } else {
        caCerts.push(bag.cert);
      }
    }
  }

  // Fallback to first certificate if key comparison was unavailable
  if (!signerCert && certBags.length > 0 && certBags[0].cert) {
    signerCert = certBags[0].cert;
  }

  if (!signerCert) {
    throw new Error(
      "Could not find valid Certificate and Private Key in this .p12 keystore. Check your password."
    );
  }

  const cnAttr = signerCert.subject.attributes.find(
    (a: any) => a.name === "commonName" || a.shortName === "CN"
  );
  const commonName = cnAttr ? String(cnAttr.value) : "DICT Authorized Signatory";

  const orgAttr = signerCert.subject.attributes.find(
    (a: any) => a.name === "organizationName" || a.shortName === "O"
  );
  const organization = orgAttr ? String(orgAttr.value) : undefined;

  const issuerCnAttr = signerCert.issuer.attributes.find(
    (a: any) => a.name === "commonName" || a.shortName === "CN"
  );
  const issuerCN = issuerCnAttr ? String(issuerCnAttr.value) : undefined;

  const subjectDN = signerCert.subject.attributes
    .map((a: any) => `${a.shortName || a.name}=${a.value}`)
    .join(", ");
  const issuerDN = signerCert.issuer.attributes
    .map((a: any) => `${a.shortName || a.name}=${a.value}`)
    .join(", ");

  const certDerBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(signerCert)).getBytes();
  const sha256Fingerprint = crypto
    .createHash("sha256")
    .update(Buffer.from(certDerBytes, "binary"))
    .digest("hex")
    .match(/.{2}/g)!
    .join(":")
    .toUpperCase();

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
    caCerts,
  };
}

export function parseP12Certificate(p12Base64: string, password?: string) {
  return getSignerIdentityFromP12(p12Base64, password);
}

/**
 * Parses all PDF objects and returns a Map containing the latest definition body of each object.
 */
function parsePdfObjects(pdfStr: string): Map<number, string> {
  const map = new Map<number, string>();
  const regex = /(\d+)\s+0\s+obj\s*([\s\S]*?)\s*endobj/g;
  let match;
  while ((match = regex.exec(pdfStr)) !== null) {
    const objNum = parseInt(match[1]);
    map.set(objNum, match[2]); // latest occurrence naturally overwrites earlier ones
  }
  return map;
}

/**
 * Appends a digital signature incrementally to an already-signed PDF buffer,
 * preserving all previous signatures and their cryptographic byte ranges intact (ISO 32000 compliant).
 */
export function appendSignatureIncremental(
  pdfBuffer: Buffer,
  signerName: string,
  sigRects: [number, number, number, number][],
  reason: string,
  contactInfo: string = "pnpki@dict.gov.ph",
  location: string = "Legazpi City, Philippines",
  customFieldName?: string,
  targetPageIndex: number = 0
): Buffer {
  const pdfStr = pdfBuffer.toString("binary");

  // 1. Find previous startxref
  const startXrefMatches = [...pdfStr.matchAll(/startxref\s+(\d+)\s+%%EOF/g)];
  if (startXrefMatches.length === 0) {
    throw new Error("Could not find startxref in PDF buffer for incremental update");
  }
  const prevStartXref = parseInt(startXrefMatches[startXrefMatches.length - 1][1]);

  // 2. Parse all latest PDF objects
  const objMap = parsePdfObjects(pdfStr);
  let maxObj = 0;
  for (const objNum of objMap.keys()) {
    if (objNum > maxObj) maxObj = objNum;
  }

  // 3. Find Catalog /Root object number from the latest trailer
  const rootMatches = [...pdfStr.matchAll(/\/Root\s+(\d+)\s+0\s+R/g)];
  const rootObjNum = rootMatches.length > 0 ? parseInt(rootMatches[rootMatches.length - 1][1]) : 1;
  const catalogBody = objMap.get(rootObjNum) || "";

  // 4. Find Page Object number (strictly match /Type /Page with word boundary to avoid matching /Type /Pages)
  let pageObjNum = 3;
  for (const [objNum, body] of objMap.entries()) {
    if (/\/Type\s*\/Page\b/.test(body)) {
      pageObjNum = objNum;
      break;
    }
  }
  const pageBody = objMap.get(pageObjNum) || "";

  // 5. Find existing Annots array in latest Page object
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

  // 6. Find existing AcroForm Fields from latest Catalog body
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

  // Allocate new objects
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

  // 1. Signature Dictionary Object
  appendObj(
    sigDictObjNum,
    `<<\n/Type /Sig\n/Filter /Adobe.PPKLite\n/SubFilter /adbe.pkcs7.detached\n/ByteRange [${byteRangePlaceholder}]\n/Contents <${placeholderContents}>\n/Reason (${reason})\n/M (D:${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}+08'00')\n/Name (${signerName})\n/ContactInfo (${contactInfo})\n/Location (${location})\n/Prop_Build << /Filter << /Name /Adobe.PPKLite >> >>\n>>`
  );

  // 2. Widget Annotations & Appearance Streams
  const newWidgetRefs: string[] = [];
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
    const bboxW = maxX - minX;
    const bboxH = maxY - minY;

    const roleName = reason.toLowerCase().includes("verification") ? "Supervisor" : "Personnel";
    const fieldName = customFieldName
      ? (sigRects.length > 1 ? `${customFieldName}_${idx + 1}` : customFieldName)
      : `${roleName}_Signature_Copy${idx + 1}`;

    // Appearance XObject
    appendObj(
      apNum,
      `<<\n/Type /XObject\n/Subtype /Form\n/BBox [0 0 ${bboxW} ${bboxH}]\n/Resources << >>\n/Length 0\n>>\nstream\n\nendstream`
    );

    // Widget Annotation
    appendObj(
      wNum,
      `<<\n/Type /Annot\n/Subtype /Widget\n/FT /Sig\n/Rect [${minX} ${minY} ${maxX} ${maxY}]\n/V ${sigDictObjNum} 0 R\n/T (${fieldName})\n/F 132\n/P ${pageObjNum} 0 R\n/AP << /N ${apNum} 0 R >>\n>>`
    );
  });

  const newAcroFormNum = maxObj + 2 + sigRects.length * 2;

  // 3. New AcroForm Object with ALL previous + new widget references
  const combinedFields = [existingFields, ...newWidgetRefs].filter(Boolean).join(" ");
  appendObj(
    newAcroFormNum,
    `<<\n/Fields [${combinedFields}]\n/SigFlags 3\n>>`
  );

  // 4. Updated Page Object with ALL previous + new annotations
  const combinedAnnots = [existingAnnots, ...newWidgetRefs].filter(Boolean).join(" ");
  let cleanedPageBody = pageBody
    .replace(/^\s*<<\s*/, "")
    .replace(/\s*>>\s*$/, "")
    .replace(/\/Annots\s*\[[^\]]*\]/g, "")
    .replace(/\/Annots\s+\d+\s+0\s+R/g, "")
    .trim();

  appendObj(
    pageObjNum,
    `<<\n${cleanedPageBody}\n/Annots [${combinedAnnots}]\n>>`
  );

  // 5. Updated Catalog Object pointing to new AcroForm
  let cleanedCatalogBody = catalogBody
    .replace(/^\s*<<\s*/, "")
    .replace(/\s*>>\s*$/, "")
    .replace(/\/AcroForm\s+\d+\s+0\s+R/g, "")
    .replace(/\/AcroForm\s*<<[\s\S]*?>>/g, "")
    .trim();

  appendObj(
    rootObjNum,
    `<<\n${cleanedCatalogBody}\n/AcroForm ${newAcroFormNum} 0 R\n>>`
  );

  // 6. Incremental XRef Table
  const xrefOffset = pdfBuffer.length + Buffer.from(appendData, "binary").length;
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
      const off = objOffsets.get(oNum)!;
      xrefData += `${String(off).padStart(10, "0")} 00000 n \n`;
    }
    i += count;
  }

  const maxTotalObj = Math.max(...objOffsets.keys(), maxObj) + 1;
  const trailerData = `trailer\n<<\n/Size ${maxTotalObj}\n/Root ${rootObjNum} 0 R\n/Prev ${prevStartXref}\n>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  appendData += xrefData + trailerData;

  return Buffer.concat([pdfBuffer, Buffer.from(appendData, "binary")]);
}

/**
 * Signs a PDF buffer using @signpdf/signpdf + @signpdf/signer-p12.
 * The digital signer identity is STRICTLY derived from the P12 certificate,
 * ensuring complete separation between document personnel data and cryptographic signer identity.
 */
export async function signPdfBuffer(
  pdfBuffer: Buffer,
  p12Base64: string,
  password?: string,
  options?: {
    reason?: string;
    contactInfo?: string;
    location?: string;
    sigRect?: [number, number, number, number];
    sigRects?: [number, number, number, number][];
    fieldName?: string;
    pageIndex?: number;
  }
): Promise<{ signedBuffer: Buffer; signerName: string; certificateInfo: any; signerIdentity: SignerIdentity }> {
  // Extract signer identity strictly from certificate
  const signerIdentity = getSignerIdentityFromP12(p12Base64, password);

  // Securely log digital signer identity for auditing & verification (NEVER logs private key or password)
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
  const reason =
    options?.reason ||
    "Civil Service Form No. 48 Official Daily Time Record Digital Certification";
  const contactInfo = options?.contactInfo || "pnpki@dict.gov.ph";
  const location = options?.location || "Legazpi City, Philippines";

  const rawRects: [number, number, number, number][] =
    options?.sigRects && options.sigRects.length > 0
      ? options.sigRects
      : [options?.sigRect || [98, 218, 122, 26]];

  const pdfStr = pdfBuffer.toString("binary");
  const isAlreadySigned = /\/Type\s*\/Sig/.test(pdfStr) && /startxref/.test(pdfStr);

  let pdfWithPlaceholder: Buffer;

  if (isAlreadySigned) {
    // ── Incremental Mode: Append second signature revision to preserve Pass 1 signature (ISO 32000) ──
    console.log("[pnpki] Document already contains a digital signature. Appending revision incrementally...");
    pdfWithPlaceholder = appendSignatureIncremental(
      pdfBuffer,
      signerName,
      rawRects,
      reason,
      contactInfo,
      location,
      options?.fieldName
    );
  } else {
    // ── First Signature Mode: Inject placeholder /Sig field and multi-widgets with pdf-lib ──
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const targetPageIndex =
      typeof options?.pageIndex === "number" && options.pageIndex >= 0 && options.pageIndex < pages.length
        ? options.pageIndex
        : (options?.pageIndex === -1 ? pages.length - 1 : 0);
    const page = pages[targetPageIndex] || pages[0];

    const widgetRects = rawRects.map(([rx, ry, rw, rh]) => [rx, ry, rx + rw, ry + rh]);
    const signatureLength = 32768;

  // ByteRange placeholder
  const byteRange = PDFArray.withContext(pdfDoc.context);
  byteRange.push(PDFNumber.of(0));
  byteRange.push(PDFName.of(DEFAULT_BYTE_RANGE_PLACEHOLDER));
  byteRange.push(PDFName.of(DEFAULT_BYTE_RANGE_PLACEHOLDER));
  byteRange.push(PDFName.of(DEFAULT_BYTE_RANGE_PLACEHOLDER));

  // Placeholder hex
  const placeholder = PDFHexString.of(String.fromCharCode(0).repeat(signatureLength));

  // /Sig Dictionary strictly embeds the true certificate identity
  const signatureDict = pdfDoc.context.obj({
    Type: "Sig",
    Filter: "Adobe.PPKLite",
    SubFilter: "adbe.pkcs7.detached",
    ByteRange: byteRange,
    Contents: placeholder,
    Reason: PDFString.of(reason),
    M: PDFString.fromDate(new Date()),
    ContactInfo: PDFString.of(contactInfo),
    Name: PDFString.of(signerName),
    Location: PDFString.of(location),
    Prop_Build: {
      Filter: { Name: "Adobe.PPKLite" },
    },
  });

  const signatureBuffer = new Uint8Array(signatureDict.sizeInBytes());
  signatureDict.copyBytesInto(signatureBuffer, 0);
  const signatureObj = PDFInvalidObject.of(signatureBuffer);
  const signatureDictRef = pdfDoc.context.register(signatureObj);

  // Create widget annotations for every copy on the page (Copy 1 and Copy 2)
  const widgetRefs: any[] = [];
  let annotations = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  if (!annotations) {
    annotations = pdfDoc.context.obj([]);
  } else {
    // Normalize any existing Link/URI annotations to strictly ISO 32000 compliant [llx, lly, urx, ury]
    for (let i = 0; i < annotations.size(); i++) {
      const annotRef = annotations.get(i);
      const dict = pdfDoc.context.lookup(annotRef);
      if (dict && "lookupMaybe" in dict) {
        const rect = (dict as any).lookupMaybe(PDFName.of("Rect"), PDFArray);
        if (rect && rect.size() === 4) {
          const x1 = (rect.get(0) as PDFNumber).asNumber();
          const y1 = (rect.get(1) as PDFNumber).asNumber();
          const x2 = (rect.get(2) as PDFNumber).asNumber();
          const y2 = (rect.get(3) as PDFNumber).asNumber();

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
      Resources: {},
    });

    const roleName = reason.toLowerCase().includes("verification") ? "Supervisor" : "Personnel";
    const fieldName = options?.fieldName
      ? (widgetRects.length > 1 ? `${options.fieldName}_${index + 1}` : options.fieldName)
      : `${roleName}_Signature_Copy${index + 1}`;

    const widgetDict = pdfDoc.context.obj({
      Type: "Annot",
      Subtype: "Widget",
      FT: "Sig",
      Rect: rect,
      V: signatureDictRef,
      T: PDFString.of(fieldName),
      F: ANNOTATION_FLAGS.PRINT | 128, // PRINT | LOCKED
      P: page.ref,
      AP: { N: pdfDoc.context.register(apStream) },
    });

    const widgetRef = pdfDoc.context.register(widgetDict);
    widgetRefs.push(widgetRef);
    annotations.push(widgetRef);
  });

  page.node.set(PDFName.of("Annots"), annotations);

  // AcroForm (Preserve existing form fields if signing incrementally)
  const existingAcroForm = pdfDoc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  if (existingAcroForm) {
    let fields = existingAcroForm.lookupMaybe(PDFName.of("Fields"), PDFArray);
    if (!fields) {
      fields = pdfDoc.context.obj([]);
      existingAcroForm.set(PDFName.of("Fields"), fields);
    }
    widgetRefs.forEach((ref) => fields!.push(ref));
    existingAcroForm.set(
      PDFName.of("SigFlags"),
      PDFNumber.of(SIG_FLAGS.SIGNATURES_EXIST | SIG_FLAGS.APPEND_ONLY)
    );
  } else {
    const acroFormObj = pdfDoc.context.obj({
      Fields: widgetRefs,
      SigFlags: SIG_FLAGS.SIGNATURES_EXIST | SIG_FLAGS.APPEND_ONLY,
    });
    const acroFormRef = pdfDoc.context.register(acroFormObj);
    pdfDoc.catalog.set(PDFName.of("AcroForm"), acroFormRef);
  }

  const savedBytes = await pdfDoc.save({ useObjectStreams: false });
  pdfWithPlaceholder = Buffer.from(savedBytes);
}

  // ── Step 2: Sign with @signpdf/signpdf + @signpdf/signer-p12 ────────────────
  const cleanBase64 = p12Base64.replace(/^data:.*?;base64,/, "").trim();
  const p12DerBuffer = Buffer.from(cleanBase64, "base64");

  const signer = new P12Signer(p12DerBuffer, { passphrase: password || "" });
  const signPdfInstance = new SignPdf();
  const signedBuffer = await signPdfInstance.sign(pdfWithPlaceholder, signer);

  console.log("[pnpki] ✓ @signpdf signed. Size:", signedBuffer.length, "bytes, signer:", signerIdentity.commonName);

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
      sha256Fingerprint: signerIdentity.sha256Fingerprint,
    },
    signerIdentity,
  };
}
