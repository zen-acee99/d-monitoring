import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream, measurePdfTextWidth } from "../src/utils/dtrVectorPdf.js";

async function verifyTo() {
  const buf = fs.readFileSync("scratch/test_to_real.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const textItems = extractTextItemsFromContentStream(sBytes, cmaps);

  const annabel = textItems.find(it => it.text.includes("ANNABEL"));
  const approved = textItems.find(it => it.text.includes("APPROVED"));

  console.log("Annabel item:", annabel);
  console.log("Approved item:", approved);

  const item = annabel!;
  const rawTargetName = "ANNABEL C. ODOÑO-CALIMPONG";
  const nameLen = rawTargetName.length;

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

  // 5-8 px gap above top of name:
  // Top of letters is ~ item.y + 7.
  // With boxY = item.y + 9, content is at item.y + 12.2, gap is 5.2 px.
  const boxY = Math.min(height - boxH - 10, Math.round(item.y + 9));

  console.log("\n--- Calculated Signature Placement ---");
  console.log(`boxX: ${boxX}, boxY: ${boxY}, boxW: ${boxW}, boxH: ${boxH}`);
  console.log(`Box vertical span: [${boxY} ... ${boxY + boxH}]`);
  console.log(`Annabel top of name letters: ~${item.y + 7.0}`);
  console.log(`Gap from name letters: ${(boxY + 3.2) - (item.y + 7.0)} px (MUST be 5-8px)`);
  console.log(`Distance to APPROVED: baseline (${approved?.y}): ${(approved?.y || 0) - (boxY + boxH)} pt (MUST be positive to not overlap!)`);
}

verifyTo().catch(console.error);
