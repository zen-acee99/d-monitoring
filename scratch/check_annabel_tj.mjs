import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import zlib from 'zlib';

async function checkAnnabelTJ() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf';
  const buf = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = doc.getPage(0);
  const s8 = doc.context.lookup(page.node.Contents().get(8));
  let s8Bytes = zlib.inflateSync(Buffer.from(s8.getContents())).toString('latin1');
  
  // Find where ANNABEL is
  let pos = s8Bytes.indexOf('LEAH');
  if (pos === -1) {
    // find around line 400
    pos = 0;
  }
  // Let's print out all BT ... ET blocks in Stream 8
  const btRegex = /BT([\s\S]*?)ET/g;
  let m;
  let blockIdx = 0;
  while ((m = btRegex.exec(s8Bytes)) !== null) {
    console.log(`--- Block ${blockIdx++} ---`);
    console.log(m[1].trim());
  }
}

checkAnnabelTJ().catch(console.error);
