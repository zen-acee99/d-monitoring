import fs from 'fs';
import { PDFDocument, decodePDFRawStream } from 'pdf-lib';

async function check() {
  const bytes = fs.readFileSync('c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15) (1).pdf');
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPage(0);
  const contents = page.node.Contents();
  const stm = pdfDoc.context.lookup((contents as any).get(2));
  const decoded = decodePDFRawStream(stm).decode();
  const txt = Buffer.from(decoded).toString('latin1');
  console.log('Stream 2 raw includes Rene:', /rene/i.test(txt));
  console.log('Stream 2 raw includes Malto:', /malto/i.test(txt));
  console.log('Stream 2 raw includes Digitally:', /digitally/i.test(txt));
}
check().catch(console.error);
