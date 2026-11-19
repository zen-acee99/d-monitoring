import fs from 'fs';
import { PDFDocument, PDFName } from 'pdf-lib';
import zlib from 'zlib';

async function dumpPdf(path) {
  const buf = fs.readFileSync(path);
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  console.log('Pages:', doc.getPageCount());
  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i);
    const contents = page.node.Contents();
    let count = contents?.size ? contents.size() : (contents ? 1 : 0);
    console.log(`Page ${i} content streams:`, count);
    for (let c = 0; c < count; c++) {
      const ref = contents.size ? contents.get(c) : contents;
      const stream = doc.context.lookup(ref);
      let bytes;
      try {
        bytes = zlib.inflateSync(Buffer.from(stream.getContents())).toString('latin1');
      } catch {
        bytes = Buffer.from(stream.getContents()).toString('latin1');
      }
      // Look for text operators Tj or TJ
      const matches = bytes.match(/\((.*?)\)\s*Tj/g) || [];
      const texts = matches.map(m => m.replace(/^\(/, '').replace(/\)\s*Tj$/, ''));
      if (texts.length > 0) {
        console.log(`Stream ${c} texts:`, texts.slice(0, 30));
      }
    }
  }
}

if (fs.existsSync('scratch/test_signed_annabel.pdf')) {
  dumpPdf('scratch/test_signed_annabel.pdf').catch(console.error);
} else {
  console.log('File does not exist');
}
