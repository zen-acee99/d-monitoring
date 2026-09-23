import { DtrRow, createEmptyDtrRows, autoFillWeekendsAndHolidays } from "@/utils/dtrUtils";
import { dtrStorageApi } from "@/services/api";

export type DtrModuleCategory = "HRM" | "TOD" | "PROVINCIAL";

export type ProvincialTab =
  | "Regional Off"
  | "Albay"
  | "Sorsogon"
  | "Catanduanes"
  | "Camarines Sur"
  | "Camarines Norte"
  | "Masbate";

export const PROVINCIAL_TABS: ProvincialTab[] = [
  "Regional Off",
  "Albay",
  "Sorsogon",
  "Catanduanes",
  "Camarines Sur",
  "Camarines Norte",
  "Masbate"
];

export interface DtrStorageItem {
  id: string;
  userId?: string;
  employeeName: string;
  employeeId: string;
  position: string;
  employmentStatus: "Regular" | "COS" | "Job Order" | "Contractual";
  module: DtrModuleCategory;
  province?: ProvincialTab;
  sectionDivision: string;
  periodText: string;
  month: number; // 0-11
  year: number;
  scope: "full" | "first-half" | "second-half";
  regularHours: string;
  saturdayHours: string;
  supervisorName: string;
  supervisorTitle: string;
  totalDaysRendered: number;
  totalHoursRendered: number;
  undertimeHours: number;
  undertimeMinutes: number;
  status: "Submitted" | "Verified" | "Approved" | "For Revision";
  submittedDate: string;
  pdfFileName: string;
  pdfFileSize: string;
  pdfDataUrl?: string; // Optional base64/dataUrl from uploaded real PDF file
  signatureImage?: string;
  hasP12?: boolean;
  signerName?: string;
  employeeSignatureImage?: string;
  employeeHasP12?: boolean;
  employeeSignerName?: string;
  supervisorSignatureImage?: string;
  supervisorHasP12?: boolean;
  rows: DtrRow[];
  docType?: "DTR" | "AR";
  remarks?: string;
  createdAt?: number;
}

const STORAGE_KEY = "dict_r5_dtr_storage_records_v1";

// Clean initial state (no hardcoded sample data)
export const INITIAL_DTR_RECORDS: DtrStorageItem[] = [];

// In-memory binary cache for large PDF base64 payloads to keep localStorage under the 5MB quota
const inMemoryPdfCache = new Map<string, string>();

export function getCachedPdfDataUrl(id: string): string | undefined {
  return inMemoryPdfCache.get(id);
}

export function setCachedPdfDataUrl(id: string, dataUrl: string) {
  if (id && dataUrl) {
    inMemoryPdfCache.set(id, dataUrl);
  }
}

export function getDtrStorage(): DtrStorageItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: DtrStorageItem[] = JSON.parse(raw);
    // Filter out any legacy hardcoded seed dummy records from older versions
    const clean = parsed.filter(
      (r) =>
        !r.id.startsWith("DTR-HRM-00") &&
        !r.id.startsWith("DTR-TOD-00") &&
        !r.id.startsWith("DTR-PROV-ALB-00") &&
        !r.id.startsWith("DTR-PROV-SOR-00") &&
        !r.id.startsWith("DTR-PROV-CAT-00") &&
        !r.id.startsWith("DTR-PROV-CAS-00") &&
        !r.id.startsWith("DTR-PROV-CAN-00") &&
        !r.id.startsWith("DTR-PROV-MAS-00") &&
        !r.id.startsWith("DTR-PROV-RO-00")
    );

    // Re-hydrate pdfDataUrl from in-memory cache if available
    return clean.map((r) => {
      if (!r.pdfDataUrl && inMemoryPdfCache.has(r.id)) {
        return { ...r, pdfDataUrl: inMemoryPdfCache.get(r.id) };
      }
      return r;
    });
  } catch (e) {
    console.error("Error reading DTR storage:", e);
    return [];
  }
}

