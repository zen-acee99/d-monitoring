import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1792147510144_81aae404.pdf';
const buf = fs.readFileSync(pdfPath);
const doc = await PDFDocument.load(buf);
const page = doc.getPages()[0];
console.log('Page size:', page.getWidth(), 'x', page.getHeight());

const node = page.node;
const annots = node.Annots();
console.log('Annots count:', annots ? annots.size() : 0);
if (annots) {
  for (let i = 0; i < annots.size(); i++) {
    const a = doc.context.lookup(annots.get(i));
    console.log('Annot', i, a.toString());
  }
}
