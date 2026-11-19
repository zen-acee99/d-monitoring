import fs from "fs";
import { PDFDocument } from "pdf-lib";
import {
  loadPageFontCMaps,
  extractPageContentStreamBytes,
  extractTextItemsFromContentStream,
} from "../src/utils/dtrVectorPdf";

async function main() {
  const bytes = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(bytes);
  const pages = pdfDoc.getPages();
  console.log(`PDF has ${pages.length} pages.`);

  const page = pages[0];
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  console.log(`Loaded ${cmaps.size} font CMaps:`);
  for (const [font, map] of cmaps.entries()) {
    console.log(`  Font /${font}: ${map.size} mappings`);
    if (map.size > 0) {
      const sample = Array.from(map.entries()).slice(0, 5);
      console.log(`    Sample:`, sample);
    }
  }

  const contentBytes = extractPageContentStreamBytes(pdfDoc, page);
  console.log(`Content stream bytes: ${contentBytes.length}`);

  const items = extractTextItemsFromContentStream(contentBytes, cmaps);
  console.log(`Extracted items count: ${items.length}`);
  for (const it of items) {
    if (it.text.toLowerCase().includes("ace") || it.text.toLowerCase().includes("malto") || it.text.toLowerCase().includes("rene") || it.text.toLowerCase().includes("certify")) {
      console.log(`Found candidate: "${it.text}" at (${it.x.toFixed(1)}, ${it.y.toFixed(1)})`);
    }
  }
}

main().catch(console.error);
