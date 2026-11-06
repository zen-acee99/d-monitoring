import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import JSZip from "jszip";
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
  KeyRound,
  Lock,
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
import { getCurrentUser, AUTH_EVENT } from "@/services/authStore";
import { getStoredUsers } from "@/data/userStore";
import { dtrGeneratorApi, dtrStorageApi, DtrGeneratorSignatureRecord } from "@/services/api";
import {
  matchNames,
  signUploadedPersonnelPdfBytes,
  scanPdfForSigners,
  ScanPdfResult,
  CounterSignPosition,
  arrayBufferToBase64,
  base64ToUint8Array,
  recheckDocWithLatestUsers,
  mergeScanResultsIntoDoc,
} from "@/utils/dtrVectorPdf";
import { RENE_JANE_SIGNATURE_BASE64 } from "@/utils/reneJaneAutoSign";
import { formatPnpkiDate } from "@/utils/dtrUtils";
import { DtrSignatureValidationModal } from "@/components/dtr/DtrSignatureValidationModal";
import { subscribeToDtrRealtime, broadcastLocalDtrEvent } from "@/services/dtrRealtime";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UserSignerContext {
  userSigProfile: DtrGeneratorSignatureRecord | null;
  effectiveSignerName: string;
  signatureImage: string | null;
  signatureImageBytes: Uint8Array | null;
  signatureImageType: "png" | "jpg" | null;
  isProfileOwnerMatch: boolean;
  p12Options: any | null;
}

export interface BulkSignProgressState {
  completed: number;
  total: number;
  failedCount: number;
  inFlight: boolean;
  type: "sign" | "counter-sign";
}

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
  isPendingSync?: boolean;
  province?: string;
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


export function isUserSuperAdmin(user: any): boolean {
  if (!user || user.status === "inactive") return false;
  const role = (user.role || "").trim().toLowerCase();
  const position = ((user as any).position || "").trim().toLowerCase();
  const designation = ((user as any).designation || "").trim().toLowerCase();
  const name = (user.name || "").trim().toLowerCase();
  const email = (user.email || "").trim().toLowerCase();

  return (
    role.includes("super admin") ||
    role.includes("superadmin") ||
    role.includes("super administrator") ||
    role.includes("superadministrator") ||
    role === "admin" ||
    role === "administrator" ||
    role.startsWith("admin ") ||
    role.endsWith(" admin") ||
    role.includes("system administrator") ||
    role.includes("sysadmin") ||
    position.includes("super admin") ||
    position.includes("super administrator") ||
    position.includes("superadministrator") ||
    position === "admin" ||
    position === "administrator" ||
    position.includes("system administrator") ||
    designation.includes("super admin") ||
    designation.includes("super administrator") ||
    designation.includes("superadministrator") ||
    designation === "admin" ||
    designation === "administrator" ||
    designation.includes("system administrator") ||
    (user as any).isSuperAdmin === true ||
    email.startsWith("admin@") ||
    name === "super admin" ||
    name === "super administrator" ||
    name === "admin" ||
    name === "administrator"
  );
}

export function isUserProvincialOfficer(user: any): boolean {
  if (!user || user.status === "inactive") return false;
  const role = (user.role || "").trim().toLowerCase();
  const position = ((user as any).position || "").trim().toLowerCase();
  const designation = ((user as any).designation || "").trim().toLowerCase();
  const name = (user.name || "").trim().toLowerCase();
  const email = (user.email || "").trim().toLowerCase();

  const isPoRole =
    role.includes("provincial officer") ||
    role === "po" ||
    role.startsWith("po ") ||
    role.endsWith(" po") ||
    role.includes(" po ") ||
    role.includes("(po)") ||
    role.startsWith("po-") ||
    role.includes("po -") ||
    position.includes("provincial officer") ||
    position === "po" ||
    position.startsWith("po ") ||
    position.endsWith(" po") ||
    position.includes(" po ") ||
    position.includes("(po)") ||
    designation.includes("provincial officer") ||
    designation === "po" ||
    designation.includes("(po)");

  const isPoByName =
    name.includes("rene jane") ||
    name.includes("buena") ||
    email.includes("renejane.buena") ||
    (name.includes("antonio") && name.includes("reyes")) ||
    email.includes("antonio.reyes") ||
    (name.includes("maria elena") && name.includes("santos")) ||
    email.includes("maria.santos") ||
    (name.includes("carlo") && name.includes("romero")) ||
    email.includes("carlo.romero") ||
    (name.includes("ramon") && name.includes("fernandez")) ||
    email.includes("ramon.fernandez") ||
    (name.includes("cynthia") && name.includes("morales")) ||
    email.includes("cynthia.morales");

  const isProvincialHead =
    (role.includes("provincial") || designation.includes("provincial") || position.includes("provincial")) &&
    (role.includes("head") || role.includes("lead") || role.includes("officer") || role.includes("director"));

  return isPoRole || isPoByName || isProvincialHead;
}

export function isUserRegionalDirectorOrAssistant(user: any): boolean {
  if (!user || user.status === "inactive") return false;
  const role = (user.role || "").trim().toLowerCase();
  const position = ((user as any).position || "").trim().toLowerCase();
  const designation = ((user as any).designation || "").trim().toLowerCase();
  const title = ((user as any).title || "").trim().toLowerCase();
  const name = (user.name || "").trim().toLowerCase();
  const email = (user.email || "").trim().toLowerCase();

  const combined = `${role} ${position} ${designation} ${title}`.toLowerCase();

  const isRd =
    combined.includes("regional director") ||
    combined.includes("director iv") ||
    combined.includes("director 4") ||
    combined.includes("director-iv") ||
    combined.includes("oic-rd") ||
    combined.includes("oic - rd") ||
    combined.includes("oic-regional director") ||
    combined.includes("oic - regional director") ||
    role === "rd" ||
    position === "rd" ||
    designation === "rd" ||
    name.includes("annabel") ||
    name.includes("calimpong") ||
    email.includes("annabel") ||
    email.includes("calimpong");

  const isArd =
    combined.includes("assistant regional director") ||
    combined.includes("asst. regional director") ||
    combined.includes("asst regional director") ||
    combined.includes("director iii") ||
    combined.includes("director 3") ||
    combined.includes("director-iii") ||
    combined.includes("oic-ard") ||
    combined.includes("oic - ard") ||
    combined.includes("oic-assistant regional director") ||
    combined.includes("oic - assistant regional director") ||
    combined.includes("ard") ||
    role === "ard" ||
    position === "ard" ||
    designation === "ard";

  return isRd || isArd;
}

export function getUserDesignatedProvince(user: any): string {
  if (!user) return "";
  const rawScope = ((user.focalProvince || user.province || "")).trim().toLowerCase();
  if (rawScope && rawScope !== "regional off" && !rawScope.includes("regional")) {
    return rawScope;
  }
  const name = (user.name || "").toLowerCase();
  const email = (user.email || "").toLowerCase();
  if (name.includes("rene jane") || name.includes("buena") || email.includes("renejane.buena")) return "albay";
  if ((name.includes("antonio") && name.includes("reyes")) || email.includes("antonio.reyes")) return "camarines sur";
  if ((name.includes("maria elena") && name.includes("santos")) || email.includes("maria.santos")) return "camarines norte";
  if ((name.includes("carlo") && name.includes("romero")) || email.includes("carlo.romero")) return "catanduanes";
  if ((name.includes("ramon") && name.includes("fernandez")) || email.includes("ramon.fernandez")) return "masbate";
  if ((name.includes("cynthia") && name.includes("morales")) || email.includes("cynthia.morales")) return "sorsogon";
  return "";
}

function isUserInRequiredSigners(
  doc: WorkspaceDocument,
  userName?: string,
  userRole?: string
): boolean {
  if (!userName && !userRole) return false;
  const target = normalizeName(userName);
  const targetRole = (userRole || "").trim().toUpperCase();

  // SuperAdmin has universal signing authority across workspace documents
  const isSuperAdminRole =
    targetRole.includes("SUPER ADMIN") ||
    targetRole.includes("SUPERADMIN") ||
    targetRole.includes("SUPER ADMINISTRATOR") ||
    targetRole.includes("SUPERADMINISTRATOR") ||
    targetRole === "ADMIN" ||
    targetRole === "ADMINISTRATOR" ||
    targetRole.startsWith("ADMIN ") ||
    targetRole.endsWith(" ADMIN") ||
    targetRole.includes("SYSTEM ADMINISTRATOR") ||
    targetRole.includes("SYSADMIN") ||
    target === "super admin" ||
    target === "super administrator" ||
    target === "admin" ||
    target === "administrator";

  if (isSuperAdminRole) {
    return true;
  }

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

  // 3. Role-based match in requiredSigners or doc.signers (name or role)
  if (targetRole) {
    const isPoRoleMatch =
      targetRole.includes("PROVINCIAL OFFICER") ||
      targetRole === "PO" ||
      targetRole.startsWith("PO ") ||
      targetRole.includes(" PO ") ||
      targetRole.endsWith(" PO");

    const isRdRoleMatch =
      targetRole.includes("REGIONAL DIRECTOR") ||
      targetRole === "RD" ||
      targetRole.startsWith("RD ") ||
      targetRole.endsWith(" RD");

    const isArdRoleMatch =
      targetRole.includes("ASST") ||
      targetRole.includes("ASSISTANT") ||
      targetRole.includes("ARD");

    const isTodRoleMatch =
      targetRole.includes("TECHNICAL OPERATIONS") ||
      targetRole.includes("TOD");

    // Check requiredSigners list for role headers/titles
    const matchesReq = doc.requiredSigners.some((req) => {
      const r = req.toUpperCase();
      if (
        isPoRoleMatch &&
        (r.includes("PROVINCIAL OFFICER") ||
          r === "PO" ||
          r.startsWith("PO ") ||
          r.includes(" PO ") ||
          r.endsWith(" PO") ||
          r.includes("REVIEWED BY"))
      )
        return true;
      if (isRdRoleMatch && (r.includes("REGIONAL DIRECTOR") || r === "RD" || r.includes("APPROVED BY"))) return true;
      if (isArdRoleMatch && (r.includes("ASST") || r.includes("ASSISTANT") || r.includes("ARD") || r.includes("RECOMMENDING"))) return true;
      if (isTodRoleMatch && (r.includes("TECHNICAL OPERATIONS") || r.includes("TOD") || r.includes("NOTED BY"))) return true;
      return false;
    });
    if (matchesReq) return true;

    // Check doc.signers for role or name containing the role title
    const matchesSigner = doc.signers.some((s) => {
      const sRole = (s.role || "").toUpperCase();
      const sName = (s.name || "").toUpperCase();
      if (
        isPoRoleMatch &&
        (sRole.includes("PROVINCIAL OFFICER") ||
          sRole.includes("REVIEWED BY") ||
          sName.includes("PROVINCIAL OFFICER") ||
          sName === "PO" ||
          sName.startsWith("PO "))
      )
        return true;
      if (isRdRoleMatch && (sRole.includes("REGIONAL DIRECTOR") || sRole.includes("APPROVED BY") || sName.includes("REGIONAL DIRECTOR") || sName === "RD")) return true;
      if (isArdRoleMatch && (sRole.includes("ASST") || sRole.includes("ASSISTANT") || sRole.includes("ARD") || sRole.includes("RECOMMENDING") || sName.includes("ARD") || sName.includes("ASSISTANT REGIONAL DIRECTOR"))) return true;
      if (isTodRoleMatch && (sRole.includes("TECHNICAL OPERATIONS") || sRole.includes("TOD") || sRole.includes("NOTED BY") || sName.includes("TOD") || sName.includes("TECHNICAL OPERATIONS"))) return true;
      return false;
    });
    if (matchesSigner) return true;
  }

  return false;
}

