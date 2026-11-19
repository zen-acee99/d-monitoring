import fs from 'fs';
import { PDFDocument, PDFName, PDFArray, decodePDFRawStream } from 'pdf-lib';

async function dissect(filePath: string) {
  const bytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPage(0);
  const contents = page.node.Contents();
  console.log(`\n======================================================`);
  console.log(`=== Dissecting ${filePath} ===`);
  console.log('Contents type:', contents?.constructor?.name);

  const streams: any[] = [];
  if (contents instanceof PDFArray) {
    console.log(`Contents is array with ${contents.size()} streams:`);
    for (let i = 0; i < contents.size(); i++) {
      streams.push(pdfDoc.context.lookup(contents.get(i)));
    }
  } else if (contents) {
    streams.push(pdfDoc.context.lookup(contents));
  }

  for (let i = 0; i < streams.length; i++) {
    const stm = streams[i];
    let decoded: Uint8Array;
    try {
      decoded = decodePDFRawStream(stm).decode();
    } catch {
      decoded = stm.getContents();
    }
    const txt = Buffer.from(decoded).toString('latin1');
    console.log(`\n--- Stream ${i} (length ${decoded.length}) ---`);
    console.log(txt.length > 500 ? txt.slice(0, 500) + '...[truncated]' : txt);
  }
}

async function main() {
  await dissect('c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15).pdf');
  await dissect('c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15) (1).pdf');
}
main().catch(console.error);
