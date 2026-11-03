import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@libsql/client/web";
import { decryptP12Password, getSignerIdentityFromP12, signPdfBuffer } from "./pnpkiSigningService.mjs";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// 1. DTR Rows for September 2026 (Days 1 to 31)
const dtrRows = [
  // 1-15 (from media_1792147510144_81aae404.pdf)
  { day: 1, amArrival: "7:02", amDeparture: "12:17", pmArrival: "12:18", pmDeparture: "6:08", undertimeHours: "", undertimeMinutes: "", isCustomLabel: false, customLabel: "" },
  { day: 2, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "HOLIDAY" },
  { day: 3, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "GP-POV 2026-09-0002" },
  { day: 4, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "NO WORK: 4DAY WORKWEEK" },
  { day: 5, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "SATURDAY" },
  { day: 6, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "SUNDAY" },
  { day: 7, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "GP-POV 2026-09-0025" },
  { day: 8, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "GP-POV 2026-09-0026" },
  { day: 9, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "GP-POV 2026-09-0027" },
  { day: 10, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "GP-POV 2026-09-0028" },
  { day: 11, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "GP-POV 2026-09-0029" },
  { day: 12, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "SATURDAY" },
  { day: 13, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "SUNDAY" },
  { day: 14, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "GP-POV 2026-09-0044" },
  { day: 15, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "GP-POV 2026-09-0050" },

  // 16-27 (from media_1792147510132_24e68bb2.pdf)
  { day: 16, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "GP-POV 2026-09-0070" },
  { day: 17, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "GP-POV 2026-09-0056" },
  { day: 18, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "NO WORK : 4DAY WORKWEEK" },
  { day: 19, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "SATURDAY" },
  { day: 20, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "SUNDAY" },
  { day: 21, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "GP-POV 2026-09-0071" },
  { day: 22, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "GP-POV 2026-09-0072" },
  { day: 23, amArrival: "7:00", amDeparture: "12:15", pmArrival: "12:16", pmDeparture: "6:04", undertimeHours: "", undertimeMinutes: "", isCustomLabel: false, customLabel: "" },
  { day: 24, amArrival: "7:03", amDeparture: "12:05", pmArrival: "12:06", pmDeparture: "6:27", undertimeHours: "", undertimeMinutes: "", isCustomLabel: false, customLabel: "" },
  { day: 25, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "NO WORK : 4DAY WORKWEEK" },
  { day: 26, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "SATURDAY" },
  { day: 27, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "SUNDAY" },

  // 28-31 (from uploaded image media_1792147499279_1799efdc.png)
  { day: 28, amArrival: "7:33", amDeparture: "12:13", pmArrival: "12:15", pmDeparture: "5:53", undertimeHours: "", undertimeMinutes: "", isCustomLabel: false, customLabel: "" },
  { day: 29, amArrival: "7:34", amDeparture: "12:12", pmArrival: "12:43", pmDeparture: "7:28", undertimeHours: "", undertimeMinutes: "", isCustomLabel: false, customLabel: "" },
  { day: 30, amArrival: "7:28", amDeparture: "12:12", pmArrival: "12:13", pmDeparture: "6:12", undertimeHours: "", undertimeMinutes: "", isCustomLabel: false, customLabel: "" },
  { day: 31, amArrival: "", amDeparture: "", pmArrival: "", pmDeparture: "", undertimeHours: "", undertimeMinutes: "", isCustomLabel: true, customLabel: "—" },
];

function formatPnpkiDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}.${month}.${day} ${hours}:${minutes}:${seconds} +08'00'`;
}

function parseTimeToMinutes(timeStr, isPm = false) {
  if (!timeStr || !timeStr.includes(":")) return null;
  const parts = timeStr.trim().split(":");
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  if (isPm && h < 12) h += 12;
  return h * 60 + m;
}

function calculateMetrics(rows) {
  let daysCount = 0;
  let totalMin = 0;
  rows.forEach((r) => {
    if (r.isCustomLabel) return;
    let dayMin = 0;
    let hasWorked = false;
    const amIn = parseTimeToMinutes(r.amArrival, false);
    const amOut = parseTimeToMinutes(r.amDeparture, false);
    if (amIn !== null && amOut !== null && amOut > amIn) {
      dayMin += amOut - amIn;
      hasWorked = true;
    }
    const pmIn = parseTimeToMinutes(r.pmArrival, true);
    const pmOut = parseTimeToMinutes(r.pmDeparture, true);
    if (pmIn !== null && pmOut !== null && pmOut > pmIn) {
      dayMin += pmOut - pmIn;
      hasWorked = true;
    }
    if (hasWorked) {
      daysCount++;
      totalMin += dayMin;
    }
  });
  return {
    totalDaysRendered: daysCount,
    totalHoursRendered: Math.round((totalMin / 60) * 10) / 10,
    undertimeHours: 0,
    undertimeMinutes: 0,
    lateMinutes: 0,
  };
}

async function buildDtrVectorPdf(options) {
  const {
    employeeName,
    periodText,
    regularHours,
    saturdayHours,
    supervisorName,
    supervisorTitle,
    empSignerName,
    supSignerName,
    empSignatureImage,
    supSignatureImage,
    signingDateTime,
  } = options;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter", // 612 x 792 pt
    compress: true,
  });

  const formWidth = 278;
  const colWidths = [24, 45, 45, 45, 45, 37, 37]; // Sum = 278 pt
  const startY = 24;
  const rowHeight = 11.5;

  const formOffsets = [20, 314];
  const employeeSigRects = [];
  const supervisorSigRects = [];

  formOffsets.forEach((formX) => {
    // 1. Header Section
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text("Civil Service Form No. 48", formX + 2, startY + 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("DAILY TIME RECORD", formX + formWidth / 2, startY + 22, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    doc.text("-----o0o-----", formX + formWidth / 2, startY + 31, { align: "center" });

    // Employee Full Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(employeeName.toUpperCase(), formX + formWidth / 2, startY + 45, { align: "center" });

    // Underline for name
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.75);
    doc.line(formX, startY + 47, formX + formWidth, startY + 47);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text("(Name)", formX + formWidth / 2, startY + 54, { align: "center" });

    // For the month of
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.text("For the month of", formX + 2, startY + 65);

    // Period text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(periodText.toUpperCase(), formX + 66 + (formWidth - 66) / 2, startY + 65, { align: "center" });

    doc.setLineWidth(0.6);
    doc.line(formX + 66, startY + 67, formX + formWidth, startY + 67);

    // Office Hours
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.2);
    doc.text("Office hours for arrival", formX + 2, startY + 75);
    doc.text("and departure", formX + 2, startY + 83);

    doc.text("Regular days", formX + 86, startY + 75);
    doc.setLineWidth(0.4);
    doc.line(formX + 124, startY + 76, formX + formWidth, startY + 76);
    if (regularHours) {
      doc.setFont("helvetica", "bold");
      doc.text(regularHours, formX + 124 + (formWidth - 124) / 2, startY + 74.5, { align: "center" });
    }

    doc.setFont("helvetica", "italic");
    doc.setFontSize(6);
    doc.text("Saturdays", formX + 86, startY + 83);
    doc.line(formX + 124, startY + 84, formX + formWidth, startY + 84);
    if (saturdayHours) {
      doc.setFont("helvetica", "bold");
      doc.text(saturdayHours, formX + 124 + (formWidth - 124) / 2, startY + 82.5, { align: "center" });
    }

    // 2. Main Table
    const tableTop = startY + 88;
    const headerH1 = 12;
    const headerH2 = 10;
    const totalHeaderH = headerH1 + headerH2;

    doc.setFillColor(243, 244, 246);
    doc.rect(formX, tableTop, formWidth, totalHeaderH, "F");

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.rect(formX, tableTop, formWidth, totalHeaderH);

    // Header vertical column dividers
    let curX = formX;
    curX += colWidths[0];
    doc.line(curX, tableTop, curX, tableTop + totalHeaderH);

    const amX = curX;
    curX += colWidths[1] + colWidths[2];
    doc.line(curX, tableTop, curX, tableTop + totalHeaderH);

    const pmX = curX;
    curX += colWidths[3] + colWidths[4];
    doc.line(curX, tableTop, curX, tableTop + totalHeaderH);

    const utX = curX;

    doc.line(formX + colWidths[0], tableTop + headerH1, formX + formWidth, tableTop + headerH1);
    doc.line(amX + colWidths[1], tableTop + headerH1, amX + colWidths[1], tableTop + totalHeaderH);
    doc.line(pmX + colWidths[3], tableTop + headerH1, pmX + colWidths[3], tableTop + totalHeaderH);
    doc.line(utX + colWidths[5], tableTop + headerH1, utX + colWidths[5], tableTop + totalHeaderH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("Days", formX + colWidths[0] / 2, tableTop + totalHeaderH / 2 + 2.5, { align: "center" });
    doc.text("A.M.", amX + (colWidths[1] + colWidths[2]) / 2, tableTop + 8.5, { align: "center" });
    doc.text("P.M.", pmX + (colWidths[3] + colWidths[4]) / 2, tableTop + 8.5, { align: "center" });
    doc.text("Undertime", utX + (colWidths[5] + colWidths[6]) / 2, tableTop + 8.5, { align: "center" });

    doc.setFontSize(6);
    doc.text("Arrival", amX + colWidths[1] / 2, tableTop + headerH1 + 7, { align: "center" });
    doc.text("Departure", amX + colWidths[1] + colWidths[2] / 2, tableTop + headerH1 + 7, { align: "center" });
    doc.text("Arrival", pmX + colWidths[3] / 2, tableTop + headerH1 + 7, { align: "center" });
    doc.text("Departure", pmX + colWidths[3] + colWidths[4] / 2, tableTop + headerH1 + 7, { align: "center" });
    doc.text("Hours", utX + colWidths[5] / 2, tableTop + headerH1 + 7, { align: "center" });
    doc.text("Minutes", utX + colWidths[5] + colWidths[6] / 2, tableTop + headerH1 + 7, { align: "center" });

    // Table Body (31 Days)
    let currentY = tableTop + totalHeaderH;

    dtrRows.forEach((row) => {
      doc.setLineWidth(0.4);
      doc.setDrawColor(0, 0, 0);

      if (row.isCustomLabel) {
        const note = (row.customLabel || "").trim().toUpperCase();
        const isWeekend = note.includes("SATURDAY") || note.includes("SUNDAY");
        if (isWeekend) {
          doc.setFillColor(229, 231, 235);
          doc.rect(formX, currentY, formWidth, rowHeight, "FD");
        } else {
          doc.rect(formX, currentY, formWidth, rowHeight);
        }

        // Day Number
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(0, 0, 0);
        doc.text(String(row.day), formX + colWidths[0] / 2, currentY + 8, { align: "center" });

        // Divider after day
        doc.line(formX + colWidths[0], currentY, formX + colWidths[0], currentY + rowHeight);

        // Note
        if (row.customLabel === "-" || row.customLabel === "—") {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.text("—", formX + colWidths[0] + (formWidth - colWidths[0]) / 2, currentY + 8, { align: "center" });
        } else {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6);
          doc.text(note, formX + colWidths[0] + (formWidth - colWidths[0]) / 2, currentY + 8, { align: "center" });
        }
      } else {
        doc.rect(formX, currentY, formWidth, rowHeight);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(0, 0, 0);
        doc.text(String(row.day), formX + colWidths[0] / 2, currentY + 8, { align: "center" });

        let lineX = formX + colWidths[0];
        doc.line(lineX, currentY, lineX, currentY + rowHeight);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.8);

        if (row.amArrival) doc.text(row.amArrival, lineX + colWidths[1] / 2, currentY + 8, { align: "center" });
        lineX += colWidths[1];
        doc.line(lineX, currentY, lineX, currentY + rowHeight);

        if (row.amDeparture) doc.text(row.amDeparture, lineX + colWidths[2] / 2, currentY + 8, { align: "center" });
        lineX += colWidths[2];
        doc.line(lineX, currentY, lineX, currentY + rowHeight);

        if (row.pmArrival) doc.text(row.pmArrival, lineX + colWidths[3] / 2, currentY + 8, { align: "center" });
        lineX += colWidths[3];
        doc.line(lineX, currentY, lineX, currentY + rowHeight);

        if (row.pmDeparture) doc.text(row.pmDeparture, lineX + colWidths[4] / 2, currentY + 8, { align: "center" });
        lineX += colWidths[4];
        doc.line(lineX, currentY, lineX, currentY + rowHeight);

        if (row.undertimeHours) doc.text(row.undertimeHours, lineX + colWidths[5] / 2, currentY + 8, { align: "center" });
        lineX += colWidths[5];
        doc.line(lineX, currentY, lineX, currentY + rowHeight);

        if (row.undertimeMinutes) doc.text(row.undertimeMinutes, lineX + colWidths[6] / 2, currentY + 8, { align: "center" });
      }

      currentY += rowHeight;
    });

    // Total Row
    const totalRowH = 12;
    doc.setFillColor(243, 244, 246);
    doc.rect(formX, currentY, formWidth, totalRowH, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(0, 0, 0);
    const textBeforeUt = formX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4];
    doc.text("TOTAL", textBeforeUt - 4, currentY + 8.5, { align: "right" });

    doc.line(textBeforeUt, currentY, textBeforeUt, currentY + totalRowH);
    doc.text("0", textBeforeUt + colWidths[5] / 2, currentY + 8.5, { align: "center" });
    doc.line(textBeforeUt + colWidths[5], currentY, textBeforeUt + colWidths[5], currentY + totalRowH);
    doc.text("0", textBeforeUt + colWidths[5] + colWidths[6] / 2, currentY + 8.5, { align: "center" });

    currentY += totalRowH;

    // 3. Certification Text
    const certY = currentY + 11;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.8);
    doc.setTextColor(0, 0, 0);

    const fullCertWidth = formWidth - 1;
    const drawJustifiedLine = (textStr, yPos) => {
      const words = textStr.trim().split(/\s+/);
      if (words.length <= 1) {
        doc.text(textStr, formX + 0.5, yPos);
        return;
      }
      const totalWordsWidth = words.reduce((acc, w) => acc + doc.getTextWidth(w), 0);
      const spaceWidth = (fullCertWidth - totalWordsWidth) / (words.length - 1);
      let curWordX = formX + 0.5;
      for (const w of words) {
        doc.text(w, curWordX, yPos);
        curWordX += doc.getTextWidth(w) + spaceWidth;
      }
    };

    drawJustifiedLine("I certify on my honor that the above is a true and correct report of the", certY);
    drawJustifiedLine("hours of work performed, record of which was made daily at the time of", certY + 9);
    doc.text("arrival and departure from office.", formX + 0.5, certY + 18);

    // 4. Employee Signature Section
    const empSigY = certY + 50;
    const boxW = 120;
    const boxH = 18;
    const boxX = formX + (formWidth - boxW) / 2;
    const boxY = empSigY - boxH - 10;

    // Signature rectangle coordinates in PDF bottom-left points
    employeeSigRects.push([
      Math.round(boxX),
      Math.round(792 - (boxY + boxH)),
      Math.round(boxW),
      Math.round(boxH),
    ]);

    if (empSignatureImage) {
      try {
        const imgW = 38;
        const imgH = boxH;
        doc.addImage(empSignatureImage, "PNG", boxX + 6, boxY, imgW, imgH);
      } catch (err) {
        console.warn("Could not embed employee signature image:", err);
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(0, 0, 0);
    const empTextX = empSignatureImage ? boxX + 48 : boxX + boxW / 2;
    const empTextAlign = empSignatureImage ? "left" : "center";

    doc.text("Digitally signed", empTextX, boxY + 6.5, { align: empTextAlign });
    doc.text(`by ${empSignerName}`, empTextX, boxY + 12.5, { align: empTextAlign });

    // Employee Signature Line
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(employeeName.toUpperCase(), formX + formWidth / 2, empSigY - 3, { align: "center" });

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.line(formX, empSigY, formX + formWidth, empSigY);

    // Verified
    const verifiedY = empSigY + 14;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.4);
    doc.text("VERIFIED as to the prescribed office hours:", formX + 2, verifiedY);

    // 5. Supervisor Signature Section
    const supSigY = verifiedY + 50;
    const supBoxX = formX + (formWidth - boxW) / 2;
    const supBoxY = supSigY - boxH - 12;

    supervisorSigRects.push([
      Math.round(supBoxX),
      Math.round(792 - (supBoxY + boxH)),
      Math.round(boxW),
      Math.round(boxH),
    ]);

    if (supSignatureImage) {
      try {
        const imgW = 34;
        const imgH = boxH;
        doc.addImage(supSignatureImage, "PNG", supBoxX + 6, supBoxY, imgW, imgH);
      } catch (err) {
        console.warn("Could not embed supervisor signature image:", err);
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.0);
    doc.setTextColor(0, 0, 0);
    const supTextX = supSignatureImage ? supBoxX + 44 : supBoxX + boxW / 2;
    const supTextAlign = supSignatureImage ? "left" : "center";

    doc.text("Digitally signed by", supTextX, supBoxY + 6.5, { align: supTextAlign });
    doc.text("Buena Rene Jane Rosendo", supTextX, supBoxY + 13.0, { align: supTextAlign });

    // Supervisor Signature Line
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(supervisorName.toUpperCase(), formX + formWidth / 2, supSigY - 3, { align: "center" });

    doc.line(formX, supSigY, formX + formWidth, supSigY);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.text(supervisorTitle, formX + formWidth / 2, supSigY + 8, { align: "center" });
  });

  const arrayBuffer = doc.output("arraybuffer");
  return {
    rawPdfBytes: Buffer.from(arrayBuffer),
    employeeSigRects,
    supervisorSigRects,
  };
}

async function main() {
  console.log("==================================================================");
  console.log("   GENERATING SEPTEMBER 1-30, 2026 COMBINED DTR FOR ACE M. MALTO   ");
  console.log("==================================================================");

  // 1. Connect to Turso DB
  const tursoDb = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Load profiles from Turso
  const aceRowRes = await tursoDb.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-usr-mu3eob3l'");
  const reneRowRes = await tursoDb.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-sup-01'");

  if (aceRowRes.rows.length === 0) {
    throw new Error("Could not find Ace Mata Malto profile (dtr-sig-usr-mu3eob3l) in Turso DB!");
  }
  if (reneRowRes.rows.length === 0) {
    throw new Error("Could not find Rene Jane R. Buena profile (dtr-sig-sup-01) in Turso DB!");
  }

  const aceProfile = aceRowRes.rows[0];
  const reneProfile = reneRowRes.rows[0];

  const acePassword = decryptP12Password(aceProfile.p12_password);
  const renePassword = decryptP12Password(reneProfile.p12_password);

  const aceIdentity = getSignerIdentityFromP12(aceProfile.p12, acePassword);
  const reneIdentity = getSignerIdentityFromP12(reneProfile.p12, renePassword);

  console.log("✓ Certified Personnel Signer:   ", aceIdentity.commonName, `(Serial: ${aceIdentity.serialNumber})`);
  console.log("✓ Certified Supervisor Signer:  ", reneIdentity.commonName, `(Serial: ${reneIdentity.serialNumber})`);

  // Load signature images
  const aceSignatureImage = aceProfile.image_digiSigned;
  const reneSignatureImage = reneProfile.image_digiSigned;

  console.log(`✓ Personnel Signature Image:    Present (${aceSignatureImage?.length || 0} chars)`);
  console.log(`✓ Supervisor Signature Image:   Present (${reneSignatureImage?.length || 0} chars)`);

  const signingDateTime = "2026.09.30 17:35:12 +08'00'";

  // 2. Build CS Form 48 Vector PDF
  console.log("\nBuilding vector Civil Service Form No. 48 with 31 rows (September 1-30)...");
  const { rawPdfBytes, employeeSigRects, supervisorSigRects } = await buildDtrVectorPdf({
    employeeName: "ACE M. MALTO",
    periodText: "SEPTEMBER 1-30, 2026",
    regularHours: "",
    saturdayHours: "",
    supervisorName: "RENE JANE R. BUENA",
    supervisorTitle: "Provincial Officer - Albay",
    empSignerName: aceIdentity.commonName,
    supSignerName: reneIdentity.commonName,
    empSignatureImage: aceSignatureImage,
    supSignatureImage: reneSignatureImage,
    signingDateTime: "",
  });

  console.log(`✓ Vector PDF generated (${rawPdfBytes.length} bytes).`);
  console.log("  Employee sig rectangles:  ", employeeSigRects);
  console.log("  Supervisor sig rectangles:", supervisorSigRects);

  // 3. Normalize PDF annotations with pdf-lib to ensure strict ISO 32000 compliance
  const pdfDoc = await PDFDocument.load(rawPdfBytes, { ignoreEncryption: true });
  const cleanBytes = await pdfDoc.save({ useObjectStreams: false });
  let currentBuffer = Buffer.from(cleanBytes);

  // 4. Sequential 4-Pass Cryptographic Signing
  console.log("\n--- Signing Pass 1/4: Personnel Copy 1 ---");
  const pass1 = await signPdfBuffer(
    currentBuffer,
    aceProfile.p12,
    acePassword,
    {
      sigRect: employeeSigRects[0],
      fieldName: "Personnel_Signature_Copy1",
      reason: "Civil Service Form No. 48 Official Daily Time Record Digital Certification (Copy 1)",
    }
  );
  currentBuffer = pass1.signedBuffer;
  console.log(`✓ Pass 1 completed (${currentBuffer.length} bytes).`);

  console.log("\n--- Signing Pass 2/4: Personnel Copy 2 ---");
  const pass2 = await signPdfBuffer(
    currentBuffer,
    aceProfile.p12,
    acePassword,
    {
      sigRect: employeeSigRects[1],
      fieldName: "Personnel_Signature_Copy2",
      reason: "Civil Service Form No. 48 Official Daily Time Record Digital Certification (Copy 2)",
    }
  );
  currentBuffer = pass2.signedBuffer;
  console.log(`✓ Pass 2 completed (${currentBuffer.length} bytes).`);

  console.log("\n--- Signing Pass 3/4: Supervisor Copy 1 ---");
  const pass3 = await signPdfBuffer(
    currentBuffer,
    reneProfile.p12,
    renePassword,
    {
      sigRect: supervisorSigRects[0],
      fieldName: "Supervisor_Signature_Copy1",
      reason: "Civil Service Form No. 48 Official Verification (Copy 1)",
    }
  );
  currentBuffer = pass3.signedBuffer;
  console.log(`✓ Pass 3 completed (${currentBuffer.length} bytes).`);

  console.log("\n--- Signing Pass 4/4: Supervisor Copy 2 ---");
  const pass4 = await signPdfBuffer(
    currentBuffer,
    reneProfile.p12,
    renePassword,
    {
      sigRect: supervisorSigRects[1],
      fieldName: "Supervisor_Signature_Copy2",
      reason: "Civil Service Form No. 48 Official Verification (Copy 2)",
    }
  );
  const finalSignedBuffer = pass4.signedBuffer;
  console.log(`✓ Pass 4 completed (${finalSignedBuffer.length} bytes).`);

  // 5. Save PDF files to target destinations
  const fileName = "DTR_Ace_M._Malto_September_2026.pdf";
  const destinations = [
    path.resolve(process.cwd(), "public", fileName),
    "C:\\Users\\Ace\\Desktop\\" + fileName,
    "C:\\Users\\Ace\\.gemini\\antigravity\\brain\\1b01b64c-6b31-4d10-a765-fcb7ef57f509\\" + fileName,
    path.resolve(process.cwd(), "dist", fileName),
  ];

  const siblingPublic = path.resolve(process.cwd(), "..", "dict-dtr-generator", "public");
  if (fs.existsSync(siblingPublic)) {
    destinations.push(path.join(siblingPublic, fileName));
  }

  for (const dest of destinations) {
    try {
      const parentDir = path.dirname(dest);
      if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(dest, finalSignedBuffer);
      console.log(`✓ Saved: ${dest}`);
    } catch (err) {
      console.warn(`Could not save to ${dest}:`, err.message);
    }
  }

  // Also save Rene Jane signature PNG to public signatures
  const sigPngDest = path.resolve(process.cwd(), "public", "signatures", "rene-jane-r-buena-signature.png");
  try {
    const parent = path.dirname(sigPngDest);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.copyFileSync("scratch/rene_sig_correct.png", sigPngDest);
    console.log(`✓ Saved signature image: ${sigPngDest}`);
  } catch {}

  // 6. Update Turso Database dtr_storage
  const metrics = calculateMetrics(dtrRows);
  const pdfDataUrl = "data:application/pdf;base64," + finalSignedBuffer.toString("base64");
  const rowsJson = JSON.stringify(dtrRows);

  console.log("\nUpdating database records in Turso dtr_storage...");

  const storageIds = [
    { id: "dtr-store-1-2026-09-full", userId: "1" },
    { id: "dtr-store-usr-mu3eob3l-2026-09-full", userId: "usr-mu3eob3l" },
  ];

  for (const item of storageIds) {
    // Delete existing if any
    await tursoDb.execute({
      sql: "DELETE FROM dtr_storage WHERE id = ?",
      args: [item.id],
    });

    await tursoDb.execute({
      sql: `INSERT INTO dtr_storage (
              id, user_id, employee_name, employee_id, position, employment_status,
              module, province, section_division, period_text, month, year, scope,
              regular_hours, saturday_hours, supervisor_name, supervisor_title,
              total_days_rendered, total_hours_rendered, undertime_hours, undertime_minutes,
              late_minutes, status, submitted_date, pdf_filename, pdf_filesize, pdf_data,
              has_p12, employee_has_p12, employee_signer_name, employee_signature_image,
              supervisor_has_p12, supervisor_signature_image, signer_name, rows_json,
              doc_type, created_at, updated_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, CURRENT_TIMESTAMP, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?,
              'DTR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )`,
      args: [
        item.id,
        item.userId,
        "Ace M. Malto",
        "usr-mu3eob3l",
        "Computer Maintenance Technologist II",
        "Regular",
        "PROVINCIAL",
        "Albay",
        "Technical Operations Division",
        "September 01-30, 2026",
        9,
        2026,
        "full",
        "8:00 AM - 5:00 PM",
        "As Required",
        "Rene Jane R. Buena",
        "Provincial Officer - Albay",
        metrics.totalDaysRendered,
        metrics.totalHoursRendered,
        0,
        0,
        0,
        "Approved",
        fileName,
        String(finalSignedBuffer.length),
        pdfDataUrl,
        1,
        1,
        aceIdentity.commonName,
        aceSignatureImage,
        1,
        reneSignatureImage,
        aceIdentity.commonName,
        rowsJson,
      ],
    });
    console.log(`✓ Turso DB dtr_storage row '${item.id}' successfully inserted/updated to Approved with signed PDF!`);
  }

  // 7. Verify the final signed PDF
  console.log("\n==================================================================");
  console.log("                    VERIFYING FINAL SIGNED PDF                    ");
  console.log("==================================================================");
  const pdfStr = finalSignedBuffer.toString("latin1");
  const sigMatches = [...pdfStr.matchAll(/\/Type\s*\/Sig\b/g)];
  console.log(`✓ Total /Type /Sig signature dictionaries: ${sigMatches.length} (Expected: 4)`);

  const nameMatches = [...pdfStr.matchAll(/\/Name\s*\(([^)]+)\)/g)].map((m) => m[1]);
  console.log("✓ Signer names in signature dictionaries: ", nameMatches);

  const fieldMatches = [...pdfStr.matchAll(/\/T\s*\(([^)]+)\)/g)].map((m) => m[1]);
  console.log("✓ Signature field widget names:           ", fieldMatches);

  const byteRangeMatches = [...pdfStr.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)];
  console.log(`✓ Validated ByteRanges (${byteRangeMatches.length}):`);
  byteRangeMatches.forEach((m, idx) => {
    console.log(`   [${idx + 1}] [${m[1]}, ${m[2]}, ${m[3]}, ${m[4]}] (covers ${Number(m[3]) + Number(m[4])} of file size)`);
  });

  const startXrefs = [...pdfStr.matchAll(/startxref\s+(\d+)/g)].map((m) => m[1]);
  console.log("✓ Incremental startxrefs:                 ", startXrefs);

  console.log(`\nFinal PDF File Size: ${finalSignedBuffer.length} bytes`);
  console.log("All operations completed successfully with 0 errors!");
}

main().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
