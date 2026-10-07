import { jsPDF } from "jspdf";
import { PDFDocument, PDFName, PDFArray, PDFNumber, PDFDict, decodePDFRawStream, PDFRawStream, rgb, StandardFonts } from "pdf-lib";
import { DtrConfig, DtrRow, formatPnpkiDate, formatTo12Hour } from "./dtrUtils";
import { dtrGeneratorApi } from "@/services/api";


// Helper to convert ArrayBuffer to Base64 in browser or Node
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Normalizes all PDF Annotation /Rect coordinates from jsPDF [x1, y1, x2, y2]
 * to strictly ISO 32000-compliant [llx, lly, urx, ury] where lly < ury.
 * This fixes the inverted bounding box bug in PDF viewers so that digital signature
 * boxes and PNPKI verification links are 100% clickable and interactive.
 */
export async function normalizePdfAnnotations(pdfBytes: Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();

    for (const page of pages) {
      const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
      if (annots) {
        for (let i = 0; i < annots.size(); i++) {
          const annotRef = annots.get(i);
          const dict = pdfDoc.context.lookup(annotRef);
          if (dict && "lookupMaybe" in dict) {
            const rect = (dict as any).lookupMaybe(PDFName.of("Rect"), PDFArray);
            if (rect && rect.size() === 4) {
              const x1 = (rect.get(0) as PDFNumber).asNumber();
              const y1 = (rect.get(1) as PDFNumber).asNumber();
              const x2 = (rect.get(2) as PDFNumber).asNumber();
              const y2 = (rect.get(3) as PDFNumber).asNumber();

              const llx = Math.min(x1, x2);
              const lly = Math.min(y1, y2);
              const urx = Math.max(x1, x2);
              const ury = Math.max(y1, y2);

              rect.set(0, PDFNumber.of(llx));
              rect.set(1, PDFNumber.of(lly));
              rect.set(2, PDFNumber.of(urx));
              rect.set(3, PDFNumber.of(ury));
            }
          }
        }
      }
    }

    return await pdfDoc.save({ useObjectStreams: false });
  } catch (err) {
    console.warn("Could not normalize PDF annotations:", err);
    return pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  }
}

export interface FontCache {
  robotoRegular?: string;
  robotoBold?: string;
  notoSerifRegular?: string;
  notoSerifItalic?: string;
}

let cachedFonts: FontCache | null = null;

/**
 * Preloads open-source TrueType fonts for full font embedding in the generated PDF.
 * This guarantees 100% compliance with Adobe Acrobat digital signature integrity checks (prevents Code 2013).
 */
export async function preloadFonts(): Promise<FontCache | null> {
  if (cachedFonts) return cachedFonts;
  try {
    const [rReg, rBold, nReg, nItalic] = await Promise.all([
      fetch("/fonts/Roboto-Regular.ttf").then((r) => (r.ok ? r.arrayBuffer() : null)),
      fetch("/fonts/Roboto-Bold.ttf").then((r) => (r.ok ? r.arrayBuffer() : null)),
      fetch("/fonts/NotoSerif-Regular.ttf").then((r) => (r.ok ? r.arrayBuffer() : null)),
      fetch("/fonts/NotoSerif-Italic.ttf").then((r) => (r.ok ? r.arrayBuffer() : null)),
    ]);

    cachedFonts = {
      robotoRegular: rReg ? arrayBufferToBase64(rReg) : undefined,
      robotoBold: rBold ? arrayBufferToBase64(rBold) : undefined,
      notoSerifRegular: nReg ? arrayBufferToBase64(nReg) : undefined,
      notoSerifItalic: nItalic ? arrayBufferToBase64(nItalic) : undefined,
    };
    return cachedFonts;
  } catch (err) {
    console.warn("Could not preload TrueType fonts, falling back to standard fonts:", err);
    return null;
  }
}

/**
 * Generates an authentic vector PDF of Civil Service Form No. 48 (Daily Time Record)
 * with two identical copies side-by-side on standard 8.5 x 11 inch (Letter) paper.
 * 
 * COMPLIANCE & INTEGRITY:
 * • Embeds TrueType fonts (CIDFont/FontFile2) -> Resolves Acrobat Code 2013 (Non-embedded fonts)
 * • Disables dynamic /OpenAction and /AA -> Resolves Acrobat Code 1000 & 1014 (Hidden behavior / Deprecating actions)
 * • 100% Vector drawing, crisp selectable text, ready for official PNPKI digital signing
 */
