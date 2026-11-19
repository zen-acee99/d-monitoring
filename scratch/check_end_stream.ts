import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes } from "../src/utils/dtrVectorPdf";

async function main() {
  const bytes = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPages()[0];
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const text = new TextDecoder("latin1").decode(sBytes);

  const idx207 = text.indexOf("(Provincial Officer - Albay) Tj");
  console.log("From Block 207 to end of stream:");
  console.log(text.substring(idx207));
}

main().catch(console.error);
