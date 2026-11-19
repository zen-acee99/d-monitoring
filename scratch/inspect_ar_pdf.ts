import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream, findPersonnelSignatureCoordinates } from "../src/utils/dtrVectorPdf.js";

async function inspectAr() {
  const buf = fs.readFileSync("public/AR_Ace_M._Malto_September_2026.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  console.log("AR Page count:", pdfDoc.getPageCount());

  for (let p = 0; p < pdfDoc.getPageCount(); p++) {
    const page = pdfDoc.getPage(p);
    const { width, height } = page.getSize();
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    const cmaps = loadPageFontCMaps(pdfDoc, page);
    const items = extractTextItemsFromContentStream(sBytes, cmaps);

    console.log(`\n--- Page ${p + 1} (${width}x${height}) ---`);
    const footerItems = items.filter(it => it.y < 200);
    footerItems.forEach(it => console.log(it.text, "x:", Math.round(it.x), "y:", Math.round(it.y)));
  }

  // Test findPersonnelSignatureCoordinates for supervisor
  const loc = findPersonnelSignatureCoordinates(pdfDoc, "RENE JANE R. BUENA", { isCounterSign: false });
  console.log("\nCalculated coords for Rene Jane Buena in AR:", loc);

  const locAnnabel = findPersonnelSignatureCoordinates(pdfDoc, "ANNABEL C. ODOÑO-CALIMPONG", { isCounterSign: false });
  console.log("Calculated coords for Annabel in AR:", locAnnabel);

  process.exit(0);
}

inspectAr().catch((e) => {
  console.error(e);
  process.exit(1);
});
