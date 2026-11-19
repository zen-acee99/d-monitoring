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

async function run() {
  const files = [
    { name: "DV", path: "scratch/test_dv.pdf", target: "ANNABEL" },
    { name: "Travel Order", path: "scratch/test_to_real.pdf", target: "ANNABEL" },
    { name: "DTR", path: "scratch/test_revistual.pdf", target: "ANNABEL" },
    { name: "Memo 138", path: "scratch/test_memo_138.pdf", target: "ANNABEL" },
  ];

  for (const f of files) {
    if (!fs.existsSync(f.path)) continue;
    const buf = fs.readFileSync(f.path);
    const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
    console.log(`\n=== Testing ${f.name} ===`);
    for (let p = 0; p < pdfDoc.getPageCount(); p++) {
      const page = pdfDoc.getPage(p);
      const sBytes = extractPageContentStreamBytes(pdfDoc, page);
      const cmaps = loadPageFontCMaps(pdfDoc, page);
      const raw = extractTextItemsFromContentStream(sBytes, cmaps);
      const assembled = assembleTextItemsIntoLines(raw);

      const m = assembled.filter(it => it.text.toUpperCase().includes(f.target));
      if (m.length > 0) {
        console.log(` Page ${p + 1} matches:`, m.map(it => `"${it.text}" at (${Math.round(it.x)}, ${Math.round(it.y)})`));
      }
    }
  }

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