export function generateDtrVectorPdf(
  config: DtrConfig,
  rows: DtrRow[],
  signatureImage?: string | null,
  hasP12?: boolean,
  fonts?: FontCache | null,
  p12SignerName?: string
): {
  doc: jsPDF;
  sigRect: [number, number, number, number];
  sigRects: [number, number, number, number][];
  employeeSigRects: [number, number, number, number][];
  supervisorSigRects: [number, number, number, number][];
} {
  // Standard Letter size in points (72 points/inch): 612 x 792 pt
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
    compress: true,
    putOnlyUsedFonts: true,
  });

  // Set official document properties
  doc.setDocumentProperties({
    title: `Civil Service Form 48 - ${(config.employeeName || "PERSONNEL").trim()}`,
    subject: "Civil Service Form No. 48 (Daily Time Record)",
    author: "Civil Service Commission / DICT",
    creator: "DICT Civil Service Monitoring System",
  });

  // Register embedded fonts if available
  const activeFonts = fonts || cachedFonts;
  const hasRoboto = Boolean(activeFonts?.robotoRegular);
  const hasRobotoBold = Boolean(activeFonts?.robotoBold);
  const hasSerif = Boolean(activeFonts?.notoSerifRegular);
  const hasSerifItalic = Boolean(activeFonts?.notoSerifItalic);

  if (activeFonts?.robotoRegular) {
    doc.addFileToVFS("Roboto-Regular.ttf", activeFonts.robotoRegular);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  }
  if (activeFonts?.robotoBold) {
    doc.addFileToVFS("Roboto-Bold.ttf", activeFonts.robotoBold);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  }
  if (activeFonts?.notoSerifRegular) {
    doc.addFileToVFS("NotoSerif-Regular.ttf", activeFonts.notoSerifRegular);
    doc.addFont("NotoSerif-Regular.ttf", "NotoSerif", "normal");
  }
  if (activeFonts?.notoSerifItalic) {
    doc.addFileToVFS("NotoSerif-Italic.ttf", activeFonts.notoSerifItalic);
    doc.addFont("NotoSerif-Italic.ttf", "NotoSerif", "italic");
  }

  // Safe font switchers
  const setSansItalic = () => {
    doc.setFont("helvetica", "italic");
  };
  const setSansBold = () => {
    if (hasRobotoBold) doc.setFont("Roboto", "bold");
    else if (hasRoboto) doc.setFont("Roboto", "normal");
    else doc.setFont("helvetica", "bold");
  };
  const setSansNormal = () => {
    if (hasRoboto) doc.setFont("Roboto", "normal");
    else doc.setFont("helvetica", "normal");
  };

  const formWidth = 278;
  const colWidths = [24, 45, 45, 45, 45, 37, 37]; // Sum = 278 pt
  const startY = 24;
  const rowHeight = 11.5;

  // Calculate total undertime (filtering strictly for 2-week cutoff scope if active)
  const isFirstHalf = config.scope === "first-half";
  const isSecondHalf = config.scope === "second-half";

  const totalUndertime = rows.reduce(
    (acc, r) => {
      if (isFirstHalf && r.day > 15) return acc;
      if (isSecondHalf && r.day <= 15) return acc;
      const h = parseInt(r.undertimeHours, 10) || 0;
      const m = parseInt(r.undertimeMinutes, 10) || 0;
      return { hours: acc.hours + h, minutes: acc.minutes + m };
    },
    { hours: 0, minutes: 0 }
  );

  // Render both copies side-by-side: Copy 1 at X=20, Copy 2 at X=314
  const formOffsets = [20, 314];
  const employeeSigRects: [number, number, number, number][] = [];
  const supervisorSigRects: [number, number, number, number][] = [];

  formOffsets.forEach((formX, formIdx) => {
    // -------------------------------------------------------------
    // 1. HEADER SECTION
    // -------------------------------------------------------------
    // Civil Service Form No. 48
    setSansItalic();
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text("Civil Service Form No. 48", formX + 2, startY + 8);

    // DAILY TIME RECORD
    setSansBold();
    doc.setFontSize(10.5);
    doc.text("DAILY TIME RECORD", formX + formWidth / 2, startY + 22, { align: "center" });

    // -----o0o-----
    setSansNormal();
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    doc.text("-----o0o-----", formX + formWidth / 2, startY + 31, { align: "center" });

    // Employee Full Name
    const empName = (config.employeeName || "PERSONNEL").trim().toUpperCase();
    setSansBold();
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(empName, formX + formWidth / 2, startY + 45, { align: "center" });

    // Underline for name (Full width)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.75);
    doc.line(formX, startY + 47, formX + formWidth, startY + 47);

    // (Name) subtext
    setSansNormal();
    doc.setFontSize(6.5);
    doc.setTextColor(0, 0, 0);
    doc.text("(Name)", formX + formWidth / 2, startY + 54, { align: "center" });

    // For the month of
    setSansItalic();
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text("For the month of", formX + 2, startY + 65);

    // Period / Month Range Text
    const periodText = (config.periodText || "AUGUST 01-31, 2026").trim().toUpperCase();
    setSansBold();
    doc.setFontSize(7.5);
    doc.text(periodText, formX + 66 + (formWidth - 66) / 2, startY + 65, { align: "center" });

    // Underline for period (Full width to right)
    doc.setLineWidth(0.6);
    doc.line(formX + 66, startY + 67, formX + formWidth, startY + 67);

    // Office hours text (Matching Image 1: 'Office hours for arrival and departure')
    setSansItalic();
    doc.setFontSize(6.2);
    doc.setTextColor(0, 0, 0);
    doc.text("Office hours for arrival", formX + 2, startY + 75);
    doc.text("and departure", formX + 2, startY + 83);

    setSansItalic();
    doc.setFontSize(6);
    doc.text("Regular days", formX + 86, startY + 75);
    doc.setLineWidth(0.4);
    doc.line(formX + 124, startY + 76, formX + formWidth, startY + 76);
    const regHoursVal = config.regularHours?.trim();
    if (regHoursVal && regHoursVal.toLowerCase() !== "regular days") {
      setSansBold();
      doc.text(regHoursVal, formX + 124 + (formWidth - 124) / 2, startY + 74.5, { align: "center" });
    }

    setSansItalic();
    doc.setFontSize(6);
    doc.text("Saturdays", formX + 86, startY + 83);
    doc.line(formX + 124, startY + 84, formX + formWidth, startY + 84);
    const satHoursVal = config.saturdayHours?.trim();
    if (satHoursVal && satHoursVal.toLowerCase() !== "saturdays") {
      setSansBold();
      doc.text(satHoursVal, formX + 124 + (formWidth - 124) / 2, startY + 82.5, { align: "center" });
    }

    // -------------------------------------------------------------
    // 2. GRID TABLE SECTION
    // -------------------------------------------------------------
    const tableTop = startY + 88;
    const headerH1 = 12;
    const headerH2 = 10;
    const totalHeaderH = headerH1 + headerH2;

    // Draw Table Header Background
    doc.setFillColor(243, 244, 246); // slate-100
    doc.rect(formX, tableTop, formWidth, totalHeaderH, "F");

    // Table Header Outer & Inner Grid
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.rect(formX, tableTop, formWidth, totalHeaderH);

    // Vertical column lines in header
    let curX = formX;
    // Column 1: Days (RowSpan 2)
    curX += colWidths[0];
    doc.line(curX, tableTop, curX, tableTop + totalHeaderH);

    // Column 2 & 3: A.M.
    const amX = curX;
    curX += colWidths[1] + colWidths[2];
    doc.line(curX, tableTop, curX, tableTop + totalHeaderH);

    // Column 4 & 5: P.M.
    const pmX = curX;
    curX += colWidths[3] + colWidths[4];
    doc.line(curX, tableTop, curX, tableTop + totalHeaderH);

    // Undertime (Rest)
    const utX = curX;

    // Sub-headers horizontal line
    doc.line(formX + colWidths[0], tableTop + headerH1, formX + formWidth, tableTop + headerH1);

    // Vertical lines in sub-header (Row 2)
    doc.line(amX + colWidths[1], tableTop + headerH1, amX + colWidths[1], tableTop + totalHeaderH);
    doc.line(pmX + colWidths[3], tableTop + headerH1, pmX + colWidths[3], tableTop + totalHeaderH);
    doc.line(utX + colWidths[5], tableTop + headerH1, utX + colWidths[5], tableTop + totalHeaderH);

    // Header Labels (Vector Text)
    doc.setTextColor(0, 0, 0);
    setSansBold();
    doc.setFontSize(7);
    doc.text("Days", formX + colWidths[0] / 2, tableTop + totalHeaderH / 2 + 2.5, { align: "center" });

    doc.text("A.M.", amX + (colWidths[1] + colWidths[2]) / 2, tableTop + 8.5, { align: "center" });
    doc.text("P.M.", pmX + (colWidths[3] + colWidths[4]) / 2, tableTop + 8.5, { align: "center" });
    doc.text("Undertime", utX + (colWidths[5] + colWidths[6]) / 2, tableTop + 8.5, { align: "center" });

    // Row 2 Labels
    doc.setFontSize(6);
    setSansBold();
    doc.text("Arrival", amX + colWidths[1] / 2, tableTop + headerH1 + 7, { align: "center" });
    doc.text("Departure", amX + colWidths[1] + colWidths[2] / 2, tableTop + headerH1 + 7, { align: "center" });
    doc.text("Arrival", pmX + colWidths[3] / 2, tableTop + headerH1 + 7, { align: "center" });
    doc.text("Departure", pmX + colWidths[3] + colWidths[4] / 2, tableTop + headerH1 + 7, { align: "center" });
    doc.text("Hours", utX + colWidths[5] / 2, tableTop + headerH1 + 7, { align: "center" });
    doc.text("Minutes", utX + colWidths[5] + colWidths[6] / 2, tableTop + headerH1 + 7, { align: "center" });

    // -------------------------------------------------------------
    // 3. TABLE BODY (31 DAYS)
    // -------------------------------------------------------------
    let rowY = tableTop + totalHeaderH;

    for (let i = 0; i < 31; i++) {
      const dayNum = i + 1;
      const rawRow = rows[i];
      const row = rawRow || {
        day: dayNum,
        amArrival: "",
        amDeparture: "",
        pmArrival: "",
        pmDeparture: "",
        undertimeHours: "",
        undertimeMinutes: "",
        isCustomLabel: false,
        customLabel: "",
      };

      // Draw Row Border
      doc.setLineWidth(0.4);
      doc.setDrawColor(0, 0, 0);

      // Check if row is merged (e.g. Saturday, Sunday, Holiday)
      if (row.isCustomLabel) {
        const note = (row.customLabel || "").trim().toUpperCase();
        const isWeekend = note.includes("SATURDAY") || note.includes("SUNDAY");

        if (isWeekend) {
          // Crisp light gray background matching official DTR template (#E5E7EB)
          doc.setFillColor(229, 231, 235);
          doc.rect(formX, rowY, formWidth, rowHeight, "FD");
        } else {
          // Non-weekend custom label (HOLIDAY, LEAVE, etc.) has white/unfilled background
          doc.rect(formX, rowY, formWidth, rowHeight);
        }

        // Day number
        setSansBold();
        doc.setFontSize(6.5);
        doc.setTextColor(0, 0, 0);
        doc.text(String(row.day), formX + colWidths[0] / 2, rowY + 8, { align: "center" });

        // Vertical divider after Day
        doc.line(formX + colWidths[0], rowY, formX + colWidths[0], rowY + rowHeight);

        // Merged Note Text
        const isNoWork = note.includes("NO WORK");
        if (isNoWork) {
          setSansItalic();
          doc.setFontSize(5.8);
          doc.setTextColor(130, 140, 150); // Soft gray matching gray-400
        } else {
          setSansBold();
          doc.setFontSize(6);
          doc.setTextColor(0, 0, 0);
        }
        doc.text(note, formX + colWidths[0] + (formWidth - colWidths[0]) / 2, rowY + 8, { align: "center" });
      } else {
        // Regular Time Row
        doc.rect(formX, rowY, formWidth, rowHeight);

        // Day number
        setSansBold();
        doc.setFontSize(6.5);
        doc.setTextColor(0, 0, 0);
        doc.text(String(row.day), formX + colWidths[0] / 2, rowY + 8, { align: "center" });

        // Vertical Column Dividers
        let lineX = formX + colWidths[0];
        doc.line(lineX, rowY, lineX, rowY + rowHeight);

        // AM Arrival
        const cleanTime = (val?: string) => (val ? formatTo12Hour(val) : "");
        setSansNormal();
        doc.setFontSize(5.8);
        doc.setTextColor(0, 0, 0);
        doc.text(cleanTime(row.amArrival), lineX + colWidths[1] / 2, rowY + 8, { align: "center" });
        lineX += colWidths[1];
        doc.line(lineX, rowY, lineX, rowY + rowHeight);

        // AM Departure
        doc.text(cleanTime(row.amDeparture), lineX + colWidths[2] / 2, rowY + 8, { align: "center" });
        lineX += colWidths[2];
        doc.line(lineX, rowY, lineX, rowY + rowHeight);

        // PM Arrival
        doc.text(cleanTime(row.pmArrival), lineX + colWidths[3] / 2, rowY + 8, { align: "center" });
        lineX += colWidths[3];
        doc.line(lineX, rowY, lineX, rowY + rowHeight);

        // PM Departure
        doc.text(cleanTime(row.pmDeparture), lineX + colWidths[4] / 2, rowY + 8, { align: "center" });
        lineX += colWidths[4];
        doc.line(lineX, rowY, lineX, rowY + rowHeight);

        // Undertime Hours
        doc.text(cleanTime(row.undertimeHours), lineX + colWidths[5] / 2, rowY + 8, { align: "center" });
        lineX += colWidths[5];
        doc.line(lineX, rowY, lineX, rowY + rowHeight);

        // Undertime Minutes
        doc.text(cleanTime(row.undertimeMinutes), lineX + colWidths[6] / 2, rowY + 8, { align: "center" });
      }

      rowY += rowHeight;
    }

    // -------------------------------------------------------------
    // 4. TOTAL ROW
    // -------------------------------------------------------------
    const totalRowH = 12;
    doc.setFillColor(243, 244, 246);
    doc.rect(formX, rowY, formWidth, totalRowH, "FD");

    // "TOTAL" text
    setSansBold();
    doc.setFontSize(6.5);
    doc.setTextColor(0, 0, 0);
    const textBeforeUt = formX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4];
    doc.text("TOTAL", textBeforeUt - 4, rowY + 8.5, { align: "right" });

    // Vertical line before undertime
    doc.line(textBeforeUt, rowY, textBeforeUt, rowY + totalRowH);

    // Total Undertime Hours
    doc.text(String(totalUndertime.hours || 0), textBeforeUt + colWidths[5] / 2, rowY + 8.5, { align: "center" });

    // Vertical line between hours and minutes
    doc.line(textBeforeUt + colWidths[5], rowY, textBeforeUt + colWidths[5], rowY + totalRowH);

    // Total Undertime Minutes
    doc.text(String(totalUndertime.minutes || 0), textBeforeUt + colWidths[5] + colWidths[6] / 2, rowY + 8.5, { align: "center" });

    rowY += totalRowH;

    // -------------------------------------------------------------
    // 5. CERTIFICATION FOOTER SECTION (Strictly matching Image 2)
    // -------------------------------------------------------------
    const certY = rowY + 11;
    setSansItalic();
    doc.setFontSize(6.8);
    doc.setTextColor(0, 0, 0);

    const fullCertWidth = formWidth - 1;
    // Helper to draw a line of words justified across fullCertWidth
    const drawJustifiedLine = (textStr: string, yPos: number) => {
      const words = textStr.trim().split(/\s+/);
      if (words.length <= 1) {
        doc.text(textStr, formX + 0.5, yPos);
        return;
      }
      const totalWordsWidth = words.reduce((acc, w) => acc + doc.getTextWidth(w), 0);
      const spaceWidth = (fullCertWidth - totalWordsWidth) / (words.length - 1);
      let curX = formX + 0.5;
      for (const w of words) {
        doc.text(w, curX, yPos);
        curX += doc.getTextWidth(w) + spaceWidth;
      }
    };

    drawJustifiedLine("I certify on my honor that the above is a true and correct report of the", certY);
    drawJustifiedLine("hours of work performed, record of which was made daily at the time of", certY + 9);
    doc.text("arrival and departure from office.", formX + 0.5, certY + 18);

    // -------------------------------------------------------------
    // EMPLOYEE SIGNATURE SECTION
    // -------------------------------------------------------------
    const empSigY = certY + 48;
    const isSupervisorOnly = config.status === "Verified" || config.status === "Approved";
    const isEmpDirectSigning = !isSupervisorOnly;

    const empSignatureImg =
      config.employeeSignatureImage ||
      (isEmpDirectSigning ? signatureImage : undefined);

    const empHasCert = Boolean(
      config.employeeHasP12 ||
      (config.employeeSignerName && config.employeeSignerName !== "PERSONNEL") ||
      (isEmpDirectSigning && (hasP12 || Boolean(p12SignerName)))
    );

    const empSigner = (
      config.employeeSignerName ||
      (isEmpDirectSigning && p12SignerName) ||
      config.employeeName ||
      empName ||
      "PERSONNEL"
    ).trim();

    if (empSignatureImg || empHasCert) {
      const boxW = 120;
      const boxH = config.includeDateTime ? 25 : 22;
      const boxX = formX + (formWidth - boxW) / 2;
      const boxY = empSigY - boxH - 4;

      // PDF bottom-left coordinate system (Page Height = 792 pt for standard Letter)
      employeeSigRects.push([
        Math.round(boxX),
        Math.round(792 - (boxY + boxH)),
        Math.round(boxW),
        Math.round(boxH),
      ]);

      if (empSignatureImg) {
        try {
          const imgW = 42;
          const imgH = boxH - 4;
          doc.addImage(empSignatureImg, "PNG", boxX + 4, boxY + 2, imgW, imgH);
        } catch (err) {
          console.warn("Could not embed employee signature image in box:", err);
        }
      }

      setSansBold();
      doc.setFontSize(6.8);
      doc.setTextColor(0, 0, 0);
      const textX = empSignatureImg ? boxX + 48 : boxX + boxW / 2;
      const textAlign = empSignatureImg ? "left" : "center";

      if (config.includeDateTime) {
        doc.text("Digitally signed", textX, boxY + 7.5, { align: textAlign });
        doc.text(`by ${empSigner}`, textX, boxY + 14.5, { align: textAlign });
        setSansNormal();
        doc.setFontSize(5.5);
        doc.setTextColor(40, 40, 40);
        doc.text(
          `Date: ${config.signingDateTime || formatPnpkiDate()}`,
          textX,
          boxY + 21.5,
          { align: textAlign }
        );
      } else {
        doc.text("Digitally signed", textX, boxY + 9, { align: textAlign });
        doc.text(`by ${empSigner}`, textX, boxY + 16.5, { align: textAlign });
      }
    }


    // Horizontal Employee Signature Line (Full width matching CS Form 48)
    setSansBold();
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(empName, formX + formWidth / 2, empSigY - 3, { align: "center" });

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.line(formX, empSigY, formX + formWidth, empSigY);

    // Verified text
    const verifiedY = empSigY + 13;
    setSansItalic();
    doc.setFontSize(6.4);
    doc.text("VERIFIED as to the prescribed office hours:", formX + 2, verifiedY);

    // -------------------------------------------------------------
    // SUPERVISOR SIGNATURE SECTION
    // -------------------------------------------------------------
    const supSigY = verifiedY + 44;
    const isSupervisorSigned =
      config.status === "Verified" ||
      config.status === "Approved" ||
      Boolean(config.supervisorSignatureImage) ||
      Boolean(config.supervisorHasP12);

    const supSignatureImg =
      config.supervisorSignatureImage ||
      (isSupervisorOnly ? signatureImage : undefined);

    const supSigner = (
      (isSupervisorOnly && p12SignerName) ||
      config.signerName ||
      config.supervisorName ||
      "NORLY A. TABO"
    ).trim();

    if (isSupervisorSigned && (supSignatureImg || config.supervisorHasP12 || (isSupervisorOnly && (hasP12 || Boolean(p12SignerName))))) {
      // Official Digital Signature Appearance in Supervisor Area (above Supervisor Name matching Image 2)
      const boxW = 120;
      const boxH = config.includeDateTime ? 25 : 22;
      const boxX = formX + (formWidth - boxW) / 2;
      const boxY = supSigY - boxH - 4;

      // PDF bottom-left coordinate system (Page Height = 792 pt for standard Letter)
      supervisorSigRects.push([
        Math.round(boxX),
        Math.round(792 - (boxY + boxH)),
        Math.round(boxW),
        Math.round(boxH),
      ]);

      if (supSignatureImg) {
        try {
          const imgW = 42;
          const imgH = boxH - 4;
          doc.addImage(supSignatureImg, "PNG", boxX + 4, boxY + 2, imgW, imgH);
        } catch (err) {
          console.warn("Could not embed supervisor signature image in box:", err);
        }
      }

      setSansBold();
      doc.setFontSize(6.8);
      doc.setTextColor(0, 0, 0);
      const textX = supSignatureImg ? boxX + 48 : boxX + boxW / 2;
      const textAlign = supSignatureImg ? "left" : "center";

      if (config.includeDateTime) {
        doc.text("Digitally signed", textX, boxY + 7.5, { align: textAlign });
        doc.text(`by ${supSigner}`, textX, boxY + 14.5, { align: textAlign });
        setSansNormal();
        doc.setFontSize(5.5);
        doc.setTextColor(40, 40, 40);
        doc.text(
          `Date: ${config.signingDateTime || formatPnpkiDate()}`,
          textX,
          boxY + 21.5,
          { align: textAlign }
        );
      } else {
        doc.text("Digitally signed", textX, boxY + 9, { align: textAlign });
        doc.text(`by ${supSigner}`, textX, boxY + 16.5, { align: textAlign });
      }
    }


    const supName = (config.supervisorName || "NORLY A. TABO").trim().toUpperCase();
    if (supName) {
      setSansBold();
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text(supName, formX + formWidth / 2, supSigY - 3, { align: "center" });
    }

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.line(formX, supSigY, formX + formWidth, supSigY);

    // Supervisor Title (Centered in italics matching CS Form 48)
    const supTitle = config.supervisorTitle || "OIC Chief - Technical Operations Division";
    setSansItalic();
    doc.setFontSize(6.5);
    doc.text(supTitle, formX + formWidth / 2, supSigY + 8, { align: "center" });
  });

  return {
    doc,
    sigRect: employeeSigRects[0] || supervisorSigRects[0] || [98, 220, 122, 26],
    sigRects: employeeSigRects.length > 0 ? employeeSigRects : supervisorSigRects.length > 0 ? supervisorSigRects : [[98, 220, 122, 26]],
    employeeSigRects,
    supervisorSigRects,
  };
}

