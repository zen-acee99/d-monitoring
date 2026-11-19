import fs from "fs";
import { PDFDocument, PDFName, PDFDict, PDFStream } from "pdf-lib";

async function main() {
  const buf = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(buf);
  const page = pdfDoc.getPages()[0];

  const res = page.node.lookup(PDFName.of("Resources"), PDFDict);
  const fonts = res?.lookup(PDFName.of("Font"), PDFDict);
  if (fonts) {
    for (const key of fonts.keys()) {
      const fObj = fonts.lookup(key, PDFDict);
      const baseFont = fObj?.lookup(PDFName.of("BaseFont"), PDFName)?.asString();
      const subtype = fObj?.lookup(PDFName.of("Subtype"), PDFName)?.asString();
      const encoding = fObj?.lookup(PDFName.of("Encoding"))?.toString();
      const toUnicode = fObj?.lookup(PDFName.of("ToUnicode"));
      console.log(`Font ${key.asString()}: baseFont=${baseFont}, subtype=${subtype}, encoding=${encoding}, hasToUnicode=${Boolean(toUnicode)}`);
    }
  }
}

main().catch(console.error);
