import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import {
  extractPageContentStreamBytes,
  loadPageFontCMaps,
  extractTextItemsFromContentStream,
  scanPdfForSigners
} from '../src/utils/dtrVectorPdf.js';
import { DEFAULT_USERS } from '../src/data/userStore.js';

function uint8ArrayToBinaryString(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let s = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)) as any);
  }
  return s;
}

function binaryStringToUint8Array(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function safeRepairCatalog(buf: Uint8Array): Uint8Array {
  const bytes = buf;
  const str = uint8ArrayToBinaryString(bytes);

  const pagesMatch = str.match(/\/Pages\s+(\d+\s+0\s+R)/);
  if (!pagesMatch) return bytes;
  const pagesRef = pagesMatch[1];

  const rootMatches = [...str.matchAll(/\/Root\s+(\d+)\s+0\s+R/g)];
  if (rootMatches.length === 0) return bytes;
  const rootObjNum = rootMatches[rootMatches.length - 1][1];

  const lastRootHeader = `${rootObjNum} 0 obj`;
  const lastRootIdx = str.lastIndexOf(lastRootHeader);
  if (lastRootIdx === -1) return bytes;

  const endobjIdx = str.indexOf("endobj", lastRootIdx);
  if (endobjIdx === -1) return bytes;

  const rootBody = str.slice(lastRootIdx, endobjIdx);
  let needsFix = false;
  let cleanedBody = rootBody;

  if (cleanedBody.includes(">>>")) {
    cleanedBody = cleanedBody.replace(/>{3,}/g, ">>");
    needsFix = true;
  }

  if (!cleanedBody.includes("/Pages")) {
    cleanedBody = cleanedBody.replace(/<<\s*/, `<<\n/Pages ${pagesRef}\n`);
    needsFix = true;
  }

  if (needsFix) {
    const fixedStr = str.slice(0, lastRootIdx) + cleanedBody + str.slice(endobjIdx);
    return binaryStringToUint8Array(fixedStr);
  }

  return bytes;
}

async function test() {
  const bytes = fs.readFileSync('./scratch/test_pov.pdf');
  const repaired = safeRepairCatalog(bytes);

  const pdfDoc = await PDFDocument.load(repaired);
  const page = pdfDoc.getPages()[0];
  console.log("Page size:", page.getSize());

  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  console.log("Extracted content stream bytes:", sBytes.length);

  const freshUsers = DEFAULT_USERS.map(u => ({ name: u.name, role: u.role, email: u.email }));
  const scan = await scanPdfForSigners(repaired, freshUsers);
  console.log("Scan result signers:", scan.signers);
  console.log("Scan result requiredSigners:", scan.requiredSigners);
  console.log("Existing signatures:", scan.existingSignatures);
}

test().catch(console.error);
