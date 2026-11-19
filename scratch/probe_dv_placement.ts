import fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream, isTableFormLabel } from '../src/utils/dtrVectorPdf.js';

async function testTraceCandidate() {
  const synthDoc = await PDFDocument.create();
  const synthPage = synthDoc.addPage([595, 842]);
  const font = await synthDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await synthDoc.embedFont(StandardFonts.Helvetica);

  synthPage.drawText("A. Certified: Expenses / Cash Advance necessary, lawful and incurred under my direct supervision.", { x: 11, y: 437, size: 8, font: fontReg });
  synthPage.drawText("NORLY A. TABO", { x: 260, y: 396, size: 10, font });
  synthPage.drawText("OIC Chief, Technical Operations Division", { x: 230, y: 383, size: 8, font: fontReg });
  synthPage.drawText("Printed Name, Designation and Signature of Supervisor", { x: 211, y: 373, size: 7, font: fontReg });

  synthPage.drawText("C. Certified :", { x: 11, y: 269, size: 9, font });
  synthPage.drawText("Signature", { x: 11, y: 205, size: 8, font: fontReg });
  synthPage.drawText("Printed Name", { x: 11, y: 174, size: 8, font: fontReg });
  synthPage.drawText("AIVAN M. BALOLOY", { x: 157, y: 174, size: 9, font });
  synthPage.drawText("Accountant III", { x: 169, y: 147, size: 8, font: fontReg });

  synthPage.drawText("D. Approved for Payment :", { x: 318, y: 269, size: 9, font });
  synthPage.drawText("One Thousand One Hundred Seventy Six Pesos and Forty Five Centavos Only", { x: 320, y: 245, size: 8, font: fontReg });
  synthPage.drawText("Signature", { x: 318, y: 205, size: 8, font: fontReg });
  synthPage.drawText("Printed Name", { x: 318, y: 174, size: 8, font: fontReg });
  synthPage.drawText("ACEMATA MALTO", { x: 430, y: 174, size: 10, font });
  synthPage.drawText("OIC-Regional Director", { x: 437, y: 154, size: 8, font: fontReg });

  const savedBytes = await synthDoc.save();
  const reloadedDoc = await PDFDocument.load(savedBytes);
  const page = reloadedDoc.getPage(0);
  const sBytes = extractPageContentStreamBytes(reloadedDoc, page);
  const cmaps = loadPageFontCMaps(reloadedDoc, page);
  const lastPageItems = extractTextItemsFromContentStream(sBytes, cmaps);

  let candidateSignerItem: any = null;

  // 1. First priority: Check for explicit "Printed Name" table row label
  const printedNameLabel = lastPageItems.find(
    (it) =>
      isTableFormLabel(it.text) &&
      (it.text.toUpperCase().includes("PRINTED NAME") ||
        it.text.toUpperCase().includes("NAME AND SIGNATURE") ||
        it.text.toUpperCase().includes("SIGNATURE OVER PRINTED"))
  );
  console.log('1. printedNameLabel:', printedNameLabel);
  if (printedNameLabel) {
    const nameOnLine = lastPageItems
      .filter(
        (other) =>
          Math.abs(other.y - printedNameLabel.y) <= 4 &&
          other.x > printedNameLabel.x &&
          !isTableFormLabel(other.text) &&
          other.text.trim().length > 3
      )
      .sort((a, b) => a.x - b.x)[0];
    console.log('1. nameOnLine:', nameOnLine);
    if (nameOnLine) {
      candidateSignerItem = nameOnLine;
    }
  }

  console.log('CandidateSignerItem after step 1:', candidateSignerItem);
}

testTraceCandidate().catch(console.error);
