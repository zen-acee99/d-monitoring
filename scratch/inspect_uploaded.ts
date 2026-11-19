import fs from 'fs';
import { safeLoadPdfDocument } from '../src/utils/dtrVectorPdf';
import { PDFName, PDFArray, PDFDict, PDFNumber } from 'pdf-lib';

async function check() {
  const buf = fs.readFileSync('C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794462315678_2f794efa.pdf');
  const doc = await safeLoadPdfDocument(buf);
  console.log('Pages:', doc.getPageCount());
  const page = doc.getPages()[0];
  const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  console.log('Annots count:', annots ? annots.size() : 0);
  if (annots) {
    for (let i = 0; i < annots.size(); i++) {
      const a = doc.context.lookup(annots.get(i), PDFDict);
      const subtype = a.lookupMaybe(PDFName.of('Subtype'), PDFName)?.asString();
      const ft = a.lookupMaybe(PDFName.of('FT'), PDFName)?.asString();
      const rect = a.lookupMaybe(PDFName.of('Rect'), PDFArray);
      let rVals: any = null;
      if (rect) {
        rVals = [
          (rect.get(0) as PDFNumber).asNumber(),
          (rect.get(1) as PDFNumber).asNumber(),
          (rect.get(2) as PDFNumber).asNumber(),
          (rect.get(3) as PDFNumber).asNumber(),
        ];
      }
      console.log(`Annot ${i}: subtype=${subtype}, ft=${ft}, rect=`, rVals);
    }
  }
}
check().catch(console.error);
