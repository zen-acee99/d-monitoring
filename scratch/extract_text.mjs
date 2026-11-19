import fs from 'fs';
import { PDFDocument, PDFName, PDFDict, PDFStream, PDFArray } from 'pdf-lib';
import zlib from 'zlib';

async function extractAllDecodedText() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf';
  const buf = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = doc.getPage(0);
  
  const resources = page.node.Resources();
  const fontDict = resources.lookup(PDFName.of('Font'));
  const cmaps = {};

  if (fontDict instanceof PDFDict) {
    const fontKeys = fontDict.keys();
    for (const k of fontKeys) {
      const fObj = doc.context.lookup(fontDict.lookup(k));
      const toUnicodeRef = fObj.lookup(PDFName.of('ToUnicode'));
      if (toUnicodeRef) {
        const toUnicodeStream = doc.context.lookup(toUnicodeRef);
        if (toUnicodeStream instanceof PDFStream) {
          let cmapBytes = toUnicodeStream.getContents();
          try { cmapBytes = zlib.inflateSync(Buffer.from(cmapBytes)); } catch(e) {}
          const cmapStr = cmapBytes.toString('latin1');
          const map = {};
          
          // bfchar: <0004> <0041>
          const bfcharSection = cmapStr.match(/beginbfchar([\s\S]*?)endbfchar/g);
          if (bfcharSection) {
            for (const sec of bfcharSection) {
              const regex = /<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g;
              let m;
              while ((m = regex.exec(sec)) !== null) {
                const src = parseInt(m[1], 16);
                const dst = parseInt(m[2], 16);
                map[src] = String.fromCharCode(dst);
              }
            }
          }

          // bfrange: <0004> <0009> <0041> OR <0004> <0006> [<0041> <0042> <0043>]
          const bfrangeSection = cmapStr.match(/beginbfrange([\s\S]*?)endbfrange/g);
          if (bfrangeSection) {
            for (const sec of bfrangeSection) {
              // check array style: <src1> <src2> [ <dst1> <dst2> ... ]
              const rangeArrRegex = /<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+\[([\s\S]*?)\]/g;
              let rm;
              let replacedSec = sec;
              while ((rm = rangeArrRegex.exec(sec)) !== null) {
                const start = parseInt(rm[1], 16);
                const items = rm[3].trim().split(/\s+/).filter(Boolean);
                for (let i = 0; i < items.length; i++) {
                  const hex = items[i].replace(/[<>]/g, '');
                  map[start + i] = String.fromCharCode(parseInt(hex, 16));
                }
              }
              // simple start end dst
              const simpleRangeRegex = /<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g;
              while ((rm = simpleRangeRegex.exec(sec)) !== null) {
                const start = parseInt(rm[1], 16);
                const end = parseInt(rm[2], 16);
                let dst = parseInt(rm[3], 16);
                for (let c = start; c <= end; c++) {
                  map[c] = String.fromCharCode(dst++);
                }
              }
            }
          }
          cmaps[k.toString().replace('/', '')] = map;
        }
      }
    }
  }

  function decodeCID(buf, fontName) {
    const cmap = cmaps[fontName];
    if (!cmap) {
      return buf.toString('latin1');
    }
    let res = '';
    for (let i = 0; i < buf.length; i += 2) {
      const code = (buf[i] << 8) | buf[i+1];
      res += cmap[code] || '?';
    }
    return res;
  }

  // Now scan all streams and parse text operations
  const contentsRef = page.node.Contents();
  for (let sIdx = 0; sIdx < contentsRef.size(); sIdx++) {
    const ref = contentsRef.get(sIdx);
    const stream = doc.context.lookup(ref);
    let bytes = stream.getContents();
    try { bytes = zlib.inflateSync(Buffer.from(bytes)); } catch(e){}

    // Walk through PDF content stream tokens
    // We look for /FontX xx Tf and then (text) Tj or [(t) 10 (e)] TJ
    let currentFont = 'Font0';
    let str = bytes.toString('latin1');
    
    // Find text blocks
    const tokenRegex = /(\/Font\w+)\s+([\d\.]+)\s+Tf|1\.0 0 0 -1\.0 ([\d\.]+) ([\d\.]+) Tm|\((.*?)\)\s*Tj|\[(.*?)\]\s*TJ/gs;
    let tMatch;
    let currentX = 0, currentY = 0;
    while ((tMatch = tokenRegex.exec(str)) !== null) {
      if (tMatch[1]) {
        currentFont = tMatch[1].replace('/', '');
      } else if (tMatch[3]) {
        currentX = parseFloat(tMatch[3]);
        currentY = parseFloat(tMatch[4]);
      } else if (tMatch[5] !== undefined) {
        // Tj
        const raw = Buffer.from(tMatch[5], 'latin1');
        const text = decodeCID(raw, currentFont);
        if (text.trim().length > 0) {
          console.log(`[Stream ${sIdx}] (${currentX.toFixed(1)}, ${currentY.toFixed(1)}) [${currentFont}]: "${text}"`);
        }
      } else if (tMatch[6] !== undefined) {
        // TJ array
        const inner = tMatch[6];
        const innerRegex = /\((.*?)\)|(-?[\d\.]+)/g;
        let p;
        let combined = '';
        while ((p = innerRegex.exec(inner)) !== null) {
          if (p[1] !== undefined) {
            combined += decodeCID(Buffer.from(p[1], 'latin1'), currentFont);
          }
        }
        if (combined.trim().length > 0) {
          console.log(`[Stream ${sIdx}] TJ (${currentX.toFixed(1)}, ${currentY.toFixed(1)}) [${currentFont}]: "${combined}"`);
        }
      }
    }
  }
}

extractAllDecodedText().catch(console.error);
