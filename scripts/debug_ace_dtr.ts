import fs from "fs";
import { PDFDocument } from "pdf-lib";
import {
  extractPageContentStreamBytes,
  loadPageFontCMaps,
  extractTextItemsFromContentStream,
  detectExistingPdfSignatures,
  findPersonnelSignatureCoordinates,
  matchNames
} from "../src/utils/dtrVectorPdf.js";

async function main() {
  const buf = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  console.log("Pages count:", pages.length);

  const existingSigs = detectExistingPdfSignatures(pdfDoc);
  console.log("Existing Sigs:", existingSigs);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    console.log(`Page ${i + 1} size: ${width} x ${height}`);
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    console.log(`Page ${i + 1} content stream bytes: ${sBytes.length}`);
    const cmaps = loadPageFontCMaps(pdfDoc, page);
    console.log(`Page ${i + 1} font cmaps count:`, cmaps.length);
    const items = extractTextItemsFromContentStream(sBytes, cmaps);
    console.log(`Page ${i + 1} extracted text items: ${items.length}`);
    
    // Check all items
    console.log("Sample items (first 20):", items.slice(0, 20).map(it => `[y=${it.y.toFixed(1)}, x=${it.x.toFixed(1)}] "${it.text}"`));
    
    // Check items matching Ace or Malto
    const aceItems = items.filter(it => it.text.toUpperCase().includes("ACE") || it.text.toUpperCase().includes("MALTO"));
    console.log("Ace/Malto items:", aceItems.map(it => `[y=${it.y.toFixed(1)}, x=${it.x.toFixed(1)}] "${it.text}"`));

    // Check items matching Rene or Buena
    const reneItems = items.filter(it => it.text.toUpperCase().includes("RENE") || it.text.toUpperCase().includes("BUENA"));
    console.log("Rene/Buena items:", reneItems.map(it => `[y=${it.y.toFixed(1)}, x=${it.x.toFixed(1)}] "${it.text}"`));
  }

  const coords = findPersonnelSignatureCoordinates(pdfDoc, "Ace malto");
  console.log("\nfindPersonnelSignatureCoordinates('Ace malto'):", coords);

  const coordsMata = findPersonnelSignatureCoordinates(pdfDoc, "ACE MATA MALTO");
  console.log("\nfindPersonnelSignatureCoordinates('ACE MATA MALTO'):", coordsMata);
}

main().catch(console.error);
