import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes } from "../src/utils/dtrVectorPdf";

async function main() {
  const bytes = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPages()[0];
  const streamBytes = extractPageContentStreamBytes(pdfDoc, page);
  const text = new TextDecoder("latin1").decode(streamBytes);
  const btMatches = [...text.matchAll(/BT[\s\S]*?ET/g)];

  for (let i = 0; i < btMatches.length; i++) {
    const b = btMatches[i][0];
    if (b.includes("00260028002a00050032002600390026000500320026003100390034")) {
      console.log(`Block ${i}:`);
      console.log(b);
    }
  }
}

main().catch(console.error);
