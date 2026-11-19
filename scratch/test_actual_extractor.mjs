import fs from 'fs';
import { PDFDocument, PDFName, PDFDict, PDFRawStream } from 'pdf-lib';
import { decodePDFRawStream } from 'pdf-lib';

function parsePdfCMap(cmapText) {
  const map = new Map();
  const bfcharRegex = /beginbfchar([\s\S]*?)endbfchar/g;
  let m;
  while ((m = bfcharRegex.exec(cmapText)) !== null) {
    const lines = m[1].trim().split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/);
      if (match) {
        const srcHex = match[1].toUpperCase();
        const dstChar = String.fromCharCode(parseInt(match[2], 16));
        map.set(srcHex, dstChar);
      }
    }
  }

  const bfrangeRegex = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = bfrangeRegex.exec(cmapText)) !== null) {
    const lines = m[1].trim().split(/\r?\n/);
    for (const line of lines) {
      const simple = line.match(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/);
      if (simple) {
        const start = parseInt(simple[1], 16);
        const end = parseInt(simple[2], 16);
        let dst = parseInt(simple[3], 16);
        const padLen = simple[1].length;
        for (let c = start; c <= end; c++) {
          map.set(c.toString(16).padStart(padLen, "0").toUpperCase(), String.fromCharCode(dst++));
        }
        continue;
      }
      const arrMatch = line.match(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+\[([\s\S]*?)\]/);
      if (arrMatch) {
        const start = parseInt(arrMatch[1], 16);
        const tokens = arrMatch[3].trim().split(/\s+/).filter(Boolean);
        const padLen = arrMatch[1].length;
        for (let i = 0; i < tokens.length; i++) {
          const hex = tokens[i].replace(/[<>]/g, "");
          map.set((start + i).toString(16).padStart(padLen, "0").toUpperCase(), String.fromCharCode(parseInt(hex, 16)));
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

function extractPageContentStreamBytes(pdfDoc, page) {
  const contentsNode = page.node.Contents();
  if (!contentsNode) return new Uint8Array(0);

  const streamObjects = [];
  try {
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

    let totalBytes = 0;
    const decodedChunks = [];

    for (const sObj of streamObjects) {
      try {
        const dec = decodePDFRawStream(sObj).decode();
        if (dec && dec.length > 0) {
          decodedChunks.push(dec);
          totalBytes += dec.length;
        }
      } catch {}
    }

    if (totalBytes === 0) return new Uint8Array(0);
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of decodedChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return combined;
  } catch {
    return new Uint8Array(0);
  }
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
    let matched1 = 0;
    for (let i = 0; i < rawBytes.length; i++) {
      const hexKey = rawBytes[i].toString(16).toUpperCase().padStart(4, "0");
      if (cmap.has(hexKey)) {
        decoded1 += cmap.get(hexKey);
        matched1++;
      } else {
        if (rawBytes[i] >= 32) decoded1 += String.fromCharCode(rawBytes[i]);
      }
    }
    if (matched1 > 0) return decoded1;
  }

  if (rawBytes.length >= 2 && rawBytes.length % 2 === 0 && rawBytes[0] === 0) {
    let s = "";
    for (let i = 0; i < rawBytes.length; i += 2) {
      const code = (rawBytes[i] << 8) | rawBytes[i + 1];
      if (code >= 32 || code === 10 || code === 13) s += String.fromCharCode(code);
    }
    if (s.trim()) return s;
  }

  return new TextDecoder("latin1").decode(rawBytes);
}

function extractTextItemsFromContentStream(streamBytes, fontCMaps) {
  const items = [];
  let currentFont = "";
  let lineStartX = 0, lineStartY = 0, currentX = 0, currentY = 0;
  let ctmA = 1, ctmB = 0, ctmC = 0, ctmD = 1, ctmE = 0, ctmF = 0;
  const ctmStack = [];

  let idx = 0;
  const len = streamBytes.length;

  function skipWhitespace() {
    while (idx < len && (streamBytes[idx] <= 32 || streamBytes[idx] === 0)) idx++;
  }

  function readWord() {
    skipWhitespace();
    const start = idx;
    while (
      idx < len &&
      streamBytes[idx] > 32 &&
      streamBytes[idx] !== 40 &&
      streamBytes[idx] !== 41 &&
      streamBytes[idx] !== 60 &&
      streamBytes[idx] !== 62 &&
      streamBytes[idx] !== 91 &&
      streamBytes[idx] !== 93 &&
      streamBytes[idx] !== 47
    ) {
      idx++;
    }
    return new TextDecoder("latin1").decode(streamBytes.subarray(start, idx));
  }

  function readLiteralStringBytes() {
    idx++; // skip '('
    const bytes = [];
    let depth = 1;
    while (idx < len) {
      const b = streamBytes[idx];
      if (b === 92) {
        idx++;
        if (idx >= len) break;
        const nb = streamBytes[idx];
        if (nb >= 48 && nb <= 55) {
          let oct = String.fromCharCode(nb);
          idx++;
          if (idx < len && streamBytes[idx] >= 48 && streamBytes[idx] <= 55) {
            oct += String.fromCharCode(streamBytes[idx]);
            idx++;
            if (idx < len && streamBytes[idx] >= 48 && streamBytes[idx] <= 55) {
              oct += String.fromCharCode(streamBytes[idx]);
              idx++;
            }
          }
          bytes.push(parseInt(oct, 8));
          continue;
        } else if (nb === 110) bytes.push(10);
        else if (nb === 114) bytes.push(13);
        else if (nb === 116) bytes.push(9);
        else if (nb === 98) bytes.push(8);
        else if (nb === 12) bytes.push(12);
        else bytes.push(nb);
        idx++;
      } else if (b === 40) {
        depth++;
        bytes.push(b);
        idx++;
      } else if (b === 41) {
        depth--;
        idx++;
        if (depth === 0) break;
        bytes.push(b);
      } else {
        bytes.push(b);
        idx++;
      }
    }
    return new Uint8Array(bytes);
  }

  function readHexStringBytes() {
    idx++; // skip '<'
    let hex = "";
    while (idx < len && streamBytes[idx] !== 62) {
      const b = streamBytes[idx];
      if ((b >= 48 && b <= 57) || (b >= 65 && b <= 70) || (b >= 97 && b <= 102)) {
        hex += String.fromCharCode(b);
      }
      idx++;
    }
    if (idx < len && streamBytes[idx] === 62) idx++;
    if (hex.length % 2 !== 0) hex += "0";
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  const tokenOperandStack = [];

  while (idx < len) {
    skipWhitespace();
    if (idx >= len) break;

    const b = streamBytes[idx];
    if (b === 47) {
      idx++;
      let name = "";
      while (
        idx < len &&
        streamBytes[idx] > 32 &&
        streamBytes[idx] !== 47 &&
        streamBytes[idx] !== 40 &&
        streamBytes[idx] !== 60 &&
        streamBytes[idx] !== 91
      ) {
        name += String.fromCharCode(streamBytes[idx]);
        idx++;
      }
      tokenOperandStack.push("/" + name);
    } else if (b === 40) {
      tokenOperandStack.push({ type: "str", bytes: readLiteralStringBytes() });
    } else if (b === 60 && idx + 1 < len && streamBytes[idx + 1] !== 60) {
      tokenOperandStack.push({ type: "str", bytes: readHexStringBytes() });
    } else if (b === 91) {
      idx++; // skip '['
      const arr = [];
      while (idx < len) {
        skipWhitespace();
        if (idx >= len) break;
        if (streamBytes[idx] === 93) {
          idx++;
          break;
        } else if (streamBytes[idx] === 40) {
          arr.push({ type: "str", bytes: readLiteralStringBytes() });
        } else if (streamBytes[idx] === 60 && streamBytes[idx + 1] !== 60) {
          arr.push({ type: "str", bytes: readHexStringBytes() });
        } else {
          const numStr = readWord();
          const n = parseFloat(numStr);
          if (!isNaN(n)) arr.push(n);
        }
      }
      tokenOperandStack.push({ type: "arr", items: arr });
    } else {
      const word = readWord();
      if (!word) {
        idx++;
        continue;
      }

      if (word === "q") {
        ctmStack.push([ctmA, ctmB, ctmC, ctmD, ctmE, ctmF]);
        tokenOperandStack.length = 0;
      } else if (word === "Q") {
        if (ctmStack.length > 0) {
          const top = ctmStack.pop();
          ctmA = top[0]; ctmB = top[1]; ctmC = top[2]; ctmD = top[3]; ctmE = top[4]; ctmF = top[5];
        }
        tokenOperandStack.length = 0;
      } else if (word === "cm") {
        if (tokenOperandStack.length >= 6) {
          const [a1, b1, c1, d1, e1, f1] = tokenOperandStack.slice(-6).map(Number);
          const a2 = ctmA * a1 + ctmC * b1;
          const b2 = ctmB * a1 + ctmD * b1;
          const c2 = ctmA * c1 + ctmC * d1;
          const d2 = ctmB * c1 + ctmD * d1;
          const e2 = ctmA * e1 + ctmC * f1 + ctmE;
          const f2 = ctmB * e1 + ctmD * f1 + ctmF;
          ctmA = a2; ctmB = b2; ctmC = c2; ctmD = d2; ctmE = e2; ctmF = f2;
        }
        tokenOperandStack.length = 0;
      } else if (word === "Tm") {
        if (tokenOperandStack.length >= 6) {
          const parts = tokenOperandStack.slice(-6).map(Number);
          lineStartX = ctmA * parts[4] + ctmC * parts[5] + ctmE;
          lineStartY = ctmB * parts[4] + ctmD * parts[5] + ctmF;
          currentX = lineStartX;
          currentY = lineStartY;
        }
        tokenOperandStack.length = 0;
      } else if (word === "Td" || word === "TD") {
        if (tokenOperandStack.length >= 2) {
          const [tx, ty] = tokenOperandStack.slice(-2).map(Number);
          lineStartX += ctmA * tx + ctmC * ty;
          lineStartY += ctmB * tx + ctmD * ty;
          currentX = lineStartX;
          currentY = lineStartY;
        }
        tokenOperandStack.length = 0;
      } else if (word === "T*") {
        lineStartY -= 12;
        currentX = lineStartX;
        currentY = lineStartY;
      } else if (word === "Tf") {
        if (tokenOperandStack.length >= 2) {
          currentFont = String(tokenOperandStack[tokenOperandStack.length - 2]).replace(/^\//, "");
        }
        tokenOperandStack.length = 0;
      } else if (word === "Tj") {
        if (tokenOperandStack.length >= 1) {
          const op = tokenOperandStack[tokenOperandStack.length - 1];
          if (op && op.type === "str") {
            const cmap = fontCMaps?.get(currentFont);
            const decoded = decodeBytesWithCMap(op.bytes, cmap);
            if (decoded && decoded.trim()) {
              items.push({ text: decoded.trim(), x: currentX, y: currentY });
            }
          }
        }
        tokenOperandStack.length = 0;
      } else if (word === "TJ") {
        if (tokenOperandStack.length >= 1) {
          const op = tokenOperandStack[tokenOperandStack.length - 1];
          if (op && op.type === "arr") {
            const cmap = fontCMaps?.get(currentFont);
            let combined = "";
            for (const elem of op.items) {
              if (elem && elem.type === "str") {
                combined += decodeBytesWithCMap(elem.bytes, cmap);
              } else if (typeof elem === "number" && elem < -120) {
                if (!combined.endsWith(" ")) combined += " ";
              }
            }
            if (combined && combined.trim()) {
              items.push({ text: combined.trim(), x: currentX, y: currentY });
            }
          }
        }
        tokenOperandStack.length = 0;
      } else {
        tokenOperandStack.push(word);
      }
    }
  }

  return items;
}

async function run() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf';
  const buf = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdfDoc.getPage(0);
  
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const items = extractTextItemsFromContentStream(sBytes, cmaps);

  console.log(`Extracted ${items.length} items.`);
  for (const it of items) {
    if (it.y < 150 || it.text.includes("ANNABEL") || it.text.includes("BALANA") || it.text.includes("CABREDO") || it.text.includes("LEAH") || it.text.includes("MALTO")) {
      console.log(`Item at (${it.x.toFixed(1)}, ${it.y.toFixed(1)}): "${it.text}"`);
    }
  }
}

run().catch(console.error);
