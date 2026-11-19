import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

async function main() {
  const bytes = fs.readFileSync('scratch/masareta_from_db.pdf');
  const doc = await PDFDocument.load(bytes);
  const p = doc.getPages()[1];
  console.log('Page 2 mediaBox:', p.getMediaBox());
  console.log('Page 2 cropBox:', p.getCropBox());
  console.log('Page 2 rotation:', p.getRotation());
  console.log('Page 2 size:', p.getSize());
}

main().catch(console.error);
