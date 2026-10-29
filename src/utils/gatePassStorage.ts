import { ProvincialTab } from "@/data/dtrStorage";
import { DtrRow } from "@/utils/dtrUtils";

export interface GatePassRecord {
  id: string; // Unique record ID (timestamp or control number)
  controlNo: string; // e.g. "GP-POV 2026-10-0015"
  filingDate: string; // e.g. "October 7, 2026"
  filingDateIso: string; // e.g. "2026-10-07"
  activityDates: string; // e.g. "October 8, 2026" or "September 16, 17, 21, 2026"
  activityDateIso: string; // e.g. "2026-10-08"
  year: number;
  monthIndex: number; // 0-indexed (0 = Jan, 9 = Oct)
  days: number[]; // e.g. [8] or [16, 17, 21]
  category: "official" | "personal";
  officialChoice?: "travel" | "seminar" | "pickup" | "others" | "";
  personalChoice?: "medication" | "family" | "others" | "";
  purpose: string;
  venue: string;
  startTime: string;
  requestedByName: string;
  requestedByTitle?: string;
  selectedPO: ProvincialTab;
  approvedByName: string;
  approvedByTitle?: string;
  createdAt: string;
  appliedToCs48?: boolean;
  rawFormData?: any; // Complete snapshot of GatePassData for full restoration
}

export interface ParsedPassDates {
  year: number;
  monthIndex: number; // 0-11
  days: number[]; // 1-31
  monthName: string;
}

const MONTH_MAP: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sept: 8,
  sep: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

export const MONTH_NAMES_LIST = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const REGISTRY_STORAGE_KEY = "dict_gatepass_registry";
const ACTIVE_PASS_STORAGE_KEY = "dict_gatepass_active";

/**
 * Increment a Control Number's numeric sequence (e.g. "GP-POV 2026-10-0015" -> "GP-POV 2026-10-0016")
 */
export function incrementGatePassSeq(controlNo: string): string {
  if (!controlNo) return "GP-POV 2026-10-0001";
  const match = controlNo.match(/^(.*?)(\d+)$/);
  if (!match) return `${controlNo}-1`;
  const prefix = match[1];
  const numStr = match[2];
  const nextNum = String(parseInt(numStr, 10) + 1).padStart(numStr.length, "0");
  return `${prefix}${nextNum}`;
}

/**
 * Robust parser for Gate Pass Inclusive Pass Date/s.
 * Handles:
 * - Direct ISO strings: "2026-10-08"
 * - English single date: "October 8, 2026"
 * - Multiple dates: "September 16, 17, 21, 2026"
 * - Date ranges: "October 8-10, 2026" or "October 8 to 10, 2026"
 * - Raw day numbers: "16, 17, 21" (inherits month/year from ISO)
 */
