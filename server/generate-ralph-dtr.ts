import { db } from "./db.js";
import { jsPDF } from "jspdf";
import { signPdfBuffer, decryptP12Password, getSignerIdentityFromP12 } from "./services/pnpkiSigningService.js";
import { broadcastDtrRealtimeEvent } from "./routes/dtrStorage.js";
import https from "https";
import fs from "fs";
import path from "path";

interface RawTimeCard {
  userFullName: string;
  employeeNumber?: string;
  userName: string;
  inDateTime: string; // "YYYY-MM-DD HH:MM:SS"
  outDateTime?: string; // "YYYY-MM-DD HH:MM:SS"
  hours?: number;
  [key: string]: any;
}

interface DtrRow {
  day: number;
  amArrival: string;
  amDeparture: string;
  pmArrival: string;
  pmDeparture: string;
  undertimeHours: string;
  undertimeMinutes: string;
  isCustomLabel?: boolean;
  customLabel?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

async function queryOtcTimeCards(fromDateTime: string, toDateTime: string, userFullName: string): Promise<RawTimeCard[]> {
  const payload = JSON.stringify({
    cmd: "api/t1QueryTimeCards",
    companyId: "94324",
    developerToken: "jGR7ij1oVYv2wk7AhhnLbEyCqJSP13",
    nextRecord: "0",
    dateTimeFrom: fromDateTime,
    dateTimeTo: toDateTime,
    userFullName: userFullName,
    departmentName: "ALL DEPARTMENTS",
    maxRecords: "5000",
  });

  return new Promise((resolve, reject) => {
    const req = https.request("https://api1.opentimeclock.com/Jun-Inside-VPC", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve(Array.isArray(parsed.data) ? parsed.data : []);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || !timeStr.includes(":")) return null;
  const parts = timeStr.trim().split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function calculateDtrMetrics(rows: DtrRow[]) {
  let totalMinutes = 0;
  let undertimeHours = 0;
  let undertimeMinutes = 0;
  let lateMinutes = 0;
  let daysRenderedCount = 0;

  const standardAmIn = 8 * 60; // 08:00 AM
  const standardPmIn = 13 * 60; // 01:00 PM

  rows.forEach((r) => {
    let dayHasRendered = false;
    let dayTotalMin = 0;

    // Morning shift
    const amIn = parseTimeToMinutes(r.amArrival);
    const amOut = parseTimeToMinutes(r.amDeparture);
    if (amIn !== null && amOut !== null && amOut > amIn) {
      dayTotalMin += amOut - amIn;
      dayHasRendered = true;
      if (amIn > standardAmIn) {
        lateMinutes += amIn - standardAmIn;
      }
    }

    // Afternoon shift
    const pmIn = parseTimeToMinutes(r.pmArrival);
    const pmOut = parseTimeToMinutes(r.pmDeparture);
    if (pmIn !== null && pmOut !== null && pmOut > pmIn) {
      dayTotalMin += pmOut - pmIn;
      dayHasRendered = true;
      if (pmIn > standardPmIn) {
        lateMinutes += pmIn - standardPmIn;
      }
    }

    if (dayHasRendered) {
      daysRenderedCount++;
      totalMinutes += dayTotalMin;
    }

    undertimeHours += parseInt(r.undertimeHours, 10) || 0;
    undertimeMinutes += parseInt(r.undertimeMinutes, 10) || 0;
  });

  const totalHoursRendered = Math.round((totalMinutes / 60) * 10) / 10;
  return {
    totalDaysRendered: daysRenderedCount,
    totalHoursRendered,
    undertimeHours,
    undertimeMinutes,
    lateMinutes,
  };
}

async function buildRalphDtrVectorPdf(
  employeeName: string,
  periodText: string,
  supervisorName: string,
  supervisorTitle: string,
  rows: DtrRow[],
  p12SignerName: string,
  signatureImage?: string
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter", // 612 x 792 pt
  });

  const formWidth = 278;
  const colWidths = [24, 45, 45, 45, 45, 37, 37]; // Sum = 278 pt
  const startY = 24;
  const rowHeight = 11.5;

  const totalUndertime = rows.reduce(
    (acc, r) => {
      const h = parseInt(r.undertimeHours, 10) || 0;
      const m = parseInt(r.undertimeMinutes, 10) || 0;
      return { hours: acc.hours + h, minutes: acc.minutes + m };
    },
    { hours: 0, minutes: 0 }
  );

  const formOffsets = [20, 314];
  const employeeSigRects: [number, number, number, number][] = [];

  formOffsets.forEach((formX) => {
    // -------------------------------------------------------------
    // 1. HEADER SECTION
    // -------------------------------------------------------------
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

    // Office Hours (Matching blank style)
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.text("Office hours for arrival", formX + 2, startY + 77);
    doc.text("and departure", formX + 2, startY + 84);

    doc.text("Regular days", formX + 130, startY + 77);
    doc.line(formX + 175, startY + 78, formX + formWidth, startY + 78);

    doc.text("Saturdays", formX + 130, startY + 87);
    doc.line(formX + 175, startY + 88, formX + formWidth, startY + 88);

    // -------------------------------------------------------------
    // 2. MAIN TABLE (31 Rows + Header)
    // -------------------------------------------------------------
    const tableTop = startY + 95;
    const headerH1 = 14;
    const headerH2 = 12;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.rect(formX, tableTop, formWidth, headerH1 + headerH2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.text("Days", formX + colWidths[0] / 2, tableTop + 17, { align: "center" });
    doc.text("A. M.", formX + colWidths[0] + (colWidths[1] + colWidths[2]) / 2, tableTop + 10, { align: "center" });
    doc.text("P. M.", formX + colWidths[0] + colWidths[1] + colWidths[2] + (colWidths[3] + colWidths[4]) / 2, tableTop + 10, { align: "center" });
    doc.text("Undertime", formX + formWidth - (colWidths[5] + colWidths[6]) / 2, tableTop + 10, { align: "center" });

    doc.line(formX + colWidths[0], tableTop + headerH1, formX + formWidth, tableTop + headerH1);

    doc.setFontSize(6.2);
    const subColX1 = formX + colWidths[0];
    doc.text("Arrival", subColX1 + colWidths[1] / 2, tableTop + headerH1 + 9, { align: "center" });
    doc.text("Departure", subColX1 + colWidths[1] + colWidths[2] / 2, tableTop + headerH1 + 9, { align: "center" });
    doc.text("Arrival", subColX1 + colWidths[1] + colWidths[2] + colWidths[3] / 2, tableTop + headerH1 + 9, { align: "center" });
    doc.text("Departure", subColX1 + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] / 2, tableTop + headerH1 + 9, { align: "center" });
    doc.text("Hours", formX + formWidth - colWidths[6] - colWidths[5] / 2, tableTop + headerH1 + 9, { align: "center" });
    doc.text("Minutes", formX + formWidth - colWidths[6] / 2, tableTop + headerH1 + 9, { align: "center" });

    // Vertical column divider lines
    let curX = formX;
    colWidths.forEach((w, idx) => {
      curX += w;
      if (idx < colWidths.length - 1) {
        doc.line(curX, idx === 0 ? tableTop : tableTop + headerH1, curX, tableTop + headerH1 + headerH2);
      }
    });

    // Render 31 day rows
    let currentY = tableTop + headerH1 + headerH2;

    rows.forEach((row) => {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.rect(formX, currentY, formWidth, rowHeight);

      // Vertical grid lines
      let lineX = formX;
      colWidths.forEach((w, colIdx) => {
        lineX += w;
        if (colIdx < colWidths.length - 1) {
          doc.line(lineX, currentY, lineX, currentY + rowHeight);
        }
      });

      // Day Number
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.4);
      doc.setTextColor(0, 0, 0);
      doc.text(String(row.day), formX + colWidths[0] / 2, currentY + 8.2, { align: "center" });

      if (row.isCustomLabel) {
        const spanW = formWidth - colWidths[0];
        doc.setFont("helvetica", "italic");
        doc.setFontSize(6.2);
        doc.setTextColor(130, 130, 130);
        doc.text(row.customLabel || "SATURDAY", formX + colWidths[0] + spanW / 2, currentY + 8.2, { align: "center" });
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.4);
        doc.setTextColor(0, 0, 0);

        let cellX = formX + colWidths[0];
        if (row.amArrival) doc.text(row.amArrival, cellX + colWidths[1] / 2, currentY + 8.2, { align: "center" });
        cellX += colWidths[1];
        if (row.amDeparture) doc.text(row.amDeparture, cellX + colWidths[2] / 2, currentY + 8.2, { align: "center" });
        cellX += colWidths[2];
        if (row.pmArrival) doc.text(row.pmArrival, cellX + colWidths[3] / 2, currentY + 8.2, { align: "center" });
        cellX += colWidths[3];
        if (row.pmDeparture) doc.text(row.pmDeparture, cellX + colWidths[4] / 2, currentY + 8.2, { align: "center" });
        cellX += colWidths[4];
        if (row.undertimeHours) doc.text(row.undertimeHours, cellX + colWidths[5] / 2, currentY + 8.2, { align: "center" });
        cellX += colWidths[5];
        if (row.undertimeMinutes) doc.text(row.undertimeMinutes, cellX + colWidths[6] / 2, currentY + 8.2, { align: "center" });
      }

      currentY += rowHeight;
    });

    // Total Row
    doc.rect(formX, currentY, formWidth, rowHeight);
    let totalLineX = formX;
    colWidths.forEach((w, colIdx) => {
      totalLineX += w;
      if (colIdx < colWidths.length - 1) {
        doc.line(totalLineX, currentY, totalLineX, currentY + rowHeight);
      }
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(0, 0, 0);
    doc.text("Total", formX + (formWidth - colWidths[5] - colWidths[6]) / 2, currentY + 8.2, { align: "center" });

    if (totalUndertime.hours > 0) {
      doc.text(String(totalUndertime.hours), formX + formWidth - colWidths[6] - colWidths[5] / 2, currentY + 8.2, { align: "center" });
    }
    if (totalUndertime.minutes > 0) {
      doc.text(String(totalUndertime.minutes), formX + formWidth - colWidths[6] / 2, currentY + 8.2, { align: "center" });
    }

    // -------------------------------------------------------------
    // 3. CERTIFICATION & SIGNATURES
    // -------------------------------------------------------------
    const certY = currentY + 18;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.text("I certify on my honor that the above is a true and correct report of the", formX + 2, certY);
    doc.text("hours of work performed, record of which was made daily at the time of", formX + 2, certY + 9);
    doc.text("arrival and departure from office.", formX + 2, certY + 18);

    // Employee Signature Box
    const empSigY = certY + 48;
    const boxW = 120;
    const boxH = 22;
    const boxX = formX + (formWidth - boxW) / 2;
    const boxY = empSigY - boxH - 4;

    // Collect bounding box coordinates for ISO-compliant cryptographic signature dictionary
    employeeSigRects.push([
      Math.round(boxX),
      Math.round(792 - (boxY + boxH)),
      Math.round(boxW),
      Math.round(boxH),
    ]);

    if (signatureImage) {
      try {
        const imgW = 42;
        const imgH = boxH - 4;
        doc.addImage(signatureImage, "PNG", boxX + 4, boxY + 2, imgW, imgH);
      } catch (err) {
        console.warn("Could not embed employee signature image:", err);
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(0, 0, 0);
    doc.text("Digitally signed", boxX + (signatureImage ? 48 : boxW / 2), boxY + 9, {
      align: signatureImage ? "left" : "center",
    });
    doc.text(`by ${p12SignerName}`, boxX + (signatureImage ? 48 : boxW / 2), boxY + 16.5, {
      align: signatureImage ? "left" : "center",
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(employeeName.toUpperCase(), formX + formWidth / 2, empSigY - 3, { align: "center" });

    doc.setLineWidth(0.6);
    doc.line(formX, empSigY, formX + formWidth, empSigY);

    // Verified
    const verifiedY = empSigY + 13;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.4);
    doc.text("VERIFIED as to the prescribed office hours:", formX + 2, verifiedY);

    // Supervisor Section
    const supSigY = verifiedY + 44;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(supervisorName.toUpperCase(), formX + formWidth / 2, supSigY - 3, { align: "center" });

    doc.line(formX, supSigY, formX + formWidth, supSigY);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.text(supervisorTitle || "In Charge", formX + formWidth / 2, supSigY + 9, { align: "center" });
  });

  const arrayBuffer = doc.output("arraybuffer");
  return {
    rawPdfBytes: Buffer.from(arrayBuffer),
    employeeSigRects,
  };
}

async function main() {
  console.log("=================================================");
  console.log("  GENERATING SIGNED DTR FOR RALPH DELA TORRE     ");
  console.log("=================================================");

  // 1. Fetch Signature Profile & Certificate from Turso
  const sigProfileRes = await db.execute({
    sql: "SELECT * FROM dtr_generator WHERE id = 'dtr-sig-usr-mudrq46b' OR user_Id = 'usr-mudrq46b'",
    args: [],
  });

  if (sigProfileRes.rows.length === 0) {
    throw new Error("Ralph Dela Torre signature profile not found in dtr_generator table.");
  }

  const profile: any = sigProfileRes.rows[0];
  const p12Base64 = profile.p12;
  const p12Password = decryptP12Password(profile.p12_password);
  const signatureImage = profile.image_digiSigned;
  const signerIdentity = getSignerIdentityFromP12(p12Base64, p12Password);

  console.log(`✓ Loaded PNPKI Keystore: ${profile.p12_filename}`);
  console.log(`✓ Certified Cryptographic Signer: ${signerIdentity.commonName}`);
  console.log(`✓ Certificate Serial: ${signerIdentity.serialNumber}`);
  console.log(`✓ Signature Image Present: ${Boolean(signatureImage)} (length: ${signatureImage?.length || 0})`);

  // 2. Fetch Timecard Punches from Open Time Clock (September 2026)
  const punches = await queryOtcTimeCards("2026-09-01 00:00:00", "2026-09-30 23:59:59", "Ralph B. Dela Torre");
  console.log(`✓ Fetched ${punches.length} punch records from Open Time Clock for Ralph B. Dela Torre.`);

  // Group punches by day
  const byDay: Record<number, RawTimeCard[]> = {};
  punches.forEach((p) => {
    if (!p.inDateTime) return;
    const datePart = p.inDateTime.split(" ")[0];
    const day = parseInt(datePart.split("-")[2], 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(p);
  });

  // Construct 31 DTR rows for September 2026 (30 days total)
  const dtrRows: DtrRow[] = [];
  for (let d = 1; d <= 31; d++) {
    if (d > 30) {
      dtrRows.push({
        day: d,
        amArrival: "",
        amDeparture: "",
        pmArrival: "",
        pmDeparture: "",
        undertimeHours: "",
        undertimeMinutes: "",
        isCustomLabel: false,
        customLabel: "",
      });
      continue;
    }

    const date = new Date(2026, 8, d); // Sept 2026
    const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat

    if (dayOfWeek === 0) {
      dtrRows.push({
        day: d,
        amArrival: "",
        amDeparture: "",
        pmArrival: "",
        pmDeparture: "",
        undertimeHours: "",
        undertimeMinutes: "",
        isCustomLabel: true,
        customLabel: "SUNDAY",
      });
      continue;
    }

    if (dayOfWeek === 6) {
      dtrRows.push({
        day: d,
        amArrival: "",
        amDeparture: "",
        pmArrival: "",
        pmDeparture: "",
        undertimeHours: "",
        undertimeMinutes: "",
        isCustomLabel: true,
        customLabel: "SATURDAY",
      });
      continue;
    }

    const dayPunches = byDay[d] || [];
    dayPunches.sort((a, b) => a.inDateTime.localeCompare(b.inDateTime));

    let amIn = "";
    let amOut = "";
    let pmIn = "";
    let pmOut = "";

    dayPunches.forEach((p) => {
      const inTime = p.inDateTime ? p.inDateTime.split(" ")[1].substring(0, 5) : "";
      const outTime = p.outDateTime && !p.outDateTime.startsWith("0000") ? p.outDateTime.split(" ")[1].substring(0, 5) : "";

      const inHour = inTime ? parseInt(inTime.split(":")[0], 10) : -1;
      const outHour = outTime ? parseInt(outTime.split(":")[0], 10) : -1;

      if (inHour >= 0 && inHour < 12) {
        if (!amIn) amIn = inTime;
        if (outTime) {
          if (outHour <= 12 || (outHour === 13 && parseInt(outTime.split(":")[1], 10) === 0)) {
            amOut = outTime;
          } else {
            amOut = "12:00";
            pmIn = "13:00";
            pmOut = outTime;
          }
        }
      } else if (inHour >= 12) {
        if (!pmIn) pmIn = inTime;
        if (outTime) pmOut = outTime;
      }
    });

    dtrRows.push({
      day: d,
      amArrival: amIn,
      amDeparture: amOut,
      pmArrival: pmIn,
      pmDeparture: pmOut,
      undertimeHours: "",
      undertimeMinutes: "",
      isCustomLabel: false,
      customLabel: "",
    });
  }

  // 3. Compute Metrics
  const metrics = calculateDtrMetrics(dtrRows);
  console.log(`✓ Calculated Metrics: Rendered ${metrics.totalDaysRendered} days (${metrics.totalHoursRendered} hrs), Late: ${metrics.lateMinutes} mins.`);

  // 4. Generate CS Form 48 Vector PDF (with embedded signature image)
  const employeeName = "DELA TORRE, RALPH B.";
  const periodText = "SEPTEMBER 01-30, 2026";
  const supervisorName = "NORLY A. TABO";
  const supervisorTitle = "OIC Chief - Technical Operations Division";

  const { rawPdfBytes, employeeSigRects } = await buildRalphDtrVectorPdf(
    employeeName,
    periodText,
    supervisorName,
    supervisorTitle,
    dtrRows,
    signerIdentity.commonName,
    signatureImage
  );

  console.log(`✓ Vector CS Form 48 generated with signature image (${rawPdfBytes.length} bytes).`);

  // 5. Cryptographically sign the PDF using Ralph's .p12 certificate (Sequential Pass 1 & Pass 2 for Copy 1 and Copy 2)
  console.log(`\nExecuting Pass 1: Personnel Copy 1...`);
  const pass1 = await signPdfBuffer(
    rawPdfBytes,
    p12Base64,
    p12Password,
    {
      reason: "Civil Service Form No. 48 Daily Time Record Submission (Copy 1)",
      sigRect: employeeSigRects[0],
      fieldName: "Personnel_Signature_Copy1",
    }
  );

  console.log(`Executing Pass 2: Personnel Copy 2...`);
  const pass2 = await signPdfBuffer(
    pass1.signedBuffer,
    p12Base64,
    p12Password,
    {
      reason: "Civil Service Form No. 48 Daily Time Record Submission (Copy 2)",
      sigRect: employeeSigRects[1],
      fieldName: "Personnel_Signature_Copy2",
    }
  );

  const signedBuffer = pass2.signedBuffer;
  console.log(`✓ Cryptographically signed PDF with PNPKI keystore (2 passes completed, ${signedBuffer.length} bytes).`);

  // Convert to Base64 Data URI
  const signedPdfBase64 = signedBuffer.toString("base64");
  const signedPdfDataUrl = `data:application/pdf;base64,${signedPdfBase64}`;
  const fileName = `DTR_RALPH_DELA_TORRE_September_2026.pdf`;
  const storageId = `DTR-PROVINCIAL-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  // 6. Delete old record if any and save new digitally signed record to PO Archive in dtr_storage
  await db.execute({
    sql: "DELETE FROM dtr_storage WHERE employee_name LIKE '%Ralph%' OR user_id = 'usr-mudrq46b'",
    args: [],
  });

  const rowsJson = JSON.stringify(dtrRows);
  const nowStr = new Date().toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  await db.execute({
    sql: `INSERT INTO dtr_storage (
      id, user_id, employee_name, employee_id, position, employment_status,
      module, province, section_division, period_text, month, year, scope,
      regular_hours, saturday_hours, supervisor_name, supervisor_title,
      total_days_rendered, total_hours_rendered, undertime_hours, undertime_minutes, late_minutes,
      status, submitted_date, pdf_filename, pdf_filesize, pdf_data,
      has_p12, signature_image, signer_name,
      employee_signature_image, employee_has_p12, employee_signer_name,
      supervisor_signature_image, supervisor_has_p12,
      rows_json, doc_type, remarks, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )`,
    args: [
      storageId,
      "usr-mudrq46b",
      employeeName,
      "DICT-R5-2026-100",
      "Technical Specialist / Engineer",
      "Regular",
      "PROVINCIAL",
      "Regional Off",
      "Regional Operations (RO)",
      periodText,
      8, // September (0-indexed)
      2026,
      "full",
      "",
      "",
      supervisorName,
      supervisorTitle,
      metrics.totalDaysRendered,
      metrics.totalHoursRendered,
      metrics.undertimeHours,
      metrics.undertimeMinutes,
      metrics.lateMinutes,
      "Submitted",
      nowStr,
      fileName,
      `${Math.round(signedBuffer.length / 1024)} KB`,
      signedPdfDataUrl,
      1, // has_p12
      signatureImage,
      signerIdentity.commonName,
      signatureImage,
      1, // employee_has_p12
      signerIdentity.commonName,
      null,
      0, // supervisor_has_p12
      rowsJson,
      "DTR",
      `Moved to PO Archive with PNPKI Digital Signature & DigiSigned Image (${signerIdentity.commonName}) from Open Time Clock`,
    ],
  });

  // 7. Update dtr_user_setup for Ralph
  await db.execute({
    sql: `UPDATE dtr_user_setup 
          SET otc_username = 'ralphdt',
              supervisor_name = 'NORLY A. TABO',
              supervisor_title = 'OIC Chief - Technical Operations Division',
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = 'usr-mudrq46b' OR employee_name LIKE '%Ralph%'`,
    args: [],
  });

  // 8. Broadcast realtime event
  broadcastDtrRealtimeEvent({
    type: "INSERT",
    id: storageId,
    record: {
      id: storageId,
      employeeName,
      province: "Regional Off",
      pdfFileName: fileName,
      totalHoursRendered: metrics.totalHoursRendered,
      status: "Submitted",
    },
  });

  console.log(`\n=================================================`);
  console.log(`✓ SUCCESS! Generated and moved Ralph Dela Torre DTR with DigiSigned image to PO Archive!`);
  console.log(`  - Record ID: ${storageId}`);
  console.log(`  - File Name: ${fileName}`);
  console.log(`  - Signer Name: ${signerIdentity.commonName}`);
  console.log(`  - DigiSigned Image: Included ✓`);
  console.log(`  - Days Rendered: ${metrics.totalDaysRendered} | Hours: ${metrics.totalHoursRendered}h | Late: ${metrics.lateMinutes}m`);
  console.log(`  - Target Archive: Provincial Module -> Regional Office (RO)`);
  console.log(`=================================================\n`);
}

main().catch((err) => {
  console.error("Failed to generate and move DTR for Ralph Dela Torre:", err);
  process.exit(1);
});
