import fs from "fs";
import { PDFDocument } from "pdf-lib";
import {
  extractPageContentStreamBytes,
  loadPageFontCMaps,
  extractTextItemsFromContentStream,
  extractVerticalLinesFromContentStream,
  measurePdfTextWidth
} from "../src/utils/dtrVectorPdf.js";

async function main() {
  const buf = fs.readFileSync("scratch/test_dv_real.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const textItems = extractTextItemsFromContentStream(sBytes, cmaps);
  const vLines = extractVerticalLinesFromContentStream(sBytes);

  console.log(`Page dimensions: width=${width}, height=${height}`);
  console.log(`Found ${vLines.length} vertical lines.`);

  // 1. Locate Section D header
  const sectionDHeader = textItems.find(it => it.text.toUpperCase().includes("APPROVED FOR PAYMENT"));
  console.log("Section D header:", sectionDHeader ? `"${sectionDHeader.text}" at x=${sectionDHeader.x}, y=${sectionDHeader.y}` : "NOT FOUND");

  // 2. Locate Section A header
  const sectionAHeader = textItems.find(it => it.text.toUpperCase().includes("UNDER MY DIRECT SUPERVISION"));
  console.log("Section A header:", sectionAHeader ? `"${sectionAHeader.text}" at x=${sectionAHeader.x}, y=${sectionAHeader.y}` : "NOT FOUND");

  // 3. Find vertical dividing lines separating Section C and Section D
  const dividerLines = vLines.filter(vl => vl.x > 300 && vl.x < 330);
  console.log("Dividing vertical lines near x=318:", dividerLines);

  // 4. Find all items in Section D
  if (sectionDHeader) {
    const secDItems = textItems.filter(it => it.x >= sectionDHeader.x - 10 && it.y < sectionDHeader.y && it.y > 100);
    console.log(`\nItems in Section D (total ${secDItems.length}):`);
    secDItems.sort((a,b) => b.y - a.y);
    secDItems.forEach(it => console.log(`  y=${it.y.toFixed(1)}, x=${it.x.toFixed(1)}: "${it.text}"`));
  }
}
main();
