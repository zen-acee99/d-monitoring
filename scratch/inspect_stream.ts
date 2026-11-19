import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import { extractPageContentStreamBytes } from '../src/utils/dtrVectorPdf';

async function main() {
  const bytes = fs.readFileSync('scratch/cert_test.pdf');
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(0);
  const sBytes = extractPageContentStreamBytes(doc, page);
  const text = new TextDecoder('latin1').decode(sBytes);
  console.log('Stream content (first 500 chars):');
  console.log(text.slice(0, 500));
  console.log('Stream content (last 500 chars):');
  console.log(text.slice(-500));
}
main().catch(console.error);
