import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from "../src/utils/dtrVectorPdf.js";

async function checkPdf(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.log(`${filePath} DOES NOT EXIST`);
    return;
  }
  const buf = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdfDoc.getPages()[0];
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const textItems = extractTextItemsFromContentStream(sBytes, cmaps);
  console.log(`\n=== ${filePath} (Total items: ${textItems.length}) ===`);
  const relevant = textItems.filter(it => {
    const t = it.text.toUpperCase();
    return t.includes("TABO") || t.includes("MALTO") || t.includes("BALOLOY") || t.includes("APPROVED") || t.includes("SUPERVISION") || t.includes("ODO");
  });
  relevant.forEach(it => console.log(`  y=${it.y.toFixed(1)}, x=${it.x.toFixed(1)}: "${it.text}"`));
}

async function main() {
  await checkPdf("scratch/test_dv.pdf");
  await checkPdf("scratch/test_dv_corrected.pdf");
  await checkPdf("scratch/signed_dv_perfect.pdf");
}
main();
