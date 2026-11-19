import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps } from '../src/utils/dtrVectorPdf';

function decodeBytesWithCMap(rawBytes: Uint8Array, cmap?: Map<string, string>): string {
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
  return new TextDecoder("latin1").decode(rawBytes);
}

async function main() {
  const bytes = fs.readFileSync('scratch/masareta_from_db.pdf');
  const doc = await PDFDocument.load(bytes);
  const p = doc.getPages()[1];
  const streamBytes = extractPageContentStreamBytes(doc, p);
  const fontCMaps = loadPageFontCMaps(doc, p);

  let currentFont = "";
  let lineStartX = 0, lineStartY = 0, currentX = 0, currentY = 0;
  let ctmA = 1, ctmB = 0, ctmC = 0, ctmD = 1, ctmE = 0, ctmF = 0;
  const ctmStack: Array<[number, number, number, number, number, number]> = [];

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

  function readLiteralStringBytes(): Uint8Array {
    idx++;
    const bArr: number[] = [];
    let depth = 1;
    while (idx < len) {
      const b = streamBytes[idx];
      if (b === 92) {
        idx++;
        bArr.push(streamBytes[idx]);
        idx++;
      } else if (b === 40) {
        depth++;
        bArr.push(b);
        idx++;
      } else if (b === 41) {
        depth--;
        idx++;
        if (depth === 0) break;
        bArr.push(b);
      } else {
        bArr.push(b);
        idx++;
      }
    }
    return new Uint8Array(bArr);
  }

  function readHexStringBytes(): Uint8Array {
    idx++;
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
    const bArr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bArr[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bArr;
  }

  const tokenOperandStack: any[] = [];

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
      idx++;
      const arr: any[] = [];
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
          const top = ctmStack.pop()!;
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
      } else if (word === "BT") {
        lineStartX = ctmE;
        lineStartY = ctmF;
        currentX = lineStartX;
        currentY = lineStartY;
        tokenOperandStack.length = 0;
      } else if (word === "ET") {
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
      } else if (word === "Tf") {
        if (tokenOperandStack.length >= 2) {
          currentFont = String(tokenOperandStack[tokenOperandStack.length - 2]).replace(/^\//, "");
        }
        tokenOperandStack.length = 0;
      } else if (word === "TJ" || word === "Tj") {
        const op = tokenOperandStack[tokenOperandStack.length - 1];
        let decoded = "";
        const cmap = fontCMaps?.get(currentFont);
        if (word === "Tj" && op?.type === "str") {
          decoded = decodeBytesWithCMap(op.bytes, cmap);
        } else if (word === "TJ" && op?.type === "arr") {
          for (const elem of op.items) {
            if (elem && elem.type === "str") {
              decoded += decodeBytesWithCMap(elem.bytes, cmap);
            }
          }
        }
        if (decoded.includes("ANNABEL") || decoded.includes("Director") || decoded.includes("Approved") || decoded.includes("MASARETA")) {
          console.log(`Matched text: "${decoded.trim()}" at x=${currentX}, y=${currentY}, CTM=[${ctmA}, ${ctmB}, ${ctmC}, ${ctmD}, ${ctmE}, ${ctmF}]`);
        }
        tokenOperandStack.length = 0;
      } else {
        tokenOperandStack.push(word);
      }
    }
  }
}

main().catch(console.error);
