import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

/**
 * Repairs a PDF buffer if its latest Document Catalog object is missing /Pages
 * or has malformed dictionary syntax.
 */
export function repairPdfCatalogIfCorrupted(buf: Uint8Array | Buffer): Uint8Array {
  const str = Buffer.from(buf).toString('latin1');
  
  // Find where /Pages <ref> was in the original PDF
  const pagesMatch = str.match(/\/Pages\s+(\d+\s+0\s+R)/);
  if (!pagesMatch) return buf instanceof Uint8Array ? buf : new Uint8Array(buf);

  const pagesRef = pagesMatch[1]; // e.g. "16 0 R"

  // Find root object number
  const rootMatches = [...str.matchAll(/\/Root\s+(\d+)\s+0\s+R/g)];
  if (rootMatches.length === 0) return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const rootObjNum = rootMatches[rootMatches.length - 1][1];

  // Find the LAST occurrence of `<rootObjNum> 0 obj`
  const lastRootHeader = `${rootObjNum} 0 obj`;
  const lastRootIdx = str.lastIndexOf(lastRootHeader);
  if (lastRootIdx === -1) return buf instanceof Uint8Array ? buf : new Uint8Array(buf);

  const endobjIdx = str.indexOf("endobj", lastRootIdx);
  if (endobjIdx === -1) return buf instanceof Uint8Array ? buf : new Uint8Array(buf);

  const rootBody = str.slice(lastRootIdx, endobjIdx);

  // If the latest root catalog object does NOT have /Pages:
  if (!rootBody.includes("/Pages")) {
    console.log(`[repair] Detected Catalog ${rootObjNum} missing /Pages! Injecting /Pages ${pagesRef}...`);
    // Also clean any dangling >> before injecting
    let cleanedBody = rootBody.replace(/>{3,}/g, ">>");
    cleanedBody = cleanedBody.replace(/<<\s*/, `<<\n/Pages ${pagesRef}\n`);
    const fixedStr = str.slice(0, lastRootIdx) + cleanedBody + str.slice(endobjIdx);
    return new Uint8Array(Buffer.from(fixedStr, 'latin1'));
  }

  // Also clean any dangling >>>>>> in root catalog if present
  if (rootBody.includes(">>>")) {
    console.log(`[repair] Detected dangling >>> in Catalog ${rootObjNum}! Cleaning...`);
    const cleanedBody = rootBody.replace(/>{3,}/g, ">>");
    const fixedStr = str.slice(0, lastRootIdx) + cleanedBody + str.slice(endobjIdx);
    return new Uint8Array(Buffer.from(fixedStr, 'latin1'));
  }

  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

async function test() {
  const buf = fs.readFileSync('scratch/test_pov.pdf');
  const repaired = repairPdfCatalogIfCorrupted(buf);
  const doc = await PDFDocument.load(repaired, { ignoreEncryption: true });
  console.log("Repaired test_pov.pdf pages:", doc.getPageCount());
  for (let p = 0; p < doc.getPageCount(); p++) {
    console.log(`Page ${p + 1}: ${doc.getPage(p).getWidth()} x ${doc.getPage(p).getHeight()}`);
  }
}

test();
