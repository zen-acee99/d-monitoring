import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream, measurePdfTextWidth } from "../src/utils/dtrVectorPdf.js";

function assembleTextItemsIntoLines(rawItems: any[]): any[] {
  if (rawItems.length <= 1) return rawItems;

  const linesMap = new Map<number, any[]>();
  for (const it of rawItems) {
    let matchedKey: number | null = null;
    for (const key of linesMap.keys()) {
      if (Math.abs(it.y - key) < 2.5) {
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

  const result: any[] = [];

  for (const [y, lineItems] of linesMap.entries()) {
    lineItems.sort((a, b) => a.x - b.x);

    let currentPhrase = "";
    let phraseStartX = lineItems[0].x;
    let prevItemRight = phraseStartX;

    for (let i = 0; i < lineItems.length; i++) {
      const it = lineItems[i];
      const estimatedItemWidth = Math.max(4, measurePdfTextWidth(it.text, 10));

      if (it.x - prevItemRight > 14 && currentPhrase.length > 0) {
        result.push({ text: currentPhrase.trim(), x: phraseStartX, y });
        currentPhrase = "";
        phraseStartX = it.x;
      } else if (it.x - prevItemRight > 3.2 && currentPhrase.length > 0 && !currentPhrase.endsWith(" ")) {
        currentPhrase += " ";
      }

      currentPhrase += it.text;
      prevItemRight = it.x + estimatedItemWidth;
    }

    if (currentPhrase.trim().length > 0) {
      result.push({ text: currentPhrase.trim(), x: phraseStartX, y });
    }
  }

  return result;
}

async function testMemo() {
  const buf = fs.readFileSync("scratch/test_memo_138.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });

  for (let p = 0; p < pdfDoc.getPageCount(); p++) {
    const page = pdfDoc.getPage(p);
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    const cmaps = loadPageFontCMaps(pdfDoc, page);
    const raw = extractTextItemsFromContentStream(sBytes, cmaps);
    const assembled = assembleTextItemsIntoLines(raw);

    const matches = assembled.filter(it => it.text.toUpperCase().includes("ANNABEL") || it.text.toUpperCase().includes("ODO"));
    if (matches.length > 0) {
      console.log(`Page ${p + 1} matches:`, matches);
      const item = matches[0];
      const boxW = 137;
      const boxH = 18;
      const boxX = Math.round(item.x);
      const boxY = Math.round(item.y + 9);
      console.log(`Calculated placement on Page ${p + 1}: boxX=${boxX}, boxY=${boxY}, boxW=${boxW}, boxH=${boxH}`);
    }
  }
  process.exit(0);
}

testMemo().catch((e) => {
  console.error(e);
  process.exit(1);
});
