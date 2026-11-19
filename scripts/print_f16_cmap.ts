import fs from "fs";
import { PDFDocument, PDFName, PDFDict, decodePDFRawStream } from "pdf-lib";

async function main() {
  const buf = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(buf);
  const page = pdfDoc.getPages()[0];

  const res = page.node.lookup(PDFName.of("Resources"), PDFDict);
  const fonts = res?.lookup(PDFName.of("Font"), PDFDict);
  const f16 = fonts?.lookup(PDFName.of("F16"), PDFDict);
  const toUnicode = f16?.get(PDFName.of("ToUnicode"));
  const stream = pdfDoc.context.lookup(toUnicode);
  const decoded = decodePDFRawStream(stream as any).decode();
  const cmapText = new TextDecoder("latin1").decode(decoded);
  console.log("Raw cmapText for F16:\n", cmapText);
}

main().catch(console.error);
