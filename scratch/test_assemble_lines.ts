import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from "../src/utils/dtrVectorPdf.js";

async function assembleLines() {
  const buf = fs.readFileSync("scratch/test_memo_138.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdfDoc.getPage(1); // Page 2
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const rawItems = extractTextItemsFromContentStream(sBytes, cmaps);

  console.log("Raw items count:", rawItems.length);

  // Group raw items into lines where Math.abs(item.y - line.y) < 2
  // And within each line sort by x
  const linesMap = new Map<number, typeof rawItems>();
  for (const it of rawItems) {
    let matchedKey: number | null = null;
    for (const key of linesMap.keys()) {
      if (Math.abs(it.y - key) < 2) {
        matchedKey = key;
        break;
      }
    }
    if (matchedKey !== null) {
      linesMap.get(matchedKey)!.push(it);
    } else {
      linesMap.set(it.y, [it]);
    }
  }

  // Sort each line by x and combine into full line text
  const assembledLines: { text: string; x: number; y: number }[] = [];
  for (const [y, lineItems] of linesMap.entries()) {
    lineItems.sort((a, b) => a.x - b.x);
    let lineStr = "";
    let startX = lineItems[0].x;
    let prevEndX = startX;

    for (let i = 0; i < lineItems.length; i++) {
      const it = lineItems[i];
      // If gap is large, add space
      if (it.x - prevEndX > 4 && lineStr.length > 0 && !lineStr.endsWith(" ")) {
        lineStr += " ";
      }
      lineStr += it.text;
      prevEndX = it.x + (it.text.length * 6);
    }
    assembledLines.push({ text: lineStr, x: startX, y });
  }

  // Sort lines top to bottom (descending y)
  assembledLines.sort((a, b) => b.y - a.y);

  console.log("\n--- Assembled Lines on Page 2 ---");
  for (const line of assembledLines) {
    if (line.text.toUpperCase().includes("ANNABEL") || line.text.toUpperCase().includes("DIRECTOR") || line.text.toUpperCase().includes("MELAD") || line.text.toUpperCase().includes("RECOMMEND")) {
      console.log(`Line at y=${Math.round(line.y)}, x=${Math.round(line.x)}: "${line.text}"`);
    }
  }
  process.exit(0);
}

assembleLines().catch((e) => {
  console.error(e);
  process.exit(1);
});
