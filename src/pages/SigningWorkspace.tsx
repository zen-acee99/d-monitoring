import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  PenLine,
  Upload,
  FileSignature,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Download,
  Eye,
  Trash2,
  FileText,
  Layers,
  ShieldCheck,
  UploadCloud,
  Loader2,
  Search,
  Filter,
  FileKey,
  Check,
  ChevronDown,
  BadgeCheck,
  ZoomIn,
  ZoomOut,
  Printer,
  Users,
  Award,
  FileCheck,
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";
import { getCurrentUser } from "@/services/authStore";
import { getStoredUsers } from "@/data/userStore";
import { dtrGeneratorApi, dtrStorageApi, DtrGeneratorSignatureRecord } from "@/services/api";
import {
  matchNames,
  signUploadedPersonnelPdfBytes,
  scanPdfForSigners,
  ScanPdfResult,
  CounterSignPosition,
} from "@/utils/dtrVectorPdf";
import { formatPnpkiDate } from "@/utils/dtrUtils";
import { DtrSignatureValidationModal } from "@/components/dtr/DtrSignatureValidationModal";
import { subscribeToDtrRealtime, broadcastLocalDtrEvent } from "@/services/dtrRealtime";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SigningStatus = "pending" | "partially_signed" | "signed" | "failed" | "uploading";

export interface DocumentSigner {
  id?: string;
  name: string;
  role?: string;
  status: "pending" | "signed" | "counter-signed" | "failed";
  signedAt?: string;
  p12CommonName?: string;
  sha256Fingerprint?: string;
  isCounterSign?: boolean;
  position?: "above" | "right" | "left" | "bottom" | "auto";
}

