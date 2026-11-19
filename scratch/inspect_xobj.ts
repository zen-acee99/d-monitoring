import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import fs from 'fs';

async function main() {
  const bytes = fs.readFileSync('scratch/cert_test.pdf');
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(0);
  const res = page.node.get(PDFName.of('Resources'));
  if (res instanceof PDFDict) {
    const xobj = res.get(PDFName.of('XObject'));
    if (xobj instanceof PDFDict) {
      console.log('XObjects:', xobj.keys().map(k => k.value()));
      for (const k of xobj.keys()) {
        const obj = xobj.get(k);
        console.log(k.value(), 'type:', obj?.constructor?.name);
      }
    }
  }
}
main().catch(console.error);
