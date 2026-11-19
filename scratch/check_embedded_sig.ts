import fs from "fs";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { extractPageContentStreamBytes } from "../src/utils/dtrVectorPdf";

async function main() {
  const bytes = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPages()[0];
  const streamBytes = extractPageContentStreamBytes(pdfDoc, page);
  const text = new TextDecoder("latin1").decode(streamBytes);

  console.log("Stream length:", text.length);

  // Check for XObjects
  const xobjMatches = [...text.matchAll(/\/(\w+)\s+Do/g)];
  console.log("XObject calls (Do):", xobjMatches.map(m => m[0]));

  // Check where "by Ace malto" is in the content stream!
  const maltoIdx = text.indexOf("by Ace malto");
  console.log("Index of 'by Ace malto':", maltoIdx);
  if (maltoIdx !== -1) {
    console.log("Surrounding context:", text.substring(maltoIdx - 100, maltoIdx + 100));
  } else {
    console.log("'by Ace malto' not found in page content stream!");
  }

  // Check page resources XObject
  const res = page.node.lookup(PDFName.of("Resources"), PDFDict);
  const xobjDict = res.lookupMaybe(PDFName.of("XObject"), PDFDict);
  if (xobjDict) {
    console.log("XObjects in Resources:", xobjDict.keys().map(k => k.asString()));
  }
}

main().catch(console.error);
