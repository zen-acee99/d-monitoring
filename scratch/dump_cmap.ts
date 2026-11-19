import fs from "fs";
import { PDFDocument, PDFName, PDFDict, decodePDFRawStream } from "pdf-lib";

async function main() {
  const bytes = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPages()[0];
  const resources = page.node.lookup(PDFName.of("Resources"), PDFDict);
  const fontDict = resources.lookup(PDFName.of("Font"), PDFDict);

  for (const k of fontDict.keys()) {
    const fontName = k.asString();
    const fontObj = fontDict.lookup(k, PDFDict);
    const toUnicodeRef = fontObj.get(PDFName.of("ToUnicode"));
    if (toUnicodeRef) {
      const stream = pdfDoc.context.lookup(toUnicodeRef);
      const decoded = decodePDFRawStream(stream as any).decode();
      const text = new TextDecoder("latin1").decode(decoded);
      console.log(`=== Font ${fontName} ToUnicode CMap (len ${text.length}): ===`);
      console.log(text.slice(0, 1000));
      console.log("...");
      console.log(text.slice(-500));
    }
  }
}

main().catch(console.error);
