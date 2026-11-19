import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

async function checkContentStreams() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf';
  const buf = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = doc.getPage(0);
  
  // Page Contents
  const contents = page.node.Contents();
  console.log('Contents type:', contents?.constructor?.name);
  
  // Search raw string in buffer for ODOÑO or CALIMPONG or ANNABEL
  const rawStr = buf.toString('latin1');
  console.log('Raw contains ANNABEL:', rawStr.includes('ANNABEL'));
  console.log('Raw contains CALIMPONG:', rawStr.includes('CALIMPONG'));
  console.log('Raw contains ODO:', rawStr.includes('ODO'));
  console.log('Raw contains BALANA:', rawStr.includes('BALANA'));
  console.log('Raw contains CABREDO:', rawStr.includes('CABREDO'));
  console.log('Raw contains LEAH:', rawStr.includes('LEAH'));

  // Let's find matches and snippets
  const words = ['ANNABEL', 'CALIMPONG', 'BALANA', 'CABREDO', 'LEAH', 'DY', 'ODO'];
  for (const w of words) {
    let idx = 0;
    while ((idx = rawStr.indexOf(w, idx)) !== -1) {
      console.log(`Found "${w}" at ${idx}: ...${rawStr.substring(Math.max(0, idx - 40), Math.min(rawStr.length, idx + 60)).replace(/[\r\n]+/g, ' ')}...`);
      idx += w.length;
    }
  }
}

checkContentStreams().catch(console.error);
