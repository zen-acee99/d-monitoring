import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import zlib from 'zlib';

async function printBlock6Hex() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf';
  const buf = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = doc.getPage(0);
  const s8 = doc.context.lookup(page.node.Contents().get(8));
  let s8Bytes = zlib.inflateSync(Buffer.from(s8.getContents()));
  
  // Find block 6
  const str = s8Bytes.toString('latin1');
  const idx = str.indexOf('914.0\n550.7056');
  console.log('Snippet around 914.0:\n', str.substring(idx, idx + 200));
  
  // Let's decode every 2-byte char in that TJ block using Font2 CMap
  // We saw Font2 CMap:
  // <0003> = ' '
  // <0004>-<000c> = 'A'-'I' (4:A, 5:B, 6:C, 7:D, 8:E, 9:F, a:G, b:H, c:I)
  // <000f>-<0013> = 'L'-'P' (f:L, 10:M, 11:N, 12:O, 13:P)
  // <0015>-<001c> = 'R'-'Y'
  // <0053> = 'Ñ'
  // <014d> = '.'
  // <014f> = '-'
  // Let's test:
  // 0004 = A
  // 0011 = N
  // 0011 = N
  // 0004 = A
  // 0005 = B
  // 0008 = E
  // 000f = L
  // 0003 = ' '
  // 0006 = C
  // 014d = .
  // 0003 = ' '
  // 0012 = O
  // 0007 = D
  // 0012 = O
  // 0053 = Ñ
  // 0012 = O
  // 014f = -
  // 0006 = C
  // 0004 = A
  // 000f = L
  // 000c = I
  // 0010 = M
  // 0013 = P
  // 0012 = O
  // 0011 = N
  // 000a = G
  // That spells: "ANNABEL C. ODOÑO-CALIMPONG"!!
}

printBlock6Hex().catch(console.error);
