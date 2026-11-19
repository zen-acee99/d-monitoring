import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream, measurePdfTextWidth, normalizeNameForMatch, isDecorationOrUnderline, isDigitalSignatureBadge } from "../src/utils/dtrVectorPdf.js";

async function testDualDtr() {
  const buf = fs.readFileSync("scratch/test_revistual.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const textItems = extractTextItemsFromContentStream(sBytes, cmaps);

  const personnelName = "ANNABEL C. ODOÑO-CALIMPONG";
  const normTarget = normalizeNameForMatch(personnelName);
  const targetParts = normTarget.split(/\s+/).filter((p) => p.length > 2);
  const nameLen = personnelName.length;

  const matches = textItems.filter((item) => {
    if (isDecorationOrUnderline(item.text) || isDigitalSignatureBadge(item.text)) return false;
    const normItem = normalizeNameForMatch(item.text);
    const isExactMatch = normTarget && (normItem === normTarget || normItem.includes(normTarget));
    const isPartsMatch = targetParts.length >= 2 && targetParts.every((part) => normItem.includes(part));
    return isExactMatch || isPartsMatch;
  });

  // Group into distinct physical occurrences (e.g. left copy vs right copy)
  const distinctMatches: typeof matches = [];
  for (const m of matches) {
    const isDuplicate = distinctMatches.some(
      (existing) => Math.abs(existing.x - m.x) < 40 && Math.abs(existing.y - m.y) < 15
    );
    if (!isDuplicate) {
      distinctMatches.push(m);
    }
  }

  console.log(`Found ${distinctMatches.length} distinct occurrences of "${personnelName}":`);
  const sigRects: [number, number, number, number][] = [];

  for (const item of distinctMatches) {
    const sameLineItems = textItems
      .filter((it) => Math.abs(it.y - item.y) < 4 && it.x >= item.x - 5 && it.x <= item.x + 250)
      .sort((a, b) => a.x - b.x);

    let rightmostX = item.x + measurePdfTextWidth(item.text.trim(), 10.5);
    for (const it of sameLineItems) {
      if (it.x <= rightmostX + 22) {
        const itEnd = it.x + measurePdfTextWidth(it.text.trim(), 10.5);
        if (itEnd > rightmostX) {
          rightmostX = itEnd;
        }
      }
    }
    const nameTextWidth = Math.max(measurePdfTextWidth(item.text.trim(), 10.5), rightmostX - item.x);

    let boxW = Math.max(115, Math.min(142, Math.round(38 + nameLen * 3.8)));
    const boxH = 18;

    let boxX = nameTextWidth > boxW
      ? Math.round(item.x + (nameTextWidth - boxW) / 2)
      : Math.round(item.x - 2);

    if (boxX + boxW > width - 10) {
      boxW = Math.max(90, width - boxX - 10);
      if (boxX + boxW > width - 10) {
        boxX = Math.max(10, width - boxW - 10);
      }
    }

    const boxY = Math.min(height - boxH - 4, Math.round(item.y + 9));
    sigRects.push([boxX, boxY, boxX + boxW, boxY + boxH]);
    console.log(` Occurrence at (${Math.round(item.x)}, ${Math.round(item.y)}) => Box: [${boxX}, ${boxY}, ${boxX + boxW}, ${boxY + boxH}]`);
  }

  process.exit(0);
}

testDualDtr().catch((e) => {
  console.error(e);
  process.exit(1);
});
