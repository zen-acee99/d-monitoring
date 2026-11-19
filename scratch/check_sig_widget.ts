import fs from 'fs';
import { safeLoadPdfDocument } from '../src/utils/dtrVectorPdf';
import { PDFName } from 'pdf-lib';

async function main() {
  const filePath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794462315678_2f794efa.pdf';
  const buf = fs.readFileSync(filePath);
  const pdfDoc = await safeLoadPdfDocument(buf);
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  for (const f of fields) {
    const widgets = f.acroField.getWidgets();
    for (const w of widgets) {
      const rect = w.getRectangle();
      console.log(`Widget rect: x=${rect.x}, y=${rect.y}, w=${rect.width}, h=${rect.height}`);
    }
  }
}
main().catch(console.error);
