import * as XLSX from "xlsx";

export interface DtrRow {
  day: number;
  amArrival: string;
  amDeparture: string;
  pmArrival: string;
  pmDeparture: string;
  undertimeHours: string;
  undertimeMinutes: string;
  isCustomLabel?: boolean;
  customLabel?: string; // e.g. "SATURDAY", "SUNDAY", "HOLIDAY - Ninoy Aquino Day", "LEAVE"
}

export interface DtrConfig {
  employeeName: string;
  supervisorName: string;
  supervisorTitle: string;
  periodText: string;
  regularHours: string;
  saturdayHours: string;
  month: number; // 0-11
  year: number;
  scope: "full" | "first-half" | "second-half";
  province?: string; // e.g. "Regional Office (RO)", "Albay", "Camarines Sur", etc.
  status?: string;
  employeeSignatureImage?: string | null;
  employeeHasP12?: boolean;
  employeeSignerName?: string;
  supervisorSignatureImage?: string | null;
  supervisorHasP12?: boolean;
  signerName?: string;
  hasP12?: boolean;
}

export const DTR_PROVINCE_OPTIONS = [
  { value: "Regional Office (RO)", label: "Regional Office (RO)", code: "RO" },
  { value: "Albay", label: "Albay", code: "ALB" },
  { value: "Camarines Norte", label: "Camarines Norte", code: "CN" },
  { value: "Camarines Sur", label: "Camarines Sur", code: "CS" },
  { value: "Catanduanes", label: "Catanduanes", code: "CAT" },
  { value: "Masbate", label: "Masbate", code: "MAS" },
  { value: "Sorsogon", label: "Sorsogon", code: "SOR" }
];

// Philippine National Holidays (Standard regular & special non-working)
export const PHILIPPINE_HOLIDAYS_BY_MONTH: Record<number, Record<number, string>> = {
  0: { 1: "NEW YEAR'S DAY" },
  1: { 25: "EDSA REVOLUTION" },
  2: {},
  3: { 9: "DAY OF VALOR" },
  4: { 1: "LABOR DAY" },
  5: { 12: "INDEPENDENCE DAY" },
  6: {},
  7: { 21: "NINOY AQUINO DAY", 31: "NATIONAL HEROES DAY" },
  8: {},
  9: {},
  10: { 1: "ALL SAINTS' DAY", 2: "ALL SOULS' DAY", 30: "BONIFACIO DAY" },
  11: { 8: "FEAST OF IMMACULATE CONCEPTION", 24: "CHRISTMAS EVE", 25: "CHRISTMAS DAY", 30: "RIZAL DAY", 31: "LAST DAY OF YEAR" }
};

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Initialize empty 31 rows
export function createEmptyDtrRows(): DtrRow[] {
  return Array.from({ length: 31 }, (_, i) => ({
    day: i + 1,
    amArrival: "",
    amDeparture: "",
    pmArrival: "",
    pmDeparture: "",
    undertimeHours: "",
    undertimeMinutes: "",
    isCustomLabel: false,
    customLabel: ""
  }));
}

