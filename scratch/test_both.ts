import fs from 'fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { findPersonnelSignatureCoordinates, findApprovalSectionCoordinates } from '../src/utils/dtrVectorPdf.js';

async function main() {
  const synthDoc = await PDFDocument.create();
  const synthPage = synthDoc.addPage([595, 842]);
  const font = await synthDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await synthDoc.embedFont(StandardFonts.Helvetica);

  // Supervisor section
  synthPage.drawText("A. Certified: Expenses / Cash Advance necessary, lawful and incurred under my direct supervision.", { x: 11, y: 437, size: 8, font: fontReg });
  synthPage.drawText("Digitally signed by Tabo Norly Avila", { x: 260, y: 410, size: 7, font: fontReg });
  synthPage.drawText("NORLY A. TABO", { x: 260, y: 396, size: 10, font });
  synthPage.drawText("OIC Chief, Technical Operations Division", { x: 230, y: 383, size: 8, font: fontReg });
  synthPage.drawText("Printed Name, Designation and Signature of Supervisor", { x: 211, y: 373, size: 7, font: fontReg });

  // Section C
  synthPage.drawText("C. Certified :", { x: 11, y: 269, size: 9, font });
  synthPage.drawText("Signature", { x: 11, y: 205, size: 8, font: fontReg });
  synthPage.drawText("Printed Name", { x: 11, y: 174, size: 8, font: fontReg });
  synthPage.drawText("AIVAN M. BALOLOY", { x: 157, y: 174, size: 9, font });
  synthPage.drawText("Accountant III", { x: 169, y: 147, size: 8, font: fontReg });

  // Section D
  synthPage.drawText("D. Approved for Payment :", { x: 318, y: 269, size: 9, font });
  synthPage.drawText("One Thousand One Hundred Seventy Six Pesos and Forty Five Centavos Only", { x: 320, y: 245, size: 8, font: fontReg });
  synthPage.drawText("Signature", { x: 318, y: 205, size: 8, font: fontReg });
  synthPage.drawText("Printed Name", { x: 318, y: 174, size: 8, font: fontReg });
  synthPage.drawText("ACEMATA MALTO", { x: 430, y: 174, size: 10, font });
  synthPage.drawText("OIC-Regional Director", { x: 437, y: 154, size: 8, font: fontReg });

  const bytes = await synthDoc.save();
  const doc = await PDFDocument.load(bytes);

  console.log('1. Target Norly Tabo (isCounter=false):');
  console.log(findPersonnelSignatureCoordinates(doc, 'NORLY A. TABO', { isCounterSign: false }));

  console.log('\n2. Target Norly Tabo (isCounter=true, csIndex=0):');
  console.log(findPersonnelSignatureCoordinates(doc, 'NORLY A. TABO', { isCounterSign: true, counterSignIndex: 0 }));

  console.log('\n3. Target Norly Tabo (isCounter=true, csIndex=1):');
  console.log(findPersonnelSignatureCoordinates(doc, 'NORLY A. TABO', { isCounterSign: true, counterSignIndex: 1 }));

  console.log('\n4. Target ACEMATA MALTO (isCounter=false):');
  console.log(findPersonnelSignatureCoordinates(doc, 'ACEMATA MALTO', { isCounterSign: false }));
}

main().catch(console.error);
