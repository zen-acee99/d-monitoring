import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes } from "../src/utils/dtrVectorPdf";

async function main() {
  const bytes = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPages()[0];
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const text = new TextDecoder("latin1").decode(sBytes);
  const blocks = [...text.matchAll(/BT[\s\S]*?ET/g)];

  console.log(`Total blocks: ${blocks.length}`);
  for (let i = blocks.length - 10; i < blocks.length; i++) {
    console.log(`--- Block ${i} ---`);
    console.log(blocks[i][0]);
  }
}

main().catch(console.error);
