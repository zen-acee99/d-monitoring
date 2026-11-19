import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { findPersonnelSignatureCoordinates } from '../src/utils/dtrVectorPdf.js';

async function test() {
  const bytes = fs.readFileSync('./scratch/test_memo_138.pdf');
  const pdfDoc = await PDFDocument.load(bytes);
  const coords = findPersonnelSignatureCoordinates(pdfDoc, 'ANNABEL C. ODOÑO-CALIMPONG');
  console.log("Coords for ANNABEL C. ODOÑO-CALIMPONG:", coords);

  const coordsMelad = findPersonnelSignatureCoordinates(pdfDoc, 'CHRISTIAN ROY N. MELAD');
  console.log("Coords for CHRISTIAN ROY N. MELAD:", coordsMelad);
}

test().catch(console.error);