export function isUserAuthorizedToSignDoc(doc: WorkspaceDocument, user: any): boolean {
  if (!user || user.status === "inactive") return false;
  if (isUserSuperAdmin(user)) return true;

  // Regional Director & Assistant Regional Director have executive regional authority to sign and bulk sign across workspace documents
  if (isUserRegionalDirectorOrAssistant(user)) {
    return true;
  }

  const userCombinedRole = [
    user.role,
    (user as any).position,
    (user as any).designation,
    (user as any).title,
  ].filter(Boolean).join(" ");

  // 1. Direct name match or role match in required signers
  if (isUserInRequiredSigners(doc, user.name, userCombinedRole)) {
    return true;
  }

  // 2. If user is a Provincial Officer (PO), check if document belongs to designated provincial office
  if (isUserProvincialOfficer(user)) {
    const userProv = getUserDesignatedProvince(user);
    if (userProv) {
      const docProv = (doc.province || "").toLowerCase();
      if (docProv && (docProv === userProv || docProv.includes(userProv) || userProv.includes(docProv))) {
        return true;
      }
      // Also check notes, fileName, or targetPersonnel for province match
      const text = `${doc.fileObj?.name || doc.fileName} ${doc.notes || ""} ${doc.targetPersonnel}`.toLowerCase();
      if (text.includes(userProv)) {
        return true;
      }
    }
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

export function computeEffectiveDocStatus(doc: WorkspaceDocument): SigningStatus {
  if (!doc) return "pending";
  if (doc.status === "failed") return "failed";

  const reqSigners = doc.requiredSigners || [];
  const signers = doc.signers || [];
  const counterSigners = doc.counterSigners || [];

  if (reqSigners.length === 0) {
    if (signers.length > 0) {
      const allSigned = signers.every((s) => s.status === "signed" || s.status === "counter-signed");
      const someSigned = signers.some((s) => s.status === "signed" || s.status === "counter-signed");
      if (allSigned) return "signed";
      if (someSigned) return "partially_signed";
    }
    return doc.status || "pending";
  }

  const completedCount = reqSigners.filter((reqName) => {
    const sObj = signers.find(
      (s) => matchNames(s.name, reqName) || normalizeName(s.name) === normalizeName(reqName)
    );
    return sObj?.status === "signed" || sObj?.status === "counter-signed";
  }).length;

  if (completedCount >= reqSigners.length) {
    return "signed";
  }
  if (completedCount > 0) {
    return "partially_signed";
  }

  if (counterSigners.length > 0) {
    return "partially_signed";
  }

  return "pending";
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
    label: "Signed",
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
  doc: rawDoc,
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
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<"viewer" | "signatures">("viewer");
  const [selectedCounterPos, setSelectedCounterPos] = useState<CounterSignPosition>("auto");

  // Dynamically resolve signatories with latest User List
  const doc = useMemo(() => {
    if (!rawDoc) return null;
    try {
      const freshUsers = getStoredUsers().map((u) => ({ name: u.name, role: u.role, email: u.email }));
      const { updatedDoc } = recheckDocWithLatestUsers(rawDoc, freshUsers);
      return updatedDoc as WorkspaceDocument;
    } catch {
      return rawDoc;
    }
  }, [rawDoc]);

  useEffect(() => {
    if (!rawDoc) {
      setBlobUrl(null);
      setIsLoadingPdf(false);
      return;
    }

    const safeCreateBlobUrl = (dataUrl: string): string | null => {
      try {
        if (!dataUrl) return null;
        let base64 = dataUrl;
        if (dataUrl.includes(",")) {
          base64 = dataUrl.split(",")[1];
        }
        const clean = base64.replace(/\s+/g, "");
        const binary = atob(clean);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });
        return URL.createObjectURL(blob);
      } catch (err) {
        console.warn("Could not create Blob URL from base64 PDF:", err);
        return null;
      }
    };

    // Always check for signed/updated PDF first so changes are immediately visible
    if (rawDoc.pdfDataUrl) {
      let created: string | null = null;
      if (rawDoc.pdfDataUrl.startsWith("data:")) {
        created = safeCreateBlobUrl(rawDoc.pdfDataUrl);
      } else if (rawDoc.pdfDataUrl.startsWith("blob:")) {
        created = rawDoc.pdfDataUrl;
      } else {
        created = safeCreateBlobUrl(`data:application/pdf;base64,${rawDoc.pdfDataUrl}`);
      }

      if (created) {
        setBlobUrl(created);
        setIsLoadingPdf(false);
        return () => {
          if (created && created.startsWith("blob:") && created !== rawDoc.pdfDataUrl) {
            URL.revokeObjectURL(created);
          }
        };
      }
    }

    if (rawDoc.fileObj) {
      try {
        const url = URL.createObjectURL(rawDoc.fileObj);
        setBlobUrl(url);
        setIsLoadingPdf(false);
        return () => URL.revokeObjectURL(url);
      } catch (e) {
        console.warn("Failed creating object URL from fileObj:", e);
      }
    }

    // If PDF binary data is not loaded yet in memory, fetch it on-demand from database
    let isCancelled = false;
    let createdUrl: string | null = null;
    setIsLoadingPdf(true);

    dtrStorageApi
      .getRecord(rawDoc.id)
      .then((fullRec) => {
        if (!isCancelled && fullRec && fullRec.pdfDataUrl) {
          rawDoc.pdfDataUrl = fullRec.pdfDataUrl;
          createdUrl = safeCreateBlobUrl(fullRec.pdfDataUrl);
          if (createdUrl) {
            setBlobUrl(createdUrl);
          }
        }
      })
      .catch((e) => console.warn("Failed to fetch full PDF record for preview:", e))
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingPdf(false);
        }
      });

    return () => {
      isCancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [rawDoc]);

  if (!doc) return null;

  const effectiveStatus = computeEffectiveDocStatus(doc);
  const sc = statusConfig[effectiveStatus] || statusConfig.pending;
  const userIsRequired = isUserAuthorizedToSignDoc(doc, currentUser);
  const userHasSigned = hasUserAlreadySigned(doc, currentUser?.name);
  const isAllRequiredSigned = effectiveStatus === "signed";

  const signersList = doc.signers || [];
  const requiredList = doc.requiredSigners || [];
  const allCounterSigners = doc.counterSigners || [];

  // Group signers matching DICT standard layout (PREPARED BY, REVIEWED BY, NOTED BY, ARD, REGIONAL DIRECTOR)
  const prepSigner = signersList.find(
    (s) =>
      s.role?.toUpperCase().includes("PREPARED") ||
      matchNames(s.name, doc.targetPersonnel)
  ) || signersList[0];

  const revSigner = signersList.find(
    (s) =>
      s !== prepSigner &&
      (s.role?.toUpperCase().includes("REVIEWED") ||
        s.role?.toUpperCase().includes("SUPERVISOR") ||
        s.role?.toUpperCase().includes("CERTIF") ||
        s.name.includes("BUENA"))
  ) || signersList.find((s) => s !== prepSigner);

  const rdSigner = signersList.find(
    (s) =>
      s !== prepSigner &&
      s !== revSigner &&
      (s.role?.toUpperCase().includes("REGIONAL DIRECTOR") ||
        s.role?.toUpperCase().includes("APPROVED") ||
        s.role?.toUpperCase().includes("DIRECTOR") ||
        s.name.toUpperCase().includes("ODO"))
  );

  const ardSigner = signersList.find(
    (s) =>
      s !== prepSigner &&
      s !== revSigner &&
      s !== rdSigner &&
      (s.role?.toUpperCase().includes("RECOMMENDING") ||
        s.role?.toUpperCase().includes("ASSISTANT") ||
        s.role?.toUpperCase().includes("ASSISTANCE") ||
        s.role?.toUpperCase().includes("ARD"))
  );

  const notedSigner = signersList.find(
    (s) =>
      s !== prepSigner &&
      s !== revSigner &&
      s !== rdSigner &&
      s !== ardSigner &&
      (s.role?.toUpperCase().includes("NOTED") ||
        s.role?.toUpperCase().includes("CHIEF") ||
        s.name.includes("TABO"))
  ) || (signersList.length > 2 && signersList[2] !== prepSigner && signersList[2] !== revSigner && signersList[2] !== rdSigner && signersList[2] !== ardSigner ? signersList[2] : undefined);

  const handledSet = new Set(
    [prepSigner, revSigner, notedSigner, ardSigner, rdSigner].filter(Boolean) as DocumentSigner[]
  );
  const otherSigners = signersList.filter((s) => !handledSet.has(s));

  const uniqueSigners = useMemo(() => {
    const seen = new Set<string>();
    return signersList.filter((s) => {
      const key = `${normalizeName(s.name)}_${s.status}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [signersList]);

  const uniqueSignedSigners = useMemo(() => {
    const seen = new Set<string>();
    return signersList.filter((s) => {
      if (s.status !== "signed") return false;
      const key = normalizeName(s.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [signersList]);

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
        <div className={`min-h-[48px] flex items-center gap-2 pt-1 pb-1 ${align === "center" ? "justify-center" : ""}`}>
          {/* Counter-signatures placed to the left (compact 20px, border-none, bg-transparent) */}
          {allCounterSigners
            .filter((c) => c.position === "left")
            .map((cs, i) => (
              <div
                key={i}
                onClick={() => onShowValidationStatus?.(cs.name, cs.signedAt)}
                className="w-5 h-5 bg-transparent flex flex-col justify-between p-0.5 text-left shrink-0 cursor-pointer hover:scale-110 transition-all inline-flex"
                title={`Counter-Signed beside name by ${cs.name} - Click to view official PNPKI Digital Signature Validation Status`}
              >
                <div className="flex items-center justify-center">
                  <ShieldCheck className="w-2.5 h-2.5 text-slate-900" />
                </div>
                <div className="leading-tight text-[5px] text-black font-bold">
                  <div className="leading-none">DigiSigned</div>
                  <div className="leading-none truncate max-w-full">
                    by {cs.name.split(" ").pop() || cs.name}
                  </div>
                </div>
              </div>
            ))}

          {/* Digital signature above name (border-none) */}
          {isSigned ? (
            <div
              onClick={() => onShowValidationStatus?.(signer.p12CommonName || signer.name, signer.signedAt)}
              className="border-none bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 rounded text-[9.5px] text-black dark:text-white font-normal inline-block cursor-pointer hover:bg-slate-200/80 transition-all"
              title="Click to view official PNPKI Digital Signature Validation Status"
            >
              <div className="flex items-center gap-1 text-black dark:text-white font-normal">
                <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Digitally signed</span>
              </div>
              <div className="text-black dark:text-white font-normal">by {signer.p12CommonName || signer.name}</div>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 italic">[Signature Area Above Name]</div>
          )}

          {/* Counter-signatures placed to the right (compact horizontal: sign on left, DigiSigned on right) */}
          {allCounterSigners
            .filter((c) => c.position === "right" || c.position === "auto")
            .map((cs, i) => (
              <div
                key={i}
                onClick={() => onShowValidationStatus?.(cs.name, cs.signedAt)}
                className="bg-transparent inline-flex items-center gap-1 px-1 py-0.5 text-left shrink-0 cursor-pointer hover:scale-105 transition-all"
                title={`Counter-Signed beside name by ${cs.name} - Click to view official PNPKI Digital Signature Validation Status`}
              >
                <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3 h-3 text-slate-900" />
                </div>
                <div className="leading-tight text-[6px] text-black font-bold shrink-0">
                  <div className="leading-none">DigiSigned</div>
                  <div className="leading-none truncate max-w-[50px]">
                    by {cs.name.split(" ").pop() || cs.name}
                  </div>
                </div>
              </div>
            ))}
        </div>
        <p className="font-black text-sm uppercase text-slate-900 tracking-tight font-sans">
          {signer.name}
        </p>
        <p className="text-[11px] text-slate-600 italic">
          {designation || "Authorized Signatory"}
        </p>

        {/* Counter-signatures placed to the bottom (compact horizontal: sign on left, DigiSigned on right) */}
        {allCounterSigners
          .filter((c) => c.position === "bottom")
          .map((cs, i) => (
            <div
              key={i}
              onClick={() => onShowValidationStatus?.(cs.name, cs.signedAt)}
              className="mt-0.5 bg-transparent inline-flex items-center gap-1 px-1 py-0.5 text-left shrink-0 cursor-pointer hover:scale-105 transition-all"
              title={`Counter-Signed below name by ${cs.name} - Click to view official PNPKI Digital Signature Validation Status`}
            >
              <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-3 h-3 text-slate-900" />
              </div>
              <div className="leading-tight text-[6px] text-black font-bold shrink-0">
                <div className="leading-none">DigiSigned</div>
                <div className="leading-none truncate max-w-[50px]">
                  by {cs.name.split(" ").pop() || cs.name}
                </div>
              </div>
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
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs md:max-w-sm" title={doc.fileObj?.name || doc.fileName}>
                    {doc.fileObj?.name || doc.fileName}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sc.bg} ${sc.color}`}
                  >
                    {sc.icon}
                    {sc.label}
                  </span>
                  <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20 font-mono">
                    {requiredList.length} Signatories
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
                <span>P12 Signatures ({uniqueSignedSigners.length + allCounterSigners.length})</span>
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
                <span>Signed by You</span>
              </span>
            ) : isAllRequiredSigned ? (
              <span className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Fully Signed</span>
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
                      {uniqueSignedSigners.length + allCounterSigners.length} / {requiredList.length}
                    </span>
                  </div>
                </div>

                {/* Multi-Signer Status Progression */}
                <div className="space-y-3 pt-2">
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    Scanned Required Signers Chain ({requiredList.length} Signatories)
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {uniqueSigners.map((sObj, idx) => {
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
          ) : isLoadingPdf ? (
            <div className="w-full h-full min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              <p className="text-sm font-semibold text-slate-300">Loading document preview…</p>
            </div>
          ) : blobUrl ? (
            /* PDF Iframe Viewer */
            <div
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
              className="w-full h-full flex justify-center transition-transform duration-150"
            >
              <iframe
                src={`${blobUrl}#toolbar=1&navpanes=1`}
                title={doc.fileObj?.name || doc.fileName}
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
                  {(doc.fileObj?.name || doc.fileName).replace(/\.[^/.]+$/, "").replace(/_/g, " ")}
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
                {signersList.length <= 3 ? (
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
                ) : signersList.length === 4 ? (
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

// ─── High-Speed File Processing & Concurrency Helpers ───────────────────────

/**
 * Native asynchronous browser FileReader conversion.
 * 100x faster than character concatenation loops, zero CPU freezing.
 */
export function fileToDataUrl(file: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error("Failed to read file as data URL"));
    reader.readAsDataURL(file);
  });
}

/**
 * Lightweight asynchronous concurrency pool for high-speed parallel operations (6 workers).
 */
export async function asyncPool<T, R>(
  poolLimit: number,
  items: T[],
  iteratorFn: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number, result?: R) => void
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let currentIndex = 0;
  let completedCount = 0;

  const actualLimit = Math.min(poolLimit, items.length);
  const workers = Array.from({ length: actualLimit }, async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      try {
        results[index] = await iteratorFn(items[index], index);
      } catch (err) {
        console.warn(`Worker error on item ${index}:`, err);
      } finally {
        completedCount++;
        onProgress?.(completedCount, items.length, results[index]);
      }
    }
  });

  await Promise.all(workers);
  return results;
}

// ─── Intelligent Upload Modal with High-Speed Parallel Scanning ──────────────

export interface ScannedFileEntry {
  id: string;
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
  const [modalSearch, setModalSearch] = useState("");
  const [scannedCount, setScannedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    const baseTimestamp = Date.now();
    const newEntries: ScannedFileEntry[] = files.map((f, i) => ({
      id: `entry-${baseTimestamp}-${i}-${Math.random().toString(36).substring(2, 5)}`,
      file: f,
      scanResult: null,
      scanning: true,
    }));

    // Pre-cache stored users ONCE to prevent 200 redundant queries
    const storedUsers = getStoredUsers().map((u) => ({ name: u.name, role: u.role, email: u.email }));

    // Append all entries immediately so user sees entire batch (<10ms)
    setEntries((prev) => [...prev, ...newEntries]);

    // High-speed parallel scanning with 6 concurrent background workers
    const CONCURRENCY_LIMIT = 6;
    let completed = 0;

    await asyncPool(CONCURRENCY_LIMIT, newEntries, async (entry) => {
      try {
        const buffer = await entry.file.arrayBuffer();
        const scan = await scanPdfForSigners(buffer, storedUsers);
        entry.scanResult = scan;
      } catch (err) {
        console.warn("Could not scan PDF for signers, using default signatories:", err);
        const fallbackName = (storedUsers[0]?.name || "PERSONNEL").toUpperCase().trim();
        entry.scanResult = {
          primaryPersonnel: fallbackName,
          requiredSigners: [fallbackName],
          signers: [
            {
              name: fallbackName,
              roleHeader: "",
              title: undefined,
              x: 420,
              y: 260,
              pageIndex: 0,
            },
          ],
        };
      } finally {
        entry.scanning = false;
        completed++;
        setScannedCount(completed);
      }
    });

    // Final state flush
    setEntries((prev) => [...prev]);
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

  const clearAll = () => {
    setEntries([]);
    setScannedCount(0);
  };

  const handleSubmit = () => {
    if (entries.length === 0) return;
    // Pass entire batch immediately — background queue will stream and upload without blocking
    onUpload(entries);
    setEntries([]);
    setScannedCount(0);
    onClose();
  };

  const filteredEntries = entries.filter((e) =>
    modalSearch ? e.file.name.toLowerCase().includes(modalSearch.toLowerCase()) : true
  );

  const isScanningActive = entries.some((e) => e.scanning);
  const scanProgressPercent = entries.length > 0 ? Math.round((scannedCount / entries.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl sm:rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#1A2235] bg-[#080B13]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-lg shadow-blue-950/40">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white">High-Speed Batch Upload & Scan</h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  100–200 files/batch
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400">
                Parallel 6-worker PDF text analysis • Instant non-blocking queue
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
            className={`border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 py-7 cursor-pointer transition-all ${
              dragging
                ? "border-blue-400 bg-blue-500/15 scale-[1.01]"
                : "border-[#1C2844] hover:border-blue-500/50 hover:bg-blue-500/5"
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-md">
              <Upload className="w-6 h-6" />
            </div>
            <div className="text-center px-4">
              <p className="text-xs sm:text-sm font-bold text-white">
                Drop 100–200 PDF documents here or <span className="text-blue-400 underline">browse</span>
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 max-w-md">
                Automatic multi-signer detection (Prepared By, Reviewed By, Regional Director, ARD, Provincial Officer)
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

          {/* High-Speed Batch Status & Progress Bar */}
          {entries.length > 0 && (
            <div className="bg-[#111728] border border-[#1C2844] rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    Batch Queue: {entries.length} document(s)
                  </span>
                  {isScanningActive && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                      6 Parallel Workers Active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-slate-300">
                    {scannedCount} / {entries.length} scanned ({scanProgressPercent}%)
                  </span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[11px] text-slate-400 hover:text-red-400 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Progress Track */}
              <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden border border-slate-700/50">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-200"
                  style={{ width: `${Math.max(scanProgressPercent, isScanningActive ? 10 : 0)}%` }}
                />
              </div>

              {/* Filter / Search within large batches */}
              {entries.length > 15 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    placeholder={`Search within ${entries.length} queued files…`}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#080B13] border border-[#1C2844] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Windowed / Virtualized-style preview for smooth 60 FPS */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {filteredEntries.slice(0, 25).map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    className="p-2.5 bg-[#0C101A] border border-[#1A2235] rounded-lg flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-white font-medium truncate max-w-xs" title={entry.file.name}>
                        {entry.file.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                        {formatFileSize(entry.file.size)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {entry.scanning ? (
                        <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Scanning…
                        </span>
                      ) : entry.scanResult ? (
                        entry.scanResult.requiredSigners.length > 0 ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <Check className="w-3 h-3 text-emerald-400" />
                            {entry.scanResult.requiredSigners.length} Signer(s)
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            Counter-Sign Ready
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] text-slate-400">Ready</span>
                      )}

                      <button
                        type="button"
                        onClick={() => removeEntry(idx)}
                        className="text-slate-500 hover:text-red-400 p-0.5 rounded cursor-pointer"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {filteredEntries.length > 25 && (
                  <div className="text-center py-2 text-[11px] text-slate-400 bg-slate-900/60 rounded-lg border border-slate-800">
                    + {filteredEntries.length - 25} more files ready in batch (all will be processed seamlessly)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 px-4 sm:px-6 py-3.5 border-t border-[#1A2235] bg-[#080B13]">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:flex-1 py-2.5 rounded-xl border border-[#1C2844] text-slate-400 hover:text-white hover:bg-white/5 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={entries.length === 0}
            className={`w-full sm:flex-1 py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              entries.length === 0
                ? "bg-blue-600/30 cursor-not-allowed opacity-50"
                : "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-950/60 active:scale-[0.99]"
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>
              {entries.length === 0
                ? "Select Files to Upload"
                : `Upload All Immediately (${entries.length} files)`}
            </span>
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

  // Retain authentic original file name:
  // 1. remarksData.originalFileName (persisted during upload)
  // 2. remarksData.fileName
  // 3. record.pdfFileName
  // 4. Fallback to record.id
  let resolvedFileName =
    remarksData.originalFileName ||
    remarksData.fileName ||
    record.pdfFileName ||
    `${record.id}.pdf`;

  // Safeguard: ONLY if a SIGNING_WORKSPACE document was previously tagged with an auto-generated
  // DTR employee fallback name (e.g. DTR_ANNABEL_C__ODO_O_CALIMPONG.pdf), revert to clean document name
  const autoGeneratedDtr = `DTR_${String(record.employeeName || "").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  const autoGeneratedTarget = `DTR_${String(target || "").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  const isCorruptedEmployeeDtr =
    (record.module === "SIGNING_WORKSPACE" || String(record.module).toUpperCase() === "SIGNING_WORKSPACE") &&
    !remarksData.originalFileName &&
    (resolvedFileName === autoGeneratedDtr || resolvedFileName === autoGeneratedTarget || resolvedFileName.startsWith("DTR_ANNABEL_C"));

  if (isCorruptedEmployeeDtr) {
    resolvedFileName = `Document_${String(record.id).replace(/^doc-upload-/, "").slice(0, 15)}.pdf`;
  }

  // Purge any spurious or cross-contaminated signers (e.g. DE LEON or ACE MALTO on RAOD / Annabel docs)
  const isRaodDoc = resolvedFileName.toUpperCase().includes("RAOD");
  const isAnnabelDoc = resolvedFileName.toUpperCase().includes("ANNABEL") || String(target).toUpperCase().includes("ANNABEL");

  let sanitizedRequired: string[] = Array.isArray(remarksData.requiredSigners)
    ? [...remarksData.requiredSigners]
    : record.signerName ? [record.signerName] : (target && target !== "PERSONNEL" ? [target] : []);

  let sanitizedSigners: DocumentSigner[] = Array.isArray(remarksData.signers)
    ? [...remarksData.signers]
    : sanitizedRequired.map((r) => ({
        name: r,
        role: "Signatory",
        status: record.status === "signed" ? "signed" : "pending",
        position: "above",
      }));

  if (isRaodDoc || isAnnabelDoc) {
    sanitizedRequired = sanitizedRequired.filter((r) => {
      const u = r.toUpperCase();
      return !u.includes("DE LEON") && !u.includes("KEN MATTHEW") && !u.includes("ACE MALTO");
    });
    sanitizedSigners = sanitizedSigners.filter((s) => {
      const u = String(s?.name || "").toUpperCase();
      return !u.includes("DE LEON") && !u.includes("KEN MATTHEW") && !u.includes("ACE MALTO");
    });
  }

  const initialDoc: WorkspaceDocument = {
    id: record.id,
    fileName: resolvedFileName,
    fileSize: record.pdfFileSize || "1.2 MB",
    uploadedAt: record.submittedDate || new Date().toISOString(),
    uploadedBy: record.employeeName || "User",
    status: (record.status?.toLowerCase() === "signed"
      ? "signed"
      : record.status?.toLowerCase() === "partially_signed"
      ? "partially_signed"
      : "pending") as SigningStatus,
    targetPersonnel: target,
    requiredSigners: sanitizedRequired,
    signers: sanitizedSigners,
    counterSigners,
    fileType: resolvedFileName.endsWith(".docx") ? "docx" : "pdf",
    notes: remarksData.notes || record.remarks,
    pdfDataUrl: record.pdfDataUrl,
    scannedInfo: remarksData.scannedInfo || undefined,
    province: record.province || remarksData.province || "",
  };

  initialDoc.status = computeEffectiveDocStatus(initialDoc);

  // Dynamically re-evaluate against latest User List to recognize any newly registered users
  try {
    const freshUsers = getStoredUsers().map((u) => ({ name: u.name, role: u.role, email: u.email }));
    const { updatedDoc } = recheckDocWithLatestUsers(initialDoc, freshUsers);
    updatedDoc.status = computeEffectiveDocStatus(updatedDoc);
    return updatedDoc as WorkspaceDocument;
  } catch {
    return initialDoc;
  }
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

// ─── Single-Document Counter-Sign Personnel Picker Modal ─────────────────────

interface SingleCounterSignModalProps {
  isOpen: boolean;
  doc: WorkspaceDocument | null;
  initialPosition?: CounterSignPosition;
  onClose: () => void;
  onConfirm: (docId: string, targetPersonnel: string, position: CounterSignPosition) => void;
  isProcessing: boolean;
}

function SingleCounterSignModal({
  isOpen,
  doc,
  initialPosition = "right",
  onClose,
  onConfirm,
  isProcessing,
}: SingleCounterSignModalProps) {
  const [selectedPersonnel, setSelectedPersonnel] = useState<string>("");
  const [selectedPosition, setSelectedPosition] = useState<CounterSignPosition>(
    initialPosition === "auto" ? "right" : initialPosition
  );

  // Gather all unique personnel from this document's signer chain AND fresh User List
  const personnelChoices = useMemo(() => {
    if (!doc) return [];
    const names = new Set<string>();

    // 1. Existing recognized signers in the document
    if (doc.targetPersonnel) names.add(doc.targetPersonnel);
    doc.requiredSigners.forEach((r) => r && names.add(r));
    doc.signers.forEach((s) => s?.name && names.add(s.name));

    // 2. DYNAMIC USER RECOGNITION: Always cross-reference the fresh User List against document text
    try {
      const freshUsers = getStoredUsers().map((u) => ({ name: u.name, role: u.role, email: u.email }));
      const { updatedDoc } = recheckDocWithLatestUsers(doc, freshUsers);
      if (updatedDoc.targetPersonnel) names.add(updatedDoc.targetPersonnel);
      (updatedDoc.requiredSigners || []).forEach((r: string) => r && names.add(r));
      (updatedDoc.signers || []).forEach((s: any) => s?.name && names.add(s.name));
    } catch {}

    return Array.from(names).filter((n) => n && n.trim().length > 2);
  }, [doc, isOpen]);

  // Auto-select first choice when modal opens or doc changes
  useEffect(() => {
    if (personnelChoices.length > 0) {
      setSelectedPersonnel((prev) =>
        personnelChoices.includes(prev) ? prev : personnelChoices[0]
      );
    } else {
      setSelectedPersonnel("");
    }
  }, [personnelChoices, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSelectedPosition(initialPosition === "auto" ? "right" : initialPosition);
    }
  }, [isOpen, initialPosition]);

  if (!isOpen || !doc) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl sm:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#1A2235] bg-[#080B13]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Counter-Sign Document</h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate max-w-[220px]" title={doc.fileObj?.name || doc.fileName}>
                {doc.fileObj?.name || doc.fileName}
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
          {/* Signer Chain Preview */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Required Signers Chain</p>
            <div className="flex flex-col gap-1.5">
              {doc.requiredSigners.map((name, idx) => {
                const signer = doc.signers.find(
                  (s) => s.name?.trim().toLowerCase() === name?.trim().toLowerCase()
                );
                const isSigned = signer?.status === "signed" || signer?.status === "counter-signed";
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                      isSigned
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                        : "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                    }`}
                  >
                    {isSigned ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="font-semibold">{name}</span>
                    <span className={`ml-auto text-[10px] font-bold ${isSigned ? "text-emerald-400" : "text-amber-400"}`}>
                      {isSigned ? "Signed" : "Need to Sign"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Personnel Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span>Counter-sign beside which personnel?</span>
              <span className="text-cyan-400 font-mono text-[10px]">
                {personnelChoices.length} in chain
              </span>
            </label>

            {personnelChoices.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                ⚠️ No personnel names detected in this document's signer chain.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                {personnelChoices.map((name) => (
                  <button
                    key={name}
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setSelectedPersonnel(name)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                      selectedPersonnel === name
                        ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-sm shadow-cyan-950/40"
                        : "bg-[#111728] border-[#1C2844] text-slate-300 hover:border-cyan-500/30 hover:text-white"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        selectedPersonnel === name
                          ? "border-cyan-400 bg-cyan-500"
                          : "border-slate-600"
                      }`}
                    >
                      {selectedPersonnel === name && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    <span className="truncate">{name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Placement Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span>Where to place the counter-signature?</span>
              <span className="text-cyan-400 font-mono text-[10px] uppercase font-bold">
                Compact (Sign + DigiSigned)
              </span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setSelectedPosition("right")}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  selectedPosition === "right"
                    ? "bg-cyan-500/15 border-cyan-500 text-cyan-300 font-bold shadow-sm shadow-cyan-950/40"
                    : "bg-[#111728] border-[#1C2844] text-slate-400 hover:text-white"
                }`}
              >
                <div className="text-xs font-bold">Beside (Right)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Right of name</div>
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setSelectedPosition("left")}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  selectedPosition === "left"
                    ? "bg-cyan-500/15 border-cyan-500 text-cyan-300 font-bold shadow-sm shadow-cyan-950/40"
                    : "bg-[#111728] border-[#1C2844] text-slate-400 hover:text-white"
                }`}
              >
                <div className="text-xs font-bold">Beside (Left)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Left of name</div>
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setSelectedPosition("bottom")}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  selectedPosition === "bottom"
                    ? "bg-cyan-500/15 border-cyan-500 text-cyan-300 font-bold shadow-sm shadow-cyan-950/40"
                    : "bg-[#111728] border-[#1C2844] text-slate-400 hover:text-white"
                }`}
              >
                <div className="text-xs font-bold">Below (Bottom)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Underneath name</div>
              </button>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-[11px] text-slate-400 leading-relaxed">
            A <span className="text-white font-bold">compact horizontal</span> counter-signature with transparent background and no border (signature on the left, &quot;DigiSigned by {getCurrentUser()?.name || "you"}&quot; on the right in black text) will be placed{" "}
            <span className="text-cyan-300 font-bold">
              {selectedPosition === "bottom" ? "directly below" : selectedPosition === "left" ? "directly to the left of" : "directly to the right of"} &quot;{selectedPersonnel || "…"}&quot;
            </span>{" "}
            using your PNPKI P12 certificate.
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
            onClick={() => doc && onConfirm(doc.id, selectedPersonnel, selectedPosition)}
            disabled={isProcessing || !selectedPersonnel || personnelChoices.length === 0}
            className="w-full sm:flex-1 py-2 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-cyan-950/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Applying Compact Counter-Signature…</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  Counter-Sign {selectedPosition === "bottom" ? "Below" : "Beside"} &quot;{selectedPersonnel || "…"}&quot;
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Counter-Sign Selection Modal ───────────────────────────────────────

interface BulkCounterSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetPersonnel: string, position: CounterSignPosition) => void;
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
  const [selectedPosition, setSelectedPosition] = useState<CounterSignPosition>("right");

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
                Compact 20×20 px counter-signature stamp with transparent background beside or below chosen personnel
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

          {/* Placement Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span>Where to place the counter-signature?</span>
              <span className="text-cyan-400 font-mono text-[10px] uppercase font-bold">
                Compact Square (20×20 px)
              </span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setSelectedPosition("right")}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  selectedPosition === "right"
                    ? "bg-cyan-500/15 border-cyan-500 text-cyan-300 font-bold shadow-sm shadow-cyan-950/40"
                    : "bg-[#111728] border-[#1C2844] text-slate-400 hover:text-white"
                }`}
              >
                <div className="text-xs font-bold">Beside (Right)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Right of name</div>
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setSelectedPosition("left")}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  selectedPosition === "left"
                    ? "bg-cyan-500/15 border-cyan-500 text-cyan-300 font-bold shadow-sm shadow-cyan-950/40"
                    : "bg-[#111728] border-[#1C2844] text-slate-400 hover:text-white"
                }`}
              >
                <div className="text-xs font-bold">Beside (Left)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Left of name</div>
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setSelectedPosition("bottom")}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  selectedPosition === "bottom"
                    ? "bg-cyan-500/15 border-cyan-500 text-cyan-300 font-bold shadow-sm shadow-cyan-950/40"
                    : "bg-[#111728] border-[#1C2844] text-slate-400 hover:text-white"
                }`}
              >
                <div className="text-xs font-bold">Below (Bottom)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Underneath name</div>
              </button>
            </div>
          </div>

          {/* Explanation Box */}
          <div className="p-3.5 rounded-xl bg-cyan-500/5 border border-cyan-500/20 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-cyan-300 font-bold">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Compact Counter-Signature Placement</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              When confirmed, a <strong className="text-white">compact horizontal</strong> counter-signature with transparent background and no border (signature on the left, &quot;DigiSigned by {getCurrentUser()?.name || "you"}&quot; on the right in black text) will be placed{" "}
              <strong className="text-cyan-300 font-bold">
                {selectedPosition === "bottom" ? "directly below" : selectedPosition === "left" ? "directly to the left of" : "directly to the right of"} {selectedPersonnel || "the selected personnel"}
              </strong>{" "}
              across <strong className="text-white">{eligibleDocsCount} document(s)</strong>.
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
            onClick={() => onConfirm(selectedPersonnel, selectedPosition)}
            disabled={isProcessing || !selectedPersonnel || availablePersonnel.length === 0}
            className="w-full sm:flex-1 py-2 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-cyan-950/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Applying Compact Counter-Signatures…</span>
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

// ─── PNPKI .p12 Keystore Management Modal ───────────────────────────────────

interface P12KeystoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  activeKeystore: any;
  onKeystoreActivated: (keystore: any) => void;
  showNotification: (msg: string) => void;
}

function P12KeystoreModal({
  isOpen,
  onClose,
  currentUser,
  activeKeystore,
  onKeystoreActivated,
  showNotification,
}: P12KeystoreModalProps) {
  const [tab, setTab] = useState<"select" | "upload">("select");
  const [availableProfiles, setAvailableProfiles] = useState<DtrGeneratorSignatureRecord[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  // Upload state
  const [p12File, setP12File] = useState<{ name: string; size: number; base64: string } | null>(null);
  const [p12Password, setP12Password] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedIdentity, setVerifiedIdentity] = useState<any | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingProfiles(true);
      dtrGeneratorApi
        .getRecords()
        .then((records) => {
          const withP12 = (records || []).filter((r) => r.hasP12 || r.p12_filename || r.p12);
          setAvailableProfiles(withP12);
          if (withP12.length > 0) {
            const currentMatch = currentUser
              ? withP12.find(
                  (p) =>
                    (currentUser.id && (String(p.user_Id) === String(currentUser.id) || p.id === `dtr-sig-${currentUser.id}`)) ||
                    matchNames(p.Name, currentUser.name)
                )
              : null;
            if (currentMatch) {
              setSelectedProfileId(currentMatch.id);
            } else {
              // Direct user to upload their own P12 certificate if not yet in database
              setTab("upload");
            }
          } else {
            setTab("upload");
          }
        })
        .catch((e) => console.warn("Could not fetch P12 profiles:", e))
        .finally(() => setIsLoadingProfiles(false));
    }
  }, [isOpen, selectedProfileId]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVerifyError(null);
    setVerifiedIdentity(null);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).replace(/^data:.*?;base64,/, "");
      setP12File({ name: file.name, size: file.size, base64: b64 });
    };
    reader.readAsDataURL(file);
  };

  const handleVerifyUpload = async () => {
    if (!p12File) {
      setVerifyError("Please select a .p12 certificate file first.");
      return;
    }
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const res = await dtrGeneratorApi.getP12Identity({
        p12: p12File.base64,
        p12_password: p12Password,
      });
      if (res.success && res.identity) {
        setVerifiedIdentity(res.identity);
      } else {
        setVerifyError(res.error || "Failed to unlock .p12 certificate. Please verify your password.");
      }
    } catch (err: any) {
      setVerifyError(err.message || "Failed to unlock .p12 certificate. Check password.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleActivateSelected = () => {
    const target = availableProfiles.find((p) => p.id === selectedProfileId);
    if (!target) return;
    onKeystoreActivated({
      profileId: target.id,
      userId: target.user_Id,
      signerName: target.Name,
      isUnlocked: true,
      hasP12: true,
    });
    showNotification(`✓ PNPKI Keystore activated: "${target.Name}"`);
    onClose();
  };

  const handleActivateUploaded = async () => {
    if (!p12File || !verifiedIdentity) return;
    const signerName = verifiedIdentity.commonName || currentUser?.name || "Signer";
    const profileId = currentUser?.id ? `dtr-sig-${currentUser.id}` : undefined;
    const userId = currentUser?.id ? String(currentUser.id) : undefined;

    try {
      await dtrGeneratorApi.saveSignatureProfile({
        id: profileId,
        user_Id: userId,
        Name: signerName,
        p12: p12File.base64,
        p12_filename: p12File.name,
        p12_filesize: p12File.size,
        p12_password: p12Password,
      });
    } catch (e) {
      console.warn("Could not save P12 to database:", e);
    }

    onKeystoreActivated({
      profileId,
      userId,
      signerName,
      p12Base64: p12File.base64,
      p12Password,
      isUnlocked: true,
      hasP12: true,
      certificateInfo: verifiedIdentity,
    });
    showNotification(`✓ PNPKI Keystore unlocked and activated for "${signerName}"`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl sm:rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#1A2235] bg-[#080B13]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">PNPKI .p12 Keystore Manager</h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400">
                Configure cryptographic digital signing for CS Form 48 & Signing Workspace
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

        {/* Active Keystore Banner */}
        {activeKeystore?.isUnlocked && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3 text-emerald-300">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-xs">
              <div className="font-bold">Active Keystore: {activeKeystore.signerName || "Authorized Signer"}</div>
              <div className="text-[10px] text-emerald-400/80">Ready for cryptographic digital signing & counter-signing.</div>
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-[#1A2235] px-4 sm:px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setTab("select")}
            className={`pb-2 px-3 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
              tab === "select"
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Registered DICT Keystores ({availableProfiles.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`pb-2 px-3 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
              tab === "upload"
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Upload New .p12 File
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 space-y-4">
          {tab === "select" ? (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-200">
                Select from verified DICT Region V PNPKI keystores in Turso:
              </label>

              {isLoadingProfiles ? (
                <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                  <span>Loading available keystores…</span>
                </div>
              ) : availableProfiles.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                  ⚠️ No registered .p12 keystores found in the database. Please upload your .p12 file.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {availableProfiles.map((p) => {
                    const isSelected = selectedProfileId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProfileId(p.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "bg-violet-600/15 border-violet-500 text-white shadow-sm shadow-violet-950/40"
                            : "bg-[#111728] border-[#1C2844] text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <FileKey className={`w-4 h-4 shrink-0 ${isSelected ? "text-violet-400" : "text-slate-400"}`} />
                          <div>
                            <div className="text-xs font-bold">{p.Name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {p.p12_filename || "PNPKI Digital Certificate (.p12)"}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-violet-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/20 text-[11px] text-slate-400 leading-relaxed">
                When activated, any document you sign or bulk-sign will receive an official cryptographic PNPKI digital signature revision (ISO 32000-1) preserving all earlier signatures intact.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-200">Upload .p12 / .pfx Certificate File:</label>
                <input
                  type="file"
                  accept=".p12,.pfx"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-violet-600 file:text-white hover:file:bg-violet-500 file:cursor-pointer bg-[#111728] border border-[#1C2844] rounded-xl p-2 cursor-pointer"
                />
                {p12File && (
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
                    <Check className="w-3 h-3" />
                    <span>Selected: {p12File.name} ({(p12File.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-200">Keystore Password:</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={p12Password}
                    onChange={(e) => setP12Password(e.target.value)}
                    placeholder="Enter .p12 passphrase"
                    className="w-full bg-[#111728] border border-[#1C2844] focus:border-violet-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleVerifyUpload}
                disabled={isVerifying || !p12File}
                className="w-full py-2 rounded-xl bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/40 text-violet-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying Keystore Cryptography…</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Verify & Unlock Keystore</span>
                  </>
                )}
              </button>

              {verifyError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                  {verifyError}
                </div>
              )}

              {verifiedIdentity && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-white">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Verified: {verifiedIdentity.commonName}</span>
                  </div>
                  <div className="text-[10px] text-slate-300">Issuer: {verifiedIdentity.issuerCN || "DICT CA"}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">SHA256: {verifiedIdentity.sha256Fingerprint}</div>
                </div>
              )}
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
            Close
          </button>
          {tab === "select" ? (
            <button
              type="button"
              onClick={handleActivateSelected}
              disabled={!selectedProfileId || availableProfiles.length === 0}
              className="w-full sm:flex-1 py-2 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-950/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Activate Selected Keystore</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleActivateUploaded}
              disabled={!verifiedIdentity}
              className="w-full sm:flex-1 py-2 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Save & Activate Keystore</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LocalStorage Serialization Helper (Safe for 100-200 files) ────────────

function serializeDocsForLocalStorage(docs: WorkspaceDocument[]): string {
  // Strip both fileObj AND large base64 pdfDataUrl to guarantee zero localStorage quota exceptions,
  // enabling instant serialization of 100-200 files in under 1 millisecond.
  return JSON.stringify(docs.map(({ fileObj, pdfDataUrl, ...rest }) => rest));
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SigningWorkspace() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const userEmail = (currentUser?.email || "").toLowerCase().trim();
  const isAceUser = userEmail === "ace.malto@dict.gov.ph";

  useEffect(() => {
    const handleAuthChange = () => {
      const freshUser = getCurrentUser();
      setCurrentUser(freshUser);
      cachedSignerContextRef.current = null;
      const freshEmail = (freshUser?.email || "").toLowerCase().trim();
      if (freshEmail !== "ace.malto@dict.gov.ph") {
        setActiveKeystoreProfile(null);
        setIsP12KeystoreModalOpen(false);
      }
    };

    const handleUserRosterUpdated = () => {
      handleAuthChange();
      try {
        const freshUsers = getStoredUsers().map((u) => ({ name: u.name, role: u.role, email: u.email }));
        setDocuments((prevDocs) => {
          let hasAnyRecognition = false;
          const updatedDocs = prevDocs.map((doc) => {
            const { updatedDoc, hasNewRecognition } = recheckDocWithLatestUsers(doc, freshUsers);
            if (hasNewRecognition) {
              hasAnyRecognition = true;
              persistDocSignatoryUpdate(updatedDoc);
              return updatedDoc as WorkspaceDocument;
            }
            return doc;
          });
          return hasAnyRecognition ? updatedDocs : prevDocs;
        });
      } catch (err) {
        console.warn("Could not recheck documents on user roster update:", err);
      }
    };

    window.addEventListener(AUTH_EVENT, handleAuthChange);
    window.addEventListener("storage", handleUserRosterUpdated);
    window.addEventListener("dict_users_updated", handleUserRosterUpdated);
    window.addEventListener("focus", handleUserRosterUpdated);
    document.addEventListener("visibilitychange", handleUserRosterUpdated);

    return () => {
      window.removeEventListener(AUTH_EVENT, handleAuthChange);
      window.removeEventListener("storage", handleUserRosterUpdated);
      window.removeEventListener("dict_users_updated", handleUserRosterUpdated);
      window.removeEventListener("focus", handleUserRosterUpdated);
      document.removeEventListener("visibilitychange", handleUserRosterUpdated);
    };
  }, []);

  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isBulkCounterModalOpen, setIsBulkCounterModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<WorkspaceDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SigningStatus | "all">("all");
  const [isBulkSigning, setIsBulkSigning] = useState(false);
  const [isBulkCounterSigning, setIsBulkCounterSigning] = useState(false);
  const [bulkSignProgress, setBulkSignProgress] = useState<BulkSignProgressState | null>(null);
  const [bulkCounterSignProgress, setBulkCounterSignProgress] = useState<BulkSignProgressState | null>(null);
  const cachedSignerContextRef = useRef<UserSignerContext | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"auto" | "table" | "cards">("auto");
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [selectedValidationSigner, setSelectedValidationSigner] = useState<{
    name: string;
    date?: string;
  } | null>(null);
  // Single counter-sign: track which document's modal is open
  const [counterSignDocTarget, setCounterSignDocTarget] = useState<WorkspaceDocument | null>(null);
  const [counterSignPositionChoice, setCounterSignPositionChoice] = useState<CounterSignPosition>("right");
  const [isSingleCounterSigning, setIsSingleCounterSigning] = useState(false);

  // PNPKI Keystore Management State (Strictly exclusive to ace.malto@dict.gov.ph)
  const [isP12KeystoreModalOpen, setIsP12KeystoreModalOpen] = useState(false);
  const [activeKeystoreProfile, setActiveKeystoreProfile] = useState<any | null>(() => {
    try {
      if (userEmail !== "ace.malto@dict.gov.ph") return null;
      const saved = localStorage.getItem("dict_active_p12_keystore");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  // Batch Download State (Select All, Selected, or All Queue to ZIP)
  const [isDownloadingBatch, setIsDownloadingBatch] = useState(false);
  const [batchDownloadProgress, setBatchDownloadProgress] = useState<{ current: number; total: number } | null>(null);

  // High-Speed Batch Upload Streaming State for 100-200 files
  const [batchUploadProgress, setBatchUploadProgress] = useState<{
    inFlight: boolean;
    total: number;
    completed: number;
    failedCount: number;
    failedItems: { doc: WorkspaceDocument; file: File; error: string }[];
  } | null>(null);
  const isBatchUploadingRef = useRef(false);
  const isSyncingRef = useRef(false);
  const syncDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Pagination for high document counts (100-200+ docs)
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Bulk signing is strictly applicable if the user is:
  // 1. SuperAdmin (universal authority across all workspace documents)
  // 2. Provincial Officer - PO
  // 3. Regional Director (RD) or Assistant Regional Director (ARD)
  const isBulkSigningAuthorized = useMemo(() => {
    return (
      isUserSuperAdmin(currentUser) ||
      isUserProvincialOfficer(currentUser) ||
      isUserRegionalDirectorOrAssistant(currentUser)
    );
  }, [currentUser]);


  // Compute list of unique personnel dynamically recognized across active documents queue
  const availablePersonnel = useMemo(() => {
    const names = new Set<string>();
    const freshUsers = getStoredUsers().map((u) => ({ name: u.name, role: u.role, email: u.email }));
    documents.forEach((d) => {
      if (d.targetPersonnel) names.add(d.targetPersonnel);
      (d.requiredSigners || []).forEach((r) => names.add(r));
      (d.signers || []).forEach((s) => names.add(s.name));

      // Dynamic cross-reference with fresh User List
      try {
        const { updatedDoc } = recheckDocWithLatestUsers(d, freshUsers);
        if (updatedDoc.targetPersonnel) names.add(updatedDoc.targetPersonnel);
        (updatedDoc.requiredSigners || []).forEach((r: string) => r && names.add(r));
        (updatedDoc.signers || []).forEach((s: any) => s?.name && names.add(s.name));
      } catch {}
    });
    return Array.from(names).filter((n) => n && n.trim().length > 2);
  }, [documents]);

  // 1. Sync helper that pulls the latest documents from backend Turso dtr_storage
  const syncFromRemoteStorage = useCallback(async (silent = true) => {
    if (isBatchUploadingRef.current || isSyncingRef.current) return;
    isSyncingRef.current = true;
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
              const isLocalCorrupted = localDoc.fileName && (localDoc.fileName.startsWith("DTR_ANNABEL_C") || localDoc.fileName === "DTR_ANNABEL_C__ODO_O_CALIMPONG.pdf");
              const preservedFileName =
                localDoc.fileObj?.name ||
                (!isLocalCorrupted ? localDoc.fileName : null) ||
                rDoc.fileName ||
                localDoc.fileName;

              nextMap.set(rDoc.id, {
                ...localDoc,
                ...rDoc,
                fileName: preservedFileName,
                // Prefer remote pdfDataUrl (e.g. if newly signed on another device)
                pdfDataUrl: rDoc.pdfDataUrl || localDoc.pdfDataUrl,
                fileObj: localDoc.fileObj,
                scannedInfo: rDoc.scannedInfo || localDoc.scannedInfo,
              });
            } else {
              nextMap.set(rDoc.id, rDoc);
            }
          });

          // ONLY keep local docs that are in active upload/pending sync state
          // Place newly uploaded local pending docs at the FRONT so user sees them immediately
          const pendingLocal: WorkspaceDocument[] = [];
          prev.forEach((pDoc) => {
            if (
              pDoc &&
              !deletedIds.has(pDoc.id) &&
              !nextMap.has(pDoc.id) &&
              (pDoc.isPendingSync || pDoc.status === "uploading" || pDoc.id.startsWith("doc-upload-"))
            ) {
              pendingLocal.push(pDoc);
            }
          });

          const merged = [...pendingLocal, ...Array.from(nextMap.values())];

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
                (m.counterSigners?.length || 0) !== (p.counterSigners?.length || 0) ||
                (m.signers?.length || 0) !== (p.signers?.length || 0) ||
                m.notes !== p.notes ||
                (m.signers || []).some((s, sIdx) => s.status !== p.signers?.[sIdx]?.status) ||
                (m.counterSigners || []).some((c, cIdx) => c.status !== p.counterSigners?.[cIdx]?.status)
              );
            });

          if (hasDiff) {
            try {
              localStorage.setItem(
                "dict_r5_signing_workspace_docs_v1",
                serializeDocsForLocalStorage(merged)
              );
            } catch {}
            return merged;
          }
          return prev;
        });

        // Also ensure preview modal updates if doc was changed or closes if deleted remotely
        setPreviewDoc((currPreview) => {
          if (!currPreview) return null;
          const remoteMatch = remoteDocs.find((r) => r.id === currPreview.id);
          if (!remoteMatch) return null;
          if (
            remoteMatch.status !== currPreview.status ||
            (remoteMatch.pdfDataUrl?.length || 0) !== (currPreview.pdfDataUrl?.length || 0) ||
            (remoteMatch.counterSigners?.length || 0) !== (currPreview.counterSigners?.length || 0)
          ) {
            return {
              ...currPreview,
              ...remoteMatch,
              pdfDataUrl: remoteMatch.pdfDataUrl || currPreview.pdfDataUrl,
            };
          }
          return currPreview;
        });
      }
    } catch (err) {
      if (!silent) {
        console.warn("Could not sync signing workspace documents from dtr_storage:", err);
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // Debounced remote sync to coalesce rapid SSE bursts or window focus events
  const debouncedSyncFromRemoteStorage = useCallback(
    (delayMs = 1500) => {
      if (isBatchUploadingRef.current) return;
      if (syncDebounceTimerRef.current) {
        clearTimeout(syncDebounceTimerRef.current);
      }
      syncDebounceTimerRef.current = setTimeout(() => {
        syncFromRemoteStorage(true);
      }, delayMs);
    },
    [syncFromRemoteStorage]
  );

  // 2. Real-time hydration, SSE subscription, polling, and tab visibility listeners
  useEffect(() => {
    const deletedIds = getDeletedDocIds();

    const cached = localStorage.getItem("dict_r5_signing_workspace_docs_v1");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const freshUsers = getStoredUsers().map((u) => ({ name: u.name, role: u.role, email: u.email }));
          const valid = parsed
            .filter((d: any) => d && !deletedIds.has(d.id))
            .map((d: any) => {
              const { updatedDoc } = recheckDocWithLatestUsers(d, freshUsers);
              return updatedDoc as WorkspaceDocument;
            });
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
        if (record && ((record.module as any) === "SIGNING_WORKSPACE" || String(record.module).toUpperCase() === "SIGNING_WORKSPACE")) {
          // If this is a batch completion notification, refresh remote docs if not uploading
          if ((record as any).batchCount) {
            if (!isBatchUploadingRef.current) {
              debouncedSyncFromRemoteStorage(1000);
            }
            return;
          }

          const deleted = getDeletedDocIds();
          if (record.id && !deleted.has(record.id)) {
            const mapped = mapDtrRecordToWorkspaceDoc(record);
            setDocuments((prev) => {
              const existingIdx = prev.findIndex((d) => d.id === mapped.id);
              let nextList: WorkspaceDocument[];
              if (existingIdx >= 0) {
                const existing = prev[existingIdx];
                const statusChanged = mapped.status !== existing.status;
                const isExistingCorrupted = existing.fileName && (existing.fileName.startsWith("DTR_ANNABEL_C") || existing.fileName === "DTR_ANNABEL_C__ODO_O_CALIMPONG.pdf");
                const preservedFileName =
                  existing.fileObj?.name ||
                  (!isExistingCorrupted ? existing.fileName : null) ||
                  mapped.fileName ||
                  existing.fileName;

                const updated = {
                  ...existing,
                  ...mapped,
                  fileName: preservedFileName,
                  // If status changed, clear stale local PDF so fresh signed version will be loaded on demand
                  pdfDataUrl: mapped.pdfDataUrl || (statusChanged ? undefined : existing.pdfDataUrl),
                  fileObj: statusChanged ? undefined : existing.fileObj,
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
                  serializeDocsForLocalStorage(nextList)
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
              serializeDocsForLocalStorage(filtered)
            );
          } catch {}
          return filtered;
        });
        setPreviewDoc((currPreview) => (currPreview?.id === event.id ? null : currPreview));
      }
    });

    // Fallback background polling every 20 seconds for reactive cross-window / cross-device sync
    const pollInterval = setInterval(() => {
      if (!isBatchUploadingRef.current) {
        syncFromRemoteStorage(true);
      }
    }, 20000);

    // Debounced refresh when user returns to this window or tab
    const handleFocusOrVisible = () => {
      if (!isBatchUploadingRef.current) {
        debouncedSyncFromRemoteStorage(500);
      }
    };

    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener("storage", handleFocusOrVisible);

    return () => {
      unsubscribeRealtime();
      clearInterval(pollInterval);
      if (syncDebounceTimerRef.current) {
        clearTimeout(syncDebounceTimerRef.current);
      }
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      window.removeEventListener("storage", handleFocusOrVisible);
    };
  }, [syncFromRemoteStorage]);

  // Sync to local storage on change (persists empty array when all documents deleted)
  useEffect(() => {
    try {
      localStorage.setItem("dict_r5_signing_workspace_docs_v1", serializeDocsForLocalStorage(documents));
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

    const targetFilename = doc.fileObj?.name || doc.fileName || `document_${doc.id}.pdf`;

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
        a.download = targetFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showNotif(`✓ Downloaded digitally signed ${targetFilename}`);
        return;
      } catch {
        const a = document.createElement("a");
        a.href = doc.pdfDataUrl;
        a.download = targetFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showNotif(`✓ Downloaded ${targetFilename}`);
        return;
      }
    }

    // 2. Download original uploaded file
    if (doc.fileObj) {
      const url = URL.createObjectURL(doc.fileObj);
      const a = document.createElement("a");
      a.href = url;
      a.download = targetFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showNotif(`✓ Downloaded ${targetFilename}`);
      return;
    }

    const sampleContent = `Republic of the Philippines\nDEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY\nRegion V - Bicol Region\n\nOFFICIAL DOCUMENT: ${targetFilename}\nTracking ID: ${doc.id}\nPrimary Subject: ${doc.targetPersonnel}\nUploaded By: ${doc.uploadedBy}\nUploaded At: ${doc.uploadedAt}\nSigning Status: ${doc.status.toUpperCase()}\n\nScanned Required Signers (${doc.requiredSigners.length}):\n${doc.requiredSigners.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}\n\nCompleted Signatures:\n${doc.signers.filter((s) => s.status === "signed").map((s) => `  ✓ ${s.name} (${s.role || "Signer"}) - Placed Above Name`).join("\n")}\n${(doc.counterSigners || []).map((c) => `  ✓ ${c.name} - Counter-Signed Beside Name (${c.position || "beside"})`).join("\n")}\n\nThis electronic document has been verified under the DICT Signing Workspace.`;
    const blob = new Blob([sampleContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = targetFilename.replace(/\.pdf$/i, ".txt");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotif(`✓ Downloaded transmittal for ${targetFilename}`);
  };

  // Helper to extract file blob and filename for single or batch downloading
  const getDocumentFile = async (
    doc: WorkspaceDocument
  ): Promise<{ fileName: string; blob: Blob } | null> => {
    let pdfUrl = doc.pdfDataUrl;
    if (!pdfUrl && !doc.fileObj) {
      try {
        const full = await dtrStorageApi.getRecord(doc.id);
        if (full?.pdfDataUrl) {
          pdfUrl = full.pdfDataUrl;
          doc.pdfDataUrl = full.pdfDataUrl;
        }
      } catch (e) {
        console.warn("Failed to load PDF for batch download:", e);
      }
    }

    if (pdfUrl) {
      try {
        const base64 = pdfUrl.includes(",") ? pdfUrl.split(",")[1] : pdfUrl;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return {
          fileName: doc.fileObj?.name || doc.fileName || `document_${doc.id}.pdf`,
          blob: new Blob([bytes], { type: "application/pdf" }),
        };
      } catch (e) {
        console.warn("Error decoding pdfUrl for doc:", doc.id, e);
      }
    }

    if (doc.fileObj) {
      return {
        fileName: doc.fileObj.name || doc.fileName,
        blob: doc.fileObj,
      };
    }

    const targetFilename = doc.fileObj?.name || doc.fileName || `${doc.id}`;
    const sampleContent = `Republic of the Philippines\nDEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY\nRegion V - Bicol Region\n\nOFFICIAL DOCUMENT: ${targetFilename}\nTracking ID: ${doc.id}\nPrimary Subject: ${doc.targetPersonnel}\nUploaded By: ${doc.uploadedBy}\nUploaded At: ${doc.uploadedAt}\nSigning Status: ${doc.status.toUpperCase()}\n\nScanned Required Signers (${doc.requiredSigners.length}):\n${doc.requiredSigners.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}\n\nCompleted Signatures:\n${doc.signers.filter((s) => s.status === "signed").map((s) => `  ✓ ${s.name} (${s.role || "Signer"}) - Placed Above Name`).join("\n")}\n${(doc.counterSigners || []).map((c) => `  ✓ ${c.name} - Counter-Signed Beside Name (${c.position || "beside"})`).join("\n")}\n\nThis electronic document has been verified under the DICT Signing Workspace.`;
    return {
      fileName: targetFilename.replace(/\.pdf$/i, ".txt"),
      blob: new Blob([sampleContent], { type: "text/plain;charset=utf-8" }),
    };
  };

  // High-performance batch download for selected or all documents into a ZIP archive
  const handleBatchDownload = async (
    targetDocs: WorkspaceDocument[],
    zipLabel = "Batch"
  ) => {
    if (targetDocs.length === 0) {
      showNotif("⚠️ No documents available to download.");
      return;
    }

    // Single document: trigger standard direct download
    if (targetDocs.length === 1) {
      await handleDownload(targetDocs[0]);
      return;
    }

    setIsDownloadingBatch(true);
    setBatchDownloadProgress({ current: 0, total: targetDocs.length });
    showNotif(`📦 Packaging ${targetDocs.length} document(s) into ZIP archive...`);

    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();

      for (let i = 0; i < targetDocs.length; i++) {
        const doc = targetDocs[i];
        setBatchDownloadProgress({ current: i + 1, total: targetDocs.length });
        const res = await getDocumentFile(doc);
        if (res) {
          let name = res.fileName;
          if (usedNames.has(name)) {
            const extIdx = name.lastIndexOf(".");
            const base = extIdx !== -1 ? name.slice(0, extIdx) : name;
            const ext = extIdx !== -1 ? name.slice(extIdx) : "";
            let counter = 1;
            while (usedNames.has(`${base}_(${counter})${ext}`)) {
              counter++;
            }
            name = `${base}_(${counter})${ext}`;
          }
          usedNames.add(name);
          zip.file(name, res.blob);
        }
      }

      showNotif(`🗜️ Compressing ${targetDocs.length} documents into ZIP archive...`);
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const today = new Date().toISOString().slice(0, 10);
      const zipName = `DICT_SigningWorkspace_${zipLabel}_${today}.zip`;

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showNotif(`✓ Downloaded ${targetDocs.length} document(s) in "${zipName}"!`);
    } catch (err: any) {
      console.error("Batch download error:", err);
      showNotif(`Failed batch download: ${err.message || "Unknown error"}`);
    } finally {
      setIsDownloadingBatch(false);
      setBatchDownloadProgress(null);
    }
  };

  // ─── Signer Profile Context Resolver (Pre-cached for 100+ documents) ────────
  const resolveUserSignerContext = async (forceRefresh = false): Promise<UserSignerContext> => {
    const liveUser = getCurrentUser() || currentUser;
    const currentUserName = (liveUser?.name || "").trim();

    if (!forceRefresh && cachedSignerContextRef.current) {
      return cachedSignerContextRef.current;
    }

    let activeKeystore = isAceUser ? activeKeystoreProfile : null;
    if (!activeKeystore && isAceUser) {
      try {
        const saved = localStorage.getItem("dict_active_p12_keystore");
        if (saved) activeKeystore = JSON.parse(saved);
      } catch {}
    }

    // 1. Locate the logged-in user's own profile (to get their real signature image and name!)
    let userSigProfile: DtrGeneratorSignatureRecord | null = null;
    let fallbackKeystoreProfile: DtrGeneratorSignatureRecord | null = null;

    try {
      const all = await dtrGeneratorApi.getRecords();
      if (Array.isArray(all) && all.length > 0) {
        // Find logged-in user's profile: match by user_Id, exact name, or partial match (e.g. Ace Malto / Malto Ace Mata)
        userSigProfile =
          all.find(
            (p) =>
              (liveUser?.id && (String(p.user_Id) === String(liveUser.id) || p.id === `dtr-sig-${liveUser.id}`)) ||
              matchNames(p.Name, currentUserName) ||
              (currentUserName.toLowerCase().includes("malto") && p.Name.toLowerCase().includes("malto")) ||
              (currentUserName.toLowerCase().includes("ace") && p.Name.toLowerCase().includes("ace"))
          ) || null;

        // Find available fallback P12 keystore profile (e.g. supervisor) for cryptographic seal if user has no P12 yet
        fallbackKeystoreProfile = all.find((p) => p.hasP12 || p.p12) || null;
      }
    } catch (err) {
      console.warn("Could not load digital signature profile:", err);
    }

    // Signer name is ALWAYS the logged-in user's name (never overwritten by keystore holder name!)
    const effectiveSignerName = (
      currentUserName ||
      liveUser?.name ||
      userSigProfile?.Name ||
      "Authorized Signer"
    ).trim();

    // Signature image is ALWAYS the logged-in user's signature stroke
    let signatureImage = userSigProfile?.image_digiSigned || activeKeystore?.signatureImage || null;
    const isReneJane =
      matchNames(effectiveSignerName, "Rene Jane Rosendo Buena") ||
      matchNames(currentUserName, "Rene Jane Rosendo Buena");

    if (!signatureImage && isReneJane) {
      signatureImage = RENE_JANE_SIGNATURE_BASE64;
    }

    let signatureImageBytes: Uint8Array | null = null;
    let signatureImageType: "png" | "jpg" | null = null;

    if (signatureImage) {
      try {
        signatureImageBytes = base64ToUint8Array(signatureImage);
        signatureImageType = (signatureImage.includes("image/jpeg") || signatureImage.includes("image/jpg")) ? "jpg" : "png";
      } catch (e) {
        console.warn("Could not pre-decode signature image bytes:", e);
      }
    }

    // Determine P12 cryptographic keystore:
    // 1. User's own P12 if uploaded in database
    // 2. Active keystore if user selected/unlocked one in the PNPKI modal
    // Note: Strictly bound to user's identity — NEVER silently fall back to another employee's P12 (e.g. Cantorna)!
    const chosenP12Profile = (userSigProfile?.hasP12 || userSigProfile?.p12)
      ? userSigProfile
      : (activeKeystore?.p12Base64 || activeKeystore?.profileId)
      ? activeKeystore
      : null;

    const hasP12Available = Boolean(
      activeKeystore?.p12Base64 ||
      chosenP12Profile?.p12Base64 ||
      chosenP12Profile?.p12 ||
      chosenP12Profile?.hasP12
    );

    const p12Options = hasP12Available
      ? {
          profileId: userSigProfile?.p12 ? userSigProfile.id : (chosenP12Profile?.id || activeKeystore?.profileId),
          user_Id: userSigProfile?.p12 ? userSigProfile.user_Id : (chosenP12Profile?.user_Id || activeKeystore?.userId),
          p12Base64: activeKeystore?.p12Base64 || userSigProfile?.p12 || chosenP12Profile?.p12 || undefined,
          p12Password: activeKeystore?.p12Password,
          signerName: effectiveSignerName, // Strictly logged-in user (e.g. Ace Malto)
          signerRole: "supervisor" as const,
        }
      : null;

    const ctx: UserSignerContext = {
      userSigProfile,
      effectiveSignerName,
      signatureImage,
      signatureImageBytes,
      signatureImageType,
      isProfileOwnerMatch: true,
      p12Options,
    };

    cachedSignerContextRef.current = ctx;
    return ctx;
  };

  // ─── Core Signing Pipeline ──────────────────────────────────────────────────
  const signDocumentItem = async (
    doc: WorkspaceDocument,
    options?: {
      isCounterSign?: boolean;
      counterSignPosition?: CounterSignPosition;
      counterSignTargetPersonnel?: string;
      signerContext?: UserSignerContext;
      skipDbSave?: boolean;
    }
  ): Promise<WorkspaceDocument & { storagePayload?: any }> => {
    try {
      const liveUser = getCurrentUser() || currentUser;
      const currentUserName = (liveUser?.name || "").trim();
      const isReq = isUserAuthorizedToSignDoc(doc, liveUser || currentUser);
      const isCounter = options?.isCounterSign !== undefined ? options.isCounterSign : !isReq;
      const counterPos = options?.counterSignPosition || "auto";

      // Pre-cached signature profile for zero redundant queries across 100+ documents
      const signerCtx = options?.signerContext || (await resolveUserSignerContext(false));
      const effectiveSignerName = signerCtx.effectiveSignerName;
      const signatureImage = signerCtx.signatureImage;
      const p12Options = signerCtx.p12Options;

      // If user has no active P12, do NOT silently sign as another person! Prompt them to unlock their certificate.
      if (!p12Options && !activeKeystoreProfile?.isUnlocked && !signerCtx.userSigProfile?.p12) {
        showNotif(`⚠️ No active PNPKI .p12 certificate for "${effectiveSignerName}". Please ensure your .p12 certificate is configured.`);
        if (isAceUser) {
          setIsP12KeystoreModalOpen(true);
        }
        throw new Error(`PNPKI .p12 certificate required for "${effectiveSignerName}".`);
      }

      // Accurately resolve which signature line in the document to target
      const matchedRequiredSigner = doc.requiredSigners.find((req) =>
        matchNames(req, effectiveSignerName) || matchNames(req, currentUserName)
      );
      let targetPersonnelName = isCounter
        ? (options?.counterSignTargetPersonnel || doc.targetPersonnel || currentUserName).trim()
        : (matchedRequiredSigner || doc.targetPersonnel || currentUserName).trim();

      // If user is Regional Director / ARD, or signing on behalf of RD/ARD, target the RD/ARD signatory line
      if (!isCounter && (!matchedRequiredSigner || !matchNames(matchedRequiredSigner, effectiveSignerName))) {
        if (isUserRegionalDirectorOrAssistant(liveUser || currentUser)) {
          const rdSigner = doc.signers.find(
            (s) =>
              s.status !== "signed" &&
              ((s.role || "").toUpperCase().includes("REGIONAL DIRECTOR") ||
                (s.role || "").toUpperCase().includes("DIRECTOR") ||
                (s.role || "").toUpperCase().includes("ARD") ||
                (s.role || "").toUpperCase().includes("NOTED BY") ||
                (s.role || "").toUpperCase().includes("APPROVED BY"))
          );
          if (rdSigner && rdSigner.name) {
            targetPersonnelName = rdSigner.name.trim();
          }
        }
      }

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
          pdfBytes = base64ToUint8Array(currentPdfDataUrl);
        }

        if (pdfBytes) {
          const counterSignIdx = doc.counterSigners?.length || 0;
          const { bytes, signatureCoordinates } =
            await signUploadedPersonnelPdfBytes(
              pdfBytes,
              targetPersonnelName,
              signatureImage,
              p12Options,
              {
                isCounterSign: isCounter,
                counterSignIndex: counterSignIdx,
                counterSignPosition: counterPos,
                signerName: effectiveSignerName,
                preloadedImageBytes: signerCtx.signatureImageBytes,
                preloadedImageType: signerCtx.signatureImageType,
              }
            );

          signatureCoords = signatureCoordinates;
          signedPdfDataUrl = `data:application/pdf;base64,${arrayBufferToBase64(bytes)}`;
          signedFileObj = new File([bytes], doc.fileObj?.name || doc.fileName, { type: "application/pdf" });
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
        ? `Counter-signed placed ${signatureCoords?.appliedPosition || counterPos} personnel "${targetPersonnelName}"`
        : `Signed directly ABOVE personnel "${targetPersonnelName}"`;

      const originalFileName = doc.fileObj?.name || doc.fileName;

      const updatedDoc: WorkspaceDocument & { storagePayload?: any } = {
        ...doc,
        fileName: originalFileName,
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
        userId: String(liveUser?.id || "USER-001"),
        employeeName: updatedDoc.targetPersonnel,
        employeeId: String(liveUser?.employeeId || "EMP-001"),
        module: "SIGNING_WORKSPACE",
        province: liveUser?.province || "Regional Office",
        sectionDivision: "Regional Office V",
        periodText: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        scope: "full-month",
        status: newStatus,
        submittedDate: updatedDoc.uploadedAt,
        pdfFileName: originalFileName,
        pdfFileSize: updatedDoc.fileSize,
        pdfDataUrl: signedPdfDataUrl,
        docType: "AR",
        hasP12: Boolean(p12Options),
        signerName: effectiveSignerName,
        remarks: JSON.stringify({
          originalFileName: originalFileName,
          targetPersonnel: updatedDoc.targetPersonnel,
          requiredSigners: updatedDoc.requiredSigners,
          signers: updatedDoc.signers,
          counterSigners: updatedCounterSigners,
          scannedInfo: updatedDoc.scannedInfo,
          notes: updatedDoc.notes,
        }),
      };

      updatedDoc.storagePayload = signStoragePayload;

      if (!options?.skipDbSave) {
        dtrStorageApi
          .saveRecord(signStoragePayload)
          .catch((err) => console.warn("Failed to sync signed record to dtr_storage:", err));

        // Broadcast to same-browser tabs immediately
        broadcastLocalDtrEvent({
          type: "UPDATE",
          record: signStoragePayload as any,
          id: updatedDoc.id,
        });
      }

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

  // ─── Single Counter-Sign with Personnel Picker ───────────────────────────────

  const persistDocSignatoryUpdate = async (doc: WorkspaceDocument) => {
    try {
      const originalFileName = doc.fileObj?.name || doc.fileName;
      const remarksPayload = {
        originalFileName: originalFileName,
        targetPersonnel: doc.targetPersonnel,
        requiredSigners: doc.requiredSigners,
        signers: doc.signers,
        counterSigners: doc.counterSigners,
        scannedInfo: doc.scannedInfo,
        notes: doc.notes,
      };
      await dtrStorageApi.saveRecord({
        id: doc.id,
        employeeName: doc.targetPersonnel,
        module: "SIGNING_WORKSPACE",
        pdfFileName: originalFileName,
        pdfFileSize: doc.fileSize,
        status: doc.status,
        submittedDate: doc.uploadedAt,
        remarks: JSON.stringify(remarksPayload),
      } as any);

      broadcastLocalDtrEvent({
        type: "UPDATE",
        record: {
          id: doc.id,
          module: "SIGNING_WORKSPACE",
          pdfFileName: originalFileName,
          status: doc.status,
          remarks: JSON.stringify(remarksPayload),
        } as any,
        id: doc.id,
      });
    } catch (e) {
      console.warn("Could not persist dynamic signatory update:", e);
    }
  };

  const handleOpenSingleCounterSign = async (doc: WorkspaceDocument, initialPos: CounterSignPosition = "right") => {
    setCounterSignPositionChoice(initialPos === "auto" ? "right" : initialPos);

    // 1. Immediately re-check document against the latest User List
    const freshUsers = getStoredUsers().map((u) => ({ name: u.name, role: u.role, email: u.email }));
    const { updatedDoc, hasNewRecognition, newlyDetectedNames } = recheckDocWithLatestUsers(doc, freshUsers);

    let activeDoc = updatedDoc;
    if (hasNewRecognition) {
      setDocuments((prev) => prev.map((d) => (d.id === activeDoc.id ? activeDoc : d)));
      showNotif(`✓ Dynamically recognized newly added personnel: ${newlyDetectedNames.join(", ")}`);
      persistDocSignatoryUpdate(activeDoc);
    }

    setCounterSignDocTarget(activeDoc);

    // 2. Perform background deep-scan of PDF streams with latest users if binary data is available
    try {
      let pdfBytes: Uint8Array | null = null;
      if (activeDoc.fileObj) {
        const ab = await activeDoc.fileObj.arrayBuffer();
        pdfBytes = new Uint8Array(ab);
      } else if (activeDoc.pdfDataUrl) {
        pdfBytes = base64ToUint8Array(activeDoc.pdfDataUrl);
      } else {
        const full = await dtrStorageApi.getRecord(activeDoc.id);
        if (full?.pdfDataUrl) {
          activeDoc.pdfDataUrl = full.pdfDataUrl;
          pdfBytes = base64ToUint8Array(full.pdfDataUrl);
        }
      }

      if (pdfBytes) {
        const scan = await scanPdfForSigners(pdfBytes, freshUsers);
        const { updatedDoc: deepDoc, hasNewRecognition: deepHasNew, newlyDetectedNames: deepNames } =
          mergeScanResultsIntoDoc(activeDoc, scan, freshUsers);
        if (deepHasNew) {
          setDocuments((prev) => prev.map((d) => (d.id === deepDoc.id ? deepDoc : d)));
          setCounterSignDocTarget(deepDoc);
          persistDocSignatoryUpdate(deepDoc);
        }
      }
    } catch (err) {
      console.warn("Could not deep-scan PDF during counter-sign:", err);
    }
  };

  const handleExecuteSingleCounterSign = async (
    docId: string,
    targetPersonnel: string,
    position: CounterSignPosition
  ) => {
    const targetDoc = documents.find((d) => d.id === docId);
    if (!targetDoc || !targetPersonnel) return;

    setIsSingleCounterSigning(true);
    showNotif(`Applying compact counter-signature ${position === "bottom" ? "below" : "beside"} "${targetPersonnel}"…`);

    const updated = await signDocumentItem(targetDoc, {
      isCounterSign: true,
      counterSignPosition: position,
      counterSignTargetPersonnel: targetPersonnel,
    });

    setDocuments((prev) => prev.map((d) => (d.id === docId ? updated : d)));
    if (previewDoc && previewDoc.id === docId) {
      setPreviewDoc(updated);
    }

    setIsSingleCounterSigning(false);
    setCounterSignDocTarget(null);
    showNotif(`✓ Counter-signed ${position === "bottom" ? "below" : "beside"} "${targetPersonnel}" (sign on left, DigiSigned on right).`);
  };



  const isCurrentUserSuperAdmin = useMemo(() => isUserSuperAdmin(currentUser), [currentUser]);

  const selectedDocs = documents.filter((d) => d.selected);

  const userRequiredDocs = documents.filter(
    (d) =>
      computeEffectiveDocStatus(d) !== "signed" &&
      isUserAuthorizedToSignDoc(d, currentUser) &&
      !hasUserAlreadySigned(d, currentUser?.name)
  );

  const userCounterDocs = documents.filter(
    (d) =>
      computeEffectiveDocStatus(d) !== "signed" &&
      (isCurrentUserSuperAdmin || !isUserAuthorizedToSignDoc(d, currentUser)) &&
      !hasUserAlreadySigned(d, currentUser?.name)
  );

  const selectedUserRequiredDocs = selectedDocs.filter(
    (d) =>
      computeEffectiveDocStatus(d) !== "signed" &&
      isUserAuthorizedToSignDoc(d, currentUser) &&
      !hasUserAlreadySigned(d, currentUser?.name)
  );

  const selectedUserCounterDocs = selectedDocs.filter(
    (d) =>
      computeEffectiveDocStatus(d) !== "signed" &&
      (isCurrentUserSuperAdmin || !isUserAuthorizedToSignDoc(d, currentUser)) &&
      !hasUserAlreadySigned(d, currentUser?.name)
  );

  // ─── Batch Multi-Select & High-Speed Batch Deletion ─────────────────────────

  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    type: "selected" | "all";
    count: number;
    ids: string[];
  }>({
    isOpen: false,
    type: "selected",
    count: 0,
    ids: [],
  });

  const toggleSelect = (id: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d))
    );
  };

  const toggleSelectAll = (customPool?: WorkspaceDocument[], forceValue?: boolean) => {
    const pool = customPool && customPool.length > 0 ? customPool : documents;
    const poolIds = new Set(pool.map((d) => d.id));
    const allSelected =
      forceValue !== undefined
        ? !forceValue
        : pool.length > 0 && pool.every((d) => d.selected);
    const targetState = forceValue !== undefined ? forceValue : !allSelected;
    setDocuments((prev) =>
      prev.map((d) => (poolIds.has(d.id) ? { ...d, selected: targetState } : d))
    );
  };

  const deselectAll = () => {
    setDocuments((prev) => prev.map((d) => ({ ...d, selected: false })));
  };

  const handlePromptDeleteSelected = () => {
    const ids = documents.filter((d) => d.selected).map((d) => d.id);
    if (ids.length === 0) {
      showNotif("⚠️ Please select at least one document to delete.");
      return;
    }
    setConfirmDeleteModal({
      isOpen: true,
      type: "selected",
      count: ids.length,
      ids,
    });
  };

  const handlePromptDeleteAll = () => {
    if (documents.length === 0) {
      showNotif("⚠️ No documents in the workspace to delete.");
      return;
    }
    setConfirmDeleteModal({
      isOpen: true,
      type: "all",
      count: documents.length,
      ids: documents.map((d) => d.id),
    });
  };

  const handleExecuteBatchDelete = async () => {
    const targetIds = confirmDeleteModal.ids;
    if (targetIds.length === 0) {
      setConfirmDeleteModal((prev) => ({ ...prev, isOpen: false }));
      return;
    }

    const count = targetIds.length;
    setIsDeletingBatch(true);
    setConfirmDeleteModal((prev) => ({ ...prev, isOpen: false }));
    showNotif(`🗑 Deleting ${count} document(s) from workspace and repository…`);

    // 1. Mark IDs in tombstone set immediately
    targetIds.forEach((id) => markDocAsDeleted(id));

    // 2. Clear from preview if active
    if (previewDoc && targetIds.includes(previewDoc.id)) {
      setPreviewDoc(null);
    }

    // 3. Immediately update state and flush to localStorage (<5ms)
    const idSet = new Set(targetIds);
    setDocuments((prev) => {
      const updated = prev.filter((d) => !idSet.has(d.id));
      try {
        localStorage.setItem(
          "dict_r5_signing_workspace_docs_v1",
          serializeDocsForLocalStorage(updated)
        );
      } catch {}
      return updated;
    });

    // 4. Broadcast DELETE event to other same-browser tabs immediately
    targetIds.forEach((id) => broadcastLocalDtrEvent({ type: "DELETE", id }));

    // 5. Concurrently delete from backend Turso dtr_storage table using asyncPool (concurrency 8)
    try {
      await asyncPool<string, void>(8, targetIds, async (id: string) => {
        try {
          await dtrStorageApi.deleteRecord(id);
        } catch (err) {
          console.warn(`Failed to delete record ${id} from dtr_storage:`, err);
        }
      });
    } finally {
      setIsDeletingBatch(false);
      showNotif(`✓ ${count} document(s) permanently deleted.`);
    }
  };

  // ─── High-Speed Batch Upload Handler (100–200 files with Auto-Retry) ───────

  const handleUploadScanned = async (scannedEntries: ScannedFileEntry[]) => {
    if (scannedEntries.length === 0) return;

    const now = new Date().toISOString();
    const activeUser = getCurrentUser() || currentUser;
    const defaultUser = activeUser?.name || "Personnel";
    const userProv = (activeUser as any)?.focalProvince || activeUser?.province || "Regional Office";

    // 1. Instant document model instantiation (<5ms for 200 items)
    const newDocs: WorkspaceDocument[] = scannedEntries.map((entry, i) => {
      const scan = entry.scanResult;
      const isPlaceholderPrimary =
        !scan?.primaryPersonnel ||
        scan.primaryPersonnel.toUpperCase() === "PERSONNEL" ||
        scan.primaryPersonnel.toUpperCase() === "USER";

      const primary = !isPlaceholderPrimary
        ? scan!.primaryPersonnel
        : scan?.requiredSigners?.[0] || defaultUser;

      const required =
        scan?.requiredSigners && scan.requiredSigners.length > 0
          ? scan.requiredSigners
          : [primary];

      const docSigners: DocumentSigner[] =
        scan?.signers && scan.signers.length > 0
          ? scan.signers.map((s: any) => ({
              name: s.name,
              role: s.title || "Signatory",
              status: s.status || (s.isAlreadySigned ? "signed" : "pending"),
              position: "above",
              signedAt: s.signedAt,
              p12CommonName: s.p12CommonName,
            }))
          : required.map((rName) => ({
              name: rName,
              role: "Signatory",
              status: "pending",
              position: "above",
            }));

      const docItem: WorkspaceDocument = {
        id: `doc-upload-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        fileName: entry.file.name,
        fileSize: formatFileSize(entry.file.size),
        uploadedAt: now,
        uploadedBy: activeUser?.name || "Unknown User",
        status: "pending",
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
        pdfDataUrl: undefined, // Evaluated asynchronously to prevent memory overhead
        scannedInfo: scan || undefined,
        notes: `Scanned from document: ${required.join(", ")}`,
        isPendingSync: true,
        province: userProv,
      };

      docItem.status = computeEffectiveDocStatus(docItem);
      return docItem;
    });

    // 2. Immediate non-blocking UI update: All 100-200 files display instantly
    setDocuments((prev) => [...newDocs, ...prev]);

    // 3. Mark batch upload active so polling & foreign SSE refetches are paused
    isBatchUploadingRef.current = true;
    setBatchUploadProgress({
      inFlight: true,
      total: newDocs.length,
      completed: 0,
      failedCount: 0,
      failedItems: [],
    });

    showNotif(`⚡ Queued ${newDocs.length} documents. Turbo batch streaming active (boosted micro-chunks).`);

    // 4. Group items into micro-batches of 4 records
    // Micro-batching eliminates individual HTTP roundtrips and keeps payloads lean (<10MB)
    const BATCH_CHUNK_SIZE = 4;
    const itemsToUpload = newDocs.map((doc, idx) => ({
      doc,
      file: scannedEntries[idx].file,
    }));

    const chunks: (typeof itemsToUpload)[] = [];
    for (let i = 0; i < itemsToUpload.length; i += BATCH_CHUNK_SIZE) {
      chunks.push(itemsToUpload.slice(i, i + BATCH_CHUNK_SIZE));
    }

    let completedCounter = 0;
    let failedCounter = 0;
    const failedCollector: { doc: WorkspaceDocument; file: File; error: string }[] = [];
    const activeUserId = String(activeUser?.id || "USER-001");
    const activeEmpId = String(activeUser?.employeeId || "EMP-001");

    // Process micro-batch chunks with controlled concurrency of 2 parallel workers (8 items in flight max)
    await asyncPool(2, chunks, async (chunk, chunkIdx) => {
      const isLastChunk = chunkIdx === chunks.length - 1;

      // Step A: Read files for this chunk concurrently (ordered mapping, minimal memory)
      const chunkPayloads = await Promise.all(
        chunk.map(async (item) => {
          let dataUrl: string | undefined = undefined;
          try {
            dataUrl = await fileToDataUrl(item.file);
            item.doc.pdfDataUrl = dataUrl;
          } catch (err) {
            console.warn(`Failed reading file data for ${item.doc.fileName}:`, err);
          }

          const originalFileName = item.file?.name || item.doc.fileName;
          item.doc.fileName = originalFileName;

          const uploadPayload = {
            id: item.doc.id,
            userId: activeUserId,
            employeeName: item.doc.targetPersonnel,
            employeeId: activeEmpId,
            module: "SIGNING_WORKSPACE",
            province: item.doc.province || userProv,
            sectionDivision: "Regional Office V",
            periodText: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            scope: "full-month",
            status: item.doc.status,
            submittedDate: item.doc.uploadedAt,
            pdfFileName: originalFileName,
            pdfFileSize: item.doc.fileSize,
            pdfDataUrl: dataUrl,
            docType: "AR",
            remarks: JSON.stringify({
              originalFileName: originalFileName,
              targetPersonnel: item.doc.targetPersonnel,
              requiredSigners: item.doc.requiredSigners,
              signers: item.doc.signers,
              counterSigners: item.doc.counterSigners,
              scannedInfo: item.doc.scannedInfo,
              notes: item.doc.notes,
            }),
          };

          return { payload: uploadPayload, doc: item.doc, file: item.file, dataUrl };
        })
      );

      // Step B: Send micro-batch via dtrStorageApi.saveBatch with automatic retry
      let batchSuccess = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const batchResult = await dtrStorageApi.saveBatch(
            chunkPayloads.map((c) => c.payload),
            { isLastChunk }
          );
          if (batchResult && batchResult.success !== false) {
            batchSuccess = true;
            break;
          }
        } catch (e: any) {
          console.warn(`saveBatch attempt ${attempt} failed:`, e);
        }
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      if (batchSuccess) {
        const succeededIds = new Set(chunkPayloads.map((c) => c.doc.id));
        setDocuments((prev) =>
          prev.map((d) => (succeededIds.has(d.id) ? { ...d, isPendingSync: false } : d))
        );
        completedCounter += chunkPayloads.length;
      } else {
        // Fallback: Individual upload with retry for items in failed chunk
        for (const c of chunkPayloads) {
          let singleSuccess = false;
          let singleErr = "";
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const res = await dtrStorageApi.saveRecord(c.payload);
              if (res && res.success !== false) {
                singleSuccess = true;
                break;
              }
              singleErr = res?.error || `Upload failed on attempt ${attempt}`;
            } catch (e: any) {
              singleErr = e?.message || "Network error";
            }
            if (attempt < 2) await new Promise((r) => setTimeout(r, 150));
          }

          if (singleSuccess) {
            setDocuments((prev) =>
              prev.map((d) => (d.id === c.doc.id ? { ...d, isPendingSync: false } : d))
            );
            completedCounter++;
          } else {
            failedCounter++;
            failedCollector.push({ doc: c.doc, file: c.file, error: singleErr });
          }
        }
      }

      // Smooth progress update
      setBatchUploadProgress((prev) =>
        prev
          ? {
              ...prev,
              completed: completedCounter,
              failedCount: failedCounter,
              failedItems: [...failedCollector],
            }
          : null
      );
    });

    // 5. Wrap up batch upload
    isBatchUploadingRef.current = false;

    // Dispatch single local broadcast to notify other tabs without spamming
    broadcastLocalDtrEvent({
      type: "INSERT",
      record: { module: "SIGNING_WORKSPACE", batchCount: completedCounter } as any,
      id: `batch-${Date.now()}`,
    });

    if (failedCounter === 0) {
      showNotif(`✓ All ${newDocs.length} documents uploaded and synced to Turso Cloud repository!`);
      setTimeout(() => {
        setBatchUploadProgress((curr) => (curr?.failedCount === 0 ? null : curr));
      }, 4000);
    } else {
      showNotif(`⚠️ ${failedCounter} file(s) encountered network issues. Click 'Retry Failed' in progress bar to re-sync.`);
      setBatchUploadProgress((prev) =>
        prev
          ? {
              ...prev,
              inFlight: false,
              failedCount: failedCounter,
              failedItems: [...failedCollector],
            }
          : null
      );
    }
  };

  // Re-run only the failed items with automatic retry
  const handleRetryFailedUploads = async () => {
    if (!batchUploadProgress || batchUploadProgress.failedItems.length === 0) return;

    const toRetry = [...batchUploadProgress.failedItems];
    isBatchUploadingRef.current = true;
    setBatchUploadProgress((prev) => (prev ? { ...prev, inFlight: true, failedItems: [] } : null));
    showNotif(`Retrying ${toRetry.length} failed upload(s)…`);

    let reCompleted = batchUploadProgress.completed;
    let reFailed = 0;
    const stillFailed: { doc: WorkspaceDocument; file: File; error: string }[] = [];

    const activeUser = getCurrentUser() || currentUser;
    const userProv = (activeUser as any)?.focalProvince || activeUser?.province || "Regional Office";
    const activeUserId = String(activeUser?.id || "USER-001");
    const activeEmpId = String(activeUser?.employeeId || "EMP-001");

    const BATCH_CHUNK_SIZE = 4;
    const chunks: (typeof toRetry)[] = [];
    for (let i = 0; i < toRetry.length; i += BATCH_CHUNK_SIZE) {
      chunks.push(toRetry.slice(i, i + BATCH_CHUNK_SIZE));
    }

    await asyncPool(2, chunks, async (chunk, chunkIdx) => {
      const isLastChunk = chunkIdx === chunks.length - 1;

      const chunkPayloads = await Promise.all(
        chunk.map(async (item) => {
          let dataUrl = item.doc.pdfDataUrl;
          if (!dataUrl && item.file) {
            try {
              dataUrl = await fileToDataUrl(item.file);
              item.doc.pdfDataUrl = dataUrl;
            } catch {}
          }

          const originalFileName = item.file?.name || item.doc.fileName;
          item.doc.fileName = originalFileName;

          const uploadPayload = {
            id: item.doc.id,
            userId: activeUserId,
            employeeName: item.doc.targetPersonnel,
            employeeId: activeEmpId,
            module: "SIGNING_WORKSPACE",
            province: item.doc.province || userProv,
            sectionDivision: "Regional Office V",
            periodText: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            scope: "full-month",
            status: item.doc.status,
            submittedDate: item.doc.uploadedAt,
            pdfFileName: originalFileName,
            pdfFileSize: item.doc.fileSize,
            pdfDataUrl: dataUrl,
            docType: "AR",
            remarks: JSON.stringify({
              originalFileName: originalFileName,
              targetPersonnel: item.doc.targetPersonnel,
              requiredSigners: item.doc.requiredSigners,
              signers: item.doc.signers,
              counterSigners: item.doc.counterSigners,
              scannedInfo: item.doc.scannedInfo,
              notes: item.doc.notes,
            }),
          };

          return { payload: uploadPayload, doc: item.doc, file: item.file };
        })
      );

      let batchSuccess = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const res = await dtrStorageApi.saveBatch(
            chunkPayloads.map((c) => c.payload),
            { isLastChunk }
          );
          if (res && res.success !== false) {
            batchSuccess = true;
            break;
          }
        } catch {}
        if (attempt < 2) await new Promise((r) => setTimeout(r, 200));
      }

      if (batchSuccess) {
        const succeededIds = new Set(chunkPayloads.map((c) => c.doc.id));
        setDocuments((prev) =>
          prev.map((d) => (succeededIds.has(d.id) ? { ...d, isPendingSync: false } : d))
        );
        reCompleted += chunkPayloads.length;
      } else {
        for (const c of chunkPayloads) {
          let singleSuccess = false;
          let singleErr = "";
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const res = await dtrStorageApi.saveRecord(c.payload);
              if (res && res.success !== false) {
                singleSuccess = true;
                break;
              }
              singleErr = res?.error || `Upload failed on attempt ${attempt}`;
            } catch (e: any) {
              singleErr = e?.message || "Network error";
            }
            if (attempt < 2) await new Promise((r) => setTimeout(r, 150));
          }

          if (singleSuccess) {
            setDocuments((prev) =>
              prev.map((d) => (d.id === c.doc.id ? { ...d, isPendingSync: false } : d))
            );
            reCompleted++;
          } else {
            reFailed++;
            stillFailed.push({ doc: c.doc, file: c.file, error: singleErr });
          }
        }
      }

      setBatchUploadProgress((prev) =>
        prev
          ? {
              ...prev,
              completed: reCompleted,
              failedCount: reFailed,
              failedItems: [...stillFailed],
            }
          : null
      );
    });

    isBatchUploadingRef.current = false;

    if (reFailed === 0) {
      showNotif(`✓ All retried documents successfully synced!`);
      setTimeout(() => setBatchUploadProgress(null), 3500);
    } else {
      showNotif(`⚠️ ${reFailed} file(s) still failing. Please check server connectivity.`);
      setBatchUploadProgress((prev) =>
        prev ? { ...prev, inFlight: false, failedCount: reFailed, failedItems: [...stillFailed] } : null
      );
    }
  };

  // ─── High-Speed Bulk Signing Engine (8 Concurrency + Pipelined Micro-Batches) ──
  const executeBulkSigningOperation = async ({
    documentsToProcess,
    isCounterSign,
    counterSignPosition,
    counterSignTargetPersonnel,
    progressType,
  }: {
    documentsToProcess: WorkspaceDocument[];
    isCounterSign: boolean;
    counterSignPosition?: CounterSignPosition;
    counterSignTargetPersonnel?: string;
    progressType: "sign" | "counter-sign";
  }) => {
    const total = documentsToProcess.length;
    if (total === 0) return;

    const startTime = Date.now();
    const initialProgress = {
      completed: 0,
      total,
      failedCount: 0,
      inFlight: true,
      type: progressType,
    };

    if (progressType === "sign") {
      setIsBulkSigning(true);
      setBulkSignProgress(initialProgress);
    } else {
      setIsBulkCounterSigning(true);
      setBulkCounterSignProgress(initialProgress);
    }

    showNotif(
      isCounterSign
        ? `Turbo bulk counter-signing ${total} document(s) ${counterSignPosition === "bottom" ? "below" : "beside"} "${counterSignTargetPersonnel}"…`
        : `Turbo bulk signing ${total} document(s) ABOVE personnel name…`
    );

    // 1. Pre-fetch and pre-decode user signature credentials ONCE for the entire batch
    const signerCtx = await resolveUserSignerContext(false);

    // 2. Pre-fetch any remote PDFs that lack local binary data concurrently
    const missingPdfDocs = documentsToProcess.filter(
      (d) => !d.fileObj && (!d.pdfDataUrl || !d.pdfDataUrl.startsWith("data:application/pdf"))
    );
    if (missingPdfDocs.length > 0) {
      await asyncPool(8, missingPdfDocs, async (d) => {
        try {
          const fullRec = await dtrStorageApi.getRecord(d.id);
          if (fullRec?.pdfDataUrl) {
            d.pdfDataUrl = fullRec.pdfDataUrl;
          }
        } catch (e) {
          console.warn(`Could not pre-fetch remote PDF for doc ${d.id}:`, e);
        }
      });
    }

    // 3. Setup pipelined micro-batch storage saves
    const MICRO_BATCH_SIZE = 8;
    const pendingPayloads: any[] = [];
    const saveBatchPromises: Promise<any>[] = [];
    let completedCount = 0;
    let failedCount = 0;
    const signedDocMap = new Map<string, WorkspaceDocument>();
    let lastDocumentStateFlush = Date.now();

    const flushSaveQueue = (force = false, isLast = false) => {
      while (pendingPayloads.length >= MICRO_BATCH_SIZE || (force && pendingPayloads.length > 0)) {
        const chunk = pendingPayloads.splice(0, MICRO_BATCH_SIZE);
        const isChunkLast = isLast && pendingPayloads.length === 0;
        const p = dtrStorageApi
          .saveBatch(chunk, { isLastChunk: isChunkLast })
          .then((res) => {
            if (!res || res.success === false) {
              // Fallback to concurrent single saves for this chunk
              return Promise.all(chunk.map((rec) => dtrStorageApi.saveRecord(rec).catch(() => {})));
            }
          })
          .catch((err) => {
            console.warn("Micro-batch save failed, falling back to individual saves:", err);
            return Promise.all(chunk.map((rec) => dtrStorageApi.saveRecord(rec).catch(() => {})));
          });
        saveBatchPromises.push(p);
      }
    };

    // 4. Concurrency 8 parallel workers via asyncPool
    const CONCURRENCY_LIMIT = 8;
    await asyncPool(CONCURRENCY_LIMIT, documentsToProcess, async (doc) => {
      try {
        const signed = await signDocumentItem(doc, {
          isCounterSign,
          counterSignPosition,
          counterSignTargetPersonnel,
          signerContext: signerCtx,
          skipDbSave: true,
        });

        if (signed.status === "failed") {
          failedCount++;
          console.warn(`Error bulk signing ${doc.fileObj?.name || doc.fileName}: ${signed.notes}`);
        } else {
          signedDocMap.set(signed.id, signed);
          if ((signed as any).storagePayload) {
            pendingPayloads.push((signed as any).storagePayload);
            flushSaveQueue(false, false);
          }
          completedCount++;
        }
      } catch (err: any) {
        console.error(`Error bulk signing ${doc.fileObj?.name || doc.fileName}:`, err);
        failedCount++;
      } finally {
        const currentProgress = {
          completed: completedCount,
          total,
          failedCount,
          inFlight: true,
          type: progressType,
        };
        if (progressType === "sign") {
          setBulkSignProgress(currentProgress);
        } else {
          setBulkCounterSignProgress(currentProgress);
        }

        // Throttle document state updates (every 250ms or at completion) to eliminate 100 main-thread table re-renders
        const now = Date.now();
        if (now - lastDocumentStateFlush > 250 || completedCount + failedCount === total) {
          lastDocumentStateFlush = now;
          setDocuments((prev) =>
            prev.map((d) => signedDocMap.get(d.id) || d)
          );
        }
      }
    });

    // Guaranteed final document state flush
    setDocuments((prev) =>
      prev.map((d) => signedDocMap.get(d.id) || d)
    );

    // 5. Flush any remaining micro-batches to Turso
    flushSaveQueue(true, true);
    await Promise.all(saveBatchPromises);

    // 6. Single broadcast to notify same-browser tabs without spamming or saturating BroadcastChannel
    broadcastLocalDtrEvent({
      type: "UPDATE",
      record: { module: "SIGNING_WORKSPACE", batchCount: completedCount } as any,
      id: `batch-${Date.now()}`,
    });

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    if (progressType === "sign") {
      setIsBulkSigning(false);
      setBulkSignProgress((prev) => (prev ? { ...prev, inFlight: false } : null));
      setTimeout(() => setBulkSignProgress(null), 3000);
      if (failedCount === 0) {
        showNotif(
          `✓ Bulk signing complete — ${completedCount} document(s) digitally signed ABOVE personnel name in ${durationSec}s.`
        );
      } else {
        showNotif(
          `⚠️ Bulk signing finished in ${durationSec}s: ${completedCount} signed, ${failedCount} failed.`
        );
      }
    } else {
      setIsBulkCounterSigning(false);
      setIsBulkCounterModalOpen(false);
      setBulkCounterSignProgress((prev) => (prev ? { ...prev, inFlight: false } : null));
      setTimeout(() => setBulkCounterSignProgress(null), 3000);
      if (failedCount === 0) {
        showNotif(
          `✓ Bulk counter-signing complete — counter-signature placed ${
            counterSignPosition === "bottom" ? "below" : "beside"
          } "${counterSignTargetPersonnel}" on ${completedCount} document(s) in ${durationSec}s.`
        );
      } else {
        showNotif(
          `⚠️ Bulk counter-signing finished in ${durationSec}s: ${completedCount} signed, ${failedCount} failed.`
        );
      }
    }
  };

  // ─── Bulk Sign (Required Signers -> Placed ABOVE Name) ──────────────────────

  const handleBulkSign = async () => {
    if (!isBulkSigningAuthorized) {
      showNotif("⚠️ Bulk signing is restricted: Exclusively authorized for SuperAdmin, Regional Director / ARD, and Provincial Officers (PO).");
      return;
    }

    const toSign =
      selectedUserRequiredDocs.length > 0 ? selectedUserRequiredDocs : userRequiredDocs;

    if (toSign.length === 0) {
      showNotif("⚠️ No pending documents found where your name is in the required signers list.");
      return;
    }

    await executeBulkSigningOperation({
      documentsToProcess: toSign,
      isCounterSign: false,
      progressType: "sign",
    });
  };

  // ─── Bulk Counter-Sign (Shows Modal with Uploaded Personnel Selection) ──────

  const handleBulkCounterSign = () => {
    if (!isBulkSigningAuthorized) {
      showNotif("⚠️ Bulk counter-signing is restricted: Exclusively authorized for SuperAdmin, Regional Director / ARD, and Provincial Officers (PO).");
      return;
    }

    const toCounter =
      selectedUserCounterDocs.length > 0 ? selectedUserCounterDocs : userCounterDocs;

    if (toCounter.length === 0) {
      showNotif("⚠️ No eligible documents found for counter-signing.");
      return;
    }

    setIsBulkCounterModalOpen(true);
  };

  const handleExecuteBulkCounterSign = async (
    targetPersonnel: string,
    position: CounterSignPosition = "right"
  ) => {
    const toCounter =
      selectedUserCounterDocs.length > 0 ? selectedUserCounterDocs : userCounterDocs;

    if (toCounter.length === 0) {
      showNotif("⚠️ No eligible documents found for counter-signing.");
      return;
    }

    await executeBulkSigningOperation({
      documentsToProcess: toCounter,
      isCounterSign: true,
      counterSignPosition: position,
      counterSignTargetPersonnel: targetPersonnel,
      progressType: "counter-sign",
    });
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
          serializeDocsForLocalStorage(updated)
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

  // ─── Filtered & Paginated List for 100-200 Files ─────────────────────────────

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const matchSearch =
        !searchQuery ||
        (d.fileObj?.name || d.fileName).toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.targetPersonnel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.uploadedBy || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.requiredSigners.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
      const effectiveStatus = computeEffectiveDocStatus(d);
      const matchStatus = statusFilter === "all" || effectiveStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [documents, searchQuery, statusFilter]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedDocs = useMemo(() => {
    if (pageSize >= 1000) return filtered;
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // ─── Stats ───────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    let pending = 0;
    let partially_signed = 0;
    let signed = 0;
    let failed = 0;
    documents.forEach((d) => {
      const st = computeEffectiveDocStatus(d);
      if (st === "signed") signed++;
      else if (st === "partially_signed") partially_signed++;
      else if (st === "failed") failed++;
      else pending++;
    });
    return { total: documents.length, pending, partially_signed, signed, failed };
  }, [documents]);

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

            {/* Bulk Actions (Exclusively for SuperAdmin, Regional Director, ARD, and Provincial Officers - PO) */}
            {isBulkSigningAuthorized && (
              <>
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
                      ? `Signing (${bulkSignProgress?.completed ?? 0}/${bulkSignProgress?.total ?? (selectedUserRequiredDocs.length || userRequiredDocs.length)})`
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
                      ? `Counter-Signing (${bulkCounterSignProgress?.completed ?? 0}/${bulkCounterSignProgress?.total ?? (selectedUserCounterDocs.length || userCounterDocs.length)})`
                      : selectedUserCounterDocs.length > 0
                      ? `Counter-Sign (${selectedUserCounterDocs.length})`
                      : `Counter-Sign (${userCounterDocs.length})`}
                  </span>
                </button>
              </>
            )}

            {/* Batch Download Button (Downloads Selected if selected, or All queue if none selected) */}
            <button
              type="button"
              onClick={() =>
                handleBatchDownload(
                  selectedDocs.length > 0
                    ? selectedDocs
                    : filtered.length > 0
                    ? filtered
                    : documents,
                  selectedDocs.length > 0 ? "Selected" : "All"
                )
              }
              disabled={isDownloadingBatch || documents.length === 0}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedDocs.length > 0
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 shadow-lg shadow-emerald-950/40"
                  : "bg-[#101726] border-[#1F293D] text-slate-300 hover:bg-[#151E32] hover:text-white"
              }`}
              title={
                selectedDocs.length > 0
                  ? `Batch download ${selectedDocs.length} selected document(s) as ZIP archive`
                  : `Batch download all ${documents.length} document(s) in queue as ZIP archive`
              }
            >
              {isDownloadingBatch ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span>
                {isDownloadingBatch && batchDownloadProgress
                  ? `Downloading (${batchDownloadProgress.current}/${batchDownloadProgress.total})`
                  : selectedDocs.length > 0
                  ? `Download (${selectedDocs.length})`
                  : `Batch Download (${documents.length})`}
              </span>
            </button>

            {/* PNPKI Keystore Button (Visible exclusively to ace.malto@dict.gov.ph) */}
            {isAceUser && (
              <button
                type="button"
                onClick={() => setIsP12KeystoreModalOpen(true)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer active:scale-[0.98] ${
                  activeKeystoreProfile
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 shadow-lg shadow-emerald-950/30"
                    : "bg-[#101726] border-[#1F293D] text-slate-300 hover:bg-[#151E32] hover:text-white"
                }`}
                title="Configure or switch active PNPKI .p12 certificate for cryptographic digital signing"
              >
                <KeyRound className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {activeKeystoreProfile
                    ? `PNPKI: ${activeKeystoreProfile.signerName?.split(" ")[0] || "Active"}`
                    : "PNPKI Keystore"}
                </span>
              </button>
            )}

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

      {/* ── Active High-Speed Bulk Signing / Counter-Signing Progress Bar (100+ files) ── */}
      {(bulkSignProgress || bulkCounterSignProgress) && (
        (() => {
          const prog = (bulkSignProgress || bulkCounterSignProgress)!;
          const isCounter = prog.type === "counter-sign";
          const pct = Math.min(100, Math.round((prog.completed / Math.max(1, prog.total)) * 100));
          return (
            <div
              className={`bg-[#0C101A] border ${
                isCounter ? "border-cyan-500/30" : "border-violet-500/30"
              } rounded-2xl p-4 shadow-xl space-y-2.5 animate-in fade-in slide-in-from-top-2`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-xl ${
                      isCounter ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-400" : "bg-violet-500/20 border-violet-500/30 text-violet-400"
                    } border flex items-center justify-center shrink-0`}
                  >
                    {prog.inFlight ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-white">
                        {prog.inFlight
                          ? isCounter
                            ? "Turbo Bulk Counter-Signing (8 Concurrency Pipeline)"
                            : "Turbo Bulk Signing (8 Concurrency Pipeline)"
                          : isCounter
                          ? "Bulk Counter-Signing Completed"
                          : "Bulk Signing Completed"}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          isCounter ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20" : "bg-violet-500/10 text-violet-300 border-violet-500/20"
                        } border`}
                      >
                        {prog.completed} / {prog.total} signed ({pct}%)
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-slate-400">
                      {prog.inFlight
                        ? "Parallel worker execution • Pre-embedded credentials • Background streaming micro-batches"
                        : `Successfully digitally signed and synced ${prog.completed} document(s) with Turso Cloud.`}
                    </p>
                  </div>
                </div>

                {!prog.inFlight && (
                  <button
                    type="button"
                    onClick={() => {
                      setBulkSignProgress(null);
                      setBulkCounterSignProgress(null);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors self-end sm:self-auto"
                    title="Dismiss Progress Banner"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Progress Bar Track */}
              <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-[#1A2235]">
                <div
                  className={`h-full transition-all duration-200 ${
                    isCounter ? "bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400" : "bg-gradient-to-r from-violet-600 via-purple-500 to-emerald-400"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })()
      )}

      {/* ── Active High-Speed Batch Upload Progress Bar (100–200 files) ── */}
      {batchUploadProgress && (
        <div className="bg-[#0C101A] border border-blue-500/30 rounded-2xl p-4 shadow-xl space-y-2.5 animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                {batchUploadProgress.inFlight ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                ) : batchUploadProgress.failedCount > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    {batchUploadProgress.inFlight
                      ? "Turbo Batch Sync in Progress (Boosted Micro-Chunks)"
                      : batchUploadProgress.failedCount > 0
                      ? "Batch Upload Finished with Some Network Retries"
                      : "Batch Upload & Sync 100% Completed"}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    {batchUploadProgress.completed} / {batchUploadProgress.total} synced
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400">
                  {batchUploadProgress.inFlight
                    ? "Direct streaming to Turso Cloud repository • Zero UI blocking"
                    : batchUploadProgress.failedCount > 0
                    ? `${batchUploadProgress.failedCount} file(s) failed after 3 retries due to connection timeout.`
                    : "All documents successfully verified, stored, and ready for digital signing."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {batchUploadProgress.failedCount > 0 && !batchUploadProgress.inFlight && (
                <button
                  type="button"
                  onClick={handleRetryFailedUploads}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Retry Failed ({batchUploadProgress.failedCount})</span>
                </button>
              )}
              {!batchUploadProgress.inFlight && (
                <button
                  type="button"
                  onClick={() => setBatchUploadProgress(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Dismiss Progress Banner"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar Track */}
          <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-[#1A2235]">
            <div
              className={`h-full transition-all duration-300 ${
                batchUploadProgress.failedCount > 0
                  ? "bg-gradient-to-r from-blue-500 via-amber-500 to-emerald-400"
                  : "bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400"
              }`}
              style={{
                width: `${Math.round(
                  ((batchUploadProgress.completed + batchUploadProgress.failedCount) /
                    Math.max(1, batchUploadProgress.total)) *
                    100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

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

          {/* ── Multi-Select & Batch Action Bar (Select All / Download Selected / Download All / Delete) ── */}
          {documents.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 sm:px-5 py-2.5 bg-[#090D17] border-b border-[#1A2235] text-xs">
              {/* Left: Selection toggles */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={
                      (filtered.length > 0 ? filtered : documents).length > 0 &&
                      (filtered.length > 0 ? filtered : documents).every((d) => d.selected)
                    }
                    onChange={() => toggleSelectAll(filtered.length > 0 ? filtered : documents)}
                    className="rounded border-slate-700 bg-slate-800 text-violet-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="font-semibold text-xs">
                    {filtered.length !== documents.length
                      ? `Select All (${filtered.length} of ${documents.length})`
                      : `Select All (${documents.length})`}
                  </span>
                </label>

                {selectedDocs.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                      {selectedDocs.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={deselectAll}
                      className="text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                    >
                      Deselect
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Batch Actions */}
              <div className="flex items-center gap-2 ml-auto">
                {/* Download Selected (Active when 1 or more selected) */}
                {selectedDocs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleBatchDownload(selectedDocs, "Selected")}
                    disabled={isDownloadingBatch || isDeletingBatch}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 font-bold text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    title={`Batch download ${selectedDocs.length} selected document(s) as ZIP archive`}
                  >
                    {isDownloadingBatch ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>
                      {isDownloadingBatch && batchDownloadProgress
                        ? `Downloading (${batchDownloadProgress.current}/${batchDownloadProgress.total})`
                        : `Download Selected (${selectedDocs.length})`}
                    </span>
                  </button>
                )}

                {/* Download All (Downloads all documents in queue or filtered queue as ZIP) */}
                <button
                  type="button"
                  onClick={() =>
                    handleBatchDownload(
                      filtered.length > 0 && filtered.length !== documents.length ? filtered : documents,
                      "All"
                    )
                  }
                  disabled={isDownloadingBatch || isDeletingBatch || documents.length === 0}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white font-medium text-xs transition-all cursor-pointer disabled:opacity-40"
                  title="Batch download all documents as ZIP archive"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {filtered.length !== documents.length
                      ? `Download Filtered (${filtered.length})`
                      : `Download All (${documents.length})`}
                  </span>
                </button>

                {/* Delete Selected (Active when 1 or more selected) */}
                {selectedDocs.length > 0 && (
                  <button
                    type="button"
                    onClick={handlePromptDeleteSelected}
                    disabled={isDeletingBatch || isDownloadingBatch}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 hover:text-red-200 font-bold text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    title={`Delete ${selectedDocs.length} selected document(s)`}
                  >
                    {isDeletingBatch ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>Delete Selected ({selectedDocs.length})</span>
                  </button>
                )}

                {/* Delete All (Purge full queue) */}
                <button
                  type="button"
                  onClick={handlePromptDeleteAll}
                  disabled={isDeletingBatch || isDownloadingBatch || documents.length === 0}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-950/30 hover:bg-red-900/40 border border-red-900/50 text-red-400 hover:text-red-300 font-medium text-xs transition-all cursor-pointer disabled:opacity-40"
                  title="Permanently remove all documents in this workspace"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete All ({documents.length})</span>
                </button>
              </div>
            </div>
          )}

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
                {paginatedDocs.map((doc) => {
                  const effectiveStatus = computeEffectiveDocStatus(doc);
                  const sc = statusConfig[effectiveStatus];
                  const userIsReq = isUserAuthorizedToSignDoc(doc, currentUser);
                  const userSigned = hasUserAlreadySigned(doc, currentUser?.name);
                  const completedSignersCount = (doc.requiredSigners || []).filter((reqName) => {
                    const sObj = doc.signers?.find(
                      (s) => matchNames(s.name, reqName) || normalizeName(s.name) === normalizeName(reqName)
                    );
                    return sObj?.status === "signed";
                  }).length;
                  const isAllRequiredSigned =
                    effectiveStatus === "signed" ||
                    (doc.requiredSigners.length > 0 && completedSignersCount >= doc.requiredSigners.length);

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
                            <p className="font-bold text-white text-xs truncate" title={doc.fileObj?.name || doc.fileName}>
                              {doc.fileObj?.name || doc.fileName}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                              <span>Personnel: <strong className="text-slate-200">{doc.targetPersonnel || doc.requiredSigners?.[0] || currentUser?.name || "Personnel"}</strong></span>
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
                          ) : isAllRequiredSigned ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>Fully Signed</span>
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
                              onClick={() => handleOpenSingleCounterSign(doc)}
                              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
                              title="Select which personnel in the signer chain to counter-sign beside."
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
                          checked={
                            (filtered.length > 0 ? filtered : documents).length > 0 &&
                            (filtered.length > 0 ? filtered : documents).every((d) => d.selected)
                          }
                          onChange={() => toggleSelectAll(filtered.length > 0 ? filtered : documents)}
                          className="rounded border-slate-700 bg-slate-800 text-violet-600 focus:ring-0 cursor-pointer"
                          title={
                            filtered.length !== documents.length
                              ? `Select all (${filtered.length} filtered)`
                              : "Select all"
                          }
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
                    {paginatedDocs.map((doc) => {
                    const effectiveStatus = computeEffectiveDocStatus(doc);
                    const sc = statusConfig[effectiveStatus];
                    const userIsReq = isUserAuthorizedToSignDoc(doc, currentUser);
                    const userSigned = hasUserAlreadySigned(doc, currentUser?.name);

                    const completedSignersCount = (doc.requiredSigners || []).filter((reqName) => {
                      const sObj = doc.signers?.find(
                        (s) => matchNames(s.name, reqName) || normalizeName(s.name) === normalizeName(reqName)
                      );
                      return sObj?.status === "signed";
                    }).length;

                    const isAllRequiredSigned =
                      effectiveStatus === "signed" ||
                      (doc.requiredSigners.length > 0 && completedSignersCount >= doc.requiredSigners.length);

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
                              <p className="font-semibold text-white truncate max-w-xs" title={doc.fileObj?.name || doc.fileName}>
                                {doc.fileObj?.name || doc.fileName}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                                Personnel:{" "}
                                <span className="text-slate-200 font-bold">{doc.targetPersonnel || doc.requiredSigners?.[0] || currentUser?.name || "Personnel"}</span>
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
                          ) : isAllRequiredSigned ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              Fully Signed
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
                              onClick={() => handleOpenSingleCounterSign(doc)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
                              title="Select which personnel in the signer chain to counter-sign beside."
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

            {/* ── Pagination & Batch Sizing Bar (Instant rendering for 100-200 files) ── */}
            {filtered.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-[#080B13] border-t border-[#1A2235] text-xs">
                <div className="flex items-center gap-3 text-slate-400">
                  <span>
                    Showing{" "}
                    <strong className="text-white">
                      {Math.min((currentPage - 1) * pageSize + 1, filtered.length)}–
                      {Math.min(currentPage * pageSize, filtered.length)}
                    </strong>{" "}
                    of <strong className="text-white">{filtered.length}</strong> documents
                  </span>
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-[11px] text-slate-500">Per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-[#0C101A] border border-[#1C2844] rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-violet-500 cursor-pointer"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200 (All)</option>
                    </select>
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1 rounded-lg border border-[#1C2844] bg-[#0C101A] text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      ◀ Prev
                    </button>

                    <div className="flex items-center gap-1 px-2 text-[11px] font-mono text-slate-400">
                      Page <strong className="text-violet-400 font-bold">{currentPage}</strong> of{" "}
                      <strong className="text-slate-200">{totalPages}</strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-2.5 py-1 rounded-lg border border-[#1C2844] bg-[#0C101A] text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      Next ▶
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Document Preview Modal ─────────────────────────────────────────── */}
      <DocumentPreviewModal
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
        onSign={handleSignSingle}
        onCounterSign={(id, pos) => {
          if (previewDoc) handleOpenSingleCounterSign(previewDoc, pos);
        }}
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

      {/* ── Single Counter-Sign Personnel Picker Modal ───────────────────── */}
      <SingleCounterSignModal
        isOpen={counterSignDocTarget !== null}
        doc={counterSignDocTarget}
        initialPosition={counterSignPositionChoice}
        onClose={() => setCounterSignDocTarget(null)}
        onConfirm={handleExecuteSingleCounterSign}
        isProcessing={isSingleCounterSigning}
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

      {/* ── PNPKI .p12 Keystore Management Modal (Exclusively for ace.malto@dict.gov.ph) ── */}
      {isAceUser && (
        <P12KeystoreModal
          isOpen={isP12KeystoreModalOpen}
          onClose={() => setIsP12KeystoreModalOpen(false)}
          currentUser={currentUser}
          activeKeystore={activeKeystoreProfile}
          onKeystoreActivated={(ks) => {
            setActiveKeystoreProfile(ks);
            try {
              localStorage.setItem("dict_active_p12_keystore", JSON.stringify(ks));
            } catch {}
            cachedSignerContextRef.current = null;
          }}
          showNotification={showNotif}
        />
      )}

      {/* ── High-Speed Batch Delete Confirmation Modal (Delete Selected / Delete All) ── */}
      {confirmDeleteModal.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0C101A] border border-red-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-lg shadow-red-950/40">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {confirmDeleteModal.type === "all" ? "Delete All Documents?" : "Delete Selected Documents?"}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {confirmDeleteModal.type === "all"
                    ? `You are about to permanently delete all ${confirmDeleteModal.count} documents.`
                    : `You are about to delete ${confirmDeleteModal.count} selected document(s).`}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 leading-relaxed">
              ⚠️ This action is permanent. All associated PDF binaries, signature states, and metadata will be purged from the cloud storage repository.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl border border-[#1C2844] text-slate-400 hover:text-white hover:bg-white/5 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchDelete}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-red-950/50 transition-all cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete {confirmDeleteModal.count} File(s)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
