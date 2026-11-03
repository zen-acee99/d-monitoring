import { PDFDocument, decodePDFRawStream, PDFRawStream } from 'pdf-lib';
import fs from 'fs';

const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1792147510132_24e68bb2.pdf';
const buf = fs.readFileSync(pdfPath);
const doc = await PDFDocument.load(buf);
const page = doc.getPages()[0];

const contentsRef = page.node.get(PDFDocument.prototype.context ? null : null);
// Read streams directly from doc context
let textStream = '';
for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
  if (obj instanceof PDFRawStream) {
    try {
      const decoded = decodePDFRawStream(obj).decode();
      const s = Buffer.from(decoded).toString('latin1');
      if (s.includes('DAILY TIME RECORD')) {
        textStream = s;
        console.log('Found main content stream in obj', ref.toString(), 'length:', s.length);
        break;
      }
    } catch {}
  }
}

if (textStream) {
  // Show header and footer parts
  const lines = textStream.split('\n');
  const textCmds = lines.filter(l => l.includes('Tj') || l.includes('TJ') || l.includes('Td') || l.includes('Tf') || l.includes('re'));
  console.log('Sample text commands (first 50):');
  console.log(textCmds.slice(0, 50));
  console.log('Sample text commands (last 50):');
  console.log(textCmds.slice(-50));
}
