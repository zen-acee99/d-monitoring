import fs from 'fs';
import { safeLoadPdfDocument } from '../src/utils/dtrVectorPdf';

async function main() {
  const filePath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794462315678_2f794efa.pdf';
  const buf = fs.readFileSync(filePath);
  const pdfDoc = await safeLoadPdfDocument(buf);
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  console.log('Form fields count:', fields.length);
  for (const f of fields) {
    console.log('Field:', f.getName(), f.constructor.name);
  }
}
main().catch(console.error);
