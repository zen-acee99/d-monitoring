import { PDFDocument, StandardFonts } from "pdf-lib";

async function measure() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const text = "by Annabel C. Odoño-Calimpong";
  for (let sz = 6.0; sz >= 4.0; sz -= 0.5) {
    console.log(`Size ${sz.toFixed(1)}: width = ${font.widthOfTextAtSize(text, sz).toFixed(1)} pt`);
  }
  const title = "Digitally signed";
  console.log(`Title "Digitally signed" at 5.5pt: width = ${font.widthOfTextAtSize(title, 5.5).toFixed(1)} pt`);
}

measure().catch(console.error);
