import fs from 'fs';
import { repairPdfCatalogIfCorrupted } from '../src/utils/dtrVectorPdf.js';
import { PDFDocument } from 'pdf-lib';

const bytes = fs.readFileSync('./scratch/test_pov.pdf');
const str = new TextDecoder("latin1").decode(bytes);

const rootMatches = [...str.matchAll(/\/Root\s+(\d+)\s+0\s+R/g)];
console.log("Root matches:", rootMatches.map(m => m[0]));

const pagesMatches = [...str.matchAll(/\/Pages\s+(\d+\s+0\s+R)/g)];
console.log("Pages matches:", pagesMatches.map(m => m[0]));

// Let's find all occurrences of Root obj
for (const m of rootMatches) {
  const rootObjNum = m[1];
  const lastRootHeader = `${rootObjNum} 0 obj`;
  let idx = 0;
  while ((idx = str.indexOf(lastRootHeader, idx)) !== -1) {
    const end = str.indexOf("endobj", idx);
    console.log(`Found ${lastRootHeader} at ${idx}:`, str.slice(idx, end + 6));
    idx = end + 6;
  }
}
