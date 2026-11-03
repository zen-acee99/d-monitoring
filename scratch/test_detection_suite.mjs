import fs from "fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  extractPageContentStreamBytes,
  loadPageFontCMaps,
  extractTextItemsFromContentStream,
  findApprovalSectionCoordinates
} from "./dtrVectorPdf_shim.mjs";

// Let's create a test harness for detectSignatureCoordinatesForReneJane
function detectSignatureCoordinatesForReneJane(pdfDoc) {
  const pageCount = pdfDoc.getPageCount();
  if (pageCount === 0) {
    return {
      docType: "GENERAL_DOCUMENT",
      targetPageIndex: 0,
      sigRects: [[320, 80, 125, 26]],
      detectedReason: "Default placement on empty document",
    };
  }

  // 1. Scan pages for Civil Service Form No. 48 / DTR
  for (let pIdx = 0; pIdx < pageCount; pIdx++) {
    const page = pdfDoc.getPage(pIdx);
    const { width, height } = page.getSize();
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    if (sBytes.length === 0) continue;
    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const textItems = extractTextItemsFromContentStream(sBytes, fontCMaps);

    const hasDtrHeader = textItems.some((it) => {
      const u = it.text.toUpperCase();
      return (
        u.includes("CIVIL SERVICE FORM") ||
        u.includes("DAILY TIME RECORD") ||
        u.includes("FORM NO. 48") ||
        u.includes("CS FORM 48") ||
        u.includes("VERIFIED AS TO THE PRESCRIBED")
      );
    });

    if (hasDtrHeader) {
      const leftItems = textItems.filter((it) => it.x < width * 0.5);
      const rightItems = textItems.filter((it) => it.x >= width * 0.5);

      const hasDualHeaders =
        leftItems.some((it) => {
          const u = it.text.toUpperCase();
          return u.includes("DAILY TIME RECORD") || u.includes("CIVIL SERVICE") || u.includes("VERIFIED");
        }) &&
        rightItems.some((it) => {
          const u = it.text.toUpperCase();
          return u.includes("DAILY TIME RECORD") || u.includes("CIVIL SERVICE") || u.includes("VERIFIED");
        });

      const isDual = width >= 500 && (hasDualHeaders || rightItems.length > 20);

      const inChargeMatches = textItems.filter((it) => {
        const u = it.text.toUpperCase();
        return u.includes("IN CHARGE") || u.includes("VERIFIED") || u.includes("OFFICE HOURS");
      });

      let detectedY = 52; // Default fallback for letter CS Form 48
      if (inChargeMatches.length > 0) {
        inChargeMatches.sort((a, b) => a.y - b.y);
        const refItem = inChargeMatches[0];
        if (refItem.text.toUpperCase().includes("IN CHARGE")) {
          detectedY = Math.round(refItem.y + 10);
        } else {
          detectedY = Math.max(30, Math.round(refItem.y - 38));
        }
      }

      const boxW = 125;
      const boxH = 26;

      if (isDual) {
        const halfW = width / 2;
        const boxX1 = Math.round((halfW - boxW) / 2 + 10);
        const boxX2 = Math.round(halfW + (halfW - boxW) / 2 + 10);
        return {
          docType: "DTR",
          targetPageIndex: pIdx,
          sigRects: [
            [boxX1, detectedY, boxW, boxH],
            [boxX2, detectedY, boxW, boxH],
          ],
          detectedReason: "Civil Service Form No. 48 detected on page " + (pIdx + 1) + " — dual supervisor signature applied (Copy 1 & Copy 2)",
        };
      } else {
        const boxX = Math.round((width - boxW) / 2);
        return {
          docType: "DTR",
          targetPageIndex: pIdx,
          sigRects: [[boxX, detectedY, boxW, boxH]],
          detectedReason: "Civil Service Form No. 48 detected on page " + (pIdx + 1) + " — supervisor signature applied above In Charge",
        };
      }
    }
  }

  // 2. Scan for Accomplishment Report (AR)
  for (let pIdx = pageCount - 1; pIdx >= 0; pIdx--) {
    const page = pdfDoc.getPage(pIdx);
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    if (sBytes.length === 0) continue;
    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const textItems = extractTextItemsFromContentStream(sBytes, fontCMaps);

    const hasArHeader = textItems.some((it) => {
      const u = it.text.toUpperCase();
      return (
        u.includes("ACCOMPLISHMENT REPORT") ||
        u.includes("MONTHLY ACCOMPLISHMENT") ||
        u.includes("DELIVERABLES") ||
        u.includes("INDIVIDUAL ACCOMPLISHMENT")
      );
    });

    if (hasArHeader) {
      const arLoc = findApprovalSectionCoordinates(pdfDoc, "RENE JANE R. BUENA");
      return {
        docType: "AR",
        targetPageIndex: arLoc.pageIndex,
        sigRects: [[arLoc.boxX, arLoc.boxY, arLoc.boxW, arLoc.boxH]],
        detectedReason: "Accomplishment Report detected — supervisor approval section matched on page " + (arLoc.pageIndex + 1),
      };
    }
  }

  // 3. General Official Document
  for (let pIdx = pageCount - 1; pIdx >= 0; pIdx--) {
    const page = pdfDoc.getPage(pIdx);
    const { width, height } = page.getSize();
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    if (sBytes.length === 0) continue;
    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const textItems = extractTextItemsFromContentStream(sBytes, fontCMaps);

    for (const item of textItems) {
      const u = item.text.toUpperCase();
      const isSupervisorName = u.includes("BUENA") && (u.includes("RENE") || u.includes("JANE"));
      const isApprovedBy =
        (u.includes("APPROVED BY") || u.includes("APPROVED:") || u.includes("RECOMMENDING APPROVAL")) &&
        item.x > width * 0.3;
      const isProvincialOfficer = u.includes("PROVINCIAL OFFICER") && item.x > width * 0.3;

      if (isSupervisorName || isApprovedBy || isProvincialOfficer) {
        const boxW = 125;
        const boxH = 26;
        let boxX = Math.round(item.x);
        let boxY = Math.round(item.y + 12);
        if (isApprovedBy) {
          boxY = Math.max(30, Math.round(item.y - 48));
        }
        boxX = Math.max(20, Math.min(width - boxW - 20, boxX));
        boxY = Math.max(20, Math.min(height - boxH - 20, boxY));

        return {
          docType: "GENERAL_DOCUMENT",
          targetPageIndex: pIdx,
          sigRects: [[boxX, boxY, boxW, boxH]],
          detectedReason: 'Official document signature block matched "' + item.text + '" on page ' + (pIdx + 1) + ' at (' + boxX + ', ' + boxY + ')',
        };
      }
    }
  }

  // 4. Fallback for generic document
  const lastPageIdx = pageCount - 1;
  const lastPage = pdfDoc.getPage(lastPageIdx);
  const { width, height } = lastPage.getSize();
  const boxW = 125;
  const boxH = 26;
  const boxX = Math.round(width * 0.52);
  const boxY = Math.round(height * 0.16);

  return {
    docType: "GENERAL_DOCUMENT",
    targetPageIndex: lastPageIdx,
    sigRects: [[boxX, boxY, boxW, boxH]],
    detectedReason: "Official signature placed in standard supervisor approval quadrant on page " + (lastPageIdx + 1) + " at (" + boxX + ", " + boxY + ")",
  };
}

