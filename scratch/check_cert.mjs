import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

async function main() {
  const bytes = fs.readFileSync('scratch/cert_test.pdf');
  const doc = await PDFDocument.load(bytes);
  console.log('Pages:', doc.getPageCount());
  const page = doc.getPage(0);
  const { width, height } = page.getSize();
  console.log('Page 0 size:', width, 'x', height);
}
main().catch(console.error);
