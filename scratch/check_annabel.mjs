import fs from 'fs';
import { PDFDocument, PDFName, PDFDict, PDFStream } from 'pdf-lib';
import zlib from 'zlib';

async function checkAnnabelPart() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf';
  const buf = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = doc.getPage(0);
  
  const resources = page.node.Resources();
  const fontDict = resources.lookup(PDFName.of('Font'));
  const f2Obj = doc.context.lookup(fontDict.lookup(PDFName.of('Font2')));
  const toUnicodeRef = f2Obj.lookup(PDFName.of('ToUnicode'));
  const toUnicodeStream = doc.context.lookup(toUnicodeRef);
  let cmapBytes = zlib.inflateSync(Buffer.from(toUnicodeStream.getContents()));
  console.log('Font2 ToUnicode CMap:\n', cmapBytes.toString('utf-8'));

  const contentsRef = page.node.Contents();
  const s8 = doc.context.lookup(contentsRef.get(8));
  let s8Bytes = zlib.inflateSync(Buffer.from(s8.getContents())).toString('latin1');
  console.log('Stream 8 raw text around OD:\n', s8Bytes.substring(s8Bytes.indexOf('OD') - 50, s8Bytes.indexOf('OD') + 200));
}

checkAnnabelPart().catch(console.error);
