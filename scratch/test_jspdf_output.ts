import { jsPDF } from 'jspdf';
import zlib from 'zlib';

const doc = new jsPDF();
doc.text("Digitally signed", 50, 50);
doc.text("by Malto Ace Mata", 50, 55);

const out = Buffer.from(doc.output("arraybuffer"));
const outStr = out.toString("latin1");
console.log("jsPDF output has plain 'Digitally signed':", outStr.includes("Digitally signed"));

// Decompress streams in out
const streamMatches = outStr.match(/stream\r?\n([\s\S]*?)\r?\nendstream/g) || [];
for (let i = 0; i < streamMatches.length; i++) {
  const m = streamMatches[i].replace(/^stream\r?\n/, '').replace(/\r?\nendstream$/, '');
  let dec = '';
  try { dec = zlib.inflateSync(Buffer.from(m, 'latin1')).toString('latin1'); } catch { dec = m; }
  console.log(`Stream ${i}:`, dec);
}