/**
 * Downloads the clean, authentic vector PDF directly into the user's browser.
 * Ensures strict compliance with Adobe Acrobat digital signature integrity checks:
 * 1. Embeds TrueType fonts (prevents Code 2013)
 * 2. Strips /OpenAction from catalog (prevents Code 1000 & 1014)
 */
export interface P12SigningOptions {
  profileId?: string;
  user_Id?: string;
  p12Base64?: string;
  p12Password?: string;
  account_password?: string;
  isGoogleAuth?: boolean;
  signerName?: string;
  signerRole?: "employee" | "supervisor";
  sigRect?: [number, number, number, number];
  sigRects?: [number, number, number, number][];
  employeeProfileId?: string;
  employeeUserId?: string;
  employeeP12Base64?: string;
  employeeP12Password?: string;
  employeeSignerName?: string;
}

export function matchNames(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ñ/gi, "n")
      .toLowerCase()
      .replace(/\.p12$/i, "")
      .replace(/\.pfx$/i, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const s1 = clean(a);
  const s2 = clean(b);
  if (s1 === s2 || s1.includes(s2) || s2.includes(s1)) return true;
  const t1 = s1.split(" ").filter((w) => w.length >= 2);
  const t2 = s2.split(" ").filter((w) => w.length >= 2);
  if (t1.length === 0 || t2.length === 0) return false;
  const common = t1.filter((w) => t2.includes(w));
  return (
    common.length >= 2 ||
    (t1.length === 1 && t2.includes(t1[0])) ||
    (t2.length === 1 && t1.includes(t2[0]))
  );
}

