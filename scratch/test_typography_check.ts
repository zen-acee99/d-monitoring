import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { checkVisualTypographyOnPage } from '../src/utils/dtrVectorPdf';

async function testCheck() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794696272616_577d24d5.pdf';
  const bytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(bytes);
  
  // Sig 1: [238, 338, 195, 32]
  const rect1 = { minX: 238, minY: 338, maxX: 238 + 195, maxY: 338 + 32 };
  const check1 = checkVisualTypographyOnPage(pdfDoc, 0, rect1, "Buena");
  console.log("Check 1 (Approved by):", check1);

  // Sig 2: [309, 184, 195, 32]
  const rect2 = { minX: 309, minY: 184, maxX: 309 + 195, maxY: 184 + 32 };
  const check2 = checkVisualTypographyOnPage(pdfDoc, 0, rect2, "Buena");
  console.log("Check 2 (Departure Guard/Officer):", check2);
}
testCheck().catch(console.error);
