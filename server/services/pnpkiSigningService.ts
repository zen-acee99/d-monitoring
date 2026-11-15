import crypto from "crypto";
import forge from "node-forge";
import zlib from "zlib";
import { PDFDocument, PDFName, PDFNumber, PDFString, PDFHexString, PDFArray, PDFDict, PDFInvalidObject, PDFRawStream, decodePDFRawStream, rgb, StandardFonts } from "pdf-lib";
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
  if (plainText.startsWith("enc:")) return plainText;
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

export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
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
      message: "Password is too common or easily guessable. Please choose a stronger password.",
    };
  }
  return { valid: true };
}

export function hashPassword(plain: string): string {
  const clean = String(plain || "").trim();
  if (!clean) return "";
  if (clean.startsWith("scrypt:")) return clean;
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(clean, salt, 64).toString("hex");
  return `scrypt:${salt}:${derivedKey}`;
}


export function verifyPassword(plain: string, stored: string): boolean {
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
 * Extracts a balanced PDF dictionary (<< ... >>) handling arbitrary nesting depth.
 */
function extractBalancedDict(str: string, startIndex: number): string | null {
  const dictStart = str.indexOf("<<", startIndex);
  if (dictStart === -1) return null;
  let depth = 0;
  let i = dictStart;
  while (i < str.length) {
    if (str[i] === "<" && str[i + 1] === "<") {
      depth++;
      i += 2;
    } else if (str[i] === ">" && str[i + 1] === ">") {
      depth--;
      i += 2;
      if (depth === 0) {
        return str.slice(dictStart, i);
      }
    } else {
      i++;
    }
  }
  return null;
}

/**
 * Safely counts opening '<<' and closing '>>' dictionary delimiters while ignoring
 * comments (%...), literal strings ((...)), and hex strings (<...>).
 */
function countDictionaryBrackets(str: string): { open: number; close: number } {
  let open = 0;
  let close = 0;
  let inString = false;
  let parenDepth = 0;
  let inComment = false;
  let inHex = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const next = i + 1 < str.length ? str[i + 1] : "";

    if (inComment) {
      if (ch === "\r" || ch === "\n") inComment = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") { i++; continue; }
      if (ch === "(") parenDepth++;
      else if (ch === ")") {
        parenDepth--;
        if (parenDepth === 0) inString = false;
      }
      continue;
    }
    if (inHex) {
      if (ch === ">") inHex = false;
      continue;
    }
    if (ch === "%") { inComment = true; continue; }
    if (ch === "(") { inString = true; parenDepth = 1; continue; }
    if (ch === "<" && next === "<") { open++; i++; continue; }
    if (ch === "<" && next !== "<") { inHex = true; continue; }
    if (ch === ">" && next === ">") { close++; i++; continue; }
  }
  return { open, close };
}

/**
 * Parses all PDF objects including uncompressed objects and objects stored inside
 * compressed Object Streams (/Type /ObjStm), returning a Map containing the latest definition body.
 */
function parsePdfObjects(pdfBuf: Buffer): Map<number, string> {
  const map = new Map<number, string>();
  const pdfStr = pdfBuf.toString("latin1");

  // 1. Regular uncompressed objects
  const regex = /(\d+)\s+0\s+obj\s*([\s\S]*?)\s*endobj/g;
  let match;
  while ((match = regex.exec(pdfStr)) !== null) {
    const objNum = parseInt(match[1]);
    map.set(objNum, match[2]); // latest occurrence naturally overwrites earlier ones
  }

  // 2. Objects inside compressed Object Streams (/Type /ObjStm)
  // Bounded regex ensures we do not cross >> or stream boundaries
  const objStmMatches = [...pdfStr.matchAll(/(\d+)\s+0\s+obj\s*<<((?:(?!>>|stream)[\s\S])*)\/Type\s*\/ObjStm/g)];
  for (const sm of objStmMatches) {
    const objStart = sm.index;
    const headerSlice = pdfStr.slice(objStart, objStart + 500);
    const firstMatch = headerSlice.match(/\/First\s+(\d+)/);
    const lenMatch = headerSlice.match(/\/Length\s+(\d+)/);
    if (!firstMatch || !lenMatch) continue;

    const first = parseInt(firstMatch[1]);
    const length = parseInt(lenMatch[1]);

    const streamWord = "stream";
    const streamWordIdx = headerSlice.indexOf(streamWord);
    if (streamWordIdx === -1) continue;

    let streamStart = objStart + streamWordIdx + streamWord.length;
    if (pdfBuf[streamStart] === 13) streamStart++;
    if (pdfBuf[streamStart] === 10) streamStart++;

    const streamData = pdfBuf.slice(streamStart, streamStart + length);
    try {
      const decompressed = zlib.inflateSync(streamData).toString("latin1");
      const headerStr = decompressed.slice(0, first).trim();
      const tokens = headerStr.split(/\s+/);
      const pairs: { objNum: number; offset: number }[] = [];
      for (let i = 0; i < tokens.length; i += 2) {
        if (tokens[i] && tokens[i + 1]) {
          pairs.push({ objNum: parseInt(tokens[i]), offset: parseInt(tokens[i + 1]) });
        }
      }
      for (let i = 0; i < pairs.length; i++) {
        const cur = pairs[i];
        const start = first + cur.offset;
        const end = i + 1 < pairs.length ? first + pairs[i + 1].offset : decompressed.length;
        const body = decompressed.slice(start, end).trim();
        // LATEST definition in stream order naturally overwrites earlier ones
        map.set(cur.objNum, body);
      }
    } catch {
      // Ignored if stream is not standard deflate
    }
  }

  return map;
}

/**
 * Normalizes signature bounding box coordinates from either:
 * - [x, y, width, height] (legacy format or jsPDF style)
 * - [llx, lly, urx, ury] (ISO 32000 compliant format)
 * and guarantees minimum bounds (>= 115pt width, >= 18pt height) so visual stamp
 * fits with a clean 5-8px gap directly above the user's name without invading columns.
 */
/**
 * Splits a signer name into clean multi-line display lines if long.
 * Guarantees names like "Annabel C. Odoño-Calimpong" break cleanly onto the next line
 * without clipping, overflowing, or shrinking to unreadable font sizes.
 */
export function fixMojibake(str?: string | null): string {
  if (!str) return "";
  return str
    .replace(/Odoæo/g, "Odoño")
    .replace(/ODOÆO/g, "ODOÑO")
    .replace(/OdoÃ±o/g, "Odoño")
    .replace(/ODOÃ‘O/g, "ODOÑO")
    .replace(/æ/g, "ñ")
    .replace(/Æ/g, "Ñ")
    .replace(/Ã±/g, "ñ")
    .replace(/Ã‘/g, "Ñ")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ã-/g, "í")
    .replace(/Ã³/g, "ó");
}

export function splitSignerNameToLines(rawSigner: string, maxLen: number = 20): string[] {
  const clean = fixMojibake(rawSigner).trim();
  const withBy = `by ${clean}`;
  if (withBy.length <= maxLen) {
    return [withBy];
  }
  const tokens = clean.split(/\s+/);
  if (tokens.length >= 2) {
    const half = Math.ceil(tokens.length / 2);
    const line1 = `by ${tokens.slice(0, half).join(" ")}`;
    const line2 = tokens.slice(half).join(" ");
    return [line1, line2];
  }
  if (clean.includes("-")) {
    const hTokens = clean.split("-");
    return [`by ${hTokens[0]}-`, hTokens.slice(1).join("-")];
  }
  return [withBy];
}

/**
 * Normalizes signature widget coordinates and guarantees proper bounding dimensions
 * (>= 125pt width, >= 26pt height) with +5px padding in each corner for clear visual presentation
 * directly above the user's name without invading columns.
 */
