import fs from 'fs';
import { PDFDocument, PDFName, PDFDict, PDFStream } from 'pdf-lib';
import zlib from 'zlib';

async function parseCMap() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf';
  const buf = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = doc.getPage(0);
  
  const resources = page.node.Resources();
  const fontDict = resources.lookup(PDFName.of('Font'));
  console.log('Fonts in page resources:');
  const cmaps = {};

  if (fontDict instanceof PDFDict) {
    const fontKeys = fontDict.keys();
    for (const k of fontKeys) {
      const fObj = doc.context.lookup(fontDict.lookup(k));
      const baseFont = fObj.lookup(PDFName.of('BaseFont'))?.toString();
      const subtype = fObj.lookup(PDFName.of('Subtype'))?.toString();
      const toUnicodeRef = fObj.lookup(PDFName.of('ToUnicode'));
      console.log(`Font ${k.toString()}: BaseFont=${baseFont}, Subtype=${subtype}, ToUnicode=${toUnicodeRef}`);
      
      if (toUnicodeRef) {
        const toUnicodeStream = doc.context.lookup(toUnicodeRef);
        if (toUnicodeStream instanceof PDFStream) {
          let cmapBytes = toUnicodeStream.getContents();
          try {
            cmapBytes = zlib.inflateSync(Buffer.from(cmapBytes));
          } catch(e) {}
          const cmapStr = cmapBytes.toString('utf-8');
          // Parse cmap mappings: <xxxx> <yyyy>
          // e.g. <0004> <0041>
          const map = {};
          const bfrangeRegex = /<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g;
          let m;
          while ((m = bfrangeRegex.exec(cmapStr)) !== null) {
            const start = parseInt(m[1], 16);
            const end = parseInt(m[2], 16);
            let target = parseInt(m[3], 16);
            for (let code = start; code <= end; code++) {
              map[code] = String.fromCharCode(target++);
            }
          }
          const bfcharRegex = /<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g;
          while ((m = bfcharRegex.exec(cmapStr)) !== null) {
            const src = parseInt(m[1], 16);
            const dst = parseInt(m[2], 16);
            map[src] = String.fromCharCode(dst);
          }
          cmaps[k.toString().replace('/', '')] = map;
        }
      }
    }
  }

  // Now let's decode Stream 8
  const contentsRef = page.node.Contents();
  const stream8Ref = contentsRef.get(8);
  const stream8 = doc.context.lookup(stream8Ref);
  let s8Bytes = stream8.getContents();
  try { s8Bytes = zlib.inflateSync(Buffer.from(s8Bytes)); } catch(e){}
  const s8Str = s8Bytes.toString('latin1');
  
  // Let's print decoded strings using Font4 CMap
  const f4CMap = cmaps['Font4'];
  console.log('Font4 CMap size:', f4CMap ? Object.keys(f4CMap).length : 0);

  // Helper to decode hex or 2-byte strings with cmap
  function decodeWithCMap(str, cmap) {
    if (!cmap) return str;
    let res = '';
    for (let i = 0; i < str.length; i += 2) {
      const code = (str.charCodeAt(i) << 8) | str.charCodeAt(i + 1);
      res += cmap[code] || `[?${code.toString(16)}]`;
    }
    return res;
  }

  // Find all text in Stream 8
  const tmRegex = /1\.0 0 0 -1\.0 ([\d\.]+) ([\d\.]+) Tm\s+0 0 Td\s+\((.*?)\) Tj/gs;
  let match;
  while ((match = tmRegex.exec(s8Str)) !== null) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    const rawText = match[3];
    const decoded = decodeWithCMap(rawText, f4CMap);
    console.log(`Pos (${x}, ${y}): "${decoded}"`);
  }
}

parseCMap().catch(console.error);
