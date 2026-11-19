import fs from 'fs';
import { PDFDocument, PDFStream, PDFArray } from 'pdf-lib';
import zlib from 'zlib';

async function checkStreamsDetail() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf';
  const buf = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = doc.getPage(0);
  
  const contentsRef = page.node.Contents();
  for (let i = 0; i < contentsRef.size(); i++) {
    const ref = contentsRef.get(i);
    const stream = doc.context.lookup(ref);
    let bytes = stream.getContents();
    let text = '';
    try {
      text = zlib.inflateSync(Buffer.from(bytes)).toString('utf-8');
    } catch (e) {
      text = Buffer.from(bytes).toString('utf-8');
    }
    console.log(`Stream ${i} (ref ${ref}) snippet:`, text.substring(0, 150).replace(/[\r\n]+/g, ' '));
    // Let's search for Tj or TJ operators
    const matches = text.match(/\((.*?)\)\s*T[jJ]|\[(.*?)\]\s*TJ/g);
    if (matches) {
      console.log(`  Found ${matches.length} text operations. First 5:`, matches.slice(0, 5));
      for (const m of matches) {
        if (m.toUpperCase().includes('ANNABEL') || m.toUpperCase().includes('BALANA') || m.toUpperCase().includes('CALIMPONG') || m.toUpperCase().includes('LEAH') || m.toUpperCase().includes('NOTED') || m.toUpperCase().includes('PREPARED')) {
          console.log('  -> MATCH:', m);
        }
      }
    }
  }
}

checkStreamsDetail().catch(console.error);
