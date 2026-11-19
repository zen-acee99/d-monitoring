import fs from "fs";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";

async function main() {
  const bytes = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(bytes);
  const context = pdfDoc.context;

  const enumerated = context.enumerateIndirectObjects();
  console.log(`Enumerated ${enumerated.length} objects.`);

  for (const [ref, obj] of enumerated) {
    if (obj instanceof PDFRawStream || (obj as any).getContents || (obj as any).decode) {
      try {
        const decoded = decodePDFRawStream(obj as any).decode();
        const str = new TextDecoder("latin1").decode(decoded);
        if (str.includes("by Ace malto") || str.includes("Ace malto")) {
          console.log(`Found in object ${ref.tag}:`);
          console.log(str.slice(0, 500));
        }
      } catch {}
    }
  }
}

main().catch(console.error);
