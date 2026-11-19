import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { checkVisualTypographyOnPage } from '../src/utils/dtrVectorPdf';

async function test() {
  const bytes = fs.readFileSync('c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15).pdf');
  const pdfDoc = await PDFDocument.load(bytes);
  // DTR_Malto-Nov(1-15).pdf has only employee signed, supervisor unsigned!
  // Supervisor box:
  const sigBox = { minX: 66, minY: 187, maxX: 261, maxY: 219 };
  const res = checkVisualTypographyOnPage(pdfDoc, 0, sigBox, "Buena");
  console.log('Result for Buena on DTR_Malto-Nov(1-15).pdf (supervisor should NOT be visually signed):');
  console.log(res);
}
test().catch(console.error);
