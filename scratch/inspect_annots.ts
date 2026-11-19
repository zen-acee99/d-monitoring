import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

async function main() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794696272616_577d24d5.pdf';
  const bytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPage(0);
  const annots = page.node.Annots();
  console.log('Annots count on P1:', annots ? annots.size() : 0);
  if (annots) {
    for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i);
      console.log('Annot:', a?.toString());
    }
  }
}
main().catch(console.error);