// Auto-fill Weekends & Holidays for a given Month and Year
export function autoFillWeekendsAndHolidays(
  currentRows: DtrRow[],
  monthIndex: number,
  year: number,
  scope: "full" | "first-half" | "second-half"
): DtrRow[] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const holidays = PHILIPPINE_HOLIDAYS_BY_MONTH[monthIndex] || {};

  return currentRows.map((row) => {
    const day = row.day;

    // Check scope
    if (scope === "first-half" && day > 15) return row;
    if (scope === "second-half" && day <= 15) return row;

    if (day > daysInMonth) {
      return {
        ...row,
        isCustomLabel: true,
        customLabel: "—",
        amArrival: "",
        amDeparture: "",
        pmArrival: "",
        pmDeparture: "",
        undertimeHours: "",
        undertimeMinutes: ""
      };
    }

    const date = new Date(year, monthIndex, day);
    const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat

    // Check if holiday
    if (holidays[day]) {
      return {
        ...row,
        isCustomLabel: true,
        customLabel: `HOLIDAY (${holidays[day]})`,
        amArrival: "",
        amDeparture: "",
        pmArrival: "",
        pmDeparture: "",
        undertimeHours: "",
        undertimeMinutes: ""
      };
    }

    // Check if Saturday
    if (dayOfWeek === 6) {
      return {
        ...row,
        isCustomLabel: true,
        customLabel: "SATURDAY",
        amArrival: "",
        amDeparture: "",
        pmArrival: "",
        pmDeparture: "",
        undertimeHours: "",
        undertimeMinutes: ""
      };
    }

    // Check if Sunday
    if (dayOfWeek === 0) {
      return {
        ...row,
        isCustomLabel: true,
        customLabel: "SUNDAY",
        amArrival: "",
        amDeparture: "",
        pmArrival: "",
        pmDeparture: "",
        undertimeHours: "",
        undertimeMinutes: ""
      };
    }

    // Regular weekday: if previously tagged as weekend/holiday, clear label
    if (row.isCustomLabel && (row.customLabel === "SATURDAY" || row.customLabel === "SUNDAY" || row.customLabel?.startsWith("HOLIDAY"))) {
      return {
        ...row,
        isCustomLabel: false,
        customLabel: ""
      };
    }

    return row;
  });
}

export interface ParseOtcResult {
  rows: DtrRow[];
  detectedEmployeeName?: string;
  detectedMonth?: number;
  detectedCount: number;
}