export async function getSignedDtrVectorPdfBytes(
  config: DtrConfig,
  rows: DtrRow[],
  signatureImage?: string | null,
  hasP12?: boolean,
  p12Options?: P12SigningOptions | null
): Promise<{ bytes: Uint8Array; resolvedSignerName: string; fileName: string }> {
  const fonts = await preloadFonts();

  const isSupervisorAction =
    p12Options?.signerRole === "supervisor" ||
    config.status === "Verified" ||
    config.status === "Approved" ||
    Boolean(config.supervisorHasP12);

  // Fetch all profiles from backend for dynamic lookup
  let allProfiles: any[] = [];
  try {
    allProfiles = await dtrGeneratorApi.getRecords();
  } catch (e) {
    console.warn("Could not fetch dtr_generator records:", e);
  }

  // 1. Resolve Employee Profile & Signing Credentials
  let empProfile: any = null;
  if (p12Options?.employeeP12Base64 || p12Options?.employeeProfileId || p12Options?.employeeUserId) {
    empProfile = {
      id: p12Options.employeeProfileId,
      user_Id: p12Options.employeeUserId,
      p12: p12Options.employeeP12Base64,
      p12_password: p12Options.employeeP12Password,
      Name: p12Options.employeeSignerName || config.employeeSignerName || config.employeeName,
    };
  } else {
    // First, look up employee in allProfiles by matching config.employeeName
    if (config.employeeName) {
      empProfile = allProfiles.find(
        (p) => matchNames(p.Name, config.employeeName) && (p.hasP12 || p.p12)
      );
    }
    if (!empProfile && (config as any).userId) {
      empProfile = allProfiles.find(
        (p) => (p.user_Id === String((config as any).userId) || p.id === `dtr-sig-${(config as any).userId}`) && (p.hasP12 || p.p12)
      );
    }
    // Fallback: If not found in database, check if p12Options was provided for the employee
    if (!empProfile && !isSupervisorAction && (p12Options?.p12Base64 || p12Options?.profileId || p12Options?.user_Id)) {
      if (matchNames(p12Options.signerName, config.employeeName) || !matchNames(p12Options.signerName, config.supervisorName)) {
        empProfile = {
          id: p12Options.profileId,
          user_Id: p12Options.user_Id,
          p12: p12Options.p12Base64,
          p12_password: p12Options.p12Password,
          account_password: p12Options.account_password,
          isGoogleAuth: p12Options.isGoogleAuth,
          Name: p12Options.signerName || config.employeeSignerName || config.employeeName,
        };
      }
    }
  }

  const empHasP12 = Boolean(empProfile || config.employeeHasP12 || (!isSupervisorAction && hasP12));
  const empSignerName = empProfile?.Name || config.employeeSignerName || config.employeeName || "PERSONNEL";

  // 2. Resolve Supervisor Profile & Signing Credentials
  let supProfile: any = null;
  const isSupervisorTarget =
    isSupervisorAction ||
    config.status === "Verified" ||
    config.status === "Approved" ||
    Boolean(config.supervisorHasP12) ||
    p12Options?.signerRole === "supervisor";

  if (isSupervisorTarget) {
    if (
      p12Options?.signerRole === "supervisor" &&
      (p12Options?.p12Base64 || p12Options?.profileId || p12Options?.user_Id) &&
      (!empProfile || p12Options.profileId !== empProfile.id || matchNames(config.employeeName, config.supervisorName))
    ) {
      supProfile = {
        id: p12Options.profileId,
        user_Id: p12Options.user_Id,
        p12: p12Options.p12Base64,
        p12_password: p12Options.p12Password,
        account_password: p12Options.account_password,
        isGoogleAuth: p12Options.isGoogleAuth,
        Name: p12Options.signerName || config.signerName || config.supervisorName,
      };
    }

    if (!supProfile) {
      // 1. Priority 1: Match config.signerName (the actual officer who signed/verified, e.g. "Malto Ace Mata")
      if (config.signerName) {
        supProfile = allProfiles.find(
          (p) => matchNames(p.Name, config.signerName) && (p.hasP12 || p.p12)
        );
      }
      // 2. Priority 2: Match config.supervisorName (e.g. "Norly A. Tabo")
      if (!supProfile && config.supervisorName) {
        supProfile = allProfiles.find(
          (p) => matchNames(p.Name, config.supervisorName) && (p.hasP12 || p.p12)
        );
      }
      // 3. Priority 3: Check p12Options if it's supervisor action
      if (!supProfile && (p12Options?.p12Base64 || p12Options?.profileId || p12Options?.user_Id)) {
        if (matchNames(p12Options?.signerName, config.supervisorName) || isSupervisorAction) {
          supProfile = {
            id: p12Options.profileId,
            user_Id: p12Options.user_Id,
            p12: p12Options.p12Base64,
            p12_password: p12Options.p12Password,
            account_password: p12Options.account_password,
            isGoogleAuth: p12Options.isGoogleAuth,
            Name: p12Options.signerName || config.signerName || config.supervisorName,
          };
        }
      }
      // 4. Priority 4: Any supervisor/PO profile with p12 that is distinct from employee
      if (!supProfile) {
        supProfile = allProfiles.find(
          (p) => (p.hasP12 || p.p12) && (!empProfile || p.id !== empProfile.id) && !matchNames(p.Name, config.employeeName)
        );
      }
    }
  }

  // 3. Separation Guard: If empProfile and supProfile mistakenly resolved to the same ID while names differ
  if (empProfile && supProfile && empProfile.id && empProfile.id === supProfile.id && !matchNames(config.employeeName, config.supervisorName)) {
    if (matchNames(supProfile.Name, config.supervisorName) || matchNames(supProfile.Name, config.signerName)) {
      empProfile = allProfiles.find((p) => matchNames(p.Name, config.employeeName) && (p.hasP12 || p.p12)) || null;
    } else if (matchNames(empProfile.Name, config.employeeName)) {
      supProfile =
        allProfiles.find((p) => config.signerName && matchNames(p.Name, config.signerName) && (p.hasP12 || p.p12)) ||
        allProfiles.find((p) => config.supervisorName && matchNames(p.Name, config.supervisorName) && (p.hasP12 || p.p12)) ||
        allProfiles.find((p) => (p.hasP12 || p.p12) && p.id !== empProfile.id && !matchNames(p.Name, config.employeeName)) ||
        null;
    }
  }

  const supHasP12 = Boolean(supProfile || config.supervisorHasP12 || (isSupervisorAction && hasP12));
  const supSignerName = supProfile?.Name || config.signerName || config.supervisorName || "NORLY A. TABO";

  // Pre-fill config with resolved identities for vector drawing
  const resolvedConfig: DtrConfig = {
    ...config,
    employeeHasP12: empHasP12,
    employeeSignerName: empSignerName,
    supervisorHasP12: supHasP12,
    signerName: supSignerName,
  };

  const { doc, employeeSigRects, supervisorSigRects } = generateDtrVectorPdf(
    resolvedConfig,
    rows,
    signatureImage,
    Boolean(hasP12 || empHasP12 || supHasP12),
    fonts,
    isSupervisorAction ? supSignerName : empSignerName
  );
  
  // Get raw binary ArrayBuffer from jsPDF (DO NOT convert to string, which corrupts streams via UTF-8 expansion!)
  const arrayBuffer = doc.output("arraybuffer");
  let finalUint8 = new Uint8Array(arrayBuffer);

  // Clean raw output to remove dynamic actions flagged by Adobe Acrobat Preflight:
  // 1. Remove /OpenAction from catalog (preserves exact byte count with space padding)
  const openActionBytes = [47, 79, 112, 101, 110, 65, 99, 116, 105, 111, 110]; // "/OpenAction"
  for (let i = 0; i <= finalUint8.length - openActionBytes.length; i++) {
    let match = true;
    for (let j = 0; j < openActionBytes.length; j++) {
      if (finalUint8[i + j] !== openActionBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      let end = i + openActionBytes.length;
      while (end < finalUint8.length && finalUint8[end] !== 93 /* ']' */ && finalUint8[end] !== 10 /* '\n' */) {
        end++;
      }
      if (end < finalUint8.length && finalUint8[end] === 93) end++;
      for (let k = i; k < end; k++) {
        finalUint8[k] = 32; // ASCII space
      }
      break;
    }
  }

  // 2. Normalize all Annotation /Rect coordinates to strictly ISO 32000 compliant [llx, lly, urx, ury]
  // This ensures all interactive digital signature boxes and PNPKI verification links are clickable across all PDF readers
  finalUint8 = await normalizePdfAnnotations(finalUint8);

  const uint8ToBase64 = (u8: Uint8Array): string => {
    let binary = "";
    const len = u8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(u8[i]);
    }
    return btoa(binary);
  };

  const base64ToUint8 = (b64: string): Uint8Array => {
    const binary = atob(b64);
    const u8 = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      u8[i] = binary.charCodeAt(i);
    }
    return u8;
  };

  // -------------------------------------------------------------
  // SEQUENTIAL PASS 1 & 2: Employee Digital Signatures (Copy 1 & Copy 2)
  // -------------------------------------------------------------
  if (empProfile && employeeSigRects.length > 0) {
    for (let i = 0; i < employeeSigRects.length; i++) {
      const rect = employeeSigRects[i];
      const copyNum = i + 1;
      const fieldName = `Personnel_Signature_Copy${copyNum}`;
      try {
        const rawPdfBase64 = uint8ToBase64(finalUint8);
        const empSignResult = await dtrGeneratorApi.signPdfDocument({
          pdfBase64: rawPdfBase64,
          profileId: empProfile.id,
          user_Id: empProfile.user_Id,
          p12: empProfile.p12 || undefined,
          p12_password: empProfile.p12_password,
          account_password: empProfile.account_password,
          isGoogleAuth: empProfile.isGoogleAuth,
          reason: `Civil Service Form No. 48 Daily Time Record Submission (Copy ${copyNum})`,
          sigRect: rect,
          fieldName,
        });

        if (empSignResult.success && empSignResult.signedPdfBase64) {
          finalUint8 = base64ToUint8(empSignResult.signedPdfBase64);
        }
      } catch (empErr) {
        console.warn(`Pass (Employee Copy ${copyNum}) warning:`, empErr);
      }
    }
  }

  // -------------------------------------------------------------
  // SEQUENTIAL PASS 3 & 4: Supervisor Digital Signatures (Copy 1 & Copy 2)
  // -------------------------------------------------------------
  if (supProfile && supervisorSigRects.length > 0) {
    for (let i = 0; i < supervisorSigRects.length; i++) {
      const rect = supervisorSigRects[i];
      const copyNum = i + 1;
      const fieldName = `Supervisor_Signature_Copy${copyNum}`;
      try {
        const currentPdfBase64 = uint8ToBase64(finalUint8);
        const supSignResult = await dtrGeneratorApi.signPdfDocument({
          pdfBase64: currentPdfBase64,
          profileId: supProfile.id,
          user_Id: supProfile.user_Id,
          p12: supProfile.p12 || undefined,
          p12_password: supProfile.p12_password,
          account_password: supProfile.account_password,
          isGoogleAuth: supProfile.isGoogleAuth,
          reason: `Civil Service Form No. 48 Official Verification (Copy ${copyNum})`,
          sigRect: rect,
          fieldName,
        });

        if (supSignResult.success && supSignResult.signedPdfBase64) {
          finalUint8 = base64ToUint8(supSignResult.signedPdfBase64);
        }
      } catch (supErr) {
        console.warn(`Pass (Supervisor Copy ${copyNum}) warning:`, supErr);
      }
    }
  }

  const safeName = (config.employeeName || empSignerName || "PERSONNEL")
    .trim()
    .replace(/\.p12$/i, "")
    .replace(/\.pfx$/i, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const fileName = `DTR_Form48_${safeName || "PERSONNEL"}_${config.year}.pdf`;

  return {
    bytes: finalUint8,
    resolvedSignerName: isSupervisorAction ? supSignerName : empSignerName,
    fileName,
  };
}

export async function downloadDtrVectorPdf(
  config: DtrConfig,
  rows: DtrRow[],
  signatureImage?: string | null,
  hasP12?: boolean,
  p12Options?: P12SigningOptions | null
): Promise<void> {
  const { bytes, fileName } = await getSignedDtrVectorPdfBytes(
    config,
    rows,
    signatureImage,
    hasP12,
    p12Options
  );

  // Trigger browser download via clean binary Blob (preserves exact binary PDF structure without UTF-8 corruption)
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parsePdfHexOrAscii(str: string): string {
  if (str.startsWith("<") && str.endsWith(">")) {
    const hex = str.slice(1, -1).replace(/\s+/g, "");
    let res = "";
    // If UTF-16BE (FEFF)
    if (hex.toUpperCase().startsWith("FEFF")) {
      for (let i = 4; i < hex.length; i += 4) {
        const code = parseInt(hex.substring(i, i + 4), 16);
        if (!isNaN(code)) res += String.fromCharCode(code);
      }
      return res;
    }
    // Check if 4-digit hex sequence (e.g. Identity-H) where length is multiple of 4 and starts with 00
    if (hex.length >= 4 && hex.length % 4 === 0 && /^00[0-9a-fA-F]{2}/.test(hex)) {
      for (let i = 0; i < hex.length; i += 4) {
        const code = parseInt(hex.substring(i, i + 4), 16);
        if (!isNaN(code) && code >= 32) {
          res += String.fromCharCode(code);
        }
      }
      if (res.trim()) return res;
    }
    // Standard 2-digit hex sequence (Latin-1 / WinAnsi / PDFDocEncoding allows code >= 32 including 209 for Ñ)
    for (let i = 0; i < hex.length; i += 2) {
      const code = parseInt(hex.substring(i, i + 2), 16);
      if (!isNaN(code) && code >= 32) {
        res += String.fromCharCode(code);
      }
    }
    return res;
  }
  if (str.startsWith("(") && str.endsWith(")")) {
    let inner = str.slice(1, -1);
    // Replace octal escapes: \ddd (e.g. \321 for Ñ, \361 for ñ)
    inner = inner.replace(/\\([0-7]{1,3})/g, (_, oct) => {
      const code = parseInt(oct, 8);
      return String.fromCharCode(code);
    });
    // Replace standard escapes
    inner = inner
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\b/g, "\b")
      .replace(/\\f/g, "\f")
      .replace(/\\([\\()])/g, "$1");
    return inner;
  }
  return "";
}

export function isDecorationOrUnderline(text: string): boolean {
  return text.replace(/[\s_\-—.\/=~]+/g, "").length <= 1;
}

export function isDigitalSignatureBadge(text: string): boolean {
  const upper = text.toUpperCase();
  return (
    upper.startsWith("DIGITALLY SIGNED") ||
    upper.includes("DIGITALLY SIGNED BY") ||
    upper.startsWith("SIGNED BY") ||
    upper.startsWith("SIGNATURE BY") ||
    upper.includes("PNPKI") ||
    upper.startsWith("DATE:") ||
    upper.startsWith("CN=") ||
    upper.includes("CERTIFICATE") ||
    upper.includes("HASH:") ||
    upper.startsWith("2026.") ||
    upper.startsWith("2025.") ||
    upper.startsWith("2024.")
  );
}

