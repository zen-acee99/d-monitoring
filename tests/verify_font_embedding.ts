import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

async function verifyFontEmbedding() {
  console.log("Starting font embedding test...");
  
  const pdfDoc = await PDFDocument.create();
  
  // CRITICAL: Registration
  console.log("Registering fontkit...");
  pdfDoc.registerFontkit(fontkit);
  
  const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSerif-Regular.ttf");
  console.log(`Loading font from: ${fontPath}`);
  const fontBytes = readFileSync(fontPath);
  
  console.log("Embedding font...");
  const font = await pdfDoc.embedFont(fontBytes);
  
  const page = pdfDoc.addPage([612, 792]);
  const text = "Ññéó— (Special chars check)";
  console.log(`Drawing text: ${text}`);
  page.drawText(text, {
    x: 50,
    y: 700,
    size: 20,
    font: font,
  });
  
  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(process.cwd(), "scratch", "test_font_embedding.pdf");
  writeFileSync(outputPath, pdfBytes);
  
  console.log(`Successfully saved PDF to: ${outputPath}`);
}

verifyFontEmbedding().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
