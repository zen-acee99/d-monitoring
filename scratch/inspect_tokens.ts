import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes } from '../src/utils/dtrVectorPdf';

async function main() {
  const bytes = fs.readFileSync('scratch/masareta_from_db.pdf');
  const doc = await PDFDocument.load(bytes);
  const p = doc.getPages()[1];
  const streamBytes = extractPageContentStreamBytes(doc, p);

  // Let's decode tokens and print 40 tokens around ANNABEL
  let idx = 0;
  const len = streamBytes.length;
  function skipWhitespace() {
    while (idx < len && (streamBytes[idx] <= 32 || streamBytes[idx] === 0)) idx++;
  }
  function readWord(): string {
    skipWhitespace();
    let w = "";
    while (
      idx < len &&
      streamBytes[idx] > 32 &&
      streamBytes[idx] !== 47 &&
      streamBytes[idx] !== 40 &&
      streamBytes[idx] !== 60 &&
      streamBytes[idx] !== 91 &&
      streamBytes[idx] !== 93
    ) {
      w += String.fromCharCode(streamBytes[idx]);
      idx++;
    }
    return w;
  }

  const allTokens: string[] = [];
  while (idx < len) {
    skipWhitespace();
    if (idx >= len) break;
    const b = streamBytes[idx];
    if (b === 47) {
      idx++;
      let name = "/";
      while (idx < len && streamBytes[idx] > 32 && streamBytes[idx] !== 47 && streamBytes[idx] !== 40 && streamBytes[idx] !== 60 && streamBytes[idx] !== 91) {
        name += String.fromCharCode(streamBytes[idx]);
        idx++;
      }
      allTokens.push(name);
    } else if (b === 40) {
      idx++;
      let s = "(";
      let depth = 1;
      while (idx < len) {
        const c = streamBytes[idx++];
        s += String.fromCharCode(c);
        if (c === 92) { if (idx < len) s += String.fromCharCode(streamBytes[idx++]); }
        else if (c === 40) depth++;
        else if (c === 41) { depth--; if (depth === 0) break; }
      }
      allTokens.push(s);
    } else if (b === 60) {
      idx++;
      let h = "<";
      while (idx < len && streamBytes[idx] !== 62) h += String.fromCharCode(streamBytes[idx++]);
      if (idx < len && streamBytes[idx] === 62) { h += ">"; idx++; }
      allTokens.push(h);
    } else if (b === 91) {
      idx++;
      let arr = "[";
      while (idx < len && streamBytes[idx] !== 93) arr += String.fromCharCode(streamBytes[idx++]);
      if (idx < len && streamBytes[idx] === 93) { arr += "]"; idx++; }
      allTokens.push(arr);
    } else {
      const w = readWord();
      if (w) allTokens.push(w);
    }
  }

  console.log('Total tokens:', allTokens.length);
  // Find where 327.84 or 327 or 252.68 appears in tokens
  for (let i = 0; i < allTokens.length; i++) {
    if (allTokens[i].includes('327.') || allTokens[i].includes('252.')) {
      console.log(`Token match at ${i}:`, allTokens.slice(Math.max(0, i - 25), Math.min(allTokens.length, i + 25)).join(' '));
    }
  }
}

main().catch(console.error);