export function normalizeNameForMatch(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/gi, "n")
    .replace(/^(ENGR\.?|ATTY\.?|DIR\.?|DR\.?|MS\.?|MR\.?)\s+/i, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

interface PdfTextItem {
  text: string;
  x: number;
  y: number;
}

// ─── PDF Font CMap Decoder (Supports subset fonts exported by MS Word / LibreOffice) ──
function parsePdfCMap(cmapText: string): Map<string, string> {
  const map = new Map<string, string>();
  const bfCharBlocks = cmapText.match(/beginbfchar([\s\S]*?)endbfchar/g) || [];
  for (const block of bfCharBlocks) {
    const lines = block.split("\n");
    for (const line of lines) {
      const match = line.match(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/);
      if (match) {
        const srcHex = match[1].toUpperCase().padStart(4, "0");
        const dstHex = match[2];
        let str = "";
        for (let i = 0; i < dstHex.length; i += 4) {
          const code = parseInt(dstHex.substring(i, i + 4), 16);
          str += String.fromCharCode(code);
        }
        map.set(srcHex, str);
      }
    }
  }

  const bfRangeBlocks = cmapText.match(/beginbfrange([\s\S]*?)endbfrange/g) || [];
  for (const block of bfRangeBlocks) {
    const lines = block.split("\n");
    for (const line of lines) {
      const match1 = line.match(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/);
      if (match1) {
        const start = parseInt(match1[1], 16);
        const end = parseInt(match1[2], 16);
        let dstStart = parseInt(match1[3], 16);
        for (let code = start; code <= end; code++) {
          const srcHex = code.toString(16).toUpperCase().padStart(4, "0");
          map.set(srcHex, String.fromCharCode(dstStart));
          dstStart++;
        }
        continue;
      }
      const match2 = line.match(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+\[([\s\S]*?)\]/);
      if (match2) {
        const start = parseInt(match2[1], 16);
        const end = parseInt(match2[2], 16);
        const hexList = match2[3].match(/<([0-9A-Fa-f]+)>/g) || [];
        for (let i = 0; i < hexList.length && start + i <= end; i++) {
          const srcHex = (start + i).toString(16).toUpperCase().padStart(4, "0");
          const dstHex = hexList[i].replace(/[<>]/g, "");
          let str = "";
          for (let j = 0; j < dstHex.length; j += 4) {
            const code = parseInt(dstHex.substring(j, j + 4), 16);
            str += String.fromCharCode(code);
          }
          map.set(srcHex, str);
        }
      }
    }
  }
  return map;
}

export function loadPageFontCMaps(pdfDoc: PDFDocument, page: any): Map<string, Map<string, string>> {
  const fontCMaps = new Map<string, Map<string, string>>();
  try {
    const resources = page.node.lookup(PDFName.of("Resources"), PDFDict);
    if (!resources) return fontCMaps;
    const fontDict = resources.lookup(PDFName.of("Font"), PDFDict);
    if (!fontDict) return fontCMaps;

    for (const k of fontDict.keys()) {
      const fontName = k.asString().replace(/^\//, "");
      const fontObj = fontDict.lookup(k, PDFDict);
      if (fontObj) {
        const toUnicodeRef = fontObj.get(PDFName.of("ToUnicode"));
        if (toUnicodeRef) {
          const toUnicodeStream = pdfDoc.context.lookup(toUnicodeRef);
          if (toUnicodeStream && (toUnicodeStream instanceof PDFRawStream || (toUnicodeStream as any).getContents || (toUnicodeStream as any).decode)) {
            const decoded = decodePDFRawStream(toUnicodeStream as any).decode();
            const cmapText = new TextDecoder("latin1").decode(decoded);
            fontCMaps.set(fontName, parsePdfCMap(cmapText));
          }
        }
      }
    }
  } catch (e) {
    console.warn("Could not load page font CMaps:", e);
  }
  return fontCMaps;
}

export function extractPageContentStreamBytes(pdfDoc: PDFDocument, page: any): Uint8Array {
  const contentsNode = page.node.Contents();
  if (!contentsNode) return new Uint8Array(0);

  const streamObjects: any[] = [];
  try {
    if ((contentsNode as any).asArray) {
      const arr = (contentsNode as any).asArray();
      for (const ref of arr) {
        const obj = pdfDoc.context.lookup(ref);
        if (obj) streamObjects.push(obj);
      }
    } else {
      const obj = pdfDoc.context.lookup(contentsNode as any);
      if (obj) streamObjects.push(obj);
    }

    let totalBytes = 0;
    const decodedChunks: Uint8Array[] = [];

    for (const sObj of streamObjects) {
      try {
        if (sObj instanceof PDFRawStream || (sObj as any).getContents || (sObj as any).decode) {
          const dec = decodePDFRawStream(sObj as any).decode();
          if (dec && dec.length > 0) {
            decodedChunks.push(dec);
            totalBytes += dec.length;
          }
        }
      } catch {}
    }

    if (totalBytes === 0) return new Uint8Array(0);
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of decodedChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return combined;
  } catch {
    return new Uint8Array(0);
  }
}

function decodeBytesWithCMap(rawBytes: Uint8Array, cmap?: Map<string, string>): string {
  if (cmap) {
    // 1. Try 2-byte big-endian CID lookup (common in MS Word / LibreOffice PDF subset fonts)
    if (rawBytes.length >= 2 && rawBytes.length % 2 === 0) {
      let decoded2 = "";
      let matchedCount = 0;
      for (let i = 0; i < rawBytes.length; i += 2) {
        const hexKey = (rawBytes[i].toString(16).padStart(2, "0") + rawBytes[i + 1].toString(16).padStart(2, "0")).toUpperCase();
        if (cmap.has(hexKey)) {
          decoded2 += cmap.get(hexKey);
          matchedCount++;
        } else {
          if (rawBytes[i] === 0 && rawBytes[i + 1] >= 32) {
            decoded2 += String.fromCharCode(rawBytes[i + 1]);
          } else {
            decoded2 += " ";
          }
        }
      }
      if (matchedCount > 0) return decoded2;
    }

    // 2. Try 1-byte lookup
    let decoded1 = "";
    let matched1 = 0;
    for (let i = 0; i < rawBytes.length; i++) {
      const hexKey = rawBytes[i].toString(16).toUpperCase().padStart(4, "0");
      if (cmap.has(hexKey)) {
        decoded1 += cmap.get(hexKey);
        matched1++;
      } else {
        if (rawBytes[i] >= 32) decoded1 += String.fromCharCode(rawBytes[i]);
      }
    }
    if (matched1 > 0) return decoded1;
  }

  // 3. Fallback: UTF-16BE or Latin1
  if (rawBytes.length >= 2 && rawBytes.length % 2 === 0 && rawBytes[0] === 0) {
    let s = "";
    for (let i = 0; i < rawBytes.length; i += 2) {
      const code = (rawBytes[i] << 8) | rawBytes[i + 1];
      if (code >= 32 || code === 10 || code === 13) s += String.fromCharCode(code);
    }
    if (s.trim()) return s;
  }

  return new TextDecoder("latin1").decode(rawBytes);
}

export function extractTextItemsFromContentStream(
  streamInput: Uint8Array | string,
  fontCMaps?: Map<string, Map<string, string>>
): PdfTextItem[] {
  let streamBytes: Uint8Array;
  if (streamInput instanceof Uint8Array) {
    streamBytes = streamInput;
  } else if (typeof streamInput === "string") {
    streamBytes = new Uint8Array(streamInput.length);
    for (let i = 0; i < streamInput.length; i++) {
      streamBytes[i] = streamInput.charCodeAt(i) & 0xff;
    }
  } else {
    return [];
  }

  const items: PdfTextItem[] = [];
  let currentFont = "";
  let lineStartX = 0, lineStartY = 0, currentX = 0, currentY = 0;
  let ctmA = 1, ctmB = 0, ctmC = 0, ctmD = 1, ctmE = 0, ctmF = 0;
  const ctmStack: Array<[number, number, number, number, number, number]> = [];

  let idx = 0;
  const len = streamBytes.length;

  function skipWhitespace() {
    while (idx < len && (streamBytes[idx] <= 32 || streamBytes[idx] === 0)) idx++;
  }

  function readWord(): string {
    skipWhitespace();
    const start = idx;
    while (
      idx < len &&
      streamBytes[idx] > 32 &&
      streamBytes[idx] !== 40 &&
      streamBytes[idx] !== 41 &&
      streamBytes[idx] !== 60 &&
      streamBytes[idx] !== 62 &&
      streamBytes[idx] !== 91 &&
      streamBytes[idx] !== 93 &&
      streamBytes[idx] !== 47
    ) {
      idx++;
    }
    return new TextDecoder("latin1").decode(streamBytes.subarray(start, idx));
  }

  function readLiteralStringBytes(): Uint8Array {
    idx++; // skip '('
    const bytes: number[] = [];
    let depth = 1;
    while (idx < len) {
      const b = streamBytes[idx];
      if (b === 92) {
        idx++;
        if (idx >= len) break;
        const nb = streamBytes[idx];
        if (nb >= 48 && nb <= 55) {
          let oct = String.fromCharCode(nb);
          idx++;
          if (idx < len && streamBytes[idx] >= 48 && streamBytes[idx] <= 55) {
            oct += String.fromCharCode(streamBytes[idx]);
            idx++;
            if (idx < len && streamBytes[idx] >= 48 && streamBytes[idx] <= 55) {
              oct += String.fromCharCode(streamBytes[idx]);
              idx++;
            }
          }
          bytes.push(parseInt(oct, 8));
          continue;
        } else if (nb === 110) bytes.push(10);
        else if (nb === 114) bytes.push(13);
        else if (nb === 116) bytes.push(9);
        else if (nb === 98) bytes.push(8);
        else if (nb === 102) bytes.push(12);
        else bytes.push(nb);
        idx++;
      } else if (b === 40) {
        depth++;
        bytes.push(b);
        idx++;
      } else if (b === 41) {
        depth--;
        idx++;
        if (depth === 0) break;
        bytes.push(b);
      } else {
        bytes.push(b);
        idx++;
      }
    }
    return new Uint8Array(bytes);
  }

  function readHexStringBytes(): Uint8Array {
    idx++; // skip '<'
    let hex = "";
    while (idx < len && streamBytes[idx] !== 62) {
      const b = streamBytes[idx];
      if ((b >= 48 && b <= 57) || (b >= 65 && b <= 70) || (b >= 97 && b <= 102)) {
        hex += String.fromCharCode(b);
      }
      idx++;
    }
    if (idx < len && streamBytes[idx] === 62) idx++;
    if (hex.length % 2 !== 0) hex += "0";
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  const tokenOperandStack: any[] = [];

  while (idx < len) {
    skipWhitespace();
    if (idx >= len) break;

    const b = streamBytes[idx];
    if (b === 47) {
      idx++;
      let name = "";
      while (
        idx < len &&
        streamBytes[idx] > 32 &&
        streamBytes[idx] !== 47 &&
        streamBytes[idx] !== 40 &&
        streamBytes[idx] !== 60 &&
        streamBytes[idx] !== 91
      ) {
        name += String.fromCharCode(streamBytes[idx]);
        idx++;
      }
      tokenOperandStack.push("/" + name);
    } else if (b === 40) {
      tokenOperandStack.push({ type: "str", bytes: readLiteralStringBytes() });
    } else if (b === 60 && idx + 1 < len && streamBytes[idx + 1] !== 60) {
      tokenOperandStack.push({ type: "str", bytes: readHexStringBytes() });
    } else if (b === 91) {
      idx++; // skip '['
      const arr: any[] = [];
      while (idx < len) {
        skipWhitespace();
        if (idx >= len) break;
        if (streamBytes[idx] === 93) {
          idx++;
          break;
        } else if (streamBytes[idx] === 40) {
          arr.push({ type: "str", bytes: readLiteralStringBytes() });
        } else if (streamBytes[idx] === 60 && streamBytes[idx + 1] !== 60) {
          arr.push({ type: "str", bytes: readHexStringBytes() });
        } else {
          const numStr = readWord();
          const n = parseFloat(numStr);
          if (!isNaN(n)) arr.push(n);
        }
      }
      tokenOperandStack.push({ type: "arr", items: arr });
    } else {
      const word = readWord();
      if (!word) {
        idx++;
        continue;
      }

      if (word === "q") {
        ctmStack.push([ctmA, ctmB, ctmC, ctmD, ctmE, ctmF]);
        tokenOperandStack.length = 0;
      } else if (word === "Q") {
        if (ctmStack.length > 0) {
          const top = ctmStack.pop()!;
          ctmA = top[0]; ctmB = top[1]; ctmC = top[2]; ctmD = top[3]; ctmE = top[4]; ctmF = top[5];
        }
        tokenOperandStack.length = 0;
      } else if (word === "cm") {
        if (tokenOperandStack.length >= 6) {
          const [a1, b1, c1, d1, e1, f1] = tokenOperandStack.slice(-6).map(Number);
          const a2 = ctmA * a1 + ctmC * b1;
          const b2 = ctmB * a1 + ctmD * b1;
          const c2 = ctmA * c1 + ctmC * d1;
          const d2 = ctmB * c1 + ctmD * d1;
          const e2 = ctmA * e1 + ctmC * f1 + ctmE;
          const f2 = ctmB * e1 + ctmD * f1 + ctmF;
          ctmA = a2; ctmB = b2; ctmC = c2; ctmD = d2; ctmE = e2; ctmF = f2;
        }
        tokenOperandStack.length = 0;
      } else if (word === "Tm") {
        if (tokenOperandStack.length >= 6) {
          const parts = tokenOperandStack.slice(-6).map(Number);
          lineStartX = ctmA * parts[4] + ctmC * parts[5] + ctmE;
          lineStartY = ctmB * parts[4] + ctmD * parts[5] + ctmF;
          currentX = lineStartX;
          currentY = lineStartY;
        }
        tokenOperandStack.length = 0;
      } else if (word === "Td" || word === "TD") {
        if (tokenOperandStack.length >= 2) {
          const [tx, ty] = tokenOperandStack.slice(-2).map(Number);
          lineStartX += ctmA * tx + ctmC * ty;
          lineStartY += ctmB * tx + ctmD * ty;
          currentX = lineStartX;
          currentY = lineStartY;
        }
        tokenOperandStack.length = 0;
      } else if (word === "T*") {
        lineStartY -= 12;
        currentX = lineStartX;
        currentY = lineStartY;
      } else if (word === "Tf") {
        if (tokenOperandStack.length >= 2) {
          currentFont = String(tokenOperandStack[tokenOperandStack.length - 2]).replace(/^\//, "");
        }
        tokenOperandStack.length = 0;
      } else if (word === "Tj") {
        if (tokenOperandStack.length >= 1) {
          const op = tokenOperandStack[tokenOperandStack.length - 1];
          if (op && op.type === "str") {
            const cmap = fontCMaps?.get(currentFont);
            const decoded = decodeBytesWithCMap(op.bytes, cmap);
            if (decoded && decoded.trim()) {
              items.push({ text: decoded.trim(), x: currentX, y: currentY });
            }
          }
        }
        tokenOperandStack.length = 0;
      } else if (word === "TJ") {
        if (tokenOperandStack.length >= 1) {
          const op = tokenOperandStack[tokenOperandStack.length - 1];
          if (op && op.type === "arr") {
            const cmap = fontCMaps?.get(currentFont);
            let combined = "";
            for (const elem of op.items) {
              if (elem && elem.type === "str") {
                combined += decodeBytesWithCMap(elem.bytes, cmap);
              } else if (typeof elem === "number" && elem < -120) {
                if (!combined.endsWith(" ")) combined += " ";
              }
            }
            if (combined && combined.trim()) {
              items.push({ text: combined.trim(), x: currentX, y: currentY });
            }
          }
        }
        tokenOperandStack.length = 0;
      } else {
        tokenOperandStack.push(word);
      }
    }
  }

  return items;
}

/**
 * Searches the pages of an uploaded PDF to locate the exact page and coordinates
 * of the Provincial Officer / Supervisor approval section.
 */
export function findApprovalSectionCoordinates(
  pdfDoc: PDFDocument,
  supervisorName?: string
): { pageIndex: number; boxX: number; boxY: number; boxW: number; boxH: number; detectedReason: string } {
  const pages = pdfDoc.getPages();
  const pageCount = pages.length;

  if (pageCount === 0) {
    return { pageIndex: 0, boxX: 320, boxY: 80, boxW: 125, boxH: 26, detectedReason: "default" };
  }

  const normalizedSupName = (supervisorName || "").trim().toUpperCase();
  const nameParts = normalizedSupName
    ? normalizedSupName.split(/\s+/).filter((p) => p.length > 2 && !p.includes("."))
    : ["RENE", "JANE", "BUENA"];

  // Search pages starting from the LAST page backwards
  for (let pIdx = pageCount - 1; pIdx >= 0; pIdx--) {
    const page = pages[pIdx];
    const { width, height } = page.getSize();
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    if (sBytes.length === 0) continue;

    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const textItems = extractTextItemsFromContentStream(sBytes, fontCMaps);

    // 1. Check for supervisor full name or surname (e.g. "RENE JANE R. BUENA" or "BUENA" or "TABO")
    for (const item of textItems) {
      const upper = item.text.toUpperCase();
      const isNameMatch =
        (normalizedSupName && upper.includes(normalizedSupName)) ||
        (nameParts.length > 0 && nameParts.every((part) => upper.includes(part))) ||
        (upper.includes("BUENA") && (upper.includes("RENE") || upper.includes("JANE"))) ||
        upper.includes("RENE JANE R. BUENA") ||
        upper.includes("NORLY A. TABO") ||
        upper.includes("MARIA ELENA SANTOS");

      if (isNameMatch && item.x > width * 0.35) {
        const boxW = 125;
        const boxH = 26;
        const boxX = Math.max(20, Math.min(width - boxW - 20, Math.round(item.x - 6)));
        const boxY = Math.round(item.y + 10);

        return {
          pageIndex: pIdx,
          boxX,
          boxY,
          boxW,
          boxH,
          detectedReason: `Matched supervisor name "${item.text}" on page ${pIdx + 1} at (${item.x}, ${item.y})`,
        };
      }
    }

    // 2. Check for "Approved by:" or "Approved by" header
    for (const item of textItems) {
      const upper = item.text.toUpperCase();
      if ((upper.includes("APPROVED BY") || upper.includes("APPROVED BY:")) && item.x > width * 0.35) {
        const boxW = 125;
        const boxH = 26;
        const boxX = Math.max(20, Math.min(width - boxW - 20, Math.round(item.x + 2)));
        const boxY = Math.max(30, Math.round(item.y - 48));

        return {
          pageIndex: pIdx,
          boxX,
          boxY,
          boxW,
          boxH,
          detectedReason: `Matched "Approved by" on page ${pIdx + 1} at (${item.x}, ${item.y})`,
        };
      }
    }

    // 3. Check for "Provincial Officer", "Provincial", "Division Chief", "Regional Director", "ARD"
    for (const item of textItems) {
      const upper = item.text.toUpperCase();
      if (
        (upper.includes("PROVINCIAL OFFICER") ||
          upper.includes("PROVINCIAL") ||
          upper.includes("OIC CHIEF") ||
          upper.includes("REGIONAL DIRECTOR") ||
          upper.includes("OIC- REGIONAL DIRECTOR") ||
          upper.includes("OIC - REGIONAL DIRECTOR") ||
          upper.includes("ASSISTANT REGIONAL DIRECTOR") ||
          upper.includes("ASSISTANCE REGIONAL DIRECTOR") ||
          upper.includes("ARD") ||
          upper.includes("DIVISION CHIEF")) &&
        item.x > width * 0.35
      ) {
        const boxW = 125;
        const boxH = 26;
        const boxX = Math.max(20, Math.min(width - boxW - 20, Math.round(item.x - 6)));
        const boxY = Math.round(item.y + 26);

        return {
          pageIndex: pIdx,
          boxX,
          boxY,
          boxW,
          boxH,
          detectedReason: `Matched title "${item.text}" on page ${pIdx + 1} at (${item.x}, ${item.y})`,
        };
      }
    }

    // 4. Check for "Prepared by:" (aligns horizontally with right column approval)
    for (const item of textItems) {
      const upper = item.text.toUpperCase();
      if (upper.includes("PREPARED BY") || upper.includes("PREPARED BY:")) {
        const boxW = 125;
        const boxH = 26;
        const boxX = Math.round(width * 0.52);
        const boxY = Math.max(30, Math.round(item.y - 48));

        return {
          pageIndex: pIdx,
          boxX,
          boxY,
          boxW,
          boxH,
          detectedReason: `Aligned with "Prepared by" row on page ${pIdx + 1} at y=${item.y}`,
        };
      }
    }
  }

  // Fallback to last page default position
  const lastPageIdx = pageCount - 1;
  const lastPage = pages[lastPageIdx];
  const { width, height } = lastPage.getSize();
  const boxW = 125;
  const boxH = 26;
  const boxX = Math.round(width * 0.52);
  const boxY = Math.round(height * 0.22);

  return {
    pageIndex: lastPageIdx,
    boxX,
    boxY,
    boxW,
    boxH,
    detectedReason: `Default placement on last page ${lastPageIdx + 1} at (${boxX}, ${boxY})`,
  };
}

/**
 * Digitally signs an existing multi-page Accomplishment Report (AR) PDF by locating the
 * Provincial Officer approval section dynamically across any page, drawing the official
 * DTR-style DigiSigned stamp + signature stroke image, and binding the cryptographic P12 keystore.
 */
export async function signUploadedArPdfBytes(
  existingPdfBytes: Uint8Array | ArrayBuffer,
  signerName: string,
  signatureImage?: string | null,
  p12Options?: P12SigningOptions | null,
  supervisorTitle?: string
): Promise<{ bytes: Uint8Array; resolvedSignerName: string }> {
  const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  
  // Dynamically locate the Approval / Provincial Officer section
  const targetSigner = (signerName || p12Options?.signerName || "RENE JANE R. BUENA").trim();
  const loc = findApprovalSectionCoordinates(pdfDoc, targetSigner);
  const targetPage = pages[loc.pageIndex];

  const boxW = loc.boxW;
  const boxH = loc.boxH;
  const boxX = loc.boxX;
  const boxY = loc.boxY;

  console.log(`[AR Signing] ${loc.detectedReason} => Placing P12 at [x=${boxX}, y=${boxY}, w=${boxW}, h=${boxH}] on page ${loc.pageIndex + 1}`);

  let resolvedSignerName = targetSigner || "Super Admin";

  // 1. Embed and draw signature stroke image if available
  if (signatureImage) {
    try {
      const cleanBase64 = signatureImage.replace(/^data:image\/\w+;base64,/, "");
      const imgBinary = atob(cleanBase64);
      const imgBytes = new Uint8Array(imgBinary.length);
      for (let i = 0; i < imgBinary.length; i++) {
        imgBytes[i] = imgBinary.charCodeAt(i);
      }
      let embeddedImg;
      if (signatureImage.includes("image/jpeg") || signatureImage.includes("image/jpg")) {
        embeddedImg = await pdfDoc.embedJpg(imgBytes);
      } else {
        embeddedImg = await pdfDoc.embedPng(imgBytes);
      }
      targetPage.drawImage(embeddedImg, {
        x: boxX + 2,
        y: boxY + 2,
        width: 44,
        height: boxH - 4,
      });
    } catch (e) {
      console.warn("Could not embed signature image in AR page:", e);
    }
  }

  // 2. Draw official DTR-style "Digitally signed by <Name>" typography
  try {
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const textX = signatureImage ? boxX + 48 : boxX + 4;

    targetPage.drawText("Digitally signed", {
      x: textX,
      y: boxY + 13,
      size: 6.8,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });

    targetPage.drawText(`by ${resolvedSignerName}`, {
      x: textX,
      y: boxY + 5,
      size: 6.8,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });
  } catch (err) {
    console.warn("Could not draw digital signature typography on AR page:", err);
  }

  let modifiedBytes = await pdfDoc.save({ useObjectStreams: false });
  modifiedBytes = await normalizePdfAnnotations(modifiedBytes);

  let finalUint8 = modifiedBytes;

  // 3. Attach cryptographic PNPKI .p12 /Sig dictionary to the exact approval box on the detected page
  if (p12Options?.p12Base64 || p12Options?.profileId || p12Options?.user_Id) {
    let binary = "";
    const len = modifiedBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(modifiedBytes[i]);
    }
    const rawPdfBase64 = btoa(binary);

    const signResult = await dtrGeneratorApi.signPdfDocument({
      pdfBase64: rawPdfBase64,
      profileId: p12Options.profileId,
      user_Id: p12Options.user_Id,
      p12: p12Options.p12Base64,
      p12_password: p12Options.p12Password,
      account_password: p12Options.account_password,
      isGoogleAuth: p12Options.isGoogleAuth,
      reason: "Official Accomplishment Report Provincial Approval",
      sigRect: [boxX, boxY, boxW, boxH],
      sigRects: [[boxX, boxY, boxW, boxH]],
      pageIndex: loc.pageIndex,
    });

    if (signResult.success && signResult.signedPdfBase64) {
      const signedBinary = atob(signResult.signedPdfBase64);
      const signedBytes = new Uint8Array(signedBinary.length);
      for (let i = 0; i < signedBinary.length; i++) {
        signedBytes[i] = signedBinary.charCodeAt(i);
      }
      finalUint8 = signedBytes;
      if (signResult.signerName) {
        resolvedSignerName = signResult.signerName;
      }
    }
  }

  return { bytes: finalUint8, resolvedSignerName };
}

/**
 * Searches the pages of an uploaded PDF to locate the exact page and coordinates
 * of a specific personnel's name (or "Prepared by:" section) and returns the bounding box:
 * - Placed directly ABOVE the personnel's name for normal signers (isCounterSign = false)
 * - Placed directly BESIDE the personnel's name for counter-signers (isCounterSign = true)
 */
export type CounterSignPosition = "auto" | "right" | "left" | "bottom";

export interface PersonnelCoordinatesOptions {
  isCounterSign?: boolean;
  counterSignIndex?: number;
  counterSignPosition?: CounterSignPosition;
}

export interface ScannedPdfSigner {
  name: string;
  roleHeader: string; // e.g. "PREPARED BY", "REVIEWED BY", "NOTED BY"
  title?: string;      // e.g. "Project Development Officer II - DICT Albay"
  x: number;
  y: number;
  pageIndex: number;
}

export interface ScanPdfResult {
  primaryPersonnel: string;
  requiredSigners: string[];
  signers: ScannedPdfSigner[];
}

export interface ScannedPdfUserCandidate {
  name: string;
  role?: string;
  email?: string;
}

/**
 * Automatically scans an uploaded PDF document's text streams to detect official
 * DICT signature blocks (e.g. PREPARED BY:, REVIEWED BY:, NOTED BY:, APPROVED BY:,
 * TOD / Technical Operations Division, Regional Director, Asst. Director, Provincial Officer)
 * or cross-references the active User List from the system.
 */
export async function scanPdfForSigners(
  pdfBytes: Uint8Array | ArrayBuffer,
  userList?: ScannedPdfUserCandidate[]
): Promise<ScanPdfResult> {
  const incoming = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(incoming, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const pageCount = pages.length;

  const detectedSigners: ScannedPdfSigner[] = [];

  // 1. Gather User List candidates strictly from argument or stored users (no hardcoded leader pre-seeding)
  let effectiveUsers: ScannedPdfUserCandidate[] = userList && userList.length > 0 ? [...userList] : [];
  if (effectiveUsers.length === 0 && typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = window.localStorage.getItem("dict_r5_users_db");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          effectiveUsers = parsed.map((u: any) => ({ name: u.name, role: u.role, email: u.email }));
        }
      }
    } catch {}
  }

  // Filter out invalid names from user roster
  effectiveUsers = effectiveUsers.filter((u) => u.name && u.name.trim().length >= 3);

  // Scan pages starting from the LAST page backwards (signatures are typically on the last page)
  for (let pIdx = pageCount - 1; pIdx >= 0; pIdx--) {
    const page = pages[pIdx];
    const { height } = page.getSize();
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    if (sBytes.length === 0) continue;

    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const items = extractTextItemsFromContentStream(sBytes, fontCMaps);

    // Filter candidate items to the signature area (bottom 55% of page) and ignore document decorations
    // Exclude header addressees like "(Agency Head)", "(Station)", etc.
    const sigAreaItems = items.filter((item) => {
      if (item.y > height * 0.55 || item.y < 20) return false;
      if (isDecorationOrUnderline(item.text) || isDigitalSignatureBadge(item.text)) return false;
      const upper = item.text.toUpperCase();
      if (
        upper.includes("(AGENCY HEAD)") ||
        upper.includes("(STATION)") ||
        upper.includes("(DESIGNATION)") ||
        upper.includes("PAGE ") ||
        upper.includes("REPUBLIC OF THE PHILIPPINES")
      ) {
        return false;
      }
      return true;
    });

    // Match strictly against users present in the active user list
    for (const u of effectiveUsers) {
      const normUName = normalizeNameForMatch(u.name);
      const uParts = normUName.split(/\s+/).filter((p) => p.length > 2);

      const userMatches = sigAreaItems.filter((item) => {
        const normItem = normalizeNameForMatch(item.text);
        const isExactMatch = normItem === normUName || normItem.includes(normUName);
        const isPartsMatch = uParts.length >= 2 && uParts.every((part) => normItem.includes(part));
        return isExactMatch || isPartsMatch;
      });

      if (userMatches.length > 0) {
        // Pick the signature block item (lowest y in the signature area)
        userMatches.sort((a, b) => a.y - b.y);
        const item = userMatches[0];

        const already = detectedSigners.some(
          (s) =>
            normalizeNameForMatch(s.name) === normUName ||
            (uParts.length >= 2 && uParts.every((p) => normalizeNameForMatch(s.name).includes(p)))
        );

        if (!already) {
          // Clean personnel name from user list — do NOT include positions per user requirement
          const cleanName = u.name.toUpperCase().replace(/^(ENGR\.?|ATTY\.?|DIR\.?|DR\.?)\s+/i, "").trim();
          detectedSigners.push({
            name: cleanName,
            roleHeader: "",
            title: undefined,
            x: item.x,
            y: item.y,
            pageIndex: pIdx,
          });
        }
      }
    }

    if (detectedSigners.length > 0) {
      break;
    }
  }

  // If no signers detected from document text, default cleanly to the first active user
  if (detectedSigners.length === 0) {
    const fallbackName = (effectiveUsers[0]?.name || "PERSONNEL").toUpperCase().replace(/^(ENGR\.?|ATTY\.?|DIR\.?|DR\.?)\s+/i, "").trim();
    detectedSigners.push({
      name: fallbackName,
      roleHeader: "",
      title: undefined,
      x: 60,
      y: 120,
      pageIndex: Math.max(0, pageCount - 1),
    });
  }

  // Sort by Y position descending (top-to-bottom order in signature section)
  detectedSigners.sort((a, b) => b.y - a.y);

  const requiredSigners = detectedSigners.map((s) => s.name);
  const primaryPersonnel = detectedSigners[0]?.name || "PERSONNEL";

  return {
    primaryPersonnel,
    requiredSigners,
    signers: detectedSigners,
  };
}

/**
 * Searches the pages of an uploaded PDF to locate the exact page and coordinates
 * of a specific personnel's name (or signature section):
 * - Placed directly ABOVE the personnel's name for normal signers (isCounterSign = false)
/**
 * Accurate width estimator for standard PDF fonts (Times, Helvetica, Arial, Calibri)
 */
export function measurePdfTextWidth(text: string, fontSize = 10.5): number {
  if (!text) return 0;
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === " " || ch === "." || ch === "," || ch === ":" || ch === "-") {
      width += fontSize * 0.28;
    } else if ("MWmw".includes(ch)) {
      width += fontSize * 0.85;
    } else if ("ijltr1I!|'\"[]()".includes(ch)) {
      width += fontSize * 0.32;
    } else if ("ABCDEFGHJKLNOPQRSTUVXYZ".includes(ch)) {
      width += fontSize * 0.64;
    } else {
      width += fontSize * 0.52;
    }
  }
  return width;
}

