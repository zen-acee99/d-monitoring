import { PDFDocument } from "pdf-lib";
import { readFileSync } from "fs";
import path from "path";

async function inspectPdf() {
  const pdfPath = path.join(process.cwd(), "scratch", "test_font_embedding.pdf");
  const pdfBytes = readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  // Inspect objects directly
  const context = (pdfDoc as any).context;
  const objects = context.enumerateIndirectObjects();
  
  let foundFontDescriptor = false;
  
  for (const [ref, obj] of objects) {
    const objStr = obj.toString();
    if (objStr.includes("FontDescriptor")) {
      console.log(`Found FontDescriptor in object ${ref}`);
      foundFontDescriptor = true;
    }
  }
  
  if (foundFontDescriptor) {
    console.log("SUCCESS: FontDescriptor found.");
  } else {
    console.log("FAILURE: FontDescriptor not found.");
  }
}

inspectPdf().catch(e => {
  console.error("Inspection failed:", e);
  process.exit(1);
});
