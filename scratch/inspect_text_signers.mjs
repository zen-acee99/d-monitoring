import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import zlib from 'zlib';

const buf = fs.readFileSync('scratch/sample_pending_raod.pdf');
const doc = await PDFDocument.load(buf);
const page = doc.getPages()[0];
const contents = page.node.Contents();
let fullText = '';
const count = contents.size ? contents.size() : 1;
for (let i = 0; i < count; i++) {
  const s = doc.context.lookup(contents.get ? contents.get(i) : contents);
  try { fullText += zlib.inflateSync(Buffer.from(s.getContents())).toString('latin1') + '\n'; } catch {}
}
const lines = fullText.split('\n');
const idx = lines.findIndex(l => l.includes('OIC') || l.includes('Regional Director') || l.includes('0 0 Td (     \x0c   O   ‡ ‰ ‹ ‘   ƒ Ž'));
console.log('Found around idx:', idx);
lines.slice(idx - 60, idx + 40).forEach((l, i) => {
  if (l.trim().length > 0) console.log(i + ': ' + l.trim());
});