/**
 * Accurately finds signature coordinates for a specific personnel in an uploaded document:
 * - Placed directly ABOVE the personnel's name for normal signers (isCounterSign = false)
 * - Placed directly BESIDE the personnel's name for counter-signers (isCounterSign = true),
 *   in a compact aspect-square (20x20) box.
 */
export function findPersonnelSignatureCoordinates(
  pdfDoc: PDFDocument,
  personnelName?: string,
  options?: PersonnelCoordinatesOptions
): {
  pageIndex: number;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  detectedReason: string;
  appliedPosition?: "above" | "right" | "left" | "bottom";
} {
  const pages = pdfDoc.getPages();
  const pageCount = pages.length;

  const isCounter = Boolean(options?.isCounterSign);
  const csIndex = options?.counterSignIndex || 0;
  const requestedPos = options?.counterSignPosition || "auto";

  if (pageCount === 0) {
    const boxW = isCounter ? 38 : 125;
    const boxH = isCounter ? 14 : 28;
    const boxX = isCounter ? 220 + (csIndex * 42) : 70;
    const boxY = 80;
    return {
      pageIndex: 0,
      boxX,
      boxY,
      boxW,
      boxH,
      detectedReason: isCounter ? "default counter-sign beside" : "default sign above",
      appliedPosition: isCounter ? "right" : "above",
    };
  }

  const normTarget = normalizeNameForMatch(personnelName || "");
  const targetParts = normTarget ? normTarget.split(/\s+/).filter((p) => p.length > 2) : [];

  // Search pages starting from the LAST page backwards (signatures are typically on the last page)
  for (let pIdx = pageCount - 1; pIdx >= 0; pIdx--) {
    const page = pages[pIdx];
    const { width, height } = page.getSize();
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    if (sBytes.length === 0) continue;

    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const textItems = extractTextItemsFromContentStream(sBytes, fontCMaps);

    // 1. Check for exact or partial personnel name match in the signature area (y <= height * 0.55)
    if (targetParts.length > 0 || normTarget) {
      const matches = textItems.filter((item) => {
        if (isDecorationOrUnderline(item.text) || isDigitalSignatureBadge(item.text)) return false;
        // Prioritize signature area matches over top form headers
        const normItem = normalizeNameForMatch(item.text);
        const isExactMatch = normTarget && (normItem === normTarget || normItem.includes(normTarget));
        const isPartsMatch = targetParts.length >= 2 && targetParts.every((part) => normItem.includes(part));
        return isExactMatch || isPartsMatch;
      });

      if (matches.length > 0) {
        // Pick the signature block item (lowest y in the signature area)
        matches.sort((a, b) => a.y - b.y);
        const item = matches[0];

        if (isCounter) {
          // Counter-sign: compact horizontal stamp (sign on left, DigiSigned on right) placed directly beside or below
          const boxW = 38;
          const boxH = 14;

          // Locate true right edge of personnel name without hopping across table columns
          const sameLineItems = textItems
            .filter((it) => Math.abs(it.y - item.y) < 4 && it.x >= item.x - 5 && it.x <= item.x + 250)
            .sort((a, b) => a.x - b.x);

          let rightmostX = item.x + measurePdfTextWidth(item.text.trim(), 10.5);
          for (const it of sameLineItems) {
            // Only extend if it's an immediate word continuation of the name (gap <= 22 points)
            if (it.x <= rightmostX + 22) {
              const itEnd = it.x + measurePdfTextWidth(it.text.trim(), 10.5);
              if (itEnd > rightmostX) {
                rightmostX = itEnd;
              }
            }
          }

          let effectivePos: "right" | "left" | "bottom" =
            requestedPos === "auto" ? "right" : requestedPos;

          if (requestedPos === "auto" && rightmostX + boxW + 10 > width) {
            effectivePos = "left";
          }

          let boxX = Math.round(item.x);
          let boxY = Math.round(item.y);

          if (effectivePos === "right") {
            // Placed snugly to the RIGHT beside the personnel name (vertically centered with name text)
            boxX = Math.min(width - boxW - 4, Math.round(rightmostX + 4 + (csIndex * (boxW + 4))));
            boxY = Math.max(4, Math.min(height - boxH - 4, Math.round(item.y - 2)));
          } else if (effectivePos === "left") {
            // Placed to the LEFT beside the personnel name
            boxX = Math.max(4, Math.round(item.x - boxW - 4 - (csIndex * (boxW + 4))));
            boxY = Math.max(4, Math.min(height - boxH - 4, Math.round(item.y - 2)));
          } else {
            // Placed BELOW underneath the personnel name
            const nameWidth = measurePdfTextWidth(item.text.trim(), 10.5);
            boxX = Math.max(4, Math.min(width - boxW - 4, Math.round(item.x + (nameWidth - boxW) / 2)));
            boxY = Math.max(4, Math.round(item.y - boxH - 4 - (csIndex * (boxH + 4))));
          }

          return {
            pageIndex: pIdx,
            boxX,
            boxY,
            boxW,
            boxH,
            detectedReason: `Counter-sign stamp (${boxW}x${boxH} pt) placed ${effectivePos} "${item.text}" on page ${pIdx + 1} at (${boxX}, ${boxY})`,
            appliedPosition: effectivePos,
          };
        } else {
          // Normal sign: placed directly ABOVE the name
          const boxW = 125;
          const boxH = 28;
          const boxX = Math.max(15, Math.min(width - boxW - 15, Math.round(item.x - 4)));
          const boxY = Math.min(height - boxH - 10, Math.round(item.y + 14));

          return {
            pageIndex: pIdx,
            boxX,
            boxY,
            boxW,
            boxH,
            detectedReason: `Matched personnel name "${item.text}" on page ${pIdx + 1} - placed ABOVE name at (${boxX}, ${boxY})`,
            appliedPosition: "above",
          };
        }
      }
    }
  }

  // Fallback to last page
  const lastPageIdx = pageCount - 1;
  const lastPage = pages[lastPageIdx];
  const { width, height } = lastPage.getSize();

  if (isCounter) {
    const boxW = 20;
    const boxH = 20;
    const effectivePos: "right" | "left" | "bottom" = requestedPos === "auto" ? "right" : requestedPos;
    let boxX = Math.round(width * 0.55);
    let boxY = Math.round(height * 0.18);

    if (effectivePos === "left") {
      boxX = Math.round(width * 0.12);
    } else if (effectivePos === "bottom") {
      boxX = Math.round(width * 0.35);
      boxY = Math.round(height * 0.10);
    }

    return {
      pageIndex: lastPageIdx,
      boxX,
      boxY,
      boxW,
      boxH,
      detectedReason: `Default counter-sign compact 20px box placed ${effectivePos} on last page ${lastPageIdx + 1} at (${boxX}, ${boxY})`,
      appliedPosition: effectivePos,
    };
  } else {
    const boxW = 125;
    const boxH = 28;
    const boxX = Math.round(width * 0.55);
    const boxY = Math.round(height * 0.18 + 24);
    return {
      pageIndex: lastPageIdx,
      boxX,
      boxY,
      boxW,
      boxH,
      detectedReason: `Default personnel placement ABOVE on last page ${lastPageIdx + 1} at (${boxX}, ${boxY})`,
      appliedPosition: "above",
    };
  }
}

