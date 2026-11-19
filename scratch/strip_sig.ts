import fs from "fs";
import { PDFDocument, PDFName, PDFArray, PDFDict } from "pdf-lib";

async function main() {
  const bytes = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPages()[0];
  const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  console.log("Annots size:", annots?.size());

  // Remove the widget annotation
  page.node.delete(PDFName.of("Annots"));
  pdfDoc.catalog.delete(PDFName.of("AcroForm"));

  const cleanBytes = await pdfDoc.save();
  fs.writeFileSync("scratch/clean_original_ace_dtr.pdf", cleanBytes);
  console.log("Saved pristine clean scratch/clean_original_ace_dtr.pdf without misplaced signatures!");
}

main().catch(console.error);
