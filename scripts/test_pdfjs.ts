import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function testPdf() {
  const data = new Uint8Array(fs.readFileSync('scratch/debug_abstract.pdf'));
  try {
    const doc = await pdfjsLib.getDocument({ data }).promise;
    console.log("PDF.js loaded successfully! Num pages:", doc.numPages);
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      console.log(`Page ${i} viewport:`, vp.width, "x", vp.height);
      const content = await page.getTextContent();
      console.log(`Page ${i} text items:`, content.items.length);
      const annots = await page.getAnnotations();
      console.log(`Page ${i} annotations:`, annots.length);
      for (const a of annots) {
        console.log(`  Annot: subtype=${a.subtype}, fieldType=${a.fieldType}, fieldName=${a.fieldName}, rect=${a.rect}`);
      }
    }
  } catch (e: any) {
    console.error("PDF.js error:", e);
  }
}

testPdf().catch(console.error);
