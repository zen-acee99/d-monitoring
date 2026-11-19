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
    const decodedStream = decodePDFRawStream(stream);
    console.log('FlateStream methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(decodedStream)));
    const bytes = (decodedStream as any).decode();
    console.log('decoded bytes type:', bytes?.constructor?.name, 'length:', bytes?.length);
  }
}
main().catch(console.error);
