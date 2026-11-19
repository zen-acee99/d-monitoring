import fs from 'fs';
import { PDFDocument, PDFName, PDFDict, PDFRawStream } from 'pdf-lib';
import zlib from 'zlib';

function decodePDFRawStream(rawStream) {
  return {
    decode: () => {
      try {
        return zlib.inflateSync(Buffer.from(rawStream.contents));
      } catch {
        return rawStream.contents;
      }
    }
  };
}

function parsePdfCMap(cmapText) {
  const map = new Map();
  const bfCharBlocks = cmapText.match(/beginbfchar([\s\S]*?)endbfchar/g) || [];
  for (const block of bfCharBlocks) {
    const lines = block.split("\n");
    for (const line of lines) {
      const match = line.match(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/);
      if (match) {
        const src = match[1].toUpperCase().padStart(4, "0");
        const dstHex = match[2];
        let str = "";
        for (let i = 0; i < dstHex.length; i += 4) {
          const code = parseInt(dstHex.substring(i, i + 4), 16);
          str += String.fromCharCode(code);
        }
        map.set(src, str);
      }
    }
  }

  const bfRangeBlocks = cmapText.match(/beginbfrange([\s\S]*?)endbfrange/g) || [];
  for (const block of bfRangeBlocks) {
    const lines = block.split("\n");
    for (const line of lines) {
      const match1 = line.match(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/);
      if (match1) {
        const start = parseInt(match1[1], 16);
        const end = parseInt(match1[2], 16);
        let dstStart = parseInt(match1[3], 16);
        for (let code = start; code <= end; code++) {
          const srcHex = code.toString(16).toUpperCase().padStart(4, "0");
          map.set(srcHex, String.fromCharCode(dstStart));
          dstStart++;
        }
        continue;
      }
      const match2 = line.match(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+\[([\s\S]*?)\]/);
      if (match2) {
        const start = parseInt(match2[1], 16);
        const end = parseInt(match2[2], 16);
        const hexList = match2[3].match(/<([0-9A-Fa-f]+)>/g) || [];
        for (let i = 0; i < hexList.length && start + i <= end; i++) {
          const srcHex = (start + i).toString(16).toUpperCase().padStart(4, "0");
          const dstHex = hexList[i].replace(/[<>]/g, "");
          let str = "";
          for (let j = 0; j < dstHex.length; j += 4) {
            const code = parseInt(dstHex.substring(j, j + 4), 16);
            str += String.fromCharCode(code);
          }
          map.set(srcHex, str);
        }
      }
    }
  }
  return map;
}

function loadPageFontCMaps(pdfDoc, page) {
  const fontCMaps = new Map();
  try {
    const resources = page.node.lookup(PDFName.of("Resources"), PDFDict);
    if (!resources) return fontCMaps;
    const fontDict = resources.lookup(PDFName.of("Font"), PDFDict);
    if (!fontDict) return fontCMaps;

    for (const k of fontDict.keys()) {
      const fontName = k.asString().replace(/^\//, "");
      const fontObj = fontDict.lookup(k, PDFDict);
      if (fontObj) {
        const toUnicodeRef = fontObj.get(PDFName.of("ToUnicode"));
        if (toUnicodeRef) {
          const toUnicodeStream = pdfDoc.context.lookup(toUnicodeRef);
          if (toUnicodeStream) {
            const decoded = decodePDFRawStream(toUnicodeStream).decode();
            const cmapText = new TextDecoder("latin1").decode(decoded);
            fontCMaps.set(fontName, parsePdfCMap(cmapText));
          }
        }
      }
    }
  } catch (e) {
    console.warn("Could not load page font CMaps:", e);
  }
  return fontCMaps;
}

async function main() {
  const bytes = fs.readFileSync('scratch/sample_pending_raod.pdf');
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPage(0);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  console.log('Loaded CMaps count:', cmaps.size);
  for (const [name, map] of cmaps.entries()) {
    console.log('Font:', name, 'entries:', map.size);
  }
}
main().catch(console.error);

function extractPageContentStreamBytes(pdfDoc, page) {
  const contentsNode = page.node.Contents();
  if (!contentsNode) return new Uint8Array(0);
  const streamObjects = [];
  if (contentsNode.asArray) {
    const arr = contentsNode.asArray();
    for (const ref of arr) {
      const obj = pdfDoc.context.lookup(ref);
      if (obj) streamObjects.push(obj);
    }
  } else {
    const obj = pdfDoc.context.lookup(contentsNode);
    if (obj) streamObjects.push(obj);
  }
  const decodedChunks = [];
  let totalBytes = 0;
  for (const sObj of streamObjects) {
    const dec = decodePDFRawStream(sObj).decode();
    if (dec && dec.length > 0) {
      decodedChunks.push(dec);
      totalBytes += dec.length;
    }
  }
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of decodedChunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined;
}

function decodeBytesWithCMap(rawBytes, cmap) {
  if (cmap) {
    if (rawBytes.length >= 2 && rawBytes.length % 2 === 0) {
      let decoded2 = "";
      let matchedCount = 0;
      for (let i = 0; i < rawBytes.length; i += 2) {
        const hexKey = (rawBytes[i].toString(16).padStart(2, "0") + rawBytes[i + 1].toString(16).padStart(2, "0")).toUpperCase();
        if (cmap.has(hexKey)) {
          decoded2 += cmap.get(hexKey);
          matchedCount++;
        } else {
          if (rawBytes[i] === 0 && rawBytes[i + 1] >= 32) {
            decoded2 += String.fromCharCode(rawBytes[i + 1]);
          } else {
            decoded2 += " ";
          }
        }
      }
      if (matchedCount > 0) return decoded2;
    }
    let decoded1 = "";
    for (let i = 0; i < rawBytes.length; i++) {
      const hexKey = rawBytes[i].toString(16).padStart(2, "0").toUpperCase();
      if (cmap.has(hexKey)) {
        decoded1 += cmap.get(hexKey);
      } else {
        decoded1 += String.fromCharCode(rawBytes[i]);
      }
    }
    return decoded1;
  }
  return new TextDecoder("latin1").decode(rawBytes);
}

// In main:
async function testStream() {
  const bytes = fs.readFileSync('scratch/sample_pending_raod.pdf');
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPage(0);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  console.log('Stream bytes length:', sBytes.length);
}
testStream();
