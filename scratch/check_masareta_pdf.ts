import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { detectExistingPdfSignatures } from '../src/utils/dtrVectorPdf';

async function main() {
  const bytes = fs.readFileSync('scratch/masareta_from_db.pdf');
  const doc = await PDFDocument.load(bytes);
  console.log('Pages:', doc.getPageCount());
  const sigs = detectExistingPdfSignatures(doc);
  console.log('Detected signatures in masareta_from_db.pdf:', JSON.stringify(sigs, null, 2));

  // Check AcroForm fields
  const form = doc.getForm();
  const fields = form.getFields();
  console.log('AcroForm field names:', fields.map(f => f.getName()));
  for (const field of fields) {
    const widgets = field.acroField.getWidgets();
    widgets.forEach((w, idx) => {
      console.log(`Field ${field.getName()}[${idx}] rect:`, w.getRectangle());
    });
  }
}

main().catch(console.error);
