import fs from 'fs';
import { extractAllCMapsFromBuffer } from '../server/services/pnpkiSigningService';

async function test() {
  const bytes = fs.readFileSync('c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15).pdf');
  const cmap = extractAllCMapsFromBuffer(bytes);
  console.log('Extracted CMap entries:', cmap.size);
  let sample = 0;
  for (const [k, v] of cmap.entries()) {
    if (sample++ < 10) {
      console.log(`  ${k} -> ${v} (${v.charCodeAt(0)})`);
    }
  }

  // Now let's test decoding hex strings in the PDF
  const pdfStr = bytes.toString('latin1');
  const hexMatches = pdfStr.match(/<([0-9a-fA-F]{4,})>/g) || [];
  console.log('Total hex strings found in PDF:', hexMatches.length);
  for (const h of hexMatches) {
    const rawHex = h.slice(1, -1);
    let decoded = '';
    for (let i = 0; i < rawHex.length; i += 4) {
      const code = rawHex.substring(i, i + 4).toUpperCase();
      decoded += cmap.get(code) || '?';
    }
    if (decoded.toLowerCase().includes('digitally') || decoded.toLowerCase().includes('malto') || decoded.toLowerCase().includes('buena')) {
      console.log(`Decoded "${h}": "${decoded}"`);
    }
  }
}

test().catch(console.error);
