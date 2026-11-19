import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream, measurePdfTextWidth } from "../src/utils/dtrVectorPdf.js";

async function testPlacement() {
  const buf = fs.readFileSync("scratch/test_dv_real.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const textItems = extractTextItemsFromContentStream(sBytes, cmaps);

  console.log(`Page dimensions: width=${width}, height=${height}`);

  const testSigners = [
    "ANNABEL C. ODOÑO-CALIMPONG",
    "AIVAN M. BALOLOY",
  ];

  for (const signer of testSigners) {
    const item = textItems.find(it => it.text.toUpperCase().includes(signer.split(" ")[0]));
    if (!item) {
      console.log(`Could not find item for ${signer}`);
      continue;
    }

    const rawTargetName = signer.trim();
    const nameLen = rawTargetName.length;
    const nameTextWidth = measurePdfTextWidth(item.text.trim(), 10.5);

    // New proposed formula:
    // boxW is proportional to name, between 115 and 142 pt
    let boxW = Math.max(115, Math.min(142, Math.round(38 + nameLen * 3.8)));
    const boxH = 32;

    // Anchor directly above the personnel name (slightly left-aligned or centered, but NEVER crossing left column border)
    let boxX = Math.round(item.x - 2);
    
    // If name is centered in a wide column, we can center the stamp over the name if space allows
    if (nameTextWidth > boxW) {
      boxX = Math.round(item.x + (nameTextWidth - boxW) / 2);
    }

    // Never overflow page right edge
    if (boxX + boxW > width - 10) {
      boxW = Math.max(90, width - boxX - 10);
      if (boxX + boxW > width - 10) {
        boxX = Math.max(10, width - boxW - 10);
      }
    }

    const boxY = Math.min(height - boxH - 10, Math.round(item.y + 14));

    console.log(`\nSigner: "${signer}"`);
    console.log(`  Name text item at x=${item.x.toFixed(1)}, y=${item.y.toFixed(1)}, textWidth=${nameTextWidth.toFixed(1)}`);
    console.log(`  Name spans horizontally: [${item.x.toFixed(1)} ... ${(item.x + nameTextWidth).toFixed(1)}]`);
    console.log(`  Signature box: [x=${boxX}, y=${boxY}, w=${boxW}, h=${boxH}]`);
    console.log(`  Signature box spans horizontally: [${boxX} ... ${boxX + boxW}]`);
    console.log(`  Distance from left label "Signature" (x=318..363): ${boxX - 363} pt (positive = safe!)`);
  }
}

testPlacement().catch(console.error);