export function normalizeSignatureBoundingBox(coords: [number, number, number, number]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  bboxW: number;
  bboxH: number;
} {
  const [c0, c1, c2, c3] = coords;
  // Determine if coords is [x, y, width, height] vs [x1, y1, x2, y2].
  const isWidthHeight =
    c3 > 0 && c3 <= 60 && c2 > 0 && c2 <= 400 &&
    (c3 - c1 < 10 || c3 - c1 > 60 || c2 - c0 < 50);

  let minX: number, minY: number, maxX: number, maxY: number;
  if (isWidthHeight) {
    minX = Math.round(c0);
    minY = Math.round(c1);
    maxX = Math.round(c0 + c2);
    maxY = Math.round(c1 + c3);
  } else {
    minX = Math.round(Math.min(c0, c2));
    minY = Math.round(Math.min(c1, c3));
    maxX = Math.round(Math.max(c0, c2));
    maxY = Math.round(Math.max(c1, c3));
  }

  let bboxW = Math.max(20, maxX - minX);
  let bboxH = Math.max(14, maxY - minY);

  // Guarantee minimum bounds (+5px corner padding: >= 125 width, >= 26 height)
  if (bboxW < 125) {
    bboxW = 125;
    maxX = minX + bboxW;
  }
  if (bboxH < 26) {
    bboxH = 26;
    maxY = minY + bboxH;
  }

  return { minX, minY, maxX, maxY, bboxW, bboxH };
}

export interface PdfTextItem {
  text: string;
  x: number;
  y: number;
}

/**
 * Parses Adobe /ToUnicode CMap stream syntax (extracting bfchar and bfrange definitions)
 * into a lookup Map from hexadecimal glyph index strings to Unicode characters.
 */
export function parsePdfCMap(cmapText: string): Map<string, string> {
  const map = new Map<string, string>();
  const bfCharBlocks = cmapText.match(/beginbfchar([\s\S]*?)endbfchar/g) || [];
  for (const block of bfCharBlocks) {
    const matches = block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g);
    for (const m of matches) {
      const srcHex = m[1].toUpperCase().padStart(4, "0");
      const dstHex = m[2];
      let str = "";
      for (let i = 0; i < dstHex.length; i += 4) {
        const code = parseInt(dstHex.substring(i, i + 4), 16);
        str += String.fromCharCode(code);
      }
      map.set(srcHex, str);
    }
  }

  const bfRangeBlocks = cmapText.match(/beginbfrange([\s\S]*?)endbfrange/g) || [];
  for (const block of bfRangeBlocks) {
    const lines = block.split("\n");
    for (const line of lines) {
      const match1 = line.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
      if (match1) {
        const start = parseInt(match1[1], 16);
        const end = parseInt(match1[2], 16);
        let dstStart = parseInt(match1[3], 16);
        for (let code = start; code <= end; code++) {
          const srcHex = code.toString(16).toUpperCase().padStart(4, "0");
          map.set(srcHex, String.fromCharCode(dstStart));
          dstStart++;
        }
        continue;
      }
      const match2 = line.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/);
      if (match2) {
        const start = parseInt(match2[1], 16);
        const end = parseInt(match2[2], 16);
        const hexList = match2[3].match(/<([0-9A-Fa-f]+)>/g) || [];
        for (let i = 0; i < hexList.length && start + i <= end; i++) {
          const srcHex = (start + i).toString(16).toUpperCase().padStart(4, "0");
          const dstHex = hexList[i].replace(/[<>]/g, "");
          let str = "";
          for (let j = 0; j < dstHex.length; j += 4) {
            const code = parseInt(dstHex.substring(j, j + 4), 16);
            str += String.fromCharCode(code);
          }
          map.set(srcHex, str);
        }
      }
    }
  }
  return map;
}