export function parseInclusivePassDates(
  activityDates?: string,
  activityDateIso?: string,
  fallbackYear = new Date().getFullYear(),
  fallbackMonth = new Date().getMonth()
): ParsedPassDates {
  let year = fallbackYear;
  let monthIndex = fallbackMonth;
  let days: number[] = [];

  // 1. Try to extract from activityDateIso first as baseline
  if (activityDateIso && /^\d{4}-\d{2}-\d{2}$/.test(activityDateIso.trim())) {
    const parts = activityDateIso.trim().split("-").map((v) => parseInt(v, 10));
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      year = parts[0];
      monthIndex = Math.max(0, Math.min(11, parts[1] - 1));
      days = [parts[2]];
    }
  }

  // 2. Inspect text activityDates
  if (activityDates && activityDates.trim()) {
    const text = activityDates.trim();

    // Check for explicit 4-digit year in text
    const yearMatch = text.match(/\b(20\d\d)\b/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
    }

    // Check for month name in text
    const lower = text.toLowerCase();
    for (const [name, idx] of Object.entries(MONTH_MAP)) {
      const regex = new RegExp(`\\b${name}\\b`, "i");
      if (regex.test(lower)) {
        monthIndex = idx;
        break;
      }
    }

    // Check for range e.g. "8-10" or "8 - 10" or "8 to 10"
    const rangeMatch = text.match(/\b([1-3]?[0-9])\s*(?:-|to)\s*([1-3]?[0-9])\b/i);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (start >= 1 && end <= 31 && start <= end) {
        const rangeDays: number[] = [];
        for (let d = start; d <= end; d++) {
          rangeDays.push(d);
        }
        days = rangeDays;
      }
    } else {
      // Check for discrete comma/and separated day numbers e.g. "16, 17, 21"
      const textWithoutYear = text.replace(/\b20\d\d\b/g, "");
      const numberMatches = textWithoutYear.match(/\b([1-3]?[0-9])\b/g);
      if (numberMatches && numberMatches.length > 0) {
        const extracted = numberMatches
          .map((n) => parseInt(n, 10))
          .filter((n) => n >= 1 && n <= 31);
        if (extracted.length > 0) {
          days = Array.from(new Set(extracted)).sort((a, b) => a - b);
        }
      }
    }
  }

  // Fallback if no days extracted
  if (days.length === 0) {
    days = [new Date().getDate()];
  }

  return {
    year,
    monthIndex,
    days,
    monthName: MONTH_NAMES_LIST[monthIndex] || "Month",
  };
}

/**
 * Retrieve all registered Gate Passes from localStorage
 */
export function getGatePassRegistry(): GatePassRecord[] {
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.warn("Failed to load gatepass registry:", e);
    return [];
  }
}

/**
 * Save / Upsert a Gate Pass to the registry
 */
export function saveGatePassToRegistry(rawPass: any, isExplicitNew = false): GatePassRecord {
  const parsed = parseInclusivePassDates(
    rawPass.activityDates,
    rawPass.activityDateIso
  );

  const cleanControl = (rawPass.controlNo || "GP-POV 2026-10-0015").trim();
  const id = isExplicitNew ? `gp-${Date.now()}` : cleanControl;

  const record: GatePassRecord = {
    id,
    controlNo: cleanControl,
    filingDate: rawPass.filingDate || "",
    filingDateIso: rawPass.filingDateIso || "",
    activityDates: rawPass.activityDates || "",
    activityDateIso: rawPass.activityDateIso || "",
    year: parsed.year,
    monthIndex: parsed.monthIndex,
    days: parsed.days,
    category: rawPass.category || "official",
    officialChoice: rawPass.officialChoice || "others",
    personalChoice: rawPass.personalChoice || "",
    purpose:
      [rawPass.othersLine1, rawPass.othersLine2, rawPass.othersLine3]
        .filter(Boolean)
        .join(" ") ||
      [rawPass.travelLine1, rawPass.travelLine2].filter(Boolean).join(" ") ||
      [rawPass.seminarLine1, rawPass.seminarLine2, rawPass.seminarLine3, rawPass.seminarLine4]
        .filter(Boolean)
        .join(" ") ||
      rawPass.personalOthersLine1 ||
      "Official Business / Field Activity",
    venue: rawPass.venue || "",
    startTime: rawPass.startTime || "",
    requestedByName: (rawPass.requestedByName || "PERSONNEL").trim(),
    requestedByTitle: rawPass.requestedByTitle || "",
    selectedPO: rawPass.selectedPO || "Albay",
    approvedByName: rawPass.approvedByName || "RENE JANE R. BUENA",
    approvedByTitle: rawPass.approvedByTitle || "",
    createdAt: new Date().toISOString(),
    appliedToCs48: true,
    rawFormData: { ...rawPass },
  };

  try {
    const registry = getGatePassRegistry();
    const existingIdx = registry.findIndex((r) => r.id === id || r.controlNo === cleanControl);
    if (existingIdx >= 0) {
      registry[existingIdx] = record;
    } else {
      registry.unshift(record);
    }
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));

    // Also persist as active gate pass
    localStorage.setItem(ACTIVE_PASS_STORAGE_KEY, JSON.stringify(rawPass));

    // Dispatch global event for live synchronization across components
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("dict_gatepass_updated", { detail: record })
      );
    }
  } catch (e) {
    console.warn("Failed to persist gatepass record:", e);
  }

  return record;
}

