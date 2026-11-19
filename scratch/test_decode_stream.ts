import fs from 'fs';
import { safeLoadPdfDocument } from '../src/utils/dtrVectorPdf';
import { PDFName, decodePDFRawStream, PDFRawStream } from 'pdf-lib';

async function main() {
  const buf = fs.readFileSync('scratch/cert_test.pdf');
  const pdfDoc = await safeLoadPdfDocument(buf);
  const page = pdfDoc.getPages()[0];
  const resources = page.node.Resources();
  const xObject = resources?.lookup(PDFName.of('XObject'));
  const imgRef = (xObject as any).get(PDFName.of('Image5'));
  const stream = pdfDoc.context.lookup(imgRef);
  if (stream instanceof PDFRawStream) {
    try {
      const decodedStream = decodePDFRawStream(stream);
      const contents = decodedStream.contents;
      console.log('decodePDFRawStream success! type:', decodedStream.constructor.name, 'contents len:', contents?.length);
    } catch (e) {
      console.log('decodePDFRawStream failed:', e);
    }
  }
}
main().catch(console.error);
