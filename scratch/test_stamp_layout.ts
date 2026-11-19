import fs from "fs";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

async function testStamp() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // Draw simulated APPROVED: and ANNABEL text matching the real Travel Order
  page.drawText("APPROVED:", { x: 355.8, y: 204.7, size: 8.5, font, color: rgb(0, 0, 0) });
  page.drawText("ANNABEL C. ODOÑO-CALIMPONG", { x: 355.8, y: 176.0, size: 8.5, font, color: rgb(0, 0, 0) });
  page.drawText("OIC-Regional Director, DICT Regional Office No. V", { x: 355.8, y: 166.0, size: 7.5, font, color: rgb(0, 0, 0) });

  // Now draw signature stamp directly above name with 6px gap
  // Annabel top of letters is at ~183.0.
  // 6px gap above top of name -> signature bottom at y = 183.0 + 6 = 189.0
  const boxX = 356;
  const boxY = 187; // box bottom
  const boxW = 135;
  const boxH = 16;  // box top is at 187 + 16 = 203 (below APPROVED: at 204.7!)

  // Vector checkmark or simulated sig image on left: width 24, height 14
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 0.5,
  });

  page.drawText("Digitally signed", {
    x: boxX + 28,
    y: boxY + 8.5,
    size: 5.2,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText("by Annabel C. Odoño-Calimpong", {
    x: boxX + 28,
    y: boxY + 2.5,
    size: 5.0,
    font,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await doc.save();
  fs.writeFileSync("scratch/test_stamp_layout.pdf", pdfBytes);
  console.log("Saved scratch/test_stamp_layout.pdf");
}

testStamp().catch(console.error);
