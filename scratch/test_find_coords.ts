import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { findPersonnelSignatureCoordinates } from '../src/utils/dtrVectorPdf';

async function main() {
  const bytes = fs.readFileSync('scratch/masareta_from_db.pdf');
  const doc = await PDFDocument.load(bytes);
  const coords = await findPersonnelSignatureCoordinates(doc, "ANNABEL C. ODOÑO-CALIMPONG");
  console.log('Coordinates result:', JSON.stringify(coords, null, 2));
}

main().catch(console.error);
