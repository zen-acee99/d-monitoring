import fs from "fs";
import { PDFDocument, PDFName, PDFDict, decodePDFRawStream } from "pdf-lib";
import { extractPageContentStreamBytes } from "../src/utils/dtrVectorPdf";

function parsePdfCMap(cmapText: string): Map<string, string> {
  const map = new Map<string, string>();
  const bfCharBlocks = cmapText.match(/beginbfchar([\s\S]*?)endbfchar/g) || [];
  for (const block of bfCharBlocks) {
    const pairRegex = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let match: RegExpExecArray | null;
    while ((match = pairRegex.exec(block)) !== null) {
      const srcHex = match[1].toUpperCase().padStart(4, "0");
      const dstHex = match[2];
      let str = "";
      for (let i = 0; i < dstHex.length; i += 4) {
        const code = parseInt(dstHex.substring(i, i + 4), 16);
        str += String.fromCharCode(code);
      }
      map.set(srcHex, str);
    }
  }

  const bfRangeBlocks = cmapText.match(/beginbfrange([\s\S]*?)endbfrange/g) || [];
  for (const block of bfRangeBlocks) {
    const lines = block.split("\n");
    for (const line of lines) {
      const match1 = line.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
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
      const match2 = line.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/);
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

function extractTextItems(streamBytes: Uint8Array, fontCMaps?: Map<string, Map<string, string>>) {
  const items: Array<{ text: string; x: number; y: number }> = [];
  let currentFont = "";
  let lineStartX = 0, lineStartY = 0, currentX = 0, currentY = 0;
  let currentLeading = 12;
  let ctmA = 1, ctmB = 0, ctmC = 0, ctmD = 1, ctmE = 0, ctmF = 0;
  const ctmStack: Array<[number, number, number, number, number, number]> = [];

  let idx = 0;
  const len = streamBytes.length;

  function skipWhitespace() {
    while (idx < len && (streamBytes[idx] <= 32 || streamBytes[idx] === 0)) idx++;
  }

  function readWord(): string {
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

  function readLiteralStringBytes(): Uint8Array {
    idx++; // skip '('
    const bytes: number[] = [];
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
        else if (nb === 102) bytes.push(12);
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

  function readHexStringBytes(): Uint8Array {
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
      idx++; // skip '['
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
      } else if (word === "TL") {
        if (tokenOperandStack.length >= 1) {
          currentLeading = parseFloat(tokenOperandStack[tokenOperandStack.length - 1]) || 12;
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
        lineStartY -= currentLeading;
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

async function main() {
  const bytes = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPages()[0];
  const resources = page.node.lookup(PDFName.of("Resources"), PDFDict);
  const fontDict = resources.lookup(PDFName.of("Font"), PDFDict);
  const fontCMaps = new Map<string, Map<string, string>>();

  for (const k of fontDict.keys()) {
    const fontName = k.asString().replace(/^\//, "");
    const fontObj = fontDict.lookup(k, PDFDict);
    const toUnicodeRef = fontObj.get(PDFName.of("ToUnicode"));
    if (toUnicodeRef) {
      const stream = pdfDoc.context.lookup(toUnicodeRef);
      const decoded = decodePDFRawStream(stream as any).decode();
      const text = new TextDecoder("latin1").decode(decoded);
      const m = parsePdfCMap(text);
      fontCMaps.set(fontName, m);
      console.log(`Font /${fontName} has ${m.size} mappings.`);
    }
  }

  const dec = extractPageContentStreamBytes(pdfDoc, page);

  const items = extractTextItems(dec, fontCMaps);
  console.log(`Extracted ${items.length} items.`);
  for (const it of items) {
    if (it.text.toLowerCase().includes("ace") || it.text.toLowerCase().includes("rene") || it.text.toLowerCase().includes("certify")) {
      console.log(`Candidate: "${it.text}" at (${it.x.toFixed(1)}, ${it.y.toFixed(1)})`);
    }
  }
}

main().catch(console.error);
