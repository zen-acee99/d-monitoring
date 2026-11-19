import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from "../src/utils/dtrVectorPdf.js";

async function inspectRevistual() {
  const buf = fs.readFileSync("scratch/test_revistual.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  console.log("Page size:", width, "x", height);

  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const items = extractTextItemsFromContentStream(sBytes, cmaps);

  console.log("\n--- Matching ANNABEL in DTR ---");
  const annabels = items.filter(it => it.text.includes("ANNABEL") || it.text.includes("ODO"));
  annabels.forEach(it => console.log("Annabel:", it.text, "x:", it.x, "y:", it.y));

  console.log("\n--- Matching Verified as to the prescribed office hours ---");
  const verified = items.filter(it => it.text.toLowerCase().includes("verified"));
  verified.forEach(it => console.log("Verified:", it.text, "x:", it.x, "y:", it.y));

  console.log("\n--- Matching Employee Signature in DTR ---");
  const empSig = items.filter(it => it.text.toLowerCase().includes("employee signature"));
  empSig.forEach(it => console.log("EmpSig:", it.text, "x:", it.x, "y:", it.y));

  process.exit(0);
}

inspectRevistual().catch((e) => {
  console.error(e);
  process.exit(1);
});
