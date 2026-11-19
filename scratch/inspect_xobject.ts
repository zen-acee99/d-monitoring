import { safeLoadPdfDocument } from '../src/utils/dtrVectorPdf';
import fs from 'fs';
import { PDFName, PDFDict } from 'pdf-lib';

(async () => {
  const bytes = fs.readFileSync('scratch/cert_test.pdf');
  const pdfDoc = await safeLoadPdfDocument(bytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  console.log('Page:', width, height);

  // Check XObjects (images)
  const res = page.node.lookupMaybe(PDFName.of('Resources'), PDFDict);
  const xobj = res?.lookupMaybe(PDFName.of('XObject'), PDFDict);
  if (xobj) {
    const keys = xobj.keys();
    console.log('XObjects:', keys.map(k => k.asString()));
  }
})();
