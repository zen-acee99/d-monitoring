import fs from 'fs';
import { PDFDocument, PDFName, PDFArray, decodePDFRawStream } from 'pdf-lib';

async function checkAnnots() {
  const bytes = fs.readFileSync('c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15) (1).pdf');
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPage(0);
  const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (!annots) {
    console.log('No annotations');
    return;
  }
  console.log(`Found ${annots.size()} annotations:`);
  for (let i = 0; i < annots.size(); i++) {
    const annotRef = annots.get(i);
    const annotDict: any = pdfDoc.context.lookup(annotRef);
    const subtype = annotDict.get(PDFName.of('Subtype'))?.toString();
    const t = annotDict.get(PDFName.of('T'))?.toString();
    const rect = annotDict.get(PDFName.of('Rect'))?.toString();
    console.log(`\nAnnot ${i}: Subtype=${subtype}, T=${t}, Rect=${rect}`);

    const ap = annotDict.get(PDFName.of('AP'));
    if (ap) {
      const apDict: any = pdfDoc.context.lookup(ap);
      const n = apDict?.get?.(PDFName.of('N'));
      if (n) {
        const nObj: any = pdfDoc.context.lookup(n);
        let dec = '';
        try {
          const decoded = decodePDFRawStream(nObj).decode();
          dec = Buffer.from(decoded).toString('latin1');
        } catch (e: any) {
          dec = `Error decoding: ${e.message}`;
        }
        console.log(`  /AP /N (len ${dec.length}):`);
        console.log(`  ${dec.trim().replace(/\n/g, ' ')}`);
      }
    }
  }
}
checkAnnots().catch(console.error);
