import fs from 'fs';
import { PDFDocument, PDFStream, PDFArray } from 'pdf-lib';
import zlib from 'zlib';

async function checkDecompressedStreams() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf';
  const buf = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = doc.getPage(0);
  
  const contentsRef = page.node.Contents();
  const streams = [];
  if (contentsRef instanceof PDFArray) {
    for (let i = 0; i < contentsRef.size(); i++) {
      const ref = contentsRef.get(i);
      const stream = doc.context.lookup(ref);
      if (stream instanceof PDFStream) {
        streams.push(stream);
      }
    }
  } else if (contentsRef instanceof PDFStream) {
    streams.push(contentsRef);
  }

  console.log(`Found ${streams.length} content streams on page 1.`);

  for (let i = 0; i < streams.length; i++) {
    const stream = streams[i];
    let decoded;
    try {
      const bytes = stream.getContents();
      decoded = zlib.inflateSync(Buffer.from(bytes)).toString('latin1');
    } catch (e) {
      // maybe not flate or raw
      try {
        decoded = Buffer.from(stream.getContents()).toString('latin1');
      } catch (err) {
        decoded = '';
      }
    }
    
    console.log(`Stream ${i}: length ${decoded.length}`);
    const words = ['ANNABEL', 'CALIMPONG', 'BALANA', 'CABREDO', 'LEAH', 'DY', 'ODO', 'OIC', 'Regional'];
    for (const w of words) {
      if (decoded.toUpperCase().includes(w.toUpperCase())) {
        let idx = decoded.toUpperCase().indexOf(w.toUpperCase());
        console.log(`  Stream ${i} contains ${w} at ${idx}: ...${decoded.substring(Math.max(0, idx - 40), Math.min(decoded.length, idx + 80)).replace(/[\r\n]+/g, ' ')}...`);
      }
    }
  }
}

checkDecompressedStreams().catch(console.error);
