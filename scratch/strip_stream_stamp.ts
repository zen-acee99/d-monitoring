import fs from "fs";
import { PDFDocument, PDFName, PDFDict, PDFRawStream } from "pdf-lib";
import { extractPageContentStreamBytes } from "../src/utils/dtrVectorPdf";

async function main() {
  const bytes = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPages()[0];
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const text = new TextDecoder("latin1").decode(sBytes);

  // Find where the misplaced stamp starts:
  // "q\n1 0 0 1 308 155 cm"
  const stampMarker = "q\n1 0 0 1 308 155 cm";
  const stampIdx = text.indexOf(stampMarker);
  console.log("Misplaced stamp marker index:", stampIdx);

  if (stampIdx !== -1) {
    const cleanStreamText = text.substring(0, stampIdx);
    console.log("Clean stream ends with:", cleanStreamText.slice(-50));
    const cleanStreamBytes = new TextEncoder().encode(cleanStreamText);

    // Replace page Contents with clean stream
    const contentsObj = pdfDoc.context.flateStream(cleanStreamBytes);
    const contentsRef = pdfDoc.context.register(contentsObj);
    page.node.set(PDFName.of("Contents"), contentsRef);

    // Also remove Annotations and AcroForm
    page.node.delete(PDFName.of("Annots"));
    pdfDoc.catalog.delete(PDFName.of("AcroForm"));

    const pristinePdf = await pdfDoc.save();
    fs.writeFileSync("scratch/truly_pristine_ace_dtr.pdf", pristinePdf);
    console.log("Saved scratch/truly_pristine_ace_dtr.pdf!");
  }
}

main().catch(console.error);