// -----------------------------------------------------------------------
// Parse biometric or OpenTimeClock (OTC) List View data
// Supports:
//   • OTC multi-line (date on own line, then In time, Out time, duration)
//   • Single-line biometric  "104-06 07:34 am 12:03 pm"
//   • OTC copy-paste with markdown links  [note](url)
// -----------------------------------------------------------------------
export function parseOtcLogStream(
  text: string,
  existingRows: DtrRow[],
  targetYear: number = 2026,
  targetScope: "first-half" | "second-half" | "full" = "full"
): ParseOtcResult {
  let detectedEmployeeName: string | undefined;
  let detectedMonth: number | undefined;
  let detectedCount = 0;
  // STEP 1 – Clean the raw text
  //   • Convert markdown links [label](url) → label
  //   • Strip bare http URLs
  //   • Remove known OTC UI clutter
  //   • Normalize Unicode punctuation to ASCII equivalents
  // ------------------------------------------------------------------
  const cleaned = text
    // [label](url) → label
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // bare URLs
    .replace(/https?:\/\/\S+/g, "")
    // OTC filter bar mega-string
    .replace(/All\s+Jobs\s+And\s+Absence[\s\S]*?All\s+Jobs[-–—]+/g, "")
    // summary lines
    .replace(/^Paid\s+Hours:.*$/gim, "")
    .replace(/^Unpaid\s+Hours:.*$/gim, "")
    .replace(/^Total\s+Hours:.*$/gim, "")
    // column header row
    .replace(/^#\s*Date\s+In\s+Out\s+Hours.*$/gim, "")
    // Normalize Unicode dashes (en-dash, em-dash, figure-dash) → ASCII hyphen
    .replace(/[–—‑‒]/g, "-")
    // Normalize non-breaking space, thin space, etc. → regular space
    .replace(/[\u00A0\u2009\u200A\u202F\u205F\u3000]/g, " ");

  const rawLines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);

  // Debug: dump all lines (remove after confirmed working)
  console.log("[DTR Parse] rawLines:", JSON.stringify(rawLines));

  // ------------------------------------------------------------------
  // STEP 2 – Detect Employee Name from first meaningful line
  // ------------------------------------------------------------------
  for (const l of rawLines.slice(0, 15)) {
    if (
      l.startsWith("[") || l.includes("http") ||
      /^(Request|List View|Day View|Message|Shift Schedule|PTO Accrual|Notifications|My Setting|Exit|#|Date|In|Out|Hours|Job\/Absence|Shift)$/.test(l)
    ) continue;
    const nm = l.match(/^([A-Z][a-zA-Z]+(?:\s+[A-Za-z]+){1,4})(?:\s*\(.+\))?$/);
    if (nm) {
      const candidate = nm[1].trim();
      if (candidate.length > 3) { detectedEmployeeName = candidate; break; }
    }
  }

  // ------------------------------------------------------------------
  // STEP 3 – Token scan: extract (day, inTime, outTime) triples
  // ------------------------------------------------------------------
  // Regex for a date line:  "MM-DD" or "MM-DD, DayName"  (no times on same line)
  const DATE_ONLY_RE  = /^(?:(?:\d{1,4})[-/])?(\d{1,2})[-/](\d{1,2})(?:[,\s]+[A-Za-z]+)?$/;
  // Regex for a time value:  "07:08 am", "12:05 pm", "17:30"
  const TIME_ONLY_RE  = /^(\d{1,2}):(\d{2})(?:\s*(am|pm|AM|PM))?$/;
  // Regex for duration:      "4h 57m", "19h 2m"
  const DURATION_RE   = /^\d+h\s+\d+m$/;
  // Pure row counter:        "1", "2", …
  const ROW_NUM_RE    = /^\d{1,2}$/;
  // Nakalimutan note with corrected time
  const NOTE_NAK_RE   = /nakalimutan/i;

  // Ignored single-word nav labels after link stripping
  const NAV_LABELS    = new Set([
    "request","list view","day view","message","shift schedule",
    "pto accrual","notifications","my setting","exit","note",
    "#","date","in","out","hours","job/absence","shift"
  ]);

  interface Punch { inTime: string; outTime: string }
  const dayPunches: Record<number, Punch[]> = {};

  let curDay:  number | null = null;  // currently active date
  let curIn:   string | null = null;  // pending In time
  let curOut:  string | null = null;  // pending Out time (rarely set before commit)

  function commitPunch() {
    if (curDay !== null && curIn) {
      if (!dayPunches[curDay]) dayPunches[curDay] = [];
      dayPunches[curDay].push({ inTime: curIn, outTime: curOut ?? "" });
    }
    curIn = null;
    curOut = null;
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // ── OTC Table Row: single-line concatenated format ──
    // When copying the full OTC page, each row becomes one line:
    // "108-13, Thu07:08 am12:05 pm4h 57m" = rowNum + date + inTime + outTime + duration
    // "1008-20, Thu12:06 pm05:09 pm5h 3m" = rowNum10 + date08-20 ...
    const OTC_ROW_RE = /^(\d{1,2})(\d{2})[-/](\d{2})(?:[,\s]*[A-Za-z]*)?\s*(\d{1,2}:\d{2}\s*(?:am|pm))\s*(\d{1,2}:\d{2}\s*(?:am|pm))/i;
    const otcRowMatch = line.match(OTC_ROW_RE);
    if (otcRowMatch) {
      commitPunch();  // flush any pending punch from prior state
      const mm = parseInt(otcRowMatch[2], 10);
      const dd = parseInt(otcRowMatch[3], 10);
      const inT  = otcRowMatch[4].trim();
      const outT = otcRowMatch[5].trim();
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
        detectedMonth = mm - 1;
        curDay = dd;  // keep curDay set for nakalimutan correction on next line
        if (!dayPunches[dd]) dayPunches[dd] = [];
        dayPunches[dd].push({ inTime: inT, outTime: outT });
      }
      continue;
    }

    // ── Skip full date-with-year lines (e.g. "08/01/2026" date range selectors) ──
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(line)) continue;

    // ── Skip nav labels and duration / row numbers ──
    if (NAV_LABELS.has(line.toLowerCase())) continue;
    if (DURATION_RE.test(line))            continue;
    if (ROW_NUM_RE.test(line))             continue;

    // ── Nakalimutan note: patch the last out-time for curDay ──
    if (NOTE_NAK_RE.test(line) && curDay !== null) {
      const afterColon = line.includes("):") ? line.split("):").slice(1).join("):") : line;
      const m = afterColon.match(/\b(\d{1,2}):(\d{2})\b/);
      if (m && dayPunches[curDay]?.length) {
        const last = dayPunches[curDay][dayPunches[curDay].length - 1];
        const hh = String(parseInt(m[1], 10)).padStart(2, "0");
        last.outTime = `${hh}:${m[2]} pm`;
      }
      continue;
    }

    // ── Skip known header-note lines ──
    if (/^Note\s*\(/.test(line)) continue;

    // ── Single-line biometric / inline date + times ──
    //    e.g.  "104-06 07:34 am 12:03 pm"
    //    e.g.  "1  08-13, Thu  07:08 am  12:05 pm  4h 57m"  (tab or spaces)
    const inlineTimes = line.match(/\b\d{1,2}:\d{2}(?:\s*(?:am|pm|AM|PM))?\b/g) ?? [];
    const inlineDateM = line.match(/\b(?:\d{1,4}[/\-])?(\d{1,2})[/\-](\d{1,2})(?:[,\s]|$)/);

    if (inlineDateM && inlineTimes.length >= 2) {
      commitPunch();
      const mm = parseInt(inlineDateM[1], 10);
      const dd = parseInt(inlineDateM[2], 10);
      if (dd >= 1 && dd <= 31) {
        if (mm >= 1 && mm <= 12) detectedMonth = mm - 1;
        if (!dayPunches[dd]) dayPunches[dd] = [];
        if (inlineTimes.length === 2) {
          dayPunches[dd].push({ inTime: inlineTimes[0], outTime: inlineTimes[1] });
        } else if (inlineTimes.length === 3) {
          dayPunches[dd].push({ inTime: inlineTimes[0], outTime: inlineTimes[1] });
          dayPunches[dd].push({ inTime: "12:55 PM", outTime: inlineTimes[2] });
        } else {
          dayPunches[dd].push({ inTime: inlineTimes[0], outTime: inlineTimes[1] });
          dayPunches[dd].push({ inTime: inlineTimes[2], outTime: inlineTimes[3] });
        }
        // Reset for next block
        curDay = dd;
        if (mm >= 1 && mm <= 12) detectedMonth = mm - 1;
      }
      continue;
    }

    // ── Date-only line  "08-13, Thu" ──
    const dateM = line.match(DATE_ONLY_RE);
    if (dateM) {
      commitPunch();
      const mm = parseInt(dateM[1], 10);
      const dd = parseInt(dateM[2], 10);
      if (dd >= 1 && dd <= 31) {
        curDay = dd;
        if (mm >= 1 && mm <= 12) detectedMonth = mm - 1;
      }
      continue;
    }

    // ── Time-only line  "07:08 am" ──
    if (TIME_ONLY_RE.test(line) && curDay !== null) {
      if (!curIn) {
        curIn = line;
      } else {
        curOut = line;
        commitPunch();
      }
      continue;
    }
  }
  commitPunch();   // flush final pending block

  // ------------------------------------------------------------------
  // STEP 4 – Helper functions
  // ------------------------------------------------------------------
  function toMin(t: string): number {
    const m = t.match(/(\d{1,2}):(\d{2})(?:\s*(am|pm))?/i);
    if (!m) return 0;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = m[3]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return h * 60 + min;
  }

  function fmt(t: string): string {
    if (!t) return "";
    const m = t.match(/(\d{1,2}):(\d{2})/i);
    if (!m) return t.replace(/\s*(am|pm|AM|PM)/gi, "").trim();
    const h = m[1].padStart(2, "0");
    const min = m[2];
    return `${h}:${min}`;
  }

  // ------------------------------------------------------------------
  // STEP 5 – Build clean rows and assign punches
  // ------------------------------------------------------------------
  const cleanInitial = createEmptyDtrRows();
  const baseRows = existingRows && existingRows.length === 31
    ? existingRows.map((r) => ({
        ...r,
        amArrival: "",
        amDeparture: "",
        pmArrival: "",
        pmDeparture: "",
        undertimeHours: "",
        undertimeMinutes: "",
      }))
    : cleanInitial;

  const updated = baseRows.map((r) => ({ ...r }));

  for (const [dayStr, punches] of Object.entries(dayPunches)) {
    const day = parseInt(dayStr, 10);
    if (day < 1 || day > 31) continue;

    const row = { ...updated[day - 1] };
    row.isCustomLabel = false;
    row.customLabel   = "";

    if (punches.length === 1) {
      const p = punches[0];
      const inMin  = toMin(p.inTime);
      const outMin = toMin(p.outTime);
      if (outMin >= 13 * 60 && inMin < 12 * 60) {
        // Single all-day punch spanning lunch
        row.amArrival   = fmt(p.inTime);
        row.amDeparture = "12:00";
        row.pmArrival   = "12:55";
        row.pmDeparture = fmt(p.outTime);
      } else if (inMin >= 12 * 60) {
        row.pmArrival   = fmt(p.inTime);
        row.pmDeparture = fmt(p.outTime);
      } else {
        row.amArrival   = fmt(p.inTime);
        row.amDeparture = fmt(p.outTime);
      }
    } else {
      // Two separate punches (morning + afternoon)
      row.amArrival   = fmt(punches[0].inTime);
      row.amDeparture = fmt(punches[0].outTime);
      row.pmArrival   = fmt(punches[1].inTime);
      row.pmDeparture = fmt(punches[1].outTime);
    }

    updated[day - 1] = row;
    detectedCount++;
  }

  return { rows: updated, detectedEmployeeName, detectedMonth, detectedCount };
}

