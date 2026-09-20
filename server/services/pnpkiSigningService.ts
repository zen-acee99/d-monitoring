import crypto from "crypto";
import forge from "node-forge";
import { PDFDocument, PDFName, PDFNumber, PDFString, PDFHexString, PDFArray, PDFInvalidObject } from "pdf-lib";
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

  // ── Step 1: Inject placeholder /Sig field and multi-widgets with pdf-lib ──
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const targetPageIndex =
    typeof options?.pageIndex === "number" && options.pageIndex >= 0 && options.pageIndex < pages.length
      ? options.pageIndex
      : (options?.pageIndex === -1 ? pages.length - 1 : 0);
  const page = pages[targetPageIndex] || pages[0];

  // Multiple rectangles: [ [rx1, ry1, rw1, rh1], [rx2, ry2, rw2, rh2] ]
  const rawRects: [number, number, number, number][] =
    options?.sigRects && options.sigRects.length > 0
      ? options.sigRects
      : [options?.sigRect || [98, 218, 122, 26]];

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

    const widgetDict = pdfDoc.context.obj({
      Type: "Annot",
      Subtype: "Widget",
      FT: "Sig",
      Rect: rect,
      V: signatureDictRef,
      T: PDFString.of(`Signature${index + 1}`),
      F: ANNOTATION_FLAGS.PRINT | 128, // PRINT | LOCKED
      P: page.ref,
      AP: { N: pdfDoc.context.register(apStream) },
    });

    const widgetRef = pdfDoc.context.register(widgetDict);
    widgetRefs.push(widgetRef);
    annotations.push(widgetRef);
  });

  page.node.set(PDFName.of("Annots"), annotations);

  // AcroForm
  const acroFormObj = pdfDoc.context.obj({
    Fields: widgetRefs,
    SigFlags: SIG_FLAGS.SIGNATURES_EXIST | SIG_FLAGS.APPEND_ONLY,
  });
  const acroFormRef = pdfDoc.context.register(acroFormObj);
  pdfDoc.catalog.set(PDFName.of("AcroForm"), acroFormRef);

  const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });

  // ── Step 2: Sign with @signpdf/signpdf + @signpdf/signer-p12 ────────────────
  const cleanBase64 = p12Base64.replace(/^data:.*?;base64,/, "").trim();
  const p12DerBuffer = Buffer.from(cleanBase64, "base64");

  const signer = new P12Signer(p12DerBuffer, { passphrase: password || "" });
  const signPdfInstance = new SignPdf();
  const signedBuffer = await signPdfInstance.sign(Buffer.from(pdfWithPlaceholder), signer);

  console.log("[pnpki] ✓ @signpdf signed. Size:", signedBuffer.length, "bytes, widgets:", widgetRefs.length);

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