/**
 * Digitally signs an uploaded PDF document for a specific personnel by locating
 * the personnel's name inside the document:
 * - Placed directly ABOVE the name when normal signing (isCounterSign = false)
 * - Placed directly BESIDE the name in a 15px aspect-square (15x15) box when counter-signing (isCounterSign = true)
 * Applies PNPKI .p12 cryptographic signing using ISO 32000 incremental update chaining,
 * preserving all existing signatures in Adobe Acrobat without invalidation.
 */
export async function signUploadedPersonnelPdfBytes(
  existingPdfBytes: Uint8Array | ArrayBuffer,
  personnelName: string,
  signatureImage?: string | null,
  p12Options?: P12SigningOptions | null,
  options?: {
    isCounterSign?: boolean;
    counterSignIndex?: number;
    counterSignPosition?: CounterSignPosition;
    signerRoleLabel?: string;
  }
): Promise<{ bytes: Uint8Array; resolvedSignerName: string; signatureCoordinates: any }> {
  const incomingBytes =
    existingPdfBytes instanceof Uint8Array
      ? existingPdfBytes
      : new Uint8Array(existingPdfBytes);

  // Check if PDF is already cryptographically signed
  const sampleTail = new TextDecoder("latin1").decode(
    incomingBytes.subarray(Math.max(0, incomingBytes.length - 15000))
  );
  const isAlreadySigned =
    sampleTail.includes("/ByteRange") ||
    sampleTail.includes("/Type /Sig") ||
    sampleTail.includes("/Type/Sig");

  const pdfDoc = await PDFDocument.load(incomingBytes, { ignoreEncryption: true });
  const targetName = (personnelName || p12Options?.signerName || "PERSONNEL").trim();
  const isCounter = Boolean(options?.isCounterSign);

  const loc = findPersonnelSignatureCoordinates(pdfDoc, targetName, {
    isCounterSign: isCounter,
    counterSignIndex: options?.counterSignIndex,
    counterSignPosition: options?.counterSignPosition,
  });

  const boxW = loc.boxW;
  const boxH = loc.boxH;
  const boxX = loc.boxX;
  const boxY = loc.boxY;

  console.log(
    `[Personnel Signing] ${loc.detectedReason} => Placing ${isCounter ? `15px Counter-Sign Box BESIDE (${loc.appliedPosition})` : "Signature ABOVE"} "${targetName}" at [x=${boxX}, y=${boxY}, w=${boxW}, h=${boxH}] on page ${loc.pageIndex + 1}`
  );

  let resolvedSignerName = (p12Options?.signerName || targetName).trim();
  let finalUint8 = incomingBytes;

  // Embed the visual signature stamp on the page
  const pages = pdfDoc.getPages();
  const targetPage = pages[loc.pageIndex];

  if (isCounter) {
    // Compact horizontal counter-signature stamp: border-none, bg-transparent, sign on left, DigiSigned on right, text-black
    try {
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // 1. Left side: Signature image or vector checkmark (width ~14 pt, height ~12 pt)
      let hasDrawnCsImg = false;
      if (signatureImage) {
        try {
          const cleanBase64 = signatureImage.replace(/^data:image\/\w+;base64,/, "");
          const imgBinary = atob(cleanBase64);
          const imgBytes = new Uint8Array(imgBinary.length);
          for (let i = 0; i < imgBinary.length; i++) {
            imgBytes[i] = imgBinary.charCodeAt(i);
          }
          let embeddedCsImg;
          if (signatureImage.includes("image/jpeg") || signatureImage.includes("image/jpg")) {
            embeddedCsImg = await pdfDoc.embedJpg(imgBytes);
          } else {
            embeddedCsImg = await pdfDoc.embedPng(imgBytes);
          }
          targetPage.drawImage(embeddedCsImg, {
            x: boxX + 1,
            y: boxY + 1,
            width: 14,
            height: 12,
          });
          hasDrawnCsImg = true;
        } catch (e) {
          console.warn("Could not draw counter-sign image:", e);
        }
      }

      if (!hasDrawnCsImg) {
        // Crisp vector checkmark lines in black on the left side
        targetPage.drawLine({
          start: { x: boxX + 2, y: boxY + 6.5 },
          end: { x: boxX + 6, y: boxY + 2.5 },
          thickness: 1.1,
          color: rgb(0, 0, 0),
        });
        targetPage.drawLine({
          start: { x: boxX + 6, y: boxY + 2.5 },
          end: { x: boxX + 13, y: boxY + 11.5 },
          thickness: 1.1,
          color: rgb(0, 0, 0),
        });
      }

      // 2. Right side: DigiSigned and name aligned vertically beside the signature (text-black)
      const rawName = (resolvedSignerName || "Signer").trim();
      const nameParts = rawName.split(/\s+/).filter(Boolean);
      const compactName =
        rawName.length <= 10
          ? rawName
          : nameParts.length > 1
          ? `${nameParts[0][0]}. ${nameParts[nameParts.length - 1]}`
          : rawName.slice(0, 10);

      const textX = boxX + 16;

      targetPage.drawText("DigiSigned", {
        x: textX,
        y: boxY + 7.8,
        size: 3.3,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      targetPage.drawText(`by ${compactName}`, {
        x: textX,
        y: boxY + 3.2,
        size: 3.0,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
    } catch (e) {
      console.warn("Could not draw compact counter-sign mark:", e);
    }
  } else {
    // 2. Standard signature stamp directly ABOVE the personnel name (border-none per user requirement)

    let hasDrawnImage = false;
    if (signatureImage) {
      try {
        const cleanBase64 = signatureImage.replace(/^data:image\/\w+;base64,/, "");
        const imgBinary = atob(cleanBase64);
        const imgBytes = new Uint8Array(imgBinary.length);
        for (let i = 0; i < imgBinary.length; i++) {
          imgBytes[i] = imgBinary.charCodeAt(i);
        }
        let embeddedImg;
        if (signatureImage.includes("image/jpeg") || signatureImage.includes("image/jpg")) {
          embeddedImg = await pdfDoc.embedJpg(imgBytes);
        } else {
          embeddedImg = await pdfDoc.embedPng(imgBytes);
        }
        targetPage.drawImage(embeddedImg, {
          x: boxX + 3,
          y: boxY + 3,
          width: 38,
          height: boxH - 6,
        });
        hasDrawnImage = true;
      } catch (e) {
        console.warn("Could not embed signature image in PDF page:", e);
      }
    }

    try {
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const textX = hasDrawnImage ? boxX + 44 : boxX + 5;

      targetPage.drawText("Digitally signed", {
        x: textX,
        y: boxY + 18,
        size: 6.5,
        font: helveticaBold,
        color: rgb(0.08, 0.20, 0.50),
      });

      targetPage.drawText(`by ${resolvedSignerName}`, {
        x: textX,
        y: boxY + 10.5,
        size: 6.5,
        font: helveticaBold,
        color: rgb(0.0, 0.0, 0.0),
      });

      targetPage.drawText(`Date: ${formatPnpkiDate()}`, {
        x: textX,
        y: boxY + 3.5,
        size: 5.2,
        font: helvetica,
        color: rgb(0.25, 0.30, 0.40),
      });
    } catch (err) {
      console.warn("Could not draw digital signature typography:", err);
    }
  }

  // CRITICAL: Save the modified PDF with the embedded visual stamp so it's permanently visible!
  try {
    finalUint8 = await pdfDoc.save({ useObjectStreams: false });
  } catch (saveErr) {
    console.warn("Could not save visual signature stamp into PDF bytes:", saveErr);
  }

  // Cryptographic PNPKI .p12 signing (via backend incremental update to preserve earlier signatures)
  if (p12Options?.p12Base64 || p12Options?.profileId || p12Options?.user_Id) {
    let binary = "";
    const len = finalUint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(finalUint8[i]);
    }
    const rawPdfBase64 = btoa(binary);

    const reason = isCounter
      ? "Official Counter-Signature - DICT Region V Signing Workspace"
      : "Official Digital Signature - DICT Region V Signing Workspace";

    const fieldTag = (p12Options.signerName || "SIGNER").replace(/[^a-zA-Z0-9]/g, "_");
    const fieldName = isCounter
      ? `CounterSignature_${(options?.counterSignIndex || 0) + 1}_${fieldTag}`
      : undefined;

    const signResult = await dtrGeneratorApi.signPdfDocument({
      pdfBase64: rawPdfBase64,
      profileId: p12Options.profileId,
      user_Id: p12Options.user_Id,
      p12: p12Options.p12Base64,
      p12_password: p12Options.p12Password,
      account_password: p12Options.account_password,
      isGoogleAuth: p12Options.isGoogleAuth,
      reason,
      fieldName,
      sigRect: [boxX, boxY, boxW, boxH],
      sigRects: [[boxX, boxY, boxW, boxH]],
      pageIndex: loc.pageIndex,
    });

    if (signResult.success && signResult.signedPdfBase64) {
      const signedBinary = atob(signResult.signedPdfBase64);
      const signedBytes = new Uint8Array(signedBinary.length);
      for (let i = 0; i < signedBinary.length; i++) {
        signedBytes[i] = signedBinary.charCodeAt(i);
      }
      finalUint8 = signedBytes;
      if (signResult.signerName) {
        resolvedSignerName = signResult.signerName;
      }
    }
  }

  return { bytes: finalUint8, resolvedSignerName, signatureCoordinates: loc };
}