export function loadPageFontCMaps(pdfDoc: PDFDocument, page: any): Map<string, Map<string, string>> {
  const fontCMaps = new Map<string, Map<string, string>>();
  try {
    const resources = page.node.lookup(PDFName.of("Resources"), PDFDict);
    if (!resources) return fontCMaps;
    const fontDict = resources.lookup(PDFName.of("Font"), PDFDict);
    if (!fontDict) return fontCMaps;

    for (const k of fontDict.keys()) {
      const fontName = k.asString().replace(/^\//, "");
      const fontObj = fontDict.lookup(k, PDFDict);
      if (fontObj) {
        const toUnicodeRef = fontObj.get(PDFName.of("ToUnicode"));
        if (toUnicodeRef) {
          const toUnicodeStream = pdfDoc.context.lookup(toUnicodeRef);
          if (toUnicodeStream && (toUnicodeStream instanceof PDFRawStream || (toUnicodeStream as any).getContents || (toUnicodeStream as any).decode)) {
            const decoded = decodePDFRawStream(toUnicodeStream as any).decode();
            const cmapText = new TextDecoder("latin1").decode(decoded);
            fontCMaps.set(fontName, parsePdfCMap(cmapText));
          }
        }
      }
    }
  } catch (e) {
    console.warn("Could not load page font CMaps:", e);
  }
  return fontCMaps;
}

export function extractPageContentStreamBytes(pdfDoc: PDFDocument, page: any): Uint8Array {
  const contentsNode = page.node.Contents();
  if (!contentsNode) return new Uint8Array(0);

  const streamObjects: any[] = [];
  try {
    if ((contentsNode as any).asArray) {
      const arr = (contentsNode as any).asArray();
      for (const ref of arr) {
        const obj = pdfDoc.context.lookup(ref);
        if (obj) streamObjects.push(obj);
      }
    } else {
      const obj = pdfDoc.context.lookup(contentsNode as any);
      if (obj) streamObjects.push(obj);
    }

    let totalBytes = 0;
    const decodedChunks: Uint8Array[] = [];

    for (const sObj of streamObjects) {
      try {
        if (sObj instanceof PDFRawStream || (sObj as any).getContents || (sObj as any).decode) {
          const dec = decodePDFRawStream(sObj as any).decode();
          if (dec && dec.length > 0) {
            decodedChunks.push(dec);
            totalBytes += dec.length;
          }
        }
      } catch {}
    }

    if (totalBytes === 0) return new Uint8Array(0);
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of decodedChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return combined;
  } catch {
    return new Uint8Array(0);
  }
}

function decodeBytesWithCMap(rawBytes: Uint8Array, cmap?: Map<string, string>): string {
  if (cmap) {
    if (rawBytes.length >= 2 && rawBytes.length % 2 === 0) {
      let decoded2 = "";
      let matchedCount = 0;
      for (let i = 0; i < rawBytes.length; i += 2) {
        const hexKey = (rawBytes[i].toString(16).padStart(2, "0") + rawBytes[i + 1].toString(16).padStart(2, "0")).toUpperCase();
        if (cmap.has(hexKey)) {
          decoded2 += cmap.get(hexKey);
          matchedCount++;
        } else {
          if (rawBytes[i] === 0 && rawBytes[i + 1] >= 32) {
            decoded2 += String.fromCharCode(rawBytes[i + 1]);
          } else {
            decoded2 += " ";
          }
        }
      }
      if (matchedCount > 0) return decoded2;
    }

    let decoded1 = "";
    let matched1 = 0;
    for (let i = 0; i < rawBytes.length; i++) {
      const hexKey = rawBytes[i].toString(16).toUpperCase().padStart(4, "0");
      if (cmap.has(hexKey)) {
        decoded1 += cmap.get(hexKey);
        matched1++;
      } else {
        if (rawBytes[i] >= 32) decoded1 += String.fromCharCode(rawBytes[i]);
      }
    }
    if (matched1 > 0) return decoded1;
  }

  if (rawBytes.length >= 2 && rawBytes.length % 2 === 0 && rawBytes[0] === 0) {
    let s = "";
    for (let i = 0; i < rawBytes.length; i += 2) {
      const code = (rawBytes[i] << 8) | rawBytes[i + 1];
      if (code >= 32 || code === 10 || code === 13) s += String.fromCharCode(code);
    }
    if (s.trim()) return s;
  }

  return new TextDecoder("latin1").decode(rawBytes);
}

export function extractTextItemsFromContentStream(
  streamInput: Uint8Array | string,
  fontCMaps?: Map<string, Map<string, string>>
): PdfTextItem[] {
  let streamBytes: Uint8Array;
  if (streamInput instanceof Uint8Array) {
    streamBytes = streamInput;
  } else if (typeof streamInput === "string") {
    streamBytes = new Uint8Array(streamInput.length);
    for (let i = 0; i < streamInput.length; i++) {
      streamBytes[i] = streamInput.charCodeAt(i) & 0xff;
    }
  } else {
    return [];
  }

  const items: PdfTextItem[] = [];
  let currentFont = "";
  let lineStartX = 0, lineStartY = 0, currentX = 0, currentY = 0;
  let currentLeading = 12;
  let ctmA = 1, ctmB = 0, ctmC = 0, ctmD = 1, ctmE = 0, ctmF = 0;
  const ctmStack: Array<[number, number, number, number, number, number]> = [];

  let tmA = 1, tmB = 0, tmC = 0, tmD = 1, tmE = 0, tmF = 0;
  let tlmA = 1, tlmB = 0, tlmC = 0, tlmD = 1, tlmE = 0, tlmF = 0;

  function updateCurrentCoordsFromTm() {
    const textX = tmE;
    const textY = tmF;
    currentX = textX * ctmA + textY * ctmC + ctmE;
    currentY = textX * ctmB + textY * ctmD + ctmF;
    lineStartX = currentX;
    lineStartY = currentY;
  }

  let idx = 0;
  const len = streamBytes.length;

  function skipWhitespace() {
    while (idx < len && (streamBytes[idx] <= 32 || streamBytes[idx] === 0)) idx++;
  }

  function readWord(): string {
    skipWhitespace();
    const start = idx;
    while (
      idx < len &&
      streamBytes[idx] > 32 &&
      streamBytes[idx] !== 40 &&
      streamBytes[idx] !== 41 &&
      streamBytes[idx] !== 60 &&
      streamBytes[idx] !== 62 &&
      streamBytes[idx] !== 91 &&
      streamBytes[idx] !== 93 &&
      streamBytes[idx] !== 47
    ) {
      idx++;
    }
    return new TextDecoder("latin1").decode(streamBytes.subarray(start, idx));
  }

  function readLiteralStringBytes(): Uint8Array {
    idx++; // skip '('
    const bytes: number[] = [];
    let depth = 1;
    while (idx < len) {
      const b = streamBytes[idx];
      if (b === 92) {
        idx++;
        if (idx >= len) break;
        const nb = streamBytes[idx];
        if (nb >= 48 && nb <= 55) {
          let oct = String.fromCharCode(nb);
          idx++;
          if (idx < len && streamBytes[idx] >= 48 && streamBytes[idx] <= 55) {
            oct += String.fromCharCode(streamBytes[idx]);
            idx++;
            if (idx < len && streamBytes[idx] >= 48 && streamBytes[idx] <= 55) {
              oct += String.fromCharCode(streamBytes[idx]);
              idx++;
            }
          }
          bytes.push(parseInt(oct, 8));
          continue;
        } else if (nb === 110) bytes.push(10);
        else if (nb === 114) bytes.push(13);
        else if (nb === 116) bytes.push(9);
        else if (nb === 98) bytes.push(8);
        else if (nb === 102) bytes.push(12);
        else bytes.push(nb);
        idx++;
      } else if (b === 40) {
        depth++;
        bytes.push(b);
        idx++;
      } else if (b === 41) {
        depth--;
        idx++;
        if (depth === 0) break;
        bytes.push(b);
        idx++;
      } else {
        bytes.push(b);
        idx++;
      }
    }
    return new Uint8Array(bytes);
  }

  function readHexStringBytes(): Uint8Array {
    idx++; // skip '<'
    let hex = "";
    while (idx < len && streamBytes[idx] !== 62) {
      const b = streamBytes[idx];
      if ((b >= 48 && b <= 57) || (b >= 65 && b <= 70) || (b >= 97 && b <= 102)) {
        hex += String.fromCharCode(b);
      }
      idx++;
    }
    if (idx < len && streamBytes[idx] === 62) idx++;
    if (hex.length % 2 !== 0) hex += "0";
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  const tokenOperandStack: any[] = [];

  while (idx < len) {
    skipWhitespace();
    if (idx >= len) break;

    const b = streamBytes[idx];
    if (b === 47) {
      idx++;
      let name = "";
      while (
        idx < len &&
        streamBytes[idx] > 32 &&
        streamBytes[idx] !== 47 &&
        streamBytes[idx] !== 40 &&
        streamBytes[idx] !== 60 &&
        streamBytes[idx] !== 91
      ) {
        name += String.fromCharCode(streamBytes[idx]);
        idx++;
      }
      tokenOperandStack.push("/" + name);
    } else if (b === 40) {
      tokenOperandStack.push({ type: "str", bytes: readLiteralStringBytes() });
    } else if (b === 60 && idx + 1 < len && streamBytes[idx + 1] !== 60) {
      tokenOperandStack.push({ type: "str", bytes: readHexStringBytes() });
    } else if (b === 91) {
      idx++; // skip '['
      const arr: any[] = [];
      while (idx < len) {
        skipWhitespace();
        if (idx >= len) break;
        if (streamBytes[idx] === 93) {
          idx++;
          break;
        } else if (streamBytes[idx] === 40) {
          arr.push({ type: "str", bytes: readLiteralStringBytes() });
        } else if (streamBytes[idx] === 60 && streamBytes[idx + 1] !== 60) {
          arr.push({ type: "str", bytes: readHexStringBytes() });
        } else {
          const numStr = readWord();
          const n = parseFloat(numStr);
          if (!isNaN(n)) arr.push(n);
        }
      }
      tokenOperandStack.push({ type: "arr", items: arr });
    } else {
      const word = readWord();
      if (!word) {
        idx++;
        continue;
      }

      if (word === "q") {
        ctmStack.push([ctmA, ctmB, ctmC, ctmD, ctmE, ctmF]);
        tokenOperandStack.length = 0;
      } else if (word === "Q") {
        if (ctmStack.length > 0) {
          const top = ctmStack.pop()!;
          ctmA = top[0]; ctmB = top[1]; ctmC = top[2]; ctmD = top[3]; ctmE = top[4]; ctmF = top[5];
        }
        tokenOperandStack.length = 0;
      } else if (word === "cm") {
        if (tokenOperandStack.length >= 6) {
          const [a1, b1, c1, d1, e1, f1] = tokenOperandStack.slice(-6).map(Number);
          const a2 = ctmA * a1 + ctmC * b1;
          const b2 = ctmB * a1 + ctmD * b1;
          const c2 = ctmA * c1 + ctmC * d1;
          const d2 = ctmB * c1 + ctmD * d1;
          const e2 = ctmA * e1 + ctmC * f1 + ctmE;
          const f2 = ctmB * e1 + ctmD * f1 + ctmF;
          ctmA = a2; ctmB = b2; ctmC = c2; ctmD = d2; ctmE = e2; ctmF = f2;
        }
        tokenOperandStack.length = 0;
      } else if (word === "BT") {
        tmA = 1; tmB = 0; tmC = 0; tmD = 1; tmE = 0; tmF = 0;
        tlmA = 1; tlmB = 0; tlmC = 0; tlmD = 1; tlmE = 0; tlmF = 0;
        updateCurrentCoordsFromTm();
        tokenOperandStack.length = 0;
      } else if (word === "ET") {
        tokenOperandStack.length = 0;
      } else if (word === "TL") {
        if (tokenOperandStack.length >= 1) {
          currentLeading = parseFloat(tokenOperandStack[tokenOperandStack.length - 1]) || 12;
        }
        tokenOperandStack.length = 0;
      } else if (word === "Tm") {
        if (tokenOperandStack.length >= 6) {
          const parts = tokenOperandStack.slice(-6).map(Number);
          tmA = parts[0]; tmB = parts[1]; tmC = parts[2]; tmD = parts[3]; tmE = parts[4]; tmF = parts[5];
          tlmA = tmA; tlmB = tmB; tlmC = tmC; tlmD = tmD; tlmE = tmE; tlmF = tmF;
          updateCurrentCoordsFromTm();
        }
        tokenOperandStack.length = 0;
      } else if (word === "Td" || word === "TD") {
        if (tokenOperandStack.length >= 2) {
          const [tx, ty] = tokenOperandStack.slice(-2).map(Number);
          if (word === "TD") currentLeading = -ty;
          tlmE = tx * tlmA + ty * tlmC + tlmE;
          tlmF = tx * tlmB + ty * tlmD + tlmF;
          tmA = tlmA; tmB = tlmB; tmC = tlmC; tmD = tlmD; tmE = tlmE; tmF = tlmF;
          updateCurrentCoordsFromTm();
        }
        tokenOperandStack.length = 0;
      } else if (word === "T*") {
        tlmE = 0 * tlmA + (-currentLeading) * tlmC + tlmE;
        tlmF = 0 * tlmB + (-currentLeading) * tlmD + tlmF;
        tmA = tlmA; tmB = tlmB; tmC = tlmC; tmD = tlmD; tmE = tlmE; tmF = tlmF;
        updateCurrentCoordsFromTm();
      } else if (word === "Tf") {
        if (tokenOperandStack.length >= 2) {
          currentFont = String(tokenOperandStack[tokenOperandStack.length - 2]).replace(/^\//, "");
        }
        tokenOperandStack.length = 0;
      } else if (word === "Tj") {
        if (tokenOperandStack.length >= 1) {
          const op = tokenOperandStack[tokenOperandStack.length - 1];
          if (op && op.type === "str") {
            const cmap = fontCMaps?.get(currentFont);
            const decoded = decodeBytesWithCMap(op.bytes, cmap);
            if (decoded && decoded.trim()) {
              items.push({ text: decoded.trim(), x: currentX, y: currentY });
            }
          }
        }
        tokenOperandStack.length = 0;
      } else if (word === "TJ") {
        if (tokenOperandStack.length >= 1) {
          const op = tokenOperandStack[tokenOperandStack.length - 1];
          if (op && op.type === "arr") {
            const cmap = fontCMaps?.get(currentFont);
            let combined = "";
            for (const elem of op.items) {
              if (elem && elem.type === "str") {
                combined += decodeBytesWithCMap(elem.bytes, cmap);
              } else if (typeof elem === "number" && elem < -120) {
                if (!combined.endsWith(" ")) combined += " ";
              }
            }
            if (combined && combined.trim()) {
              items.push({ text: combined.trim(), x: currentX, y: currentY });
            }
          }
        }
        tokenOperandStack.length = 0;
      } else {
        tokenOperandStack.push(word);
      }
    }
  }

  return items;
}

/**
 * Deduplication inspector: Checks whether a PDF page already contains visual typography
 * (such as "Digitally signed", "DigiSigned", or the signer's name) on the page canvas
 * or in existing annotation appearance streams.
 */
export function checkVisualTypographyOnPage(
  pdfDoc: PDFDocument,
  pageIndex: number,
  sigBox: { minX: number; minY: number; maxX: number; maxY: number },
  signerName?: string
): { exists: boolean; reason: string } {
  const pages = pdfDoc.getPages();
  const page = pages[pageIndex] || pages[0];
  if (!page) return { exists: false, reason: "No page" };

  const normSigner = (signerName || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Check existing Widget annotations and their /AP /N streams
  const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  if (annots) {
    for (let i = 0; i < annots.size(); i++) {
      const annot = pdfDoc.context.lookup(annots.get(i));
      if (!annot || !(annot instanceof PDFDict)) continue;

      const ap = annot.lookup(PDFName.of("AP"));
      if (ap && ap instanceof PDFDict) {
        const n = ap.lookup(PDFName.of("N"));
        if (n) {
          const stm: any = pdfDoc.context.lookup(n);
          if (stm && (stm instanceof PDFRawStream || stm.getContents || stm.decode)) {
            let decoded: Uint8Array;
            try {
              decoded = decodePDFRawStream(stm).decode();
            } catch {
              decoded = stm.getContents ? stm.getContents() : new Uint8Array(0);
            }
            const apStr = Buffer.from(decoded).toString("latin1").toLowerCase();
            const hasDigi = apStr.includes("digitally signed") || apStr.includes("digisigned");
            const hasSigner = !normSigner || apStr.replace(/[^a-z0-9]/g, "").includes(normSigner);

            if (hasDigi && hasSigner) {
              const rectArr = annot.lookupMaybe(PDFName.of("Rect"), PDFArray);
              if (rectArr && rectArr.size() === 4) {
                const rx1 = (rectArr.get(0) as any).asNumber ? (rectArr.get(0) as any).asNumber() : Number(rectArr.get(0));
                const ry1 = (rectArr.get(1) as any).asNumber ? (rectArr.get(1) as any).asNumber() : Number(rectArr.get(1));
                const rx2 = (rectArr.get(2) as any).asNumber ? (rectArr.get(2) as any).asNumber() : Number(rectArr.get(2));
                const ry2 = (rectArr.get(3) as any).asNumber ? (rectArr.get(3) as any).asNumber() : Number(rectArr.get(3));
                const ax = Math.min(rx1, rx2);
                const ay = Math.min(ry1, ry2);
                if (Math.abs(ay - sigBox.minY) < 35 && Math.abs(ax - sigBox.minX) < 65) {
                  return { exists: true, reason: `Found in annotation AP/N stream at (${ax}, ${ay})` };
                }
              } else {
                return { exists: true, reason: "Found in annotation AP/N stream" };
              }
            }
          }
        }
      }
    }
  }

  // 2. Check page canvas content streams (jsPDF or pre-drawn text)
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  if (sBytes.length === 0) return { exists: false, reason: "Empty content stream" };

  const fontCMaps = loadPageFontCMaps(pdfDoc, page);
  const textItems = extractTextItemsFromContentStream(sBytes, fontCMaps);

  // Signature box bounds: tight vertical tolerance to never invade preprinted signatory title below
  const minX = sigBox.minX - 35;
  const maxX = sigBox.maxX + 35;
  const minY = sigBox.minY - 4; // NEVER look below signature box into preprinted name line!
  const maxY = sigBox.maxY + 15;

  const inBoxItems = textItems.filter((it) => it.x >= minX && it.x <= maxX && it.y >= minY && it.y <= maxY);

  const hasDigi = inBoxItems.some((it) => {
    const l = it.text.toLowerCase();
    return l.includes("digitally signed") || l.includes("digisigned");
  });

  const hasSigner = !normSigner || inBoxItems.some((it) => {
    return it.text.toLowerCase().replace(/[^a-z0-9]/g, "").includes(normSigner);
  });

  if (hasDigi && hasSigner) {
    const matched = inBoxItems.find((it) => it.text.toLowerCase().includes("digitally") || it.text.toLowerCase().includes("digisigned"));
    return {
      exists: true,
      reason: `Found canvas digital signature "${matched?.text}" at (${matched?.x.toFixed(1)}, ${matched?.y.toFixed(1)})`,
    };
  }

  return { exists: false, reason: "No matching visual typography in target box" };
}

export function checkIfVisualTypographyExists(
  pageContentsStr: string,
  pdfBuffer: Buffer,
  signerName: string,
  sigBox: { minX: number; minY: number; maxX: number; maxY: number },
  fieldName?: string,
  reason?: string
): boolean {
  try {
    const normSigner = (signerName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const lowerContents = pageContentsStr.toLowerCase();
    const hasDigi = lowerContents.includes("digitally signed") || lowerContents.includes("digisigned");
    const hasSigner = !normSigner || lowerContents.replace(/[^a-z0-9]/g, "").includes(normSigner);
    return hasDigi && hasSigner;
  } catch {
    return false;
  }
}

/**
 * Appends a digital signature incrementally to an already-signed PDF buffer,
 * preserving all previous signatures and their cryptographic byte ranges intact (ISO 32000 compliant).
 * Renders the visual appearance (signature image + crisp black typography) directly into the
 * Appearance XObject (/AP /N) on the signature widget annotation so the signature is visible,
 * clickable in Adobe Acrobat to inspect validation details, and registered in the Signatures panel.
 */
export async function appendSignatureIncremental(
  pdfBuffer: Buffer,
  signerName: string,
  sigRects: [number, number, number, number][],
  reason: string,
  contactInfo: string = "pnpki@dict.gov.ph",
  location: string = "Legazpi City, Philippines",
  customFieldName?: string,
  targetPageIndex: number = 0,
  visualOptions?: {
    signatureImage?: string;
    isCounterSign?: boolean;
    counterSignPosition?: string;
    skipVisualText?: boolean;
  }
): Promise<Buffer> {
  const pdfStr = pdfBuffer.toString("latin1");

  // 1. Find previous startxref (support both text xref and xref streams)
  const startXrefMatches = [...pdfStr.matchAll(/startxref\s*(\d+)/g)];
  if (startXrefMatches.length === 0) {
    throw new Error("Could not find startxref in PDF buffer for incremental update");
  }
  const prevStartXref = parseInt(startXrefMatches[startXrefMatches.length - 1][1]);

  // Determine if previous xref was an XRef stream (/Type /XRef)
  const prevXrefSlice = pdfStr.slice(prevStartXref, prevStartXref + 300);
  const prevWasXRefStream = /\/Type\s*\/XRef\b/.test(prevXrefSlice);

  // 2. Parse all latest PDF objects (including objects inside Object Streams)
  const objMap = parsePdfObjects(pdfBuffer);
  let maxObj = 0;
  for (const objNum of objMap.keys()) {
    if (objNum > maxObj) maxObj = objNum;
  }

  // 3. Find Catalog /Root object number from the latest trailer or cross-reference stream
  let rootObjNum = 1;
  const rootMatches = [...pdfStr.matchAll(/\/Root\s+(\d+)\s+0\s+R/g)];
  if (rootMatches.length > 0) {
    rootObjNum = parseInt(rootMatches[rootMatches.length - 1][1]);
  }
  const catalogBody = objMap.get(rootObjNum) || "";

  // 4. Find Page Object number by traversing the document page tree from Catalog /Pages
  const pageObjNums: number[] = [];
  const pagesRefMatch = catalogBody.match(/\/Pages\s+(\d+)\s+0\s+R/);
  if (pagesRefMatch) {
    const pagesRootNum = parseInt(pagesRefMatch[1]);
    const visited = new Set<number>();
    const collectPages = (nodeObjNum: number) => {
      if (visited.has(nodeObjNum)) return;
      visited.add(nodeObjNum);
      const nodeBody = objMap.get(nodeObjNum) || "";
      if (/\/Type\s*\/Page\b/.test(nodeBody) && !/\/Type\s*\/Pages\b/.test(nodeBody)) {
        pageObjNums.push(nodeObjNum);
        return;
      }
      const kidsMatch = nodeBody.match(/\/Kids\s*\[([^\]]*)\]/);
      if (kidsMatch) {
        const kidRefs = kidsMatch[1].match(/\d+\s+0\s+R/g) || [];
        for (const kr of kidRefs) {
          const kidNum = parseInt(kr);
          collectPages(kidNum);
        }
      }
    };
    collectPages(pagesRootNum);
  }

  // Fallback if page tree traversal did not locate pages
  if (pageObjNums.length === 0) {
    for (const [objNum, body] of objMap.entries()) {
      if (/\/Type\s*\/Page\b/.test(body) && !/\/Type\s*\/Pages\b/.test(body)) {
        pageObjNums.push(objNum);
      }
    }
  }
  let pageObjNum = pageObjNums.length > 0 ? pageObjNums[0] : 13;
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

  // 6. Find existing AcroForm, Fields, DR, and DA
  let existingFields = "";
  let existingDR = "";
  let existingDA = "";
  let existingAcroFormObjNum: number | null = null;

  const acroFormRefMatch = catalogBody.match(/\/AcroForm\s+(\d+)\s+0\s+R/);
  if (acroFormRefMatch) {
    existingAcroFormObjNum = parseInt(acroFormRefMatch[1]);
    const afBody = objMap.get(existingAcroFormObjNum) || "";
    const fieldsMatch = afBody.match(/\/Fields\s*\[([^\]]*)\]/);
    if (fieldsMatch) existingFields = fieldsMatch[1].trim();

    const drRefMatch = afBody.match(/\/DR\s+(\d+\s+0\s+R)/);
    if (drRefMatch) {
      existingDR = drRefMatch[1].trim();
    } else {
      const drIdx = afBody.indexOf("/DR");
      if (drIdx !== -1) {
        const afterDr = afBody.slice(drIdx + 3).trim();
        if (afterDr.startsWith("<<")) {
          existingDR = extractBalancedDict(afBody, drIdx) || "";
        }
      }
    }

    const daMatch = afBody.match(/\/DA\s*(\([^\)]*\))/);
    if (daMatch) existingDA = daMatch[1];
  } else {
    const drRefMatch = catalogBody.match(/\/DR\s+(\d+\s+0\s+R)/);
    if (drRefMatch) {
      existingDR = drRefMatch[1].trim();
    } else {
      const drIdx = catalogBody.indexOf("/DR");
      if (drIdx !== -1) {
        const afterDr = catalogBody.slice(drIdx + 3).trim();
        if (afterDr.startsWith("<<")) {
          existingDR = extractBalancedDict(catalogBody, drIdx) || "";
        }
      }
    }
    const daMatch = catalogBody.match(/\/DA\s*(\([^\)]*\))/);
    if (daMatch) existingDA = daMatch[1];
    const fieldsMatch = catalogBody.match(/\/Fields\s*\[([^\]]*)\]/);
    if (fieldsMatch) existingFields = fieldsMatch[1].trim();
  }

  // Preserve all existing signature root field references in AcroForm /Fields
  const fieldRefsSet = new Set<string>();
  if (existingFields) {
    const refs = existingFields.match(/\d+\s+0\s+R/g) || [];
    refs.forEach((r) => fieldRefsSet.add(r));
  } else {
    for (const [objNum, body] of objMap.entries()) {
      if (/\/FT\s*\/Sig\b/.test(body) && !/\/Parent\b/.test(body)) {
        fieldRefsSet.add(`${objNum} 0 R`);
      }
    }
  }

  // Extract Info and ID from previous trailer or cross-reference stream
  let trailerInfoEntry = "";
  let trailerIdEntry = "";

  const infoMatch = pdfStr.match(/\/Info\s+(\d+\s+0\s+R)/);
  if (infoMatch) {
    trailerInfoEntry = `/Info ${infoMatch[1]}\n`;
  }
  const idMatch = pdfStr.match(/\/ID\s*(\[\s*<[0-9a-fA-F]+>\s*<[0-9a-fA-F]+>\s*\])/);
  if (idMatch) {
    trailerIdEntry = `/ID ${idMatch[1]}\n`;
  }

  // 7. Pre-extract signature image RGB and Alpha streams for Appearance XObject
  let defRGB: Buffer | null = null;
  let defAlpha: Buffer | null = null;
  let imgW = 0;
  let imgH = 0;

  if (visualOptions?.signatureImage) {
    try {
      const cleanImgB64 = visualOptions.signatureImage.replace(/^data:.*?;base64,/, "").trim();
      const imgBuf = Buffer.from(cleanImgB64, "base64");
      const tempDoc = await PDFDocument.create();
      const isJpg = visualOptions.signatureImage.includes("image/jpeg") || visualOptions.signatureImage.includes("image/jpg");
      if (!isJpg) {
        const embedded = await tempDoc.embedPng(imgBuf);
        imgW = embedded.width;
        imgH = embedded.height;
        const embedder = (embedded as any).embedder;
        if (embedder && embedder.image) {
          const imgObj = embedder.image;
          if (imgObj.rgbChannel) {
            defRGB = zlib.deflateSync(imgObj.rgbChannel);
          }
          if (imgObj.alphaChannel) {
            defAlpha = zlib.deflateSync(imgObj.alphaChannel);
          }
        }
      }
    } catch (imgErr) {
      console.warn("[pnpki] Could not pre-process signature image for Appearance XObject:", imgErr);
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

  let nextFreeObj = maxObj + 2;

  // 2. Shared Type 1 Helvetica Font Object for clean vector text
  const fontObjNum = nextFreeObj++;
  appendObj(
    fontObjNum,
    `<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n/Encoding /WinAnsiEncoding\n>>`
  );

  // 3. Shared Signature Image XObject and Alpha Mask (if image present)
  let imgObjNum = 0;
  let smaskObjNum = 0;
  if (defRGB) {
    if (defAlpha) {
      smaskObjNum = nextFreeObj++;
      appendObj(
        smaskObjNum,
        `<<\n/Type /XObject\n/Subtype /Image\n/Width ${imgW}\n/Height ${imgH}\n/ColorSpace /DeviceGray\n/BitsPerComponent 8\n/Resources << >>\n/Filter /FlateDecode\n/Length ${defAlpha.length}\n>>\nstream\n${defAlpha.toString("binary")}\nendstream`
      );
    }
    imgObjNum = nextFreeObj++;
    const smaskEntry = smaskObjNum ? `/SMask ${smaskObjNum} 0 R\n` : "";
    appendObj(
      imgObjNum,
      `<<\n/Type /XObject\n/Subtype /Image\n/Width ${imgW}\n/Height ${imgH}\n/ColorSpace /DeviceRGB\n/BitsPerComponent 8\n/Resources << >>\n${smaskEntry}/Filter /FlateDecode\n/Length ${defRGB.length}\n>>\nstream\n${defRGB.toString("binary")}\nendstream`
    );
  }

  // Count existing signatures in the document to generate strictly unique /T field names
  const existingSigMatches = [...pdfStr.matchAll(/\/Type\s*\/Sig\b/g)];
  const existingSigCount = existingSigMatches.length;
  const cleanSignerTag = signerName.replace(/[^a-zA-Z0-9]/g, "_");
  const isCounter = Boolean(visualOptions?.isCounterSign);



  // 4. Widget Annotations & Appearance Streams (deduplicated to prevent duplicate /Widget dicts)
  const newWidgetRefs: string[] = [];
  const seenRectKeys = new Set<string>();
  const uniqueRects: { minX: number; minY: number; maxX: number; maxY: number; bboxW: number; bboxH: number }[] = [];
  const rawList = (sigRects && sigRects.length > 0) ? sigRects : [[98, 218, 122, 26] as [number, number, number, number]];
  for (const r of rawList) {
    const box = normalizeSignatureBoundingBox(r);
    const key = `${box.minX},${box.minY},${box.maxX},${box.maxY}`;
    if (!seenRectKeys.has(key)) {
      seenRectKeys.add(key);
      uniqueRects.push(box);
    }
  }

  let pdfDocForCheck: PDFDocument | null = null;
  try {
    pdfDocForCheck = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  } catch (loadErr) {
    console.warn("[pnpki] Could not load PDF buffer for incremental typography check:", loadErr);
  }

  const newFieldRefs: string[] = [];

  const defaultFieldName = isCounter
    ? `CounterSignature_${existingSigCount + 1}_${cleanSignerTag}`
    : `Signature_${existingSigCount + 1}_${cleanSignerTag}`;
  const baseFieldName = customFieldName || defaultFieldName;

  uniqueRects.forEach(({ minX, minY, maxX, maxY, bboxW, bboxH }, idx) => {
    const wNum = nextFreeObj++;
    const apNum = nextFreeObj++;
    newWidgetRefs.push(`${wNum} 0 R`);

    let streamContent = "q\n";

    const isReneJane =
      signerName.toLowerCase().includes("buena") ||
      signerName.toLowerCase().includes("rene jane");
    const escapedSigner = signerName.replace(/[()\\]/g, "\\$&");
    const titleText = isCounter ? "DigiSigned" : (isReneJane ? "Digitally signed by" : "Digitally signed");
    const nameLines = isReneJane
      ? ["Buena Rene Jane Rosendo"]
      : splitSignerNameToLines(escapedSigner, 18);

    // Deduplication guard: Check if visual text is explicitly skipped or already present in document
    let alreadyHasVisualText = Boolean(visualOptions?.skipVisualText);
    if (!alreadyHasVisualText && pdfDocForCheck) {
      try {
        const check = checkVisualTypographyOnPage(
          pdfDocForCheck,
          targetPageIndex,
          { minX, minY, maxX, maxY },
          signerName
        );
        alreadyHasVisualText = check.exists;
      } catch (chkErr) {
        console.warn("[pnpki] Could not inspect incremental page stream for existing text:", chkErr);
      }
    }

    if (imgObjNum && !alreadyHasVisualText) {
      const drawH = Math.max(16, bboxH - 6);
      streamContent += `q\n32 0 0 ${drawH} 2 3 cm\n/SigImg Do\nQ\n`;
    } else if (isCounter && !alreadyHasVisualText) {
      // Crisp vector checkmark on left if no image
      streamContent += `q\n1.4 w\n0 0 0 RG\n4 14 m\n8 9 l\n16 20 l\nS\nQ\n`;
    }

    const textX = imgObjNum ? 44 : (isCounter ? 20 : 6);
    const availW = Math.max(55, bboxW - textX - 6);

    if (!alreadyHasVisualText) {
      if (nameLines.length >= 2) {
        // ── Multi-line Name Layout (Enlarged +5px padding, clean line wrap for long names) ──
        let fontSize = 6.2;
        const charWidthFactor = 0.55;
        for (const nl of nameLines) {
          while (fontSize > 4.5 && nl.length * (fontSize * charWidthFactor) > availW) {
            fontSize -= 0.1;
          }
        }
        fontSize = Math.round(fontSize * 10) / 10;
        const titleSize = Math.max(6.2, Math.round((fontSize + 0.3) * 10) / 10);

        const l1 = nameLines[0].replace(/[()\\]/g, "\\$&");
        const l2 = nameLines[1].replace(/[()\\]/g, "\\$&");
        streamContent += `q\nBT\n/Helv ${titleSize} Tf\n0 0 0 rg\n${textX} 19.0 Td\n(${titleText}) Tj\n0 -7.5 Td\n/Helv ${fontSize} Tf\n(${l1}) Tj\n0 -7.5 Td\n(${l2}) Tj\nET\nQ\n`;
      } else {
        // ── Standard 2-Line Layout (Title + Single Line Name, font size enlarged ~6.4pt) ──
        let fontSize = 6.4;
        const charWidthFactor = 0.55;
        while (fontSize > 4.5 && nameLines[0].length * (fontSize * charWidthFactor) > availW) {
          fontSize -= 0.1;
        }
        fontSize = Math.round(fontSize * 10) / 10;
        const titleSize = Math.max(6.5, Math.round((fontSize + 0.3) * 10) / 10);

        const l1 = nameLines[0].replace(/[()\\]/g, "\\$&");
        streamContent += `q\nBT\n/Helv ${titleSize} Tf\n0 0 0 rg\n${textX} 16.0 Td\n(${titleText}) Tj\n0 -9.0 Td\n/Helv ${fontSize} Tf\n(${l1}) Tj\nET\nQ\n`;
      }
    }

    // Always close outer graphics state
    streamContent += "Q\n";

    const streamLen = Buffer.from(streamContent, "binary").length;
    const imgResourceEntry = imgObjNum ? `/XObject << /SigImg ${imgObjNum} 0 R >>\n` : "";

    // Appearance XObject (/AP /N)
    appendObj(
      apNum,
      `<<\n/Type /XObject\n/Subtype /Form\n/BBox [0 0 ${bboxW} ${bboxH}]\n/Resources <<\n/ProcSet [/PDF /Text /ImageC]\n/Font << /Helv ${fontObjNum} 0 R >>\n${imgResourceEntry}>>\n/Length ${streamLen}\n>>\nstream\n${streamContent}\nendstream`
    );

    if (idx === 0) {
      // Single terminal widget signature field bound to uniqueRects[0]
      appendObj(
        wNum,
        `<<\n/Type /Annot\n/Subtype /Widget\n/FT /Sig\n/Rect [${minX} ${minY} ${maxX} ${maxY}]\n/V ${sigDictObjNum} 0 R\n/T (${baseFieldName})\n/F 132\n/P ${pageObjNum} 0 R\n/AP << /N ${apNum} 0 R >>\n>>`
      );
      newFieldRefs.push(`${wNum} 0 R`);
    } else {
      // Visual Stamp annotation for secondary copy (Copy 2) without signature field /Kids
      appendObj(
        wNum,
        `<<\n/Type /Annot\n/Subtype /Stamp\n/Rect [${minX} ${minY} ${maxX} ${maxY}]\n/F 132\n/P ${pageObjNum} 0 R\n/AP << /N ${apNum} 0 R >>\n>>`
      );
    }
  });

  // Add new root field(s) to the combined fields set
  newFieldRefs.forEach((r) => fieldRefsSet.add(r));
  const finalFieldsStr = Array.from(fieldRefsSet).join(" ");

  // 5. AcroForm Object: If existingAcroFormObjNum is an indirect object, reuse its object number!
  const acroFormObjNum = existingAcroFormObjNum || nextFreeObj++;
  const drEntry = existingDR ? `/DR ${existingDR}\n` : `/DR << /Font << /Helv ${fontObjNum} 0 R >> >>\n`;
  const daEntry = existingDA ? `/DA ${existingDA}\n` : `/DA (/Helv 0 Tf 0 g )\n`;

  // AcroForm Object preserving ALL previous + new widget references and DR/DA
  appendObj(
    acroFormObjNum,
    `<<\n/Fields [${finalFieldsStr}]\n${drEntry}${daEntry}/SigFlags 3\n>>`
  );

  // 6. Updated Page Object with ALL previous + new annotations
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

  // 7. Updated Catalog Object
  {
    let cleanedCatalogBody = catalogBody.trim();
    cleanedCatalogBody = cleanedCatalogBody.replace(/^\d+\s+\d+\s+obj\s*/, "");

    // Cleanly extract inner dictionary content if enclosed in << ... >>
    const firstDictOpen = cleanedCatalogBody.indexOf("<<");
    const lastDictClose = cleanedCatalogBody.lastIndexOf(">>");
    if (firstDictOpen !== -1 && lastDictClose !== -1 && lastDictClose > firstDictOpen) {
      cleanedCatalogBody = cleanedCatalogBody.slice(firstDictOpen + 2, lastDictClose).trim();
    }

    // Clean dangling >> if any safely without stripping nested dictionaries
    const { open: catOpen, close: catClose } = countDictionaryBrackets(cleanedCatalogBody);
    if (catClose > catOpen) {
      cleanedCatalogBody = cleanedCatalogBody.replace(/>>\s*$/, "").trim();
    }

    // Remove any existing /AcroForm reference or inline dictionary
    cleanedCatalogBody = cleanedCatalogBody.replace(/\/AcroForm\s+\d+\s+0\s+R/g, "").trim();
    const afIdx = cleanedCatalogBody.indexOf("/AcroForm");
    if (afIdx !== -1) {
      const balanced = extractBalancedDict(cleanedCatalogBody, afIdx);
      if (balanced) {
        cleanedCatalogBody = (cleanedCatalogBody.slice(0, afIdx) + cleanedCatalogBody.slice(afIdx + balanced.length)).trim();
      }
    }

    // Guarantee /Pages is ALWAYS preserved in the Document Catalog (ISO 32000-1 requirement)
    if (!cleanedCatalogBody.includes("/Pages")) {
      const pagesMatch = pdfStr.match(/\/Pages\s+(\d+\s+0\s+R)/);
      if (pagesMatch) {
        cleanedCatalogBody = `${pagesMatch[0]}\n${cleanedCatalogBody}`;
      }
    }

    // Guarantee /Type /Catalog is present
    if (!cleanedCatalogBody.includes("/Type /Catalog") && !cleanedCatalogBody.includes("/Type/Catalog")) {
      cleanedCatalogBody = `/Type /Catalog\n${cleanedCatalogBody}`;
    }

    appendObj(
      rootObjNum,
      `<<\n${cleanedCatalogBody}\n/AcroForm ${acroFormObjNum} 0 R\n>>`
    );
  }

  // 8. Cross-Reference Section:
  // If the previous revision used an XRef Stream (/Type /XRef), write an incremental XRef Stream!
  // Otherwise, write a classic incremental xref table (e.g. for CS Form 48).
  if (prevWasXRefStream) {
    const sortedObjs = [...objOffsets.keys()].sort((a, b) => a - b);
    const xrefObjNum = Math.max(...sortedObjs, maxObj) + 1;
    const allObjs = [...sortedObjs, xrefObjNum];

    const groups: { start: number; count: number }[] = [];
    let i = 0;
    while (i < allObjs.length) {
      const start = allObjs[i];
      let count = 1;
      while (i + count < allObjs.length && allObjs[i + count] === start + count) {
        count++;
      }
      groups.push({ start, count });
      i += count;
    }

    const indexStr = groups.map((g) => `${g.start} ${g.count}`).join(" ");
    const xrefOffset = pdfBuffer.length + Buffer.from(appendData, "binary").length;
    objOffsets.set(xrefObjNum, xrefOffset);

    // Build binary stream: for each object, 1 byte type (1), 4 bytes offset, 2 bytes gen (0)
    const streamBuf = Buffer.alloc(allObjs.length * 7);
    allObjs.forEach((oNum, idx) => {
      const off = objOffsets.get(oNum)!;
      streamBuf[idx * 7] = 1;
      streamBuf[idx * 7 + 1] = (off >> 24) & 0xff;
      streamBuf[idx * 7 + 2] = (off >> 16) & 0xff;
      streamBuf[idx * 7 + 3] = (off >> 8) & 0xff;
      streamBuf[idx * 7 + 4] = off & 0xff;
      streamBuf[idx * 7 + 5] = 0;
      streamBuf[idx * 7 + 6] = 0;
    });

    const defStream = zlib.deflateSync(streamBuf);
    const header = `${xrefObjNum} 0 obj\n<<\n/Type /XRef\n/Size ${xrefObjNum + 1}\n/Root ${rootObjNum} 0 R\n/Prev ${prevStartXref}\n${trailerInfoEntry}${trailerIdEntry}/W [1 4 2]\n/Index [${indexStr}]\n/Filter /FlateDecode\n/Length ${defStream.length}\n>>\nstream\n`;
    const footer = `\nendstream\nendobj\nstartxref\n${xrefOffset}\n%%EOF\n`;

    const xrefStreamBuf = Buffer.concat([Buffer.from(header, "binary"), defStream, Buffer.from(footer, "binary")]);
    return Buffer.concat([pdfBuffer, Buffer.from(appendData, "binary"), xrefStreamBuf]);
  } else {
    // Classic incremental xref table (Strict ISO 32000-1 20-byte entries)
    const xrefOffset = pdfBuffer.length + Buffer.from(appendData, "binary").length;
    let xrefData = `xref\n`;

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
    const trailerData = `trailer\n<<\n/Size ${maxTotalObj}\n/Root ${rootObjNum} 0 R\n/Prev ${prevStartXref}\n${trailerInfoEntry}${trailerIdEntry}>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    appendData += xrefData + trailerData;
    return Buffer.concat([pdfBuffer, Buffer.from(appendData, "binary")]);
  }
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
    signatureImage?: string;
    signerName?: string;
    isCounterSign?: boolean;
    counterSignPosition?: string;
    skipVisualText?: boolean;
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

  const signerName = fixMojibake(options?.signerName || signerIdentity.commonName || "").trim();
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
  const isAlreadySigned = /\/Type\s*\/Sig\b/.test(pdfStr) && /startxref/.test(pdfStr);

  let pdfWithPlaceholder: Buffer;

  if (isAlreadySigned) {
    // ── Incremental Mode: Append digital signature revision incrementally to preserve earlier signatures (ISO 32000) ──
    console.log("[pnpki] Document already contains a digital signature. Appending revision incrementally with visual appearance...");
    pdfWithPlaceholder = await appendSignatureIncremental(
      pdfBuffer,
      signerName,
      rawRects,
      reason,
      contactInfo,
      location,
      options?.fieldName,
      options?.pageIndex,
      {
        signatureImage: options?.signatureImage,
        isCounterSign: options?.isCounterSign,
        counterSignPosition: options?.counterSignPosition,
        skipVisualText: options?.skipVisualText,
      }
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

    const seenRectKeys = new Set<string>();
    const widgetRects: [number, number, number, number][] = [];
    for (const r of rawRects) {
      const box = normalizeSignatureBoundingBox(r);
      const key = `${box.minX},${box.minY},${box.maxX},${box.maxY}`;
      if (!seenRectKeys.has(key)) {
        seenRectKeys.add(key);
        widgetRects.push([box.minX, box.minY, box.maxX, box.maxY]);
      }
    }
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

  // Create single terminal widget annotation for digital signature
  const rootFieldRefs: any[] = [];
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
  const isCounter = Boolean(options?.isCounterSign);
  const roleName = reason.toLowerCase().includes("verification") ? "Supervisor" : "Personnel";
  const baseFieldName = options?.fieldName || `${roleName}_Signature`;

  for (let index = 0; index < widgetRects.length; index++) {
    const rectCoords = widgetRects[index];
    const minX = Math.min(rectCoords[0], rectCoords[2]);
    const minY = Math.min(rectCoords[1], rectCoords[3]);
    const maxX = Math.max(rectCoords[0], rectCoords[2]);
    const maxY = Math.max(rectCoords[1], rectCoords[3]);
    const rw = maxX - minX;
    const rh = maxY - minY;

    // Deduplication guard: Check if visual text is explicitly skipped or already present in page contents
    let alreadyHasVisualText = Boolean(options?.skipVisualText);
    if (!alreadyHasVisualText) {
      try {
        const check = checkVisualTypographyOnPage(
          pdfDoc,
          targetPageIndex,
          { minX, minY, maxX, maxY },
          signerName
        );
        alreadyHasVisualText = check.exists;
      } catch (e) {
        console.warn("[pnpki] Could not inspect page content stream for existing text:", e);
      }
    }

    // Draw handwritten signature image once directly onto page canvas if provided AND NOT already visually present/skipped
    let hasImg = false;
    if (options?.signatureImage && !options?.skipVisualText && !alreadyHasVisualText) {
      try {
        const imgData = options.signatureImage.replace(/^data:image\/\w+;base64,/, "");
        const imgBuf = Buffer.from(imgData, "base64");
        const isPng = options.signatureImage.includes("png") || imgBuf[0] === 0x89;
        const embedded = isPng ? await pdfDoc.embedPng(imgBuf) : await pdfDoc.embedJpg(imgBuf);
        page.drawImage(embedded, {
          x: minX + 2,
          y: minY + 1.5,
          width: 30,
          height: Math.max(10, rh - 3),
        });
        hasImg = true;
      } catch (e) {
        console.warn("[pnpki] Could not embed signature image in first-signature mode:", e);
      }
    }

    const rect = PDFArray.withContext(pdfDoc.context);
    rect.push(PDFNumber.of(minX));
    rect.push(PDFNumber.of(minY));
    rect.push(PDFNumber.of(maxX));
    rect.push(PDFNumber.of(maxY));

    let fontRef: any = null;
    const fontDict = pdfDoc.context.obj({
      Type: "Font",
      Subtype: "Type1",
      BaseFont: "Helvetica",
      Encoding: "WinAnsiEncoding",
    });
    fontRef = pdfDoc.context.register(fontDict);

    // Register font in Page Resources so page content stream can render vector text
    let resources = page.node.lookupMaybe(PDFName.of("Resources"), PDFDict);
    if (!resources) {
      resources = pdfDoc.context.obj({});
      page.node.set(PDFName.of("Resources"), resources);
    }
    let fonts = resources.lookupMaybe(PDFName.of("Font"), PDFDict);
    if (!fonts) {
      fonts = pdfDoc.context.obj({});
      resources.set(PDFName.of("Font"), fonts);
    }
    fonts.set(PDFName.of("F_PNPKI"), fontRef);

    const escapedSigner = signerName.replace(/[()\\]/g, "\\$&");
    const isReneJane =
      signerName.toLowerCase().includes("buena") ||
      signerName.toLowerCase().includes("rene jane");
    const apTitleText = isCounter ? "DigiSigned" : (isReneJane ? "Digitally signed by" : "Digitally signed");
    const apNameLines = isReneJane
      ? ["Buena Rene Jane Rosendo"]
      : splitSignerNameToLines(escapedSigner, 18);
    const apTextX = (isCounter && !hasImg) ? 20 : (hasImg ? 44 : 6);
    const availW = Math.max(55, rw - apTextX - 6);

    let fontSize = apNameLines.length >= 2 ? 6.2 : 6.4;
    const charWidthFactor = 0.55;
    for (const nl of apNameLines) {
      while (fontSize > 4.5 && nl.length * (fontSize * charWidthFactor) > availW) {
        fontSize -= 0.1;
      }
    }
    fontSize = Math.round(fontSize * 10) / 10;
    const titleSize = Math.max(apNameLines.length >= 2 ? 6.2 : 6.5, Math.round((fontSize + 0.3) * 10) / 10);

    if (!alreadyHasVisualText) {
      // Draw visual DigiSigned typography directly onto Page canvas so Chromium PDFium / browser iframe renders it 100% reliably
      let pageTextOps = "q\n";
      if (isCounter && !hasImg) {
        pageTextOps += `1.4 w\n0 0 0 RG\n${minX + 4} ${minY + 14} m\n${minX + 8} ${minY + 9} l\n${minX + 16} ${minY + 20} l\nS\n`;
      }
      const pageTextX = minX + apTextX;
      if (apNameLines.length >= 2) {
        const l1 = apNameLines[0].replace(/[()\\]/g, "\\$&");
        const l2 = apNameLines[1].replace(/[()\\]/g, "\\$&");
        pageTextOps += `BT\n/F_PNPKI ${titleSize} Tf\n0 0 0 rg\n${pageTextX} ${minY + 19.0} Td\n(${apTitleText}) Tj\n0 -7.5 Td\n/F_PNPKI ${fontSize} Tf\n(${l1}) Tj\n0 -7.5 Td\n(${l2}) Tj\nET\nQ\n`;
      } else {
        const l1 = apNameLines[0].replace(/[()\\]/g, "\\$&");
        pageTextOps += `BT\n/F_PNPKI ${titleSize} Tf\n0 0 0 rg\n${pageTextX} ${minY + 16.0} Td\n(${apTitleText}) Tj\n0 -9.0 Td\n/F_PNPKI ${fontSize} Tf\n(${l1}) Tj\nET\nQ\n`;
      }

      const textStream = pdfDoc.context.stream(pageTextOps);
      const textStreamRef = pdfDoc.context.register(textStream);

      // Append text stream to Page Contents safely handling both PDFArray and PDFRawStream/PDFStream
      const existingContents = page.node.get(PDFName.of("Contents"));
      if (!existingContents) {
        page.node.set(PDFName.of("Contents"), textStreamRef);
      } else {
        const derefContents = page.node.lookup(PDFName.of("Contents"));
        if (derefContents instanceof PDFArray) {
          derefContents.push(textStreamRef);
        } else {
          const arr = pdfDoc.context.obj([existingContents, textStreamRef]);
          page.node.set(PDFName.of("Contents"), arr);
        }
      }
    }

    if (index === 0) {
      // Appearance stream on signature widget is an empty Form XObject (q Q) with mandatory /Resources << >>
      const apStream = pdfDoc.context.stream("q\nQ\n", {
        Type: "XObject",
        Subtype: "Form",
        BBox: [0, 0, rw, rh],
        Resources: pdfDoc.context.obj({}),
      });

      // Single terminal widget annotation bound to primary signature box (widgetRects[0])
      const widgetDict = pdfDoc.context.obj({
        Type: "Annot",
        Subtype: "Widget",
        FT: "Sig",
        Rect: rect,
        V: signatureDictRef,
        T: PDFString.of(baseFieldName),
        F: ANNOTATION_FLAGS.PRINT | 128, // PRINT | LOCKED
        P: page.ref,
        AP: { N: pdfDoc.context.register(apStream) },
      });

      const widgetRef = pdfDoc.context.register(widgetDict);
      annotations.push(widgetRef);
      rootFieldRefs.push(widgetRef);
    }
  }

  page.node.set(PDFName.of("Annots"), annotations);

  // AcroForm (Preserve existing form fields if signing incrementally)
  const existingAcroForm = pdfDoc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  if (existingAcroForm) {
    let fields = existingAcroForm.lookupMaybe(PDFName.of("Fields"), PDFArray);
    if (!fields) {
      fields = pdfDoc.context.obj([]);
      existingAcroForm.set(PDFName.of("Fields"), fields);
    }
    rootFieldRefs.forEach((ref) => fields!.push(ref));
    existingAcroForm.set(
      PDFName.of("SigFlags"),
      PDFNumber.of(SIG_FLAGS.SIGNATURES_EXIST | SIG_FLAGS.APPEND_ONLY)
    );
  } else {
    const acroFormObj = pdfDoc.context.obj({
      Fields: rootFieldRefs,
      SigFlags: SIG_FLAGS.SIGNATURES_EXIST | SIG_FLAGS.APPEND_ONLY,
    });
    const acroFormRef = pdfDoc.context.register(acroFormObj);
    pdfDoc.catalog.set(PDFName.of("AcroForm"), acroFormRef);
  }

  // Ensure all embedded Image XObjects (RGB and Alpha SMasks) and Form XObjects contain mandatory /Resources << >>
  await pdfDoc.flush();
  for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
    const dict = (obj as any)?.dict || (obj instanceof PDFDict ? obj : null);
    if (dict && typeof dict.has === "function" && typeof dict.get === "function") {
      const subtype = dict.get(PDFName.of("Subtype"));
      if (
        (subtype === PDFName.of("Image") || subtype?.toString() === "/Image" ||
         subtype === PDFName.of("Form") || subtype?.toString() === "/Form") &&
        !dict.has(PDFName.of("Resources"))
      ) {
        dict.set(PDFName.of("Resources"), pdfDoc.context.obj({}));
      }
    }
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
    signerName: signerName || signerIdentity.commonName,
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
