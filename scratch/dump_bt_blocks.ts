import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes } from "../src/utils/dtrVectorPdf";

async function main() {
  const bytes = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPages()[0];
  const streamBytes = extractPageContentStreamBytes(pdfDoc, page);
  const text = new TextDecoder("latin1").decode(streamBytes);

  console.log("Total stream length:", text.length);
  // Find occurrences of BT
  const btMatches = [...text.matchAll(/BT[\s\S]*?ET/g)];
  console.log(`Found ${btMatches.length} BT...ET blocks.`);

  // Let's print the first 3 blocks and any block that has F16 or F15
  for (let i = 0; i < Math.min(5, btMatches.length); i++) {
    console.log(`--- Block ${i} ---`);
    console.log(btMatches[i][0]);
  }

  // Print blocks containing F15 or F16
  for (let i = 0; i < btMatches.length; i++) {
    if (btMatches[i][0].includes("/F15") || btMatches[i][0].includes("/F16")) {
      console.log(`--- Block ${i} with F15/F16 ---`);
      console.log(btMatches[i][0]);
    }
  }
}

main().catch(console.error);
