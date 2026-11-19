import fs from 'fs';
import { safeLoadPdfDocument } from '../src/utils/dtrVectorPdf';
import { PDFName, PDFDict, PDFRawStream } from 'pdf-lib';

async function main() {
  const buf = fs.readFileSync('scratch/cert_test.pdf');
  const pdfDoc = await safeLoadPdfDocument(buf);
  const page = pdfDoc.getPages()[0];
  const resources = page.node.Resources();
  console.log('Resources exists:', Boolean(resources));
  const xObject = resources.lookupMaybe(PDFName.of("XObject"), PDFDict);
  console.log('xObject exists:', Boolean(xObject));
  if (xObject) {
    const keys = xObject.keys();
    console.log('Keys:', keys.map(k => k.asString()));
    for (const key of keys) {
      const ref = xObject.get(key);
      const stream = pdfDoc.context.lookup(ref);
      console.log('Key:', key.asString(), 'stream type:', stream?.constructor?.name);
      if (stream instanceof PDFRawStream) {
        const dict = stream.dict;
        console.log('Subtype:', dict.lookup(PDFName.of("Subtype"))?.toString());
        console.log('Width:', dict.lookup(PDFName.of("Width"))?.toString());
        console.log('Height:', dict.lookup(PDFName.of("Height"))?.toString());
        console.log('Filter:', dict.lookup(PDFName.of("Filter"))?.toString());
      }
    }
  }
}
main().catch(console.error);