// Generate Standard Official Civil Service Form No. 48 Excel (.xlsx) file
export function exportDtrToExcel(config: DtrConfig, rows: DtrRow[]) {
  // Build a 2-copy side-by-side worksheet
  const sheetData: (string | number)[][] = [];

  // Title
  sheetData.push([
    "Civil Service Form No. 48", "", "", "", "", "", "",
    "",
    "Civil Service Form No. 48", "", "", "", "", "", ""
  ]);

  sheetData.push([
    "DAILY TIME RECORD", "", "", "", "", "", "",
    "",
    "DAILY TIME RECORD", "", "", "", "", "", ""
  ]);

  sheetData.push([
    "----- oOo -----", "", "", "", "", "", "",
    "",
    "----- oOo -----", "", "", "", "", "", ""
  ]);

  sheetData.push([
    config.employeeName || "PERSONNEL", "", "", "", "", "", "",
    "",
    config.employeeName || "PERSONNEL", "", "", "", "", "", ""
  ]);

  sheetData.push([
    "(Name)", "", "", "", "", "", "",
    "",
    "(Name)", "", "", "", "", "", ""
  ]);

  sheetData.push([
    `Station / Province: ${config.province || "Regional Office (RO)"}`, "", "", "", "", "", "",
    "",
    `Station / Province: ${config.province || "Regional Office (RO)"}`, "", "", "", "", "", ""
  ]);

  sheetData.push([
    `For the month of: ${config.periodText || "MM DD-DD YYYY"}`, "", "", "", "", "", "",
    "",
    `For the month of: ${config.periodText || "MM DD-DD YYYY"}`, "", "", "", "", "", ""
  ]);

  sheetData.push([
    `Official hours: Regular: ${config.regularHours || ""} | Saturdays: ${config.saturdayHours || ""}`, "", "", "", "", "", "",
    "",
    `Official hours: Regular: ${config.regularHours || ""} | Saturdays: ${config.saturdayHours || ""}`, "", "", "", "", "", ""
  ]);

  sheetData.push([]); // blank row

  // Table Headers
  sheetData.push([
    "Days", "A.M. Arrival", "A.M. Departure", "P.M. Arrival", "P.M. Departure", "Undertime (Hrs)", "Undertime (Min)",
    "",
    "Days", "A.M. Arrival", "A.M. Departure", "P.M. Arrival", "P.M. Departure", "Undertime (Hrs)", "Undertime (Min)"
  ]);

  let totalUndertimeHrs = 0;
  let totalUndertimeMins = 0;

  // Rows 1-31
  for (const r of rows) {
    if (r.undertimeHours) totalUndertimeHrs += parseInt(r.undertimeHours, 10) || 0;
    if (r.undertimeMinutes) totalUndertimeMins += parseInt(r.undertimeMinutes, 10) || 0;

    const rowTextLeft = r.isCustomLabel
      ? [r.day, r.customLabel || "", "", "", "", "", ""]
      : [r.day, r.amArrival, r.amDeparture, r.pmArrival, r.pmDeparture, r.undertimeHours, r.undertimeMinutes];

    const rowTextRight = r.isCustomLabel
      ? [r.day, r.customLabel || "", "", "", "", "", ""]
      : [r.day, r.amArrival, r.amDeparture, r.pmArrival, r.pmDeparture, r.undertimeHours, r.undertimeMinutes];

    sheetData.push([
      ...rowTextLeft,
      "",
      ...rowTextRight
    ]);
  }

  // Totals
  sheetData.push([
    "TOTAL", "", "", "", "", totalUndertimeHrs || 0, totalUndertimeMins || 0,
    "",
    "TOTAL", "", "", "", "", totalUndertimeHrs || 0, totalUndertimeMins || 0
  ]);

  sheetData.push([]); // blank row

  // Certification text
  sheetData.push([
    "I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from office.",
    "", "", "", "", "", "",
    "",
    "I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from office.",
    "", "", "", "", "", ""
  ]);

  sheetData.push([]);

  // Employee signature line
  sheetData.push([
    "", "", config.employeeName || "PERSONNEL", "", "", "", "",
    "",
    "", "", config.employeeName || "PERSONNEL", "", "", "", ""
  ]);

  sheetData.push([
    "VERIFIED as to the prescribed office hours:", "", "", "", "", "", "",
    "",
    "VERIFIED as to the prescribed office hours:", "", "", "", "", "", ""
  ]);

  sheetData.push([]);

  // Supervisor Signature Line
  sheetData.push([
    "", "", config.supervisorName || "NORLY A. TABO", "", "", "", "",
    "",
    "", "", config.supervisorName || "NORLY A. TABO", "", "", "", ""
  ]);

  sheetData.push([
    "", "", config.supervisorTitle || "OIC Chief - Technical Operations Division", "", "", "", "",
    "",
    "", "", config.supervisorTitle || "OIC Chief - Technical Operations Division", "", "", "", ""
  ]);

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths
  ws["!cols"] = [
    { wch: 6 },  // Day
    { wch: 12 }, // AM Arr
    { wch: 12 }, // AM Dep
    { wch: 12 }, // PM Arr
    { wch: 12 }, // PM Dep
    { wch: 10 }, // Undertime Hrs
    { wch: 10 }, // Undertime Min
    { wch: 4 },  // Divider
    { wch: 6 },  // Day
    { wch: 12 }, // AM Arr
    { wch: 12 }, // AM Dep
    { wch: 12 }, // PM Arr
    { wch: 12 }, // PM Dep
    { wch: 10 }, // Undertime Hrs
    { wch: 10 }  // Undertime Min
  ];

  const wb = XLSX.utils.book_new();
  const safeName = (config.employeeName || "PERSONNEL").replace(/[^a-zA-Z0-9]/g, "_");
  XLSX.utils.book_append_sheet(wb, ws, "CS_Form_48");

  // Trigger download
  XLSX.writeFile(wb, `DTR_${safeName}_${MONTH_NAMES[config.month]}_${config.year}.xlsx`);
}