async function runTests() {
  console.log("=== RUNNING DETECTION SUITE ===");

  // Test 1: Real DTR
  const dtrBytes = fs.readFileSync("public/DTR_Ace_M._Malto_September_2026.pdf");
  const dtrDoc = await PDFDocument.load(dtrBytes, { ignoreEncryption: true });
  const dtrRes = detectSignatureCoordinatesForReneJane(dtrDoc);
  console.log("1. Real DTR Detection:", dtrRes.docType, "Boxes:", dtrRes.sigRects.length, "Reason:", dtrRes.detectedReason);
  if (dtrRes.docType !== "DTR" || dtrRes.sigRects.length !== 2) {
    throw new Error("DTR detection failed!");
  }

  // Test 2: Real AR
  const arBytes = fs.readFileSync("public/AR_Ace_M._Malto_September_2026.pdf");
  const arDoc = await PDFDocument.load(arBytes, { ignoreEncryption: true });
  const arRes = detectSignatureCoordinatesForReneJane(arDoc);
  console.log("2. Real AR Detection:", arRes.docType, "Page:", arRes.targetPageIndex + 1, "Boxes:", arRes.sigRects.length, "Reason:", arRes.detectedReason);
  if (arRes.docType !== "AR" || arRes.targetPageIndex !== 1) {
    throw new Error("AR detection failed!");
  }

  // Test 3: Generic document with "APPROVED BY:"
  const genDoc = await PDFDocument.create();
  const genPage = genDoc.addPage([612, 792]);
  genPage.drawText("SPECIAL ORDER NO. 2026-10-001", { x: 50, y: 720, size: 14 });
  genPage.drawText("APPROVED BY:", { x: 350, y: 200, size: 12 });
  genPage.drawText("RENE JANE R. BUENA", { x: 350, y: 150, size: 12 });
  genPage.drawText("Provincial Officer", { x: 350, y: 135, size: 10 });
  const genBytes = await genDoc.save();
  const genDocLoaded = await PDFDocument.load(genBytes);
  const genRes = detectSignatureCoordinatesForReneJane(genDocLoaded);
  console.log("3. General Document with Name Detection:", genRes.docType, "Page:", genRes.targetPageIndex + 1, "Reason:", genRes.detectedReason);

  // Test 4: Purely blank / arbitrary document
  const blankDoc = await PDFDocument.create();
  blankDoc.addPage([612, 792]);
  const blankBytes = await blankDoc.save();
  const blankDocLoaded = await PDFDocument.load(blankBytes);
  const blankRes = detectSignatureCoordinatesForReneJane(blankDocLoaded);
  console.log("4. Blank Document Fallback:", blankRes.docType, "Page:", blankRes.targetPageIndex + 1, "Reason:", blankRes.detectedReason);
  if (blankRes.docType !== "GENERAL_DOCUMENT" || blankRes.targetPageIndex !== 0) {
    throw new Error("Blank document fallback failed!");
  }

  console.log("ALL TESTS PASSED!");
}

runTests().catch(console.error);
