import { safeLoadPdfDocument, findPersonnelSignatureCoordinates } from '../src/utils/dtrVectorPdf';
import fs from 'fs';

async function main() {
  const bytes = fs.readFileSync('scratch/cert_test.pdf');
  const doc = await safeLoadPdfDocument(bytes);
  
  const testNames = [
    "DIR. ANNABEL C. ODOÑO-CALIMPONG",
    "ANNABEL C. ODOÑO-CALIMPONG",
    "Annabel",
    "Annabel Cortez Odoño-Calimpong",
    "ACE MATA MALTO",
    "ACEMATA MALTO"
  ];
  
  for (const name of testNames) {
    const loc = findPersonnelSignatureCoordinates(doc, name);
    console.log(`Target: "${name}" => Page: ${loc.pageIndex + 1}, box: [${loc.boxX}, ${loc.boxY}, ${loc.boxW}, ${loc.boxH}], reason: ${loc.detectedReason}`);
  }
}
main().catch(console.error);