export async function syncDtrStorageWithBackend(): Promise<DtrStorageItem[]> {
  try {
    const remoteRecords = await dtrStorageApi.getRecords();
    if (Array.isArray(remoteRecords)) {
      // Cache binary pdfDataUrl in memory
      remoteRecords.forEach((item) => {
        if (item.pdfDataUrl) {
          inMemoryPdfCache.set(item.id, item.pdfDataUrl);
        }
      });

      const local = getDtrStorage();
      const localMap = new Map<string, DtrStorageItem>();
      local.forEach((item) => localMap.set(item.id, item));

      // Canonical synchronization: remote database is the source of truth for all records.
      // Remote deletions will correctly remove stale local records.
      const synced: DtrStorageItem[] = remoteRecords.map((item) => {
        const existing = localMap.get(item.id);
        const isVerified = item.status === "Verified" || item.status === "Approved";

        return {
          ...item,
          status: item.status || "Submitted",
          hasP12: Boolean(item.hasP12 || item.employeeHasP12),
          employeeHasP12: Boolean(item.employeeHasP12 ?? item.hasP12),
          supervisorHasP12: Boolean(item.supervisorHasP12 && isVerified),
          signatureImage: item.signatureImage || existing?.signatureImage,
          employeeSignatureImage: item.employeeSignatureImage || existing?.employeeSignatureImage,
          supervisorSignatureImage: item.supervisorSignatureImage || existing?.supervisorSignatureImage,
          signerName: item.signerName || existing?.signerName,
          pdfDataUrl: item.pdfDataUrl || existing?.pdfDataUrl || inMemoryPdfCache.get(item.id),
        };
      });

      saveDtrStorage(synced);
      return synced;
    }
  } catch (err) {
    console.warn("Could not sync DTR storage from backend:", err);
  }
  return getDtrStorage();
}

export function saveDtrStorage(records: DtrStorageItem[]) {
  try {
    // Populate in-memory binary cache
    records.forEach((r) => {
      if (r.pdfDataUrl) {
        inMemoryPdfCache.set(r.id, r.pdfDataUrl);
      }
    });

    // Sanitize records to keep localStorage lightweight (<100KB) and prevent QuotaExceededError
    const sanitized = records.map((r) => {
      const { pdfDataUrl, ...lightweight } = r;
      return lightweight;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    window.dispatchEvent(new Event("dict_dtr_storage_updated"));
  } catch (e) {
    console.warn("localStorage quota exceeded or failed, fallback to ultra-light storage:", e);
    try {
      // Emergency prune if localStorage is completely full
      const minimal = records.map((r) => ({
        id: r.id,
        userId: r.userId,
        employeeName: r.employeeName,
        employeeId: r.employeeId,
        position: r.position,
        employmentStatus: r.employmentStatus,
        module: r.module,
        province: r.province,
        sectionDivision: r.sectionDivision,
        periodText: r.periodText,
        month: r.month,
        year: r.year,
        scope: r.scope,
        status: r.status,
        submittedDate: r.submittedDate,
        pdfFileName: r.pdfFileName,
        pdfFileSize: r.pdfFileSize,
        docType: r.docType,
        rows: [],
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
      window.dispatchEvent(new Event("dict_dtr_storage_updated"));
    } catch {
      // Memory state still persists and dispatches
      window.dispatchEvent(new Event("dict_dtr_storage_updated"));
    }
  }
}

export function addDtrRecord(record: Omit<DtrStorageItem, "id" | "submittedDate">): DtrStorageItem {
  const existing = getDtrStorage();
  const prefix = record.docType === "AR" ? "AR" : "DTR";
  const newId = `${prefix}-${record.module}-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  const nowStr = new Date().toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });

  const newRecord: DtrStorageItem = {
    ...record,
    id: newId,
    submittedDate: nowStr,
    createdAt: Date.now()
  };

  const updated = [newRecord, ...existing.filter((r) => r.id !== newId)];
  saveDtrStorage(updated);

  // Asynchronously save to Turso dtr_storage table for permanent audit trailing
  dtrStorageApi.saveRecord(newRecord).catch((err) => {
    console.warn("Backend dtr_storage sync failed (will retain locally):", err);
  });

  return newRecord;
}

export function updateDtrRecord(id: string, updates: Partial<DtrStorageItem>) {
  const existing = getDtrStorage();
  const updated = existing.map((r) => (r.id === id ? { ...r, ...updates } : r));
  saveDtrStorage(updated);

  const updatedRecord = updated.find((r) => r.id === id);
  if (updatedRecord) {
    dtrStorageApi.saveRecord(updatedRecord).catch((err) => {
      console.warn("Backend saveRecord failed (retained locally):", err);
    });
  }

  if (updates.status || updates.remarks) {
    dtrStorageApi.updateStatus(id, updates.status || "Submitted", updates.remarks).catch((err) => {
      console.warn("Backend status update failed:", err);
    });
  }
}

export function deleteDtrRecord(id: string) {
  const existing = getDtrStorage();
  const updated = existing.filter((r) => r.id !== id);
  saveDtrStorage(updated);

  dtrStorageApi.deleteRecord(id).catch((err) => {
    console.warn("Backend delete record failed:", err);
  });
}