export interface WorkspaceDocument {
  id: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  uploadedBy: string;
  status: SigningStatus;
  targetPersonnel: string;
  requiredSigners: string[];
  signers: DocumentSigner[];
  counterSigners?: DocumentSigner[];
  fileType: "pdf" | "docx" | "other";
  notes?: string;
  selected?: boolean;
  pdfDataUrl?: string; // base64 or blob URL
  fileObj?: File;
  scannedInfo?: ScanPdfResult;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTimestamp(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function normalizeName(name?: string): string {
  return (name || "").trim().toLowerCase();
}

function isUserInRequiredSigners(
  doc: WorkspaceDocument,
  userName?: string,
  userRole?: string
): boolean {
  if (!userName && !userRole) return false;
  const target = normalizeName(userName);
  const targetRole = (userRole || "").trim().toUpperCase();

  // 1. Direct name match in requiredSigners
  const inReq = doc.requiredSigners.some(
    (req) => normalizeName(req) === target || (userName && matchNames(req, userName))
  );
  if (inReq) return true;

  // 2. Direct name match in doc.signers
  const inSignersName = doc.signers.some(
    (s) => normalizeName(s.name) === target || (userName && matchNames(s.name, userName))
  );
  if (inSignersName) return true;

  // 3. Role-based match if user holds an executive or DICT signatory role (TOD, Regional Director, Asst. Director, Provincial Officer)
  if (targetRole) {
    const isRoleMatch = doc.signers.some((s) => {
      const sRole = (s.role || "").toUpperCase();
      if (
        (targetRole.includes("REGIONAL DIRECTOR") || targetRole === "RD") &&
        (sRole.includes("REGIONAL DIRECTOR") || sRole.includes("APPROVED BY"))
      ) return true;
      if (
        (targetRole.includes("ASST") || targetRole.includes("ASSISTANT") || targetRole.includes("ARD")) &&
        (sRole.includes("ASST") || sRole.includes("ASSISTANT") || sRole.includes("ARD") || sRole.includes("RECOMMENDING"))
      ) return true;
      if (
        (targetRole.includes("TECHNICAL OPERATIONS") || targetRole.includes("TOD")) &&
        (sRole.includes("TECHNICAL OPERATIONS") || sRole.includes("TOD") || sRole.includes("NOTED BY"))
      ) return true;
      if (
        targetRole.includes("PROVINCIAL OFFICER") &&
        (sRole.includes("PROVINCIAL OFFICER") || sRole.includes("REVIEWED BY"))
      ) return true;
      return false;
    });
    if (isRoleMatch) return true;
  }

  return false;
}

function hasUserAlreadySigned(doc: WorkspaceDocument, userName?: string): boolean {
  if (!userName) return false;
  const inSigners = doc.signers.some(
    (s) =>
      (s.status === "signed" || s.status === "counter-signed") &&
      (matchNames(s.name, userName) || normalizeName(s.name) === normalizeName(userName))
  );
  const inCounter = (doc.counterSigners || []).some(
    (c) =>
      (c.status === "counter-signed" || c.status === "signed") &&
      (matchNames(c.name, userName) || normalizeName(c.name) === normalizeName(userName))
  );
  return inSigners || inCounter;
}

const statusConfig: Record<
  SigningStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
    icon: <Clock className="w-3 h-3" />,
  },
  partially_signed: {
    label: "Partially Signed",
    color: "text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/30",
    icon: <Users className="w-3 h-3" />,
  },
  signed: {
    label: "Fully Signed",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  failed: {
    label: "Failed",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  uploading: {
    label: "Uploading…",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
};


// ─── Document Preview Modal Matching Image 2 Layout ────────────────────────

function DocumentPreviewModal({
  doc,
  onClose,
  onSign,
  onCounterSign,
  onDownload,
  onShowValidationStatus,
  currentUser,
}: {
  doc: WorkspaceDocument | null;
  onClose: () => void;
  onSign?: (id: string) => void;
  onCounterSign?: (id: string, position: CounterSignPosition) => void;
  onDownload?: (doc: WorkspaceDocument) => void;
  onShowValidationStatus?: (signerName: string, date?: string) => void;
  currentUser: any;
}) {
  const [zoom, setZoom] = useState(100);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"viewer" | "signatures">("viewer");
  const [selectedCounterPos, setSelectedCounterPos] = useState<CounterSignPosition>("auto");

  useEffect(() => {
    if (!doc) {
      setBlobUrl(null);
      return;
    }

    // Always check for signed/updated PDF first so changes are immediately visible
    if (doc.pdfDataUrl) {
      let url = doc.pdfDataUrl;
      if (doc.pdfDataUrl.startsWith("data:")) {
        try {
          const base64 = doc.pdfDataUrl.includes(",")
            ? doc.pdfDataUrl.split(",")[1]
            : doc.pdfDataUrl;
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: "application/pdf" });
          const created = URL.createObjectURL(blob);
          setBlobUrl(created);
          return () => URL.revokeObjectURL(created);
        } catch {
          setBlobUrl(doc.pdfDataUrl);
        }
      } else {
        setBlobUrl(doc.pdfDataUrl);
      }
      return;
    }

    if (doc.fileObj) {
      const url = URL.createObjectURL(doc.fileObj);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    }

    // If PDF binary data is not loaded yet in memory, fetch it on-demand from database
    let isCancelled = false;
    dtrStorageApi
      .getRecord(doc.id)
      .then((fullRec) => {
        if (!isCancelled && fullRec && fullRec.pdfDataUrl) {
          doc.pdfDataUrl = fullRec.pdfDataUrl;
          try {
            const base64 = fullRec.pdfDataUrl.includes(",")
              ? fullRec.pdfDataUrl.split(",")[1]
              : fullRec.pdfDataUrl;
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: "application/pdf" });
            const created = URL.createObjectURL(blob);
            setBlobUrl(created);
          } catch {
            setBlobUrl(fullRec.pdfDataUrl);
          }
        }
      })
      .catch((e) => console.warn("Failed to fetch full PDF record for preview:", e));

    return () => {
      isCancelled = true;
    };
  }, [doc]);

  if (!doc) return null;

  const sc = statusConfig[doc.status];
  const userIsRequired = isUserInRequiredSigners(doc, currentUser?.name, currentUser?.role);
  const userHasSigned = hasUserAlreadySigned(doc, currentUser?.name);

  // Group signers matching DICT standard layout (PREPARED BY, REVIEWED BY, NOTED BY, ARD, REGIONAL DIRECTOR)
  const prepSigner = doc.signers.find(
    (s) =>
      s.role?.toUpperCase().includes("PREPARED") ||
      matchNames(s.name, doc.targetPersonnel)
  ) || doc.signers[0];

  const revSigner = doc.signers.find(
    (s) =>
      s !== prepSigner &&
      (s.role?.toUpperCase().includes("REVIEWED") ||
        s.role?.toUpperCase().includes("SUPERVISOR") ||
        s.role?.toUpperCase().includes("CERTIF") ||
        s.name.includes("BUENA"))
  ) || doc.signers.find((s) => s !== prepSigner);

  const rdSigner = doc.signers.find(
    (s) =>
      s !== prepSigner &&
      s !== revSigner &&
      (s.role?.toUpperCase().includes("REGIONAL DIRECTOR") ||
        s.role?.toUpperCase().includes("APPROVED") ||
        s.role?.toUpperCase().includes("DIRECTOR") ||
        s.name.toUpperCase().includes("ODO"))
  );

  const ardSigner = doc.signers.find(
    (s) =>
      s !== prepSigner &&
      s !== revSigner &&
      s !== rdSigner &&
      (s.role?.toUpperCase().includes("RECOMMENDING") ||
        s.role?.toUpperCase().includes("ASSISTANT") ||
        s.role?.toUpperCase().includes("ASSISTANCE") ||
        s.role?.toUpperCase().includes("ARD"))
  );

  const notedSigner = doc.signers.find(
    (s) =>
      s !== prepSigner &&
      s !== revSigner &&
      s !== rdSigner &&
      s !== ardSigner &&
      (s.role?.toUpperCase().includes("NOTED") ||
        s.role?.toUpperCase().includes("CHIEF") ||
        s.name.includes("TABO"))
  ) || (doc.signers.length > 2 && doc.signers[2] !== prepSigner && doc.signers[2] !== revSigner && doc.signers[2] !== rdSigner && doc.signers[2] !== ardSigner ? doc.signers[2] : undefined);

  const handledSet = new Set(
    [prepSigner, revSigner, notedSigner, ardSigner, rdSigner].filter(Boolean) as DocumentSigner[]
  );
  const otherSigners = doc.signers.filter((s) => !handledSet.has(s));

  const allCounterSigners = doc.counterSigners || [];

  const renderSignerCard = (
    signer?: DocumentSigner,
    defaultHeader = "AUTHORIZED SIGNATORY:",
    align: "left" | "right" | "center" = "left"
  ) => {
    if (!signer) return null;
    const isSigned = signer.status === "signed";
    const roleText = signer.role || "";
    let headerLabel = defaultHeader;
    if (roleText.includes(":")) {
      headerLabel = roleText.split(":")[0].trim().toUpperCase() + ":";
    } else if (roleText.toUpperCase().includes("REGIONAL DIRECTOR")) {
      headerLabel = roleText.toUpperCase().includes("OIC") ? "OIC - REGIONAL DIRECTOR:" : "REGIONAL DIRECTOR:";
    } else if (
      roleText.toUpperCase().includes("ARD") ||
      roleText.toUpperCase().includes("ASSISTANT") ||
      roleText.toUpperCase().includes("ASSISTANCE")
    ) {
      headerLabel = roleText.toUpperCase().includes("OIC")
        ? "OIC - ASSISTANT REGIONAL DIRECTOR (ARD):"
        : "RECOMMENDING APPROVAL (ARD):";
    }

    const designation = roleText.includes(":") ? roleText.split(":")[1].trim() : roleText;

    return (
      <div className={`space-y-1 ${align === "center" ? "text-center flex flex-col items-center" : ""}`}>
        <p className="text-[11px] font-black uppercase text-slate-900 tracking-wider">
          {headerLabel}
        </p>
        <div className={`min-h-[44px] flex items-center gap-2 pt-1 pb-1 ${align === "center" ? "justify-center" : ""}`}>
          {/* Counter-signatures placed to the left (border-none) */}
          {allCounterSigners
            .filter((c) => c.position === "left")
            .map((cs, i) => (
              <div
                key={i}
                onClick={() => onShowValidationStatus?.(cs.name, cs.signedAt)}
                className="border-none bg-cyan-500/10 px-2 py-1 rounded text-[8.5px] text-cyan-900 font-bold cursor-pointer hover:bg-cyan-100/60 transition-all"
                title="Click to view official PNPKI Digital Signature Validation Status"
              >
                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5 text-cyan-600" />
                  <span>Counter-signed (Left)</span>
                </div>
                <div>by {cs.name}</div>
                {cs.signedAt && (
                  <div className="text-[7.5px] font-mono text-cyan-800">
                    Date: {formatPnpkiDate(new Date(cs.signedAt))}
                  </div>
                )}
              </div>
            ))}

          {/* Digital signature above name (border-none) */}
          {isSigned ? (
            <div
              onClick={() => onShowValidationStatus?.(signer.p12CommonName || signer.name, signer.signedAt)}
              className="border-none bg-blue-500/10 px-2.5 py-1 rounded text-[9.5px] text-blue-900 font-bold inline-block cursor-pointer hover:bg-blue-100/60 transition-all"
              title="Click to view official PNPKI Digital Signature Validation Status"
            >
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-blue-600" />
                <span>Digitally signed</span>
              </div>
              <div>by {signer.p12CommonName || signer.name}</div>
              {signer.signedAt && (
                <div className="text-[7.5px] font-mono text-slate-600">
                  Date: {formatPnpkiDate(new Date(signer.signedAt))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 italic">[Signature Area Above Name]</div>
          )}

          {/* Counter-signatures placed to the right (border-none) */}
          {allCounterSigners
            .filter((c) => c.position === "right" || c.position === "auto")
            .map((cs, i) => (
              <div
                key={i}
                onClick={() => onShowValidationStatus?.(cs.name, cs.signedAt)}
                className="border-none bg-cyan-500/10 px-2 py-1 rounded text-[8.5px] text-cyan-900 font-bold cursor-pointer hover:bg-cyan-100/60 transition-all"
                title="Click to view official PNPKI Digital Signature Validation Status"
              >
                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5 text-cyan-600" />
                  <span>Counter-signed (Beside)</span>
                </div>
                <div>by {cs.name}</div>
                {cs.signedAt && (
                  <div className="text-[7.5px] font-mono text-cyan-800">
                    Date: {formatPnpkiDate(new Date(cs.signedAt))}
                  </div>
                )}
              </div>
            ))}
        </div>
        <p className="font-black text-sm uppercase text-slate-900 tracking-tight font-sans">
          {signer.name}
        </p>
        <p className="text-[11px] text-slate-600 italic">
          {designation || "Authorized Signatory"}
        </p>

        {/* Counter-signatures placed to the bottom (border-none) */}
        {allCounterSigners
          .filter((c) => c.position === "bottom")
          .map((cs, i) => (
            <div
              key={i}
              onClick={() => onShowValidationStatus?.(cs.name, cs.signedAt)}
              className="mt-2 border-none bg-cyan-500/10 px-2 py-1 rounded text-[8.5px] text-cyan-900 font-bold inline-block cursor-pointer hover:bg-cyan-100/60 transition-all"
              title="Click to view official PNPKI Digital Signature Validation Status"
            >
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5 text-cyan-600" />
                <span>Counter-signed (Bottom beside name) by {cs.name}</span>
              </div>
              {cs.signedAt && (
                <div className="text-[7.5px] font-mono text-cyan-800">
                  Date: {formatPnpkiDate(new Date(cs.signedAt))}
                </div>
              )}
            </div>
          ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl sm:rounded-2xl w-full max-w-6xl h-[96vh] sm:h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between px-3 sm:px-5 py-3 border-b border-[#1A2235] bg-[#080B13] shrink-0 gap-2.5">
          {/* Top Row: File Identity & Mobile Close */}
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
                <FileSignature className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs md:max-w-sm" title={doc.fileName}>
                    {doc.fileName}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sc.bg} ${sc.color}`}
                  >
                    {sc.icon}
                    {sc.label}
                  </span>
                  <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20 font-mono">
                    {doc.requiredSigners.length} Signatories
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono truncate">
                  {doc.fileSize} · Primary Subject:{" "}
                  <span className="text-white font-bold">{doc.targetPersonnel}</span>
                  <span className="hidden md:inline"> · Uploaded by {doc.uploadedBy} ({formatTimestamp(doc.uploadedAt)})</span>
                </p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 shrink-0">
            {/* View Tab Switcher */}
            <div className="flex items-center bg-[#111728] border border-[#1C2844] rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("viewer")}
                className={`px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  activeTab === "viewer"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Document
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("signatures")}
                className={`px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "signatures"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>P12 Signatures ({doc.signers.filter((s) => s.status === "signed").length + allCounterSigners.length})</span>
              </button>
            </div>

            {/* Zoom Controls */}
            {activeTab === "viewer" && (
              <div className="flex items-center bg-[#111728] border border-[#1C2844] rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(z - 15, 60))}
                  className="p-1 hover:text-white text-slate-400 rounded transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono px-1.5 text-slate-300 select-none">
                  {zoom}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(z + 15, 160))}
                  className="p-1 hover:text-white text-slate-400 rounded transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Print */}
            {blobUrl && (
              <button
                type="button"
                onClick={() => {
                  const printWindow = window.open(blobUrl, "_blank");
                  if (printWindow) {
                    printWindow.focus();
                    printWindow.print();
                  }
                }}
                className="p-1.5 rounded-lg bg-[#111728] border border-[#1C2844] text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Print"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Download */}
            {onDownload && (
              <button
                type="button"
                onClick={() => onDownload(doc)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-xs font-semibold transition-colors cursor-pointer"
                title="Download"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}

            {/* Context-Aware Signing Action */}
            {userHasSigned ? (
              <span className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Signed</span>
              </span>
            ) : userIsRequired ? (
              onSign && (
                <button
                  type="button"
                  onClick={() => onSign(doc.id)}
                  className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  title="You are a required signer in this document. Places signature ABOVE your name."
                >
                  <PenLine className="w-3.5 h-3.5" />
                  <span>Sign (Above Name)</span>
                </button>
              )
            ) : (
              onCounterSign && (
                <div className="flex items-center gap-1 bg-[#111728] border border-[#1C2844] rounded-lg p-0.5">
                  <select
                    value={selectedCounterPos}
                    onChange={(e) => setSelectedCounterPos(e.target.value as CounterSignPosition)}
                    className="bg-transparent text-[11px] text-cyan-300 font-semibold px-1.5 py-1 outline-none cursor-pointer"
                    title="Placement beside name (Right, Left, or Bottom)"
                  >
                    <option value="auto" className="bg-[#0C101A] text-white">Beside (Auto)</option>
                    <option value="right" className="bg-[#0C101A] text-white">Beside (Right)</option>
                    <option value="left" className="bg-[#0C101A] text-white">Beside (Left)</option>
                    <option value="bottom" className="bg-[#0C101A] text-white">Beside (Bottom)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => onCounterSign(doc.id, selectedCounterPos)}
                    className="flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-md bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                    title="Places counter-signature beside the personnel name."
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Counter Sign</span>
                  </button>
                </div>
              )
            )}

            {/* Desktop Close */}
            <button
              type="button"
              onClick={onClose}
              className="hidden lg:block p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 bg-[#06080F] p-4 overflow-auto flex justify-center items-start custom-scrollbar relative">
          {activeTab === "signatures" ? (
            /* Dedicated Acrobat Digital Signatures Inspector */
            <div className="w-full max-w-4xl space-y-6 text-slate-200 py-2">
              <div className="bg-[#0F1424] border border-[#1E293B] rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E293B] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-white flex flex-wrap items-center gap-2">
                        Adobe Acrobat Digital Signature Verification Panel
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                          ISO 32000-1 Validated
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Cryptographic audit trail reflecting all PNPKI .p12 certificates attached to this PDF.
                      </p>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-xs text-slate-400 block">Total Signatures:</span>
                    <span className="text-lg font-black text-white font-mono">
                      {doc.signers.filter((s) => s.status === "signed").length + allCounterSigners.length} / {doc.requiredSigners.length}
                    </span>
                  </div>
                </div>

                {/* Multi-Signer Status Progression */}
                <div className="space-y-3 pt-2">
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    Scanned Required Signers Chain ({doc.requiredSigners.length} Signatories)
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {doc.signers.map((sObj, idx) => {
                      const isSigned = sObj.status === "signed";

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isSigned
                              ? "bg-emerald-500/5 border-emerald-500/20"
                              : "bg-slate-900/60 border-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-slate-500 font-bold">
                              SIGNER #{idx + 1}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isSigned
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                  : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              }`}
                            >
                              {isSigned ? "✓ Signed" : "⏳ Need to Sign"}
                            </span>
                          </div>
                          <p className="font-bold text-sm text-white mt-1">{sObj.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {sObj.role || "Authorized Signatory"}
                          </p>
                          <div className="mt-2 pt-2 border-t border-white/5 text-[10px] font-mono text-slate-500 flex justify-between items-center">
                            <span>Placement: Above Name</span>
                            {sObj.signedAt && (
                              <span className="text-emerald-400">
                                {formatTimestamp(sObj.signedAt)}
                              </span>
                            )}
                          </div>
                          {isSigned && (
                            <button
                              type="button"
                              onClick={() => onShowValidationStatus?.(sObj.p12CommonName || sObj.name, sObj.signedAt)}
                              className="mt-2.5 w-full py-1.5 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                              title="Inspect Adobe Acrobat / PNPKI Certificate Details"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Validate PNPKI Certificate</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Counter Signers List */}
                {allCounterSigners.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-[#1E293B]">
                    <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Award className="w-3.5 h-3.5 text-cyan-400" />
                      Counter-Signatures ({allCounterSigners.length} Applied Beside Personnel Name)
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {allCounterSigners.map((cs, cIdx) => (
                        <div
                          key={cIdx}
                          className="p-3.5 rounded-xl border bg-cyan-500/5 border-cyan-500/20"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-cyan-400 font-bold">
                              COUNTER-SIGNER #{cIdx + 1}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                              ✓ Counter-Signed
                            </span>
                          </div>
                          <p className="font-bold text-sm text-white mt-1">{cs.name}</p>
                          <p className="text-[11px] text-slate-400">{cs.role || "Witness / Counter-Signer"}</p>
                          <div className="mt-2 pt-2 border-t border-white/5 text-[10px] font-mono text-slate-500 flex justify-between items-center">
                            <span className="text-cyan-400">
                              Placement: Beside ({cs.position || "Right / Left / Bottom"})
                            </span>
                            {cs.signedAt && <span>{formatTimestamp(cs.signedAt)}</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => onShowValidationStatus?.(cs.p12CommonName || cs.name, cs.signedAt)}
                            className="mt-2.5 w-full py-1.5 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            title="Inspect Adobe Acrobat / PNPKI Certificate Details"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Validate PNPKI Certificate</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : blobUrl ? (
            /* PDF Iframe Viewer */
            <div
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
              className="w-full h-full flex justify-center transition-transform duration-150"
            >
              <iframe
                src={`${blobUrl}#toolbar=1&navpanes=1`}
                title={doc.fileName}
                className="w-full h-full min-h-[75vh] rounded-xl border border-[#1A2235] bg-white shadow-2xl"
              />
            </div>
          ) : (
            /* Styled Fallback Document Simulation - FAITHFUL TO IMAGE 2 */
            <div
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
              className="bg-white text-black p-4 sm:p-8 md:p-14 rounded-lg shadow-2xl w-full max-w-[840px] min-h-[720px] flex flex-col justify-between select-text transition-transform duration-150"
            >
              {/* Document Header */}
              <div className="border-b border-slate-300 pb-5 space-y-2">
                <div className="flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-widest gap-1 text-center sm:text-left">
                  <span>Republic of the Philippines</span>
                  <span>DEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY</span>
                  <span>Region V</span>
                </div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight text-center uppercase py-3 font-sans break-words">
                  {doc.fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " ")}
                </h1>
                <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 border-t border-slate-200 pt-2 font-mono gap-1">
                  <span>Tracking Ref: {doc.id}</span>
                  <span>Date: {formatTimestamp(doc.uploadedAt)}</span>
                </div>
              </div>

              {/* Document Body Area */}
              <div className="my-6 space-y-4 text-xs text-slate-700 leading-relaxed font-sans">
                <p className="text-slate-800 text-justify">
                  This electronic document has been verified and registered under the DICT Region V
                  Document Signing Workspace. All signatories below are evaluated against the document's
                  cryptographic structure according to PNPKI ISO 32000-1 specifications.
                </p>
                {doc.notes && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs">
                    <strong>Document Audit:</strong> {doc.notes}
                  </div>
                )}
              </div>

              {/* ── Official Signature Section (Image 2 Layout + Multi-Tier Support) ── */}
              <div className="pt-8 border-t-2 border-slate-900 space-y-8 sm:space-y-10">
                {/* Row 1: Preparer (Left) & Reviewer (Right) */}
                {(prepSigner || revSigner) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-12">
                    {prepSigner && renderSignerCard(prepSigner, "PREPARED BY:", "left")}
                    {revSigner && renderSignerCard(revSigner, "REVIEWED BY:", "left")}
                  </div>
                )}

                {/* Row 2: Middle Tier (Noted by / ARD / Regional Director / Recommending Approval) */}
                {doc.signers.length <= 3 ? (
                  /* 3-Signer Mode (Faithfully matching Image 2 with Noted By or Regional Director centered) */
                  (rdSigner || notedSigner || ardSigner || otherSigners[0]) &&
                    renderSignerCard(
                      rdSigner || notedSigner || ardSigner || otherSigners[0],
                      rdSigner
                        ? (rdSigner.role?.toUpperCase().includes("OIC") ? "OIC - REGIONAL DIRECTOR:" : "APPROVED BY:")
                        : notedSigner
                        ? "NOTED BY:"
                        : ardSigner
                        ? "RECOMMENDING APPROVAL (ARD):"
                        : "AUTHORIZED SIGNATORY:",
                      "center"
                    )
                ) : doc.signers.length === 4 ? (
                  /* 4-Signer Mode: 2 Columns (Noted by / ARD on Left, Regional Director / Approved on Right) */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-12">
                    {notedSigner && renderSignerCard(notedSigner, "NOTED BY:", "left")}
                    {(rdSigner || ardSigner) &&
                      renderSignerCard(
                        rdSigner || ardSigner,
                        rdSigner ? "APPROVED BY:" : "RECOMMENDING APPROVAL (ARD):",
                        "left"
                      )}
                  </div>
                ) : (
                  /* 5+ Signer Mode: Full Regional Executive Hierarchy */
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-12">
                      {notedSigner && renderSignerCard(notedSigner, "NOTED BY:", "left")}
                      {ardSigner && renderSignerCard(ardSigner, "RECOMMENDING APPROVAL (ARD):", "left")}
                    </div>
                    {rdSigner && renderSignerCard(rdSigner, "APPROVED BY / REGIONAL DIRECTOR:", "center")}
                  </>
                )}

                {/* Extra signers beyond the standard hierarchy */}
                {otherSigners.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-12 pt-4 border-t border-slate-200">
                    {otherSigners.map((s, idx) => (
                      <div key={idx}>
                        {renderSignerCard(s, "AUTHORIZED SIGNATORY:", "left")}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Bar */}
        <div className="bg-[#080B13] border-t border-[#1A2235] px-4 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">DICT Region V Official Document Management & Signing Service</span>
          </div>
          <div>
            Format: <strong className="text-slate-300 uppercase">{doc.fileType}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Intelligent Upload Modal with Automated Document Scanning ──────────────

interface ScannedFileEntry {
  file: File;
  scanResult: ScanPdfResult | null;
  scanning: boolean;
}

function UploadModal({
  isOpen,
  onClose,
  onUpload,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (scannedEntries: ScannedFileEntry[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [entries, setEntries] = useState<ScannedFileEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFiles = async (files: File[]) => {
    const newEntries: ScannedFileEntry[] = files.map((f) => ({
      file: f,
      scanResult: null,
      scanning: true,
    }));

    setEntries((prev) => [...prev, ...newEntries]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const buffer = await file.arrayBuffer();
        const storedUsers = getStoredUsers().map((u) => ({ name: u.name, role: u.role, email: u.email }));
        const scan = await scanPdfForSigners(buffer, storedUsers);
        setEntries((prev) =>
          prev.map((item) =>
            item.file === file ? { ...item, scanResult: scan, scanning: false } : item
          )
        );
      } catch (err) {
        console.warn("Could not scan PDF for signers, retaining default signatories:", err);
        setEntries((prev) =>
          prev.map((item) =>
            item.file === file
              ? {
                  ...item,
                  scanResult: {
                    primaryPersonnel: "ACE M. MALTO",
                    requiredSigners: ["ACE M. MALTO"],
                    signers: [
                      {
                        name: "ACE M. MALTO",
                        roleHeader: "",
                        title: undefined,
                        x: 420,
                        y: 260,
                        pageIndex: 0,
                      },
                    ],
                  },
                  scanning: false,
                }
              : item
          )
        );
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files) as File[];
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      if (files.length > 0) {
        processFiles(files);
      }
    }
  };

  const removeEntry = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (entries.length === 0) return;
    onUpload(entries);
    setEntries([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl sm:rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#1A2235] bg-[#080B13]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Upload & Scan Documents</h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400">
                Automatically scans PDF text streams for DICT signature blocks
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 py-8 cursor-pointer transition-all ${
              dragging
                ? "border-blue-400 bg-blue-500/10"
                : "border-[#1C2844] hover:border-blue-500/50 hover:bg-blue-500/5"
            }`}
          >
            <Upload className="w-8 h-8 text-blue-400 opacity-80" />
            <div className="text-center">
              <p className="text-xs font-semibold text-white">
                Drop PDF documents here or <span className="text-blue-400 underline">browse</span>
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Automatically detects PREPARED BY, REVIEWED BY, NOTED BY, ARD, and REGIONAL DIRECTOR signatories
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Scanned Documents Display */}
          {entries.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                Scanned Document Queue ({entries.length})
              </h4>

              <div className="space-y-2.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {entries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#111728] border border-[#1C2844] rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="text-xs text-white font-bold truncate max-w-xs">
                          {entry.file.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatFileSize(entry.file.size)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEntry(idx)}
                        className="text-slate-500 hover:text-red-400 p-0.5 rounded cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Scan Status */}
                    {entry.scanning ? (
                      <div className="flex items-center gap-2 text-xs text-blue-400 py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Scanning PDF signature blocks…</span>
                      </div>
                    ) : entry.scanResult ? (
                      entry.scanResult.requiredSigners.length > 0 ? (
                        <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                              Scanned {entry.scanResult.requiredSigners.length} Signature Block(s) from Document:
                            </span>
                          </div>
                          <div className="space-y-1.5 pl-1">
                            {entry.scanResult.signers.map((s, sIdx) => (
                              <div key={sIdx} className="text-xs text-slate-200 flex items-center gap-2 py-0.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span className="font-bold text-white tracking-wide">{s.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50 text-[11px] text-slate-400">
                          ℹ️ No required signatories detected in document. This document can be Counter-Signed.
                        </div>
                      )
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 px-4 sm:px-6 py-3 sm:py-3.5 border-t border-[#1A2235] bg-[#080B13]">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:flex-1 py-2 rounded-xl border border-[#1C2844] text-slate-400 hover:text-white hover:bg-white/5 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={entries.length === 0 || entries.some((e) => e.scanning)}
            className={`w-full sm:flex-1 py-2 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              entries.length === 0 || entries.some((e) => e.scanning)
                ? "bg-blue-600/40 cursor-not-allowed opacity-60"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-950/50"
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Upload & Queue {entries.length > 0 ? `(${entries.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Turso dtr_storage Record Mapper ─────────────────────────────────────────

function mapDtrRecordToWorkspaceDoc(record: any): WorkspaceDocument {
  let remarksData: any = {};
  try {
    if (record.remarks && (record.remarks.startsWith("{") || record.remarks.startsWith("["))) {
      remarksData = JSON.parse(record.remarks);
    }
  } catch {}

  const target = remarksData.targetPersonnel || record.employeeName || "PERSONNEL";
  const required = remarksData.requiredSigners || (record.signerName ? [record.signerName] : [target]);
  const signers: DocumentSigner[] = remarksData.signers || [
    {
      name: target,
      role: "Signatory",
      status: record.status === "signed" ? "signed" : "pending",
      position: "above",
    },
  ];
  const counterSigners: DocumentSigner[] = remarksData.counterSigners || [];

  return {
    id: record.id,
    fileName: record.pdfFileName || `${record.id}.pdf`,
    fileSize: record.pdfFileSize || "1.2 MB",
    uploadedAt: record.submittedDate || new Date().toISOString(),
    uploadedBy: record.employeeName || "User",
    status: (record.status?.toLowerCase() === "signed"
      ? "signed"
      : record.status?.toLowerCase() === "partially_signed"
      ? "partially_signed"
      : "pending") as SigningStatus,
    targetPersonnel: target,
    requiredSigners: required,
    signers,
    counterSigners,
    fileType: record.pdfFileName?.endsWith(".docx") ? "docx" : "pdf",
    notes: remarksData.notes || record.remarks,
    pdfDataUrl: record.pdfDataUrl,
    scannedInfo: remarksData.scannedInfo || undefined,
  };
}

const DELETED_IDS_STORAGE_KEY = "dict_r5_signing_workspace_deleted_ids_v1";

function getDeletedDocIds(): Set<string> {
  if (typeof window === "undefined" || !window.localStorage) return new Set();
  try {
    const raw = localStorage.getItem(DELETED_IDS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

function markDocAsDeleted(id: string) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const set = getDeletedDocIds();
    set.add(id);
    localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

// ─── Bulk Counter-Sign Selection Modal ───────────────────────────────────────

interface BulkCounterSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetPersonnel: string) => void;
  availablePersonnel: string[];
  eligibleDocsCount: number;
  isProcessing: boolean;
}

function BulkCounterSignModal({
  isOpen,
  onClose,
  onConfirm,
  availablePersonnel,
  eligibleDocsCount,
  isProcessing,
}: BulkCounterSignModalProps) {
  const [selectedPersonnel, setSelectedPersonnel] = useState<string>("");

  useEffect(() => {
    if (availablePersonnel.length > 0) {
      if (!selectedPersonnel || !availablePersonnel.includes(selectedPersonnel)) {
        setSelectedPersonnel(availablePersonnel[0]);
      }
    }
  }, [availablePersonnel, selectedPersonnel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl sm:rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#1A2235] bg-[#080B13]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Bulk Counter-Sign Documents</h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400">
                15px aspect-square counter-signature stamp beside chosen personnel
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span>Select Personnel to Place Counter-Signature Beside:</span>
              <span className="text-cyan-400 font-mono text-[10px]">
                {availablePersonnel.length} Signer{availablePersonnel.length !== 1 ? "s" : ""} Uploaded
              </span>
            </label>

            {availablePersonnel.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                ⚠️ No uploaded personnel names detected in the documents queue.
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedPersonnel}
                  onChange={(e) => setSelectedPersonnel(e.target.value)}
                  disabled={isProcessing}
                  className="w-full bg-[#111728] border border-[#1C2844] focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white font-bold tracking-wide outline-none transition-colors cursor-pointer appearance-none pr-9"
                >
                  {availablePersonnel.map((name) => (
                    <option key={name} value={name} className="bg-[#0C101A] text-white">
                      {name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Explanation Box */}
          <div className="p-3.5 rounded-xl bg-cyan-500/5 border border-cyan-500/20 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-cyan-300 font-bold">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>15px Aspect-Square Counter-Signature Placement</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              When confirmed, a compact <strong className="text-white">15px aspect-square (15x15)</strong> box will be placed directly beside <strong className="text-cyan-300 font-bold">{selectedPersonnel || "the selected personnel"}</strong> across <strong className="text-white">{eligibleDocsCount} document(s)</strong>.
            </p>
            <p className="text-slate-400 text-[10px]">
              Applies official PNPKI digital signature cryptography (ISO 32000-1) preserving all earlier signatures.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 px-4 sm:px-6 py-3 sm:py-3.5 border-t border-[#1A2235] bg-[#080B13]">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full sm:flex-1 py-2 rounded-xl border border-[#1C2844] text-slate-400 hover:text-white hover:bg-white/5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedPersonnel)}
            disabled={isProcessing || !selectedPersonnel || availablePersonnel.length === 0}
            className="w-full sm:flex-1 py-2 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-cyan-950/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Applying Counter-Signatures…</span>
              </>
            ) : (
              <>
                <Award className="w-3.5 h-3.5" />
                <span>Counter-Sign All ({eligibleDocsCount} Docs)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SigningWorkspace() {
  const currentUser = getCurrentUser();
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isBulkCounterModalOpen, setIsBulkCounterModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<WorkspaceDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SigningStatus | "all">("all");
  const [isBulkSigning, setIsBulkSigning] = useState(false);
  const [isBulkCounterSigning, setIsBulkCounterSigning] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"auto" | "table" | "cards">("auto");
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [selectedValidationSigner, setSelectedValidationSigner] = useState<{
    name: string;
    date?: string;
  } | null>(null);

  // Compute list of unique personnel uploaded in the active documents queue
  const availablePersonnel = useMemo(() => {
    const names = new Set<string>();
    documents.forEach((d) => {
      if (d.targetPersonnel) names.add(d.targetPersonnel);
      d.requiredSigners.forEach((r) => names.add(r));
      d.signers.forEach((s) => names.add(s.name));
    });
    return Array.from(names).filter((n) => n && n.trim().length > 2);
  }, [documents]);

  // 1. Sync helper that pulls the latest documents from backend Turso dtr_storage
  const syncFromRemoteStorage = useCallback(async (silent = true) => {
    try {
      const deletedIds = getDeletedDocIds();
      const records = await dtrStorageApi.getRecords({ module: "SIGNING_WORKSPACE" });
      if (Array.isArray(records)) {
        const remoteDocs = records
          .filter((r) => r && !deletedIds.has(r.id))
          .map(mapDtrRecordToWorkspaceDoc);

        setDocuments((prev) => {
          const nextMap = new Map<string, WorkspaceDocument>();

          // Remote is source of truth for synced docs (especially status, signatures, counterSigners, notes)
          remoteDocs.forEach((rDoc) => {
            const localDoc = prev.find((p) => p.id === rDoc.id);
            if (localDoc) {
              nextMap.set(rDoc.id, {
                ...localDoc,
                ...rDoc,
                // Prefer remote pdfDataUrl (e.g. if newly signed on another device)
                pdfDataUrl: rDoc.pdfDataUrl || localDoc.pdfDataUrl,
                fileObj: localDoc.fileObj,
                scannedInfo: rDoc.scannedInfo || localDoc.scannedInfo,
              });
            } else {
              nextMap.set(rDoc.id, rDoc);
            }
          });

          // Keep local docs that are not yet in remote and not marked deleted
          prev.forEach((pDoc) => {
            if (pDoc && !deletedIds.has(pDoc.id) && !nextMap.has(pDoc.id)) {
              nextMap.set(pDoc.id, pDoc);
            }
          });

          const merged = Array.from(nextMap.values());

          // Check if there are changes before triggering state & storage writes
          const hasDiff =
            merged.length !== prev.length ||
            merged.some((m, i) => {
              const p = prev[i];
              return (
                !p ||
                m.id !== p.id ||
                m.status !== p.status ||
                (m.pdfDataUrl?.length || 0) !== (p.pdfDataUrl?.length || 0) ||
                (m.counterSigners?.length || 0) !== (p.counterSigners?.length || 0)
              );
            });

          if (hasDiff) {
            try {
              localStorage.setItem(
                "dict_r5_signing_workspace_docs_v1",
                JSON.stringify(merged.map(({ fileObj, ...rest }) => rest))
              );
            } catch {}
            return merged;
          }
          return prev;
        });
      }
    } catch (err) {
      if (!silent) {
        console.warn("Could not sync signing workspace documents from dtr_storage:", err);
      }
    }
  }, []);

  // 2. Real-time hydration, SSE subscription, polling, and tab visibility listeners
  useEffect(() => {
    const deletedIds = getDeletedDocIds();

    const cached = localStorage.getItem("dict_r5_signing_workspace_docs_v1");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((d: any) => d && !deletedIds.has(d.id));
          setDocuments(valid);
        }
      } catch {}
    }

    // Initial sync from backend
    syncFromRemoteStorage(false);

    // Realtime SSE event listener for instant cross-user / cross-device updates
    const unsubscribeRealtime = subscribeToDtrRealtime((event) => {
      if (event.type === "INSERT" || event.type === "UPDATE") {
        const record = event.record;
        if (record && (record.module === "SIGNING_WORKSPACE" || String(record.module).toUpperCase() === "SIGNING_WORKSPACE")) {
          const deleted = getDeletedDocIds();
          if (!deleted.has(record.id)) {
            const mapped = mapDtrRecordToWorkspaceDoc(record);
            setDocuments((prev) => {
              const existingIdx = prev.findIndex((d) => d.id === mapped.id);
              let nextList: WorkspaceDocument[];
              if (existingIdx >= 0) {
                const existing = prev[existingIdx];
                const updated = {
                  ...existing,
                  ...mapped,
                  pdfDataUrl: mapped.pdfDataUrl || existing.pdfDataUrl,
                  fileObj: existing.fileObj,
                  scannedInfo: mapped.scannedInfo || existing.scannedInfo,
                };
                nextList = [...prev];
                nextList[existingIdx] = updated;
              } else {
                nextList = [mapped, ...prev];
              }
              try {
                localStorage.setItem(
                  "dict_r5_signing_workspace_docs_v1",
                  JSON.stringify(nextList.map(({ fileObj, ...rest }) => rest))
                );
              } catch {}
              return nextList;
            });

            // If previewing this doc, update the preview with newly signed/modified version
            setPreviewDoc((currPreview) => {
              if (currPreview && currPreview.id === mapped.id) {
                return {
                  ...currPreview,
                  ...mapped,
                  pdfDataUrl: mapped.pdfDataUrl || currPreview.pdfDataUrl,
                };
              }
              return currPreview;
            });
          }
        }
      } else if (event.type === "DELETE" && event.id) {
        setDocuments((prev) => {
          const filtered = prev.filter((d) => d.id !== event.id);
          try {
            localStorage.setItem(
              "dict_r5_signing_workspace_docs_v1",
              JSON.stringify(filtered.map(({ fileObj, ...rest }) => rest))
            );
          } catch {}
          return filtered;
        });
        setPreviewDoc((currPreview) => (currPreview?.id === event.id ? null : currPreview));
      }
    });

    // Fallback background polling every 3.5 seconds
    const pollInterval = setInterval(() => {
      syncFromRemoteStorage(true);
    }, 3500);

    // Instant refresh when user returns to this window or tab
    const handleFocusOrVisible = () => {
      syncFromRemoteStorage(true);
    };

    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener("dict_dtr_storage_updated", handleFocusOrVisible);
    window.addEventListener("storage", handleFocusOrVisible);

    return () => {
      unsubscribeRealtime();
      clearInterval(pollInterval);
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      window.removeEventListener("dict_dtr_storage_updated", handleFocusOrVisible);
      window.removeEventListener("storage", handleFocusOrVisible);
    };
  }, [syncFromRemoteStorage]);

  // Sync to local storage on change (persists empty array when all documents deleted)
  useEffect(() => {
    try {
      const sanitized = documents.map(({ fileObj, ...rest }) => rest);
      localStorage.setItem("dict_r5_signing_workspace_docs_v1", JSON.stringify(sanitized));
    } catch {}
  }, [documents]);

  const handleOpenValidationModal = (signerName: string, date?: string) => {
    setSelectedValidationSigner({ name: signerName, date });
    setValidationModalOpen(true);
  };

  const showNotif = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDownload = async (doc: WorkspaceDocument) => {
    let pdfUrl = doc.pdfDataUrl;
    if (!pdfUrl && !doc.fileObj) {
      try {
        const full = await dtrStorageApi.getRecord(doc.id);
        if (full?.pdfDataUrl) {
          pdfUrl = full.pdfDataUrl;
          doc.pdfDataUrl = full.pdfDataUrl;
        }
      } catch (e) {
        console.warn("Failed to load PDF for download:", e);
      }
    }

    // 1. Download cryptographically signed PDF if available
    if (pdfUrl) {
      try {
        const base64 = pdfUrl.includes(",")
          ? pdfUrl.split(",")[1]
          : pdfUrl;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.fileName;
        a.click();
        URL.revokeObjectURL(url);
        showNotif(`✓ Downloaded digitally signed ${doc.fileName}`);
        return;
      } catch {
        const a = document.createElement("a");
        a.href = doc.pdfDataUrl;
        a.download = doc.fileName;
        a.click();
        showNotif(`✓ Downloaded ${doc.fileName}`);
        return;
      }
    }

    // 2. Download original uploaded file
    if (doc.fileObj) {
      const url = URL.createObjectURL(doc.fileObj);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName;
      a.click();
      URL.revokeObjectURL(url);
      showNotif(`✓ Downloaded ${doc.fileName}`);
      return;
    }

    const sampleContent = `Republic of the Philippines\nDEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY\nRegion V - Bicol Region\n\nOFFICIAL DOCUMENT: ${doc.fileName}\nTracking ID: ${doc.id}\nPrimary Subject: ${doc.targetPersonnel}\nUploaded By: ${doc.uploadedBy}\nUploaded At: ${doc.uploadedAt}\nSigning Status: ${doc.status.toUpperCase()}\n\nScanned Required Signers (${doc.requiredSigners.length}):\n${doc.requiredSigners.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}\n\nCompleted Signatures:\n${doc.signers.filter((s) => s.status === "signed").map((s) => `  ✓ ${s.name} (${s.role || "Signer"}) - Placed Above Name`).join("\n")}\n${(doc.counterSigners || []).map((c) => `  ✓ ${c.name} - Counter-Signed Beside Name (${c.position || "beside"})`).join("\n")}\n\nThis electronic document has been verified under the DICT Signing Workspace.`;
    const blob = new Blob([sampleContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.fileName.replace(/\.pdf$/i, ".txt");
    a.click();
    URL.revokeObjectURL(url);
    showNotif(`✓ Downloaded transmittal for ${doc.fileName}`);
  };

  // ─── Core Signing Pipeline ──────────────────────────────────────────────────
  const signDocumentItem = async (
    doc: WorkspaceDocument,
    options?: {
      isCounterSign?: boolean;
      counterSignPosition?: CounterSignPosition;
      counterSignTargetPersonnel?: string;
    }
  ): Promise<WorkspaceDocument> => {
    try {
      const currentUserName = currentUser?.name || "ACE MALTO";
      const isReq = isUserInRequiredSigners(doc, currentUserName, currentUser?.role);
      const isCounter = options?.isCounterSign !== undefined ? options.isCounterSign : !isReq;
      const counterPos = options?.counterSignPosition || "auto";

      // Fetch digital signature profile for the current logged-in signer
      let userSigProfile: DtrGeneratorSignatureRecord | null = null;
      try {
        if (currentUser?.id) {
          const list = await dtrGeneratorApi.getRecords({ user_Id: String(currentUser.id) });
          if (Array.isArray(list) && list.length > 0) {
            userSigProfile = list.find((p) => p.user_Id === String(currentUser.id)) || list[0];
          }
        }
        if (!userSigProfile && currentUserName) {
          const list = await dtrGeneratorApi.getRecords({ Name: currentUserName });
          if (Array.isArray(list) && list.length > 0) {
            userSigProfile =
              list.find((p) => p.Name.toLowerCase() === currentUserName.toLowerCase()) || list[0];
          }
        }
        if (!userSigProfile) {
          const all = await dtrGeneratorApi.getRecords();
          if (Array.isArray(all) && all.length > 0) {
            userSigProfile =
              all.find((p) => matchNames(p.Name, currentUserName)) || all[0];
          }
        }
      } catch (err) {
        console.warn("Could not load digital signature profile:", err);
      }

      const effectiveSignerName =
        userSigProfile?.Name || currentUserName.toUpperCase() || "AUTHORIZED SIGNER";
      const signatureImage = userSigProfile?.image_digiSigned || null;
      const p12Options =
        userSigProfile?.hasP12 || userSigProfile?.p12
          ? {
              profileId: userSigProfile.id,
              user_Id: userSigProfile.user_Id,
              p12Base64: userSigProfile.p12,
              signerName: effectiveSignerName,
              signerRole: "supervisor" as const,
            }
          : null;

      // Accurately resolve which signature line in the document to target
      const matchedRequiredSigner = doc.requiredSigners.find((req) =>
        matchNames(req, effectiveSignerName) || matchNames(req, currentUserName)
      );
      const targetPersonnelName = isCounter
        ? (options?.counterSignTargetPersonnel || doc.targetPersonnel || currentUserName).trim()
        : (matchedRequiredSigner || doc.targetPersonnel || currentUserName).trim();

      let signedPdfDataUrl = doc.pdfDataUrl;
      let signedFileObj: File | null = null;
      let signatureCoords: any = null;

      let currentPdfDataUrl = doc.pdfDataUrl;
      if (!doc.fileObj && (!currentPdfDataUrl || !currentPdfDataUrl.startsWith("data:application/pdf"))) {
        try {
          const fullRec = await dtrStorageApi.getRecord(doc.id);
          if (fullRec?.pdfDataUrl) {
            currentPdfDataUrl = fullRec.pdfDataUrl;
            doc.pdfDataUrl = fullRec.pdfDataUrl;
          }
        } catch (e) {
          console.warn("Could not fetch remote PDF data for signing:", e);
        }
      }

      // If binary PDF file is present, perform cryptographic signing via incremental chaining
      if (doc.fileObj || (currentPdfDataUrl && currentPdfDataUrl.startsWith("data:application/pdf"))) {
        let pdfBytes: Uint8Array | null = null;
        if (doc.fileObj) {
          const buffer = await doc.fileObj.arrayBuffer();
          pdfBytes = new Uint8Array(buffer);
        } else if (currentPdfDataUrl) {
          const base64 = currentPdfDataUrl.includes(",")
            ? currentPdfDataUrl.split(",")[1]
            : currentPdfDataUrl;
          const binary = atob(base64);
          pdfBytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            pdfBytes[i] = binary.charCodeAt(i);
          }
        }

        if (pdfBytes) {
          const counterSignIdx = doc.counterSigners?.length || 0;
          const { bytes, resolvedSignerName, signatureCoordinates } =
            await signUploadedPersonnelPdfBytes(
              pdfBytes,
              targetPersonnelName,
              signatureImage,
              p12Options,
              {
                isCounterSign: isCounter,
                counterSignIndex: counterSignIdx,
                counterSignPosition: counterPos,
              }
            );

          signatureCoords = signatureCoordinates;

          let outBinary = "";
          const len = bytes.byteLength;
          for (let j = 0; j < len; j++) {
            outBinary += String.fromCharCode(bytes[j]);
          }
          signedPdfDataUrl = `data:application/pdf;base64,${btoa(outBinary)}`;
          signedFileObj = new File([bytes], doc.fileName, { type: "application/pdf" });
        }
      }

      const now = new Date().toISOString();
      const updatedSigners = [...doc.signers];
      const updatedCounterSigners = [...(doc.counterSigners || [])];

      if (isCounter) {
        // Add to counter-signers list (placed BESIDE the name in 15px box)
        const appliedPos = signatureCoords?.appliedPosition || counterPos;
        updatedCounterSigners.push({
          name: effectiveSignerName,
          role: "Counter-Signer",
          status: "counter-signed",
          signedAt: now,
          p12CommonName: effectiveSignerName,
          isCounterSign: true,
          position: appliedPos,
        });
      } else {
        // Update matching required signer or append (placed ABOVE the name)
        const matchIdx = updatedSigners.findIndex(
          (s) => matchNames(s.name, effectiveSignerName) || normalizeName(s.name) === normalizeName(effectiveSignerName)
        );

        if (matchIdx >= 0) {
          updatedSigners[matchIdx] = {
            ...updatedSigners[matchIdx],
            status: "signed",
            signedAt: now,
            p12CommonName: effectiveSignerName,
            isCounterSign: false,
            position: "above",
          };
        } else {
          updatedSigners.push({
            name: effectiveSignerName,
            role: "Signatory",
            status: "signed",
            signedAt: now,
            p12CommonName: effectiveSignerName,
            isCounterSign: false,
            position: "above",
          });
        }
      }

      // Check overall document completion
      const signedCount = doc.requiredSigners.filter((req) =>
        updatedSigners.some(
          (s) => s.status === "signed" && (matchNames(s.name, req) || normalizeName(s.name) === normalizeName(req))
        )
      ).length;

      const newStatus: SigningStatus =
        signedCount >= doc.requiredSigners.length ? "signed" : "partially_signed";

      const placementDesc = isCounter
        ? `Counter-signed (15px box) BESIDE personnel "${targetPersonnelName}"`
        : `Signed directly ABOVE personnel "${targetPersonnelName}"`;

      const updatedDoc: WorkspaceDocument = {
        ...doc,
        fileObj: signedFileObj || doc.fileObj,
        status: newStatus,
        signers: updatedSigners,
        counterSigners: updatedCounterSigners,
        pdfDataUrl: signedPdfDataUrl,
        notes: signatureCoords
          ? `${placementDesc} on page ${signatureCoords.pageIndex + 1} (${signatureCoords.detectedReason})`
          : placementDesc,
        selected: false,
      };

      // Asynchronously update in Turso dtr_storage table (module = 'SIGNING_WORKSPACE')
      const signStoragePayload = {
        id: updatedDoc.id,
        userId: String(currentUser?.id || "USER-001"),
        employeeName: updatedDoc.targetPersonnel,
        employeeId: String(currentUser?.employeeId || "EMP-001"),
        module: "SIGNING_WORKSPACE",
        province: currentUser?.province || "Regional Office",
        sectionDivision: "Regional Office V",
        periodText: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        scope: "full-month",
        status: newStatus,
        submittedDate: updatedDoc.uploadedAt,
        pdfFileName: updatedDoc.fileName,
        pdfFileSize: updatedDoc.fileSize,
        pdfDataUrl: signedPdfDataUrl,
        docType: "AR",
        hasP12: true,
        signerName: effectiveSignerName,
        remarks: JSON.stringify({
          targetPersonnel: updatedDoc.targetPersonnel,
          requiredSigners: updatedDoc.requiredSigners,
          signers: updatedDoc.signers,
          counterSigners: updatedCounterSigners,
          scannedInfo: updatedDoc.scannedInfo,
          notes: updatedDoc.notes,
        }),
      };

      dtrStorageApi
        .saveRecord(signStoragePayload)
        .catch((err) => console.warn("Failed to sync signed record to dtr_storage:", err));

      // Broadcast to same-browser tabs immediately
      broadcastLocalDtrEvent({
        type: "UPDATE",
        record: signStoragePayload as any,
        id: updatedDoc.id,
      });

      return updatedDoc;
    } catch (err: any) {
      console.error("Signing document failed:", err);
      return {
        ...doc,
        status: "failed",
        notes: `Signing error: ${err.message || "Failed"}`,
      };
    }
  };

  const handleSignSingle = async (id: string) => {
    const targetDoc = documents.find((d) => d.id === id);
    if (!targetDoc) return;

    showNotif(`Applying P12 digital signature ABOVE personnel name…`);
    const updated = await signDocumentItem(targetDoc, { isCounterSign: false });

    setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
    if (previewDoc && previewDoc.id === id) {
      setPreviewDoc(updated);
    }
    showNotif(`✓ Signed successfully ABOVE personnel name (preserved in Acrobat).`);
  };

  const handleCounterSignSingle = async (id: string, position: CounterSignPosition = "auto") => {
    const targetDoc = documents.find((d) => d.id === id);
    if (!targetDoc) return;

    showNotif(`Applying 15px P12 counter-signature BESIDE personnel name (${position})…`);
    const updated = await signDocumentItem(targetDoc, { isCounterSign: true, counterSignPosition: position });

    setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
    if (previewDoc && previewDoc.id === id) {
      setPreviewDoc(updated);
    }
    showNotif(`✓ Counter-signed successfully BESIDE personnel name in 15px square box.`);
  };

  // ─── Selection Helpers ───────────────────────────────────────────────────────

  const selectedDocs = documents.filter((d) => d.selected);

  const userRequiredDocs = documents.filter(
    (d) => isUserInRequiredSigners(d, currentUser?.name, currentUser?.role) && !hasUserAlreadySigned(d, currentUser?.name)
  );

  const userCounterDocs = documents.filter(
    (d) => !isUserInRequiredSigners(d, currentUser?.name, currentUser?.role) && !hasUserAlreadySigned(d, currentUser?.name)
  );

  const selectedUserRequiredDocs = selectedDocs.filter(
    (d) => isUserInRequiredSigners(d, currentUser?.name, currentUser?.role) && !hasUserAlreadySigned(d, currentUser?.name)
  );

  const selectedUserCounterDocs = selectedDocs.filter(
    (d) => !isUserInRequiredSigners(d, currentUser?.name, currentUser?.role) && !hasUserAlreadySigned(d, currentUser?.name)
  );

  const toggleSelect = (id: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d))
    );
  };

  const toggleSelectAll = () => {
    const allSelected = documents.length > 0 && documents.every((d) => d.selected);
    setDocuments((prev) => prev.map((d) => ({ ...d, selected: !allSelected })));
  };

  // ─── Upload Handler with Automatic Document Scanning ────────────────────────

  const handleUploadScanned = async (scannedEntries: ScannedFileEntry[]) => {
    const now = new Date().toISOString();
    const newDocs: WorkspaceDocument[] = [];

    for (let i = 0; i < scannedEntries.length; i++) {
      const entry = scannedEntries[i];
      const scan = entry.scanResult;
      const defaultUser = currentUser?.name || "ACE M. MALTO";
      const primary = scan?.primaryPersonnel || scan?.requiredSigners?.[0] || defaultUser;
      const required =
        scan?.requiredSigners && scan.requiredSigners.length > 0
          ? scan.requiredSigners
          : [defaultUser];

      const docSigners: DocumentSigner[] =
        scan?.signers && scan.signers.length > 0
          ? scan.signers.map((s) => ({
              name: s.name,
              role: "Signatory",
              status: "pending",
              position: "above",
            }))
          : required.map((rName) => ({
              name: rName,
              role: "Signatory",
              status: "pending",
              position: "above",
            }));

      let pdfDataUrl: string | undefined = undefined;
      try {
        const buffer = await entry.file.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let j = 0; j < len; j++) {
          binary += String.fromCharCode(bytes[j]);
        }
        pdfDataUrl = `data:application/pdf;base64,${btoa(binary)}`;
      } catch {}

      const newDoc: WorkspaceDocument = {
        id: `doc-upload-${Date.now()}-${i}`,
        fileName: entry.file.name,
        fileSize: formatFileSize(entry.file.size),
        uploadedAt: now,
        uploadedBy: currentUser?.name || "Unknown User",
        status: "pending" as SigningStatus,
        targetPersonnel: primary,
        requiredSigners: required,
        signers: docSigners,
        counterSigners: [],
        fileType: entry.file.name.endsWith(".pdf")
          ? "pdf"
          : entry.file.name.endsWith(".docx") || entry.file.name.endsWith(".doc")
          ? "docx"
          : "other",
        fileObj: entry.file,
        pdfDataUrl,
        scannedInfo: scan || undefined,
        notes: `Scanned from document: ${required.join(", ")}`,
      };

      newDocs.push(newDoc);

      // Persist to Turso dtr_storage table (module = 'SIGNING_WORKSPACE')
      const uploadPayload = {
        id: newDoc.id,
        userId: String(currentUser?.id || "USER-001"),
        employeeName: newDoc.targetPersonnel,
        employeeId: String(currentUser?.employeeId || "EMP-001"),
        module: "SIGNING_WORKSPACE",
        province: currentUser?.province || "Regional Office",
        sectionDivision: "Regional Office V",
        periodText: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        scope: "full-month",
        status: newDoc.status,
        submittedDate: newDoc.uploadedAt,
        pdfFileName: newDoc.fileName,
        pdfFileSize: newDoc.fileSize,
        pdfDataUrl: newDoc.pdfDataUrl,
        docType: "AR",
        remarks: JSON.stringify({
          targetPersonnel: newDoc.targetPersonnel,
          requiredSigners: newDoc.requiredSigners,
          signers: newDoc.signers,
          counterSigners: newDoc.counterSigners,
          scannedInfo: newDoc.scannedInfo,
          notes: newDoc.notes,
        }),
      };

      dtrStorageApi
        .saveRecord(uploadPayload)
        .catch((err) => console.warn("Could not save to dtr_storage:", err));

      // Broadcast to other tabs immediately
      broadcastLocalDtrEvent({
        type: "INSERT",
        record: uploadPayload as any,
        id: newDoc.id,
      });
    }

    setDocuments((prev) => [...newDocs, ...prev]);
    showNotif(
      `✓ ${scannedEntries.length} document(s) scanned and queued with detected signature blocks.`
    );
  };

  // ─── Bulk Sign (Required Signers -> Placed ABOVE Name) ──────────────────────

  const handleBulkSign = async () => {
    const toSign =
      selectedUserRequiredDocs.length > 0 ? selectedUserRequiredDocs : userRequiredDocs;

    if (toSign.length === 0) {
      showNotif("⚠️ No pending documents found where your name is in the required signers list.");
      return;
    }

    setIsBulkSigning(true);
    showNotif(`Bulk signing ${toSign.length} document(s) ABOVE personnel name…`);

    for (const doc of toSign) {
      const signed = await signDocumentItem(doc, { isCounterSign: false });
      setDocuments((prev) => prev.map((d) => (d.id === signed.id ? signed : d)));
    }

    setIsBulkSigning(false);
    showNotif(
      `✓ Bulk signing complete — ${toSign.length} document(s) digitally signed ABOVE personnel name.`
    );
  };

  // ─── Bulk Counter-Sign (Shows Modal with Uploaded Personnel Selection) ──────

  const handleBulkCounterSign = () => {
    const toCounter =
      selectedUserCounterDocs.length > 0 ? selectedUserCounterDocs : userCounterDocs;

    if (toCounter.length === 0) {
      showNotif("⚠️ No eligible documents found for counter-signing.");
      return;
    }

    setIsBulkCounterModalOpen(true);
  };

  const handleExecuteBulkCounterSign = async (targetPersonnel: string) => {
    const toCounter =
      selectedUserCounterDocs.length > 0 ? selectedUserCounterDocs : userCounterDocs;

    if (toCounter.length === 0) {
      showNotif("⚠️ No eligible documents found for counter-signing.");
      return;
    }

    setIsBulkCounterSigning(true);
    showNotif(`Bulk counter-signing ${toCounter.length} document(s) BESIDE "${targetPersonnel}" in 15px box…`);

    for (const doc of toCounter) {
      const signed = await signDocumentItem(doc, {
        isCounterSign: true,
        counterSignTargetPersonnel: targetPersonnel,
        counterSignPosition: "auto",
      });
      setDocuments((prev) => prev.map((d) => (d.id === signed.id ? signed : d)));
    }

    setIsBulkCounterSigning(false);
    setIsBulkCounterModalOpen(false);
    showNotif(
      `✓ Bulk counter-signing complete — 15px square counter-signature placed BESIDE "${targetPersonnel}" on ${toCounter.length} document(s).`
    );
  };

  // ─── Remove ──────────────────────────────────────────────────────────────────

  const handleRemove = async (id: string) => {
    // 1. Mark ID in persistent tombstone set to prevent any resurrection
    markDocAsDeleted(id);

    // 2. Clear from preview if active
    if (previewDoc?.id === id) {
      setPreviewDoc(null);
    }

    // 3. Immediately update state and flush to localStorage (even if list becomes empty)
    setDocuments((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      try {
        localStorage.setItem(
          "dict_r5_signing_workspace_docs_v1",
          JSON.stringify(updated.map(({ fileObj, ...rest }) => rest))
        );
      } catch {}
      return updated;
    });

    // Broadcast DELETE event to other same-browser tabs immediately
    broadcastLocalDtrEvent({ type: "DELETE", id });

    // 4. Permanently delete from backend Turso dtr_storage table
    try {
      await dtrStorageApi.deleteRecord(id);
    } catch (err) {
      console.warn("Failed to delete record from dtr_storage:", err);
    }

    showNotif("Document permanently removed from workspace.");
  };

  // ─── Filtered List ───────────────────────────────────────────────────────────

  const filtered = documents.filter((d) => {
    const matchSearch =
      !searchQuery ||
      d.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.targetPersonnel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.uploadedBy || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.requiredSigners.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ─── Stats ───────────────────────────────────────────────────────────────────

  const stats = {
    total: documents.length,
    pending: documents.filter((d) => d.status === "pending").length,
    partially_signed: documents.filter((d) => d.status === "partially_signed").length,
    signed: documents.filter((d) => d.status === "signed").length,
    failed: documents.filter((d) => d.status === "failed").length,
  };

  return (
    <div className="space-y-4 sm:space-y-5 max-w-[1920px] mx-auto text-slate-200 w-full min-w-0">
      {/* ── Page Header Banner ─────────────────────────────────────────────── */}
      <div className="bg-[#0C101A] border border-[#1A2235] rounded-2xl p-4 sm:p-5 lg:p-6 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-lg shadow-violet-950/40 shrink-0 mt-0.5 sm:mt-0">
              <FileSignature className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  DICT Region V
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  PNPKI Multi-Signer System
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  ISO 32000-1 Adobe Acrobat Compatible
                </span>
              </div>
              <h1 className="text-base sm:text-lg lg:text-xl font-black text-white tracking-tight mt-1 truncate">
                Signing Workspace
              </h1>
            </div>
          </div>

          {/* Action Buttons in Top Right Header */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {notification && (
              <div className="w-full sm:w-auto px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl animate-in fade-in flex items-center gap-1.5 shadow-md">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{notification}</span>
              </div>
            )}

            {/* Bulk Sign Button */}
            <button
              type="button"
              onClick={handleBulkSign}
              disabled={isBulkSigning || (selectedUserRequiredDocs.length === 0 && userRequiredDocs.length === 0)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-violet-950/50 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              title="Bulk signs documents where you are listed as a required signer. Places digital signature ABOVE personnel name."
            >
              {isBulkSigning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <PenLine className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {isBulkSigning
                  ? "Signing…"
                  : selectedUserRequiredDocs.length > 0
                  ? `Bulk Sign (${selectedUserRequiredDocs.length})`
                  : `Bulk Sign (${userRequiredDocs.length})`}
              </span>
            </button>

            {/* Bulk Counter-Sign Button */}
            <button
              type="button"
              onClick={handleBulkCounterSign}
              disabled={
                isBulkCounterSigning ||
                (selectedUserCounterDocs.length === 0 && userCounterDocs.length === 0)
              }
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-blue-950/50 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              title="Bulk counter-signs documents where you are not in the required signers list. Places digital signature stamp BESIDE personnel name."
            >
              {isBulkCounterSigning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {isBulkCounterSigning
                  ? "Counter-Signing…"
                  : selectedUserCounterDocs.length > 0
                  ? `Counter-Sign (${selectedUserCounterDocs.length})`
                  : `Counter-Sign (${userCounterDocs.length})`}
              </span>
            </button>

            {/* Upload File Button */}
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 transition-all cursor-pointer active:scale-[0.98]"
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span>Upload File</span>
            </button>
          </div>
        </div>

        {/* Sub-module Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1A2235]/60">
          <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold bg-violet-600/90 text-white shadow-md shadow-violet-900/30 border border-violet-500/40">
            <FileSignature className="w-3.5 h-3.5 shrink-0" />
            <span>Document Signing Queue</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/20 text-white">
              {stats.total} Documents
            </span>
          </div>
        </div>
      </div>
        {/* ── Stats Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              label: "Total Documents",
              value: stats.total,
              icon: <Layers className="w-4 h-4 sm:w-5 sm:h-5" />,
              color: "text-blue-400",
              bg: "from-blue-500/10 to-transparent border-blue-500/20",
            },
            {
              label: "Pending Signing",
              value: stats.pending,
              icon: <Clock className="w-4 h-4 sm:w-5 sm:h-5" />,
              color: "text-amber-400",
              bg: "from-amber-500/10 to-transparent border-amber-500/20",
            },
            {
              label: "Partially Signed",
              value: stats.partially_signed,
              icon: <Users className="w-4 h-4 sm:w-5 sm:h-5" />,
              color: "text-sky-400",
              bg: "from-sky-500/10 to-transparent border-sky-500/20",
            },
            {
              label: "Fully Signed",
              value: stats.signed,
              icon: <BadgeCheck className="w-4 h-4 sm:w-5 sm:h-5" />,
              color: "text-emerald-400",
              bg: "from-emerald-500/10 to-transparent border-emerald-500/20",
            },
          ].map((card) => (
            <div
              key={card.label}
              className={`bg-gradient-to-br ${card.bg} border rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4`}
            >
              <div className={`${card.color} opacity-80 shrink-0`}>{card.icon}</div>
              <div className="min-w-0">
                <div className={`text-xl sm:text-2xl font-black ${card.color} truncate`}>{card.value}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 font-semibold truncate">{card.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Table Card ───────────────────────────────────────────────────── */}
        <div className="bg-[#0C101A] border border-[#1A2235] rounded-2xl overflow-hidden shadow-xl">
          {/* Table Toolbar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#1A2235]">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-violet-400 shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold text-white">Document Queue & Signer Matrix</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20 font-mono">
                  {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* View Switcher Button (Cards vs Table) */}
              <div className="flex items-center bg-[#0A0E1A] border border-[#1C2844] rounded-lg p-0.5 ml-auto sm:ml-2">
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === "cards" ? "auto" : "cards")}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    viewMode === "cards" ? "bg-violet-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                  }`}
                  title="Card View (Mobile / Tablet friendly)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === "table" ? "auto" : "table")}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    viewMode === "table" ? "bg-violet-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                  }`}
                  title="Table View (Desktop Dense view)"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 sm:w-56 lg:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search file or signer…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#0A0E1A] border border-[#1C2844] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors w-full"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as SigningStatus | "all")}
                  className="bg-[#0A0E1A] border border-[#1C2844] rounded-lg pl-8 pr-7 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors appearance-none cursor-pointer w-full sm:w-auto"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="partially_signed">Partially Signed</option>
                  <option value="signed">Fully Signed</option>
                  <option value="failed">Failed</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-slate-500">
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-8 h-8 opacity-30" />
                <p className="text-sm font-semibold text-slate-400">No documents found</p>
                <p className="text-[11px] text-slate-600">
                  Upload a file or adjust your search filters.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Responsive Mobile / Card View (< md by default or when viewMode === "cards") ── */}
              <div
                className={`divide-y divide-[#18233C]/60 ${
                  viewMode === "cards"
                    ? "block"
                    : viewMode === "table"
                    ? "hidden"
                    : "block md:hidden"
                }`}
              >
                {/* Select All Bar in Mobile Card View */}
                <div className="px-4 py-2.5 bg-[#080B13] border-b border-[#1A2235] flex items-center justify-between text-xs text-slate-400">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={documents.length > 0 && documents.every((d) => d.selected)}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-700 bg-slate-800 text-violet-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-300 text-[11px]">Select All ({documents.length})</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {filtered.filter((d) => d.selected).length} selected
                  </span>
                </div>

                {filtered.map((doc) => {
                  const sc = statusConfig[doc.status];
                  const userIsReq = isUserInRequiredSigners(doc, currentUser?.name, currentUser?.role);
                  const userSigned = hasUserAlreadySigned(doc, currentUser?.name);
                  const completedSignersCount = doc.signers.filter(
                    (s) => s.status === "signed"
                  ).length;

                  return (
                    <div
                      key={`card-${doc.id}`}
                      className={`p-4 space-y-3 transition-colors ${
                        doc.selected ? "bg-violet-500/5" : "hover:bg-[#0F1525]/60"
                      }`}
                    >
                      {/* Header: Checkbox + File Info + Status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={!!doc.selected}
                            onChange={() => toggleSelect(doc.id)}
                            className="mt-1 rounded border-slate-700 bg-slate-800 text-violet-600 focus:ring-0 cursor-pointer shrink-0"
                          />
                          <div className="w-8 h-8 rounded-lg bg-[#111728] border border-[#1C2844] flex items-center justify-center shrink-0 mt-0.5">
                            <FileKey className="w-4 h-4 text-violet-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-white text-xs truncate" title={doc.fileName}>
                              {doc.fileName}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                              <span>Personnel: <strong className="text-slate-200">{doc.targetPersonnel || doc.requiredSigners?.[0] || "ACE M. MALTO"}</strong></span>
                              <span>•</span>
                              <span className="font-mono">{doc.fileSize}</span>
                            </div>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${sc.bg} ${sc.color}`}
                        >
                          {sc.icon}
                          {sc.label}
                        </span>
                      </div>

                      {/* Upload Details */}
                      <div className="text-[10px] text-slate-400 flex items-center justify-between px-1">
                        <span>Uploaded by: <strong className="text-slate-300">{doc.uploadedBy}</strong></span>
                        <span className="font-mono text-slate-500">{formatTimestamp(doc.uploadedAt)}</span>
                      </div>

                      {/* Signers Chain Matrix */}
                      <div className="p-2.5 rounded-xl bg-[#080B13] border border-[#161F33] space-y-2">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="font-semibold text-slate-300">
                            Required Signers Chain ({completedSignersCount} of {doc.requiredSigners.length} Signed)
                          </span>
                          {doc.counterSigners && doc.counterSigners.length > 0 && (
                            <span className="text-cyan-400 font-semibold text-[9.5px]">
                              +{doc.counterSigners.length} Counter-Signed
                            </span>
                          )}
                        </div>

                        {/* Signer Badges */}
                        <div className="flex flex-wrap gap-1.5">
                          {doc.requiredSigners.map((reqName, sIdx) => {
                            const sObj = doc.signers.find(
                              (s) =>
                                matchNames(s.name, reqName) ||
                                normalizeName(s.name) === normalizeName(reqName)
                            );
                            const isSigned = sObj?.status === "signed";

                            return (
                              <span
                                key={`req-card-${sIdx}`}
                                onClick={() => isSigned && handleOpenValidationModal(reqName, sObj?.signedAt)}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border font-medium ${
                                  isSigned
                                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                }`}
                                title={`${reqName} (${isSigned ? "Signed - Click to view PNPKI status" : "Need to Sign"})`}
                              >
                                {isSigned ? (
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                                ) : (
                                  <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                )}
                                <span className="truncate max-w-[110px] font-bold">{reqName}</span>
                                <span
                                  className={`text-[8.5px] px-1 py-0.2 rounded font-bold ${
                                    isSigned
                                      ? "bg-emerald-500/20 text-emerald-300"
                                      : "bg-amber-500/20 text-amber-300"
                                  }`}
                                >
                                  {isSigned ? "Signed" : "Need Sign"}
                                </span>
                              </span>
                            );
                          })}

                          {doc.counterSigners?.map((cs, cIdx) => (
                            <span
                              key={`cs-card-${cIdx}`}
                              onClick={() => handleOpenValidationModal(cs.name, cs.signedAt)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] border bg-cyan-500/10 text-cyan-300 border-cyan-500/30 font-medium cursor-pointer hover:bg-cyan-500/20"
                              title={`Counter-Signed beside name by ${cs.name} (${cs.position || "beside"})`}
                            >
                              <ShieldCheck className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                              <span className="truncate max-w-[100px]">{cs.name} ({cs.position || "Beside"})</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Card Actions Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#161F33]">
                        {/* Primary Action Button */}
                        <div className="flex-1 min-w-[130px]">
                          {userSigned ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold">
                              <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>Signed by You</span>
                            </span>
                          ) : userIsReq ? (
                            <button
                              type="button"
                              onClick={() => handleSignSingle(doc.id)}
                              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
                            >
                              <PenLine className="w-3.5 h-3.5 shrink-0" />
                              <span>Sign (Above Name)</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCounterSignSingle(doc.id, "auto")}
                              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                              <span>Counter Sign</span>
                            </button>
                          )}
                        </div>

                        {/* Secondary Tools */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1.5 rounded-lg bg-[#111728] border border-[#1C2844] text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Preview Document & Signature Blocks"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(doc)}
                            className="p-1.5 rounded-lg bg-[#111728] border border-[#1C2844] text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Download Document"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(doc.id)}
                            className="p-1.5 rounded-lg bg-[#111728] border border-[#1C2844] text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Remove Document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Desktop / High-Density Table View (>= md by default or when viewMode === "table") ── */}
              <div
                className={`overflow-x-auto custom-scrollbar ${
                  viewMode === "table"
                    ? "block"
                    : viewMode === "cards"
                    ? "hidden"
                    : "hidden md:block"
                }`}
              >
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#1A2235] bg-[#080B13] text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={documents.length > 0 && documents.every((d) => d.selected)}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-700 bg-slate-800 text-violet-600 focus:ring-0 cursor-pointer"
                          title="Select all"
                        />
                      </th>
                      <th className="px-4 py-3 min-w-[200px]">Document / Personnel</th>
                      <th className="px-4 py-3 w-24">Size</th>
                      <th className="px-4 py-3 w-32">Uploaded By</th>
                      <th className="px-4 py-3 min-w-[280px]">
                        Required Signers Chain (Adobe Acrobat P12)
                      </th>
                      <th className="px-4 py-3 w-28">Status</th>
                      <th className="px-4 py-3 w-40 text-center">Your Action</th>
                      <th className="px-4 py-3 w-28 text-right">Tools</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#111728]">
                    {filtered.map((doc) => {
                    const sc = statusConfig[doc.status];
                    const userIsReq = isUserInRequiredSigners(doc, currentUser?.name, currentUser?.role);
                    const userSigned = hasUserAlreadySigned(doc, currentUser?.name);

                    const completedSignersCount = doc.signers.filter(
                      (s) => s.status === "signed"
                    ).length;

                    return (
                      <tr
                        key={doc.id}
                        className={`transition-colors hover:bg-[#0F1525] ${
                          doc.selected ? "bg-violet-500/5" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={!!doc.selected}
                            onChange={() => toggleSelect(doc.id)}
                            className="rounded border-slate-700 bg-slate-800 text-violet-600 focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* File Name & Primary Personnel */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#111728] border border-[#1C2844] flex items-center justify-center shrink-0">
                              <FileKey className="w-3.5 h-3.5 text-violet-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate max-w-xs">
                                {doc.fileName}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                                Personnel:{" "}
                                <span className="text-slate-200 font-bold">{doc.targetPersonnel || doc.requiredSigners?.[0] || "ACE M. MALTO"}</span>
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Size */}
                        <td className="px-4 py-3 text-slate-400 font-mono">{doc.fileSize}</td>

                        {/* Uploaded By */}
                        <td className="px-4 py-3 text-slate-300">
                          <div>
                            <span className="block truncate text-xs">{doc.uploadedBy}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {formatTimestamp(doc.uploadedAt)}
                            </span>
                          </div>
                        </td>

                        {/* Required Signers Matrix */}
                        <td className="px-4 py-3">
                          <div className="space-y-1.5 max-w-sm">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className="font-semibold">
                                {completedSignersCount} of {doc.requiredSigners.length} Signed
                              </span>
                              {doc.counterSigners && doc.counterSigners.length > 0 && (
                                <span className="text-cyan-400 font-semibold">
                                  +{doc.counterSigners.length} Counter-Signed
                                </span>
                              )}
                            </div>

                            {/* Signer Badges */}
                            <div className="flex flex-wrap gap-1">
                              {doc.requiredSigners.map((reqName, sIdx) => {
                                const sObj = doc.signers.find(
                                  (s) =>
                                    matchNames(s.name, reqName) ||
                                    normalizeName(s.name) === normalizeName(reqName)
                                );
                                const isSigned = sObj?.status === "signed";

                                return (
                                  <span
                                    key={sIdx}
                                    onClick={() => isSigned && handleOpenValidationModal(reqName, sObj?.signedAt)}
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] border font-medium ${
                                      isSigned
                                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20 hover:ring-1 hover:ring-emerald-400/40"
                                        : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                    }`}
                                    title={`${reqName} (${isSigned ? "Signed above name - Click to view PNPKI status" : "Need to Sign"})`}
                                  >
                                    {isSigned ? (
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                                    ) : (
                                      <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                    )}
                                    <span className="truncate max-w-[120px] font-bold">{reqName}</span>
                                    <span
                                      className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                                        isSigned
                                          ? "bg-emerald-500/20 text-emerald-300"
                                          : "bg-amber-500/20 text-amber-300"
                                      }`}
                                    >
                                      {isSigned ? "Signed" : "Need to Sign"}
                                    </span>
                                  </span>
                                );
                              })}

                              {/* Counter Signers badges */}
                              {doc.counterSigners?.map((cs, cIdx) => (
                                <span
                                  key={`cs-${cIdx}`}
                                  onClick={() => handleOpenValidationModal(cs.name, cs.signedAt)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] border bg-cyan-500/10 text-cyan-300 border-cyan-500/30 font-medium cursor-pointer hover:bg-cyan-500/20 hover:ring-1 hover:ring-cyan-400/40"
                                  title={`Counter-Signed beside name by ${cs.name} (${cs.position || "beside"}) - Click to view PNPKI status`}
                                >
                                  <ShieldCheck className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                                  <span className="truncate max-w-[110px]">{cs.name} ({cs.position || "Beside"})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sc.bg} ${sc.color}`}
                          >
                            {sc.icon}
                            {sc.label}
                          </span>
                        </td>

                        {/* Dynamic User Action (Sign vs Counter Sign) */}
                        <td className="px-4 py-3 text-center">
                          {userSigned ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold">
                              <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                              Signed by You
                            </span>
                          ) : userIsReq ? (
                            <button
                              type="button"
                              onClick={() => handleSignSingle(doc.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
                              title="You are in the required signers list. Places digital signature stamp ABOVE personnel name."
                            >
                              <PenLine className="w-3.5 h-3.5" />
                              <span>Sign (Above)</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCounterSignSingle(doc.id, "auto")}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
                              title="You are not in the required signers list. Places digital signature stamp BESIDE personnel name."
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Counter Sign</span>
                            </button>
                          )}
                        </td>

                        {/* Tools (Preview Eye, Download, Remove) */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Preview Eye Button */}
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="p-1.5 rounded-lg bg-[#111728] border border-[#1C2844] text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Preview Document & Signature Blocks"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Download */}
                            <button
                              type="button"
                              onClick={() => handleDownload(doc)}
                              className="p-1.5 rounded-lg bg-[#111728] border border-[#1C2844] text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Download Document"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            {/* Remove */}
                            <button
                              type="button"
                              onClick={() => handleRemove(doc.id)}
                              className="p-1.5 rounded-lg bg-[#111728] border border-[#1C2844] text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Remove Document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Document Preview Modal ─────────────────────────────────────────── */}
      <DocumentPreviewModal
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
        onSign={handleSignSingle}
        onCounterSign={handleCounterSignSingle}
        onDownload={handleDownload}
        onShowValidationStatus={handleOpenValidationModal}
        currentUser={currentUser}
      />

      {/* ── Upload Modal with Automatic Scanning ───────────────────────────── */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUploadScanned}
      />

      {/* ── Bulk Counter Sign Selection Modal ────────────────────────────── */}
      <BulkCounterSignModal
        isOpen={isBulkCounterModalOpen}
        onClose={() => setIsBulkCounterModalOpen(false)}
        onConfirm={handleExecuteBulkCounterSign}
        availablePersonnel={availablePersonnel}
        eligibleDocsCount={
          selectedUserCounterDocs.length > 0
            ? selectedUserCounterDocs.length
            : userCounterDocs.length
        }
        isProcessing={isBulkCounterSigning}
      />

      {/* ── Adobe Acrobat / PNPKI Signature Validation Modal (Identical to DTR) ── */}
      <DtrSignatureValidationModal
        isOpen={validationModalOpen}
        onClose={() => setValidationModalOpen(false)}
        signerName={selectedValidationSigner?.name || "Signer"}
        signatureDate={
          selectedValidationSigner?.date
            ? new Date(selectedValidationSigner.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : undefined
        }
      />
    </div>
  );
}
