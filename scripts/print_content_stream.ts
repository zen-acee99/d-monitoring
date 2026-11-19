import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes } from "../src/utils/dtrVectorPdf.js";

async function main() {
  const buf = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(buf);
  const page = pdfDoc.getPages()[0];
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const str = new TextDecoder("latin1").decode(sBytes);
  console.log("Content stream length:", str.length);
  console.log("First 1500 chars:\n", str.slice(0, 1500));
}

main().catch(console.error);
