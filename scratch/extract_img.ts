import fs from 'fs';
import { safeLoadPdfDocument } from '../src/utils/dtrVectorPdf';
import { PDFName, PDFRawStream } from 'pdf-lib';

async function main() {
  const buf = fs.readFileSync('scratch/cert_test.pdf');
  const pdfDoc = await safeLoadPdfDocument(buf);
  const page = pdfDoc.getPages()[0];
  const resources = page.node.Resources();
  const xObject = resources?.lookup(PDFName.of('XObject'));
  if (!xObject) {
    console.log('No XObject found');
    return;
  }
  const imgRef = (xObject as any).get(PDFName.of('Image5'));
  console.log('imgRef:', imgRef);
  const imgStream = pdfDoc.context.lookup(imgRef);
  console.log('imgStream type:', imgStream?.constructor?.name);
  if (imgStream && (imgStream as any).dict) {
    const dict = (imgStream as any).dict;
    console.log('Filter:', dict.get(PDFName.of('Filter'))?.toString());
    console.log('Width:', dict.get(PDFName.of('Width'))?.toString());
    console.log('Height:', dict.get(PDFName.of('Height'))?.toString());
    console.log('ColorSpace:', dict.get(PDFName.of('ColorSpace'))?.toString());
    console.log('BitsPerComponent:', dict.get(PDFName.of('BitsPerComponent'))?.toString());
    const bytes = (imgStream as any).contents;
    console.log('Contents len:', bytes?.length);
    // If DCTDecode, it is a JPEG!
    const filter = dict.get(PDFName.of('Filter'))?.toString();
    if (filter === '/DCTDecode') {
      fs.writeFileSync('scratch/extracted_cert_bg.jpg', bytes);
      console.log('Saved JPEG to scratch/extracted_cert_bg.jpg');
    } else {
      console.log('Not DCTDecode, filter is:', filter);
    }
  }
}
main().catch(console.error);
