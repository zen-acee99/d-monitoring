import { PDFDocument, PDFName, PDFDict, PDFRawStream } from 'pdf-lib';
import fs from 'fs';

async function main() {
  const bytes = fs.readFileSync('scratch/cert_test.pdf');
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(0);
  const res = page.node.get(PDFName.of('Resources'));
  if (res instanceof PDFDict) {
    const xobj = res.get(PDFName.of('XObject'));
    if (xobj instanceof PDFDict) {
      const imgRef = xobj.get(PDFName.of('Image5'));
      const imgObj = doc.context.lookup(imgRef);
      if (imgObj instanceof PDFRawStream || imgObj instanceof PDFDict) {
        console.log('Image5 keys:', imgObj.dict.keys().map(k => k.value()));
        console.log('Width:', imgObj.dict.get(PDFName.of('Width'))?.toString());
        console.log('Height:', imgObj.dict.get(PDFName.of('Height'))?.toString());
        console.log('Filter:', imgObj.dict.get(PDFName.of('Filter'))?.toString());
        if (imgObj instanceof PDFRawStream) {
          const streamBytes = imgObj.contents;
          console.log('Stream length:', streamBytes.length);
          fs.writeFileSync('scratch/extracted_image5.jpg', streamBytes);
          console.log('Saved scratch/extracted_image5.jpg');
        }
      }
    }
  }
}
main().catch(console.error);