/**
 * Delete a Gate Pass from the registry
 */
export function deleteGatePassFromRegistry(idOrControlNo: string): GatePassRecord[] {
  try {
    const registry = getGatePassRegistry();
    const updated = registry.filter(
      (r) => r.id !== idOrControlNo && r.controlNo !== idOrControlNo
    );
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(updated));

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("dict_gatepass_updated", { detail: { deletedId: idOrControlNo } })
      );
    }
    return updated;
  } catch (e) {
    console.warn("Failed to delete gatepass from registry:", e);
    return getGatePassRegistry();
  }
}

/**
 * Clear all Gate Passes from the registry
 */
export function clearGatePassRegistry(): void {
  try {
    localStorage.removeItem(REGISTRY_STORAGE_KEY);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("dict_gatepass_updated", { detail: { cleared: true } })
      );
    }
  } catch (e) {
    console.warn("Failed to clear gatepass registry:", e);
  }
}

/**
 * Find gate passes that match a target month and year, optionally filtering by employee name.
 */
export function findMatchingGatePasses(
  monthIndex: number,
  year: number,
  employeeName?: string
): GatePassRecord[] {
  const registry = getGatePassRegistry();
  const norm = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
  const targetEmp = employeeName ? norm(employeeName) : "";

  return registry.filter((p) => {
    if (p.year !== year || p.monthIndex !== monthIndex) return false;
    if (!targetEmp) return true;
    const pEmp = norm(p.requestedByName);
    if (!pEmp) return true;
    return pEmp.includes(targetEmp) || targetEmp.includes(pEmp);
  });
}

/**
 * Merge a single Gate Pass into DTR Rows.
 */
export function mergeGatePassIntoDtrRows(
  currentRows: DtrRow[],
  gatePass: { controlNo: string; days: number[] }
): { updatedRows: DtrRow[]; mergedDays: number[] } {
  const controlNo = gatePass.controlNo.trim();
  const mergedDays: number[] = [];

  const updatedRows = currentRows.map((row) => {
    if (gatePass.days.includes(row.day)) {
      mergedDays.push(row.day);
      return {
        ...row,
        isCustomLabel: true,
        customLabel: controlNo,
        amArrival: "",
        amDeparture: "",
        pmArrival: "",
        pmDeparture: "",
        undertimeHours: "",
        undertimeMinutes: "",
      };
    }
    return row;
  });

  return { updatedRows, mergedDays };
}

/**
 * Merge multiple Gate Passes into DTR Rows simultaneously.
 * Iterates through all provided Gate Passes and stamps their respective Control Numbers into their days.
 */
export function mergeAllGatePassesIntoDtrRows(
  currentRows: DtrRow[],
  gatePasses: { controlNo: string; days: number[] }[]
): { updatedRows: DtrRow[]; totalMergedDays: number[]; appliedPassesCount: number } {
  let updatedRows = [...currentRows];
  const allMergedDays: number[] = [];
  let count = 0;

  for (const gp of gatePasses) {
    if (!gp.controlNo || !gp.days || gp.days.length === 0) continue;
    const { updatedRows: stepRows, mergedDays } = mergeGatePassIntoDtrRows(updatedRows, gp);
    updatedRows = stepRows;
    allMergedDays.push(...mergedDays);
    if (mergedDays.length > 0) count++;
  }

  return {
    updatedRows,
    totalMergedDays: Array.from(new Set(allMergedDays)).sort((a, b) => a - b),
    appliedPassesCount: count,
  };
}
