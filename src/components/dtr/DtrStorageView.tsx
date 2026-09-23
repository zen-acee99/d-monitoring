import React, { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Filter,
  Eye,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Building,
  User,
  Calendar,
  Layers,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  ShieldCheck,
  Check,
  X,
  FileSignature,
  Loader2,
  AlertCircle,
  Upload
} from "lucide-react";
import {
  DtrModuleCategory,
  ProvincialTab,
  DtrStorageItem,
  getDtrStorage,
  saveDtrStorage,
  deleteDtrRecord,
  updateDtrRecord,
  syncDtrStorageWithBackend,
  getCachedPdfDataUrl,
  setCachedPdfDataUrl
} from "@/data/dtrStorage";
import { DtrPdfModal } from "./DtrPdfModal";
import { DtrUploadModal } from "./DtrUploadModal";
import { exportDtrToExcel } from "@/utils/dtrUtils";
import { getSignedDtrVectorPdfBytes, downloadDtrVectorPdf, signUploadedArPdfBytes } from "@/utils/dtrVectorPdf";
import { dtrGeneratorApi, dtrStorageApi, DtrGeneratorSignatureRecord } from "@/services/api";
import { getCurrentUser, AUTH_EVENT } from "@/services/authStore";
import { UserRecord } from "@/data/userStore";
import { subscribeToDtrRealtime, broadcastLocalDtrEvent } from "@/services/dtrRealtime";

interface DtrStorageViewProps {
  module: DtrModuleCategory;
  province?: ProvincialTab;
  title: string;
  description: string;
}

export function DtrStorageView({
  module,
  province,
  title,
  description
}: DtrStorageViewProps) {
  const [records, setRecords] = useState<DtrStorageItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedRecordForPdf, setSelectedRecordForPdf] = useState<DtrStorageItem | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<"DTR" | "AR">("AR");
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(() => getCurrentUser());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // User signing credentials state
  const [userSigProfile, setUserSigProfile] = useState<DtrGeneratorSignatureRecord | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Selected records for bulk signing
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkSigning, setIsBulkSigning] = useState(false);
  const [bulkSignProgress, setBulkSignProgress] = useState<{ current: number; total: number } | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = () => {
    const all = getDtrStorage();
    setRecords(all);
  };

  // Load active user's PNPKI and DigiSigned profile
  const loadUserSigningProfile = async (user: UserRecord | null) => {
    if (!user) {
      setUserSigProfile(null);
      return;
    }
    setLoadingProfile(true);
    try {
      let match: DtrGeneratorSignatureRecord | null = null;
      if (user.id) {
        const list = await dtrGeneratorApi.getRecords({ user_Id: String(user.id) });
        if (Array.isArray(list) && list.length > 0) {
          match = list.find((p) => p.user_Id === String(user.id) || p.id === `dtr-sig-${user.id}`) || list[0];
        }
      }
      if (!match && user.name) {
        const list = await dtrGeneratorApi.getRecords({ Name: user.name });
        if (Array.isArray(list) && list.length > 0) {
          match = list.find((p) => p.Name.toLowerCase() === user.name.toLowerCase()) || list[0];
        }
      }
      if (!match) {
        const all = await dtrGeneratorApi.getRecords();
        if (Array.isArray(all) && all.length > 0) {
          match =
            all.find(
              (p) =>
                p.user_Id === String(user.id) ||
                (p.Name && user.name && p.Name.toLowerCase() === user.name.toLowerCase()) ||
                (p.Name && user.name && (p.Name.toLowerCase().includes(user.name.toLowerCase()) || user.name.toLowerCase().includes(p.Name.toLowerCase())))
            ) || null;
        }
      }
      setUserSigProfile(match);
    } catch (e) {
      console.warn("Could not load user signing profile:", e);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadData();
    loadUserSigningProfile(currentUser);
    syncDtrStorageWithBackend().then((synced) => {
      if (Array.isArray(synced)) setRecords(synced);
    }).catch(() => {});

    const handleAuthChange = () => {
      const u = getCurrentUser();
      setCurrentUser(u);
      loadUserSigningProfile(u);
    };

    const handleStorageUpdate = () => {
      loadData();
    };

    // Realtime Event Subscription (SSE & BroadcastChannel for instant cross-tab / cross-browser sync)
    const unsubscribeRealtime = subscribeToDtrRealtime((event) => {
      if (event.type === "INSERT" && event.record) {
        setRecords((prev) => [event.record, ...prev.filter((r) => r.id !== event.record.id)]);
      } else if (event.type === "UPDATE" && event.record) {
        setRecords((prev) =>
          prev.map((r) => (r.id === event.record.id ? { ...r, ...event.record } : r))
        );
      } else if (event.type === "DELETE" && event.id) {
        setRecords((prev) => prev.filter((r) => r.id !== event.id));
        setSelectedIds((prev) => prev.filter((id) => id !== event.id));
      }
    });

    // Secondary background sync polling every 3s as fallback
    const pollInterval = setInterval(() => {
      syncDtrStorageWithBackend().then((synced) => {
        if (Array.isArray(synced)) {
          setRecords(synced);
        }
      }).catch(() => {});
    }, 3000);

    const handleFocus = () => {
      loadData();
      syncDtrStorageWithBackend().then((synced) => {
        if (Array.isArray(synced)) setRecords(synced);
      }).catch(() => {});
    };

    window.addEventListener("dict_dtr_storage_updated", handleStorageUpdate);
    window.addEventListener(AUTH_EVENT, handleAuthChange);
    window.addEventListener("dict_users_updated", handleAuthChange);
    window.addEventListener("storage", handleStorageUpdate);
    window.addEventListener("focus", handleFocus);

    return () => {
      unsubscribeRealtime();
      clearInterval(pollInterval);
      window.removeEventListener("dict_dtr_storage_updated", handleStorageUpdate);
      window.removeEventListener(AUTH_EVENT, handleAuthChange);
      window.removeEventListener("dict_users_updated", handleAuthChange);
      window.removeEventListener("storage", handleStorageUpdate);
      window.removeEventListener("focus", handleFocus);
    };
  }, [module, province]);

  // Determine if the current user has authority to use Bulk Signing
  const canBulkSign = React.useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.status === "inactive") return false;

    const role = (currentUser.role || "").trim().toLowerCase();

    // 1. Super Admin, Admin, and Regional Leadership (Always authorized across all archives)
    if (
      role === "super admin" ||
      role === "admin" ||
      role.includes("super admin") ||
      role.includes("admin") ||
      role.includes("regional director") ||
      role.includes("asst. regional director") ||
      role.includes("assistant regional director")
    ) {
      return true;
    }

    // 2. Technical Operations Division (TOD) leadership
    if (
      role.includes("technical operations") ||
      role.includes("oic chief - technical operations") ||
      role.includes("oic chief") ||
      role.includes("tod")
    ) {
      return true;
    }

    // 3. Provincial Officer (PO) - Authorized for their assigned province or in general
    if (
      role.includes("provincial officer") ||
      role === "po" ||
      role.startsWith("po ") ||
      (currentUser.position && currentUser.position.toLowerCase().includes("provincial officer"))
    ) {
      // If we are in the provincial view, verify if the PO is assigned to this province or has regional jurisdiction
      if (module === "PROVINCIAL" && province) {
        if (!currentUser.focalProvince || currentUser.focalProvince === "All" || currentUser.focalProvince.toLowerCase().includes("all")) {
          return true;
        }
        const userScope = currentUser.focalProvince.toLowerCase();
        const tabScope = province.toLowerCase();
        return userScope.includes(tabScope) || tabScope.includes(userScope);
      }
      return true;
    }

    return false;
  }, [currentUser, module, province]);

  // Check user's signing assets requirements - strictly based on user's actual uploaded profile assets
  const hasP12Cert = Boolean(userSigProfile?.hasP12 || userSigProfile?.p12);
  const hasDigiSignedImg = Boolean(userSigProfile?.hasImageDigiSigned || userSigProfile?.image_digiSigned);
  const isSigningAssetsReady = hasP12Cert && hasDigiSignedImg;

  // Compute disabled tooltip explanation
  const signingAssetsTooltip = React.useMemo(() => {
    if (!hasP12Cert && !hasDigiSignedImg) {
      return "You haven't uploaded your PNPKI .p12 certificate and DigiSigned image.";
    }
    if (!hasP12Cert) {
      return "You haven't uploaded your PNPKI .p12 certificate.";
    }
    if (!hasDigiSignedImg) {
      return "You haven't uploaded your DigiSigned image.";
    }
    return "";
  }, [hasP12Cert, hasDigiSignedImg]);

  // Filter records specifically for this module and province
  const scopedRecords = records.filter((r) => {
    if (r.module?.toUpperCase() !== module?.toUpperCase()) return false;
    if (module === "PROVINCIAL" && province) {
      const p1 = (r.province || "").toLowerCase().trim();
      const p2 = province.toLowerCase().trim();
      if (p2.includes("regional") || p2 === "ro") {
        return p1.includes("regional") || p1 === "ro" || p1.includes("office");
      }
      return p1 === p2 || p1.includes(p2) || p2.includes(p1);
    }
    return true;
  });

  // Helper to extract timestamp for descending sorting (newest upload first)
  const getRecordTimestamp = (r: DtrStorageItem): number => {
    if (r.createdAt && typeof r.createdAt === "number" && !isNaN(r.createdAt)) {
      return r.createdAt;
    }
    if (r.submittedDate) {
      const parsed = Date.parse(r.submittedDate);
      if (!isNaN(parsed)) return parsed;
    }
    // Attempt extraction from ID if it contains a timestamp snippet
    const idParts = (r.id || "").split("-");
    for (const part of idParts) {
      const num = Number(part);
      if (!isNaN(num) && num > 100000) {
        return num;
      }
    }
    return 0;
  };

  // Sort scoped records descending so the newest upload appears in the first row
  const sortedScopedRecords = [...scopedRecords].sort((a, b) => {
    const timeA = getRecordTimestamp(a);
    const timeB = getRecordTimestamp(b);
    if (timeA !== timeB) {
      return timeB - timeA; // Descending
    }
    return (b.id || "").localeCompare(a.id || "");
  });

  const filteredRecords = sortedScopedRecords.filter((r) => {
    const matchesSearch =
      r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.position.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      r.periodText.toLowerCase().includes(search.toLowerCase()) ||
      (r.pdfFileName && r.pdfFileName.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === "All" || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Eligible records for signing (records that are not already Approved or Verified)
  const eligibleRecords = filteredRecords.filter((r) => r.status === "Submitted" || r.status === "For Revision");

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // Select all eligible records in the current view
      const eligibleIds = eligibleRecords.map((r) => r.id);
      setSelectedIds(eligibleIds.length > 0 ? eligibleIds : filteredRecords.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Calculate statistics
  const totalCount = scopedRecords.length;
  const approvedCount = scopedRecords.filter((r) => r.status === "Approved").length;
  const verifiedCount = scopedRecords.filter((r) => r.status === "Verified").length;
  const pendingCount = scopedRecords.filter((r) => r.status === "Submitted").length;
  const totalHours = scopedRecords.reduce((acc, r) => acc + (r.totalHoursRendered || 0), 0);

  // Handlers
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleOpenPdf = (record: DtrStorageItem) => {
    setSelectedRecordForPdf(record);
    setIsPdfModalOpen(true);
  };

  const handleDownloadRecord = async (item: DtrStorageItem) => {
    setDownloadingId(item.id);
    try {
      let dataUrl = item.pdfDataUrl || getCachedPdfDataUrl(item.id);
      if (!dataUrl) {
        try {
          const full = await dtrStorageApi.getRecord(item.id);
          if (full && full.pdfDataUrl) {
            dataUrl = full.pdfDataUrl;
            setCachedPdfDataUrl(item.id, full.pdfDataUrl);
          }
        } catch {}
      }

      if (dataUrl && dataUrl.startsWith("data:application/pdf;base64,")) {
        const base64 = dataUrl.split(",")[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = item.pdfFileName || `DTR_${item.employeeName}_${item.year}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showNotification(`✓ Downloaded ${item.pdfFileName || "signed DTR PDF"}`);
        return;
      }

      const supervisorName = (item.supervisorName || "RENE JANE R. BUENA").trim();
      const supervisorTitle = (item.supervisorTitle || (item.province ? `Provincial Officer - ${item.province}` : "Provincial Officer")).trim();
      const signerName = (item.signerName || userSigProfile?.Name || currentUser?.name || "Super Admin").trim();

      const p12Options = userSigProfile && (userSigProfile.hasP12 || userSigProfile.p12)
        ? {
            profileId: userSigProfile.id,
            user_Id: userSigProfile.user_Id || String(currentUser?.id || ""),
            p12Base64: userSigProfile.p12 || undefined,
            signerName,
          }
        : {
            signerName,
          };

      await downloadDtrVectorPdf(
        {
          employeeName: item.employeeName,
          supervisorName,
          supervisorTitle,
          periodText: item.periodText,
          regularHours: item.regularHours,
          saturdayHours: item.saturdayHours,
          month: item.month,
          year: item.year,
          scope: item.scope,
          status: item.status,
          employeeSignatureImage: item.employeeSignatureImage || item.signatureImage,
          employeeHasP12: item.employeeHasP12 ?? item.hasP12,
          employeeSignerName: item.employeeSignerName || item.employeeName,
          supervisorSignatureImage: item.supervisorSignatureImage || (item.status !== "Submitted" ? userSigProfile?.image_digiSigned : undefined),
          supervisorHasP12: Boolean(item.supervisorHasP12 && (item.status === "Verified" || item.status === "Approved")),
          signerName,
        } as any,
        item.rows,
        item.supervisorSignatureImage || (item.status !== "Submitted" ? (userSigProfile?.image_digiSigned || item.signatureImage) : undefined),
        Boolean((item.status === "Verified" || item.status === "Approved") && (item.supervisorHasP12 || userSigProfile?.hasP12)),
        p12Options
      );

      showNotification(`✓ Downloaded ${item.pdfFileName || "signed DTR PDF"}`);
    } catch (err: any) {
      console.error("Failed to download PDF with p12:", err);
      showNotification(`Failed to download PDF: ${err.message || "Error"}`);
    } finally {
      setDownloadingId(null);
    }
  };

  // Helper to digitally sign a single record (DTR or AR)
  const signSingleItem = async (
    item: DtrStorageItem,
    supervisorName: string,
    supervisorTitle: string,
    signerName: string,
    p12Options: any
  ): Promise<{ pdfDataUrl: string; resolvedSignerName: string }> => {
    const isAR = item.docType === "AR" || (item.pdfFileName && item.pdfFileName.startsWith("AR_"));

    if (isAR) {
      let arDataUrl = item.pdfDataUrl || getCachedPdfDataUrl(item.id);
      if (!arDataUrl) {
        try {
          const full = await dtrStorageApi.getRecord(item.id);
          if (full && full.pdfDataUrl) {
            arDataUrl = full.pdfDataUrl;
            setCachedPdfDataUrl(item.id, full.pdfDataUrl);
          }
        } catch {}
      }

      if (arDataUrl) {
        const cleanBase64 = arDataUrl.replace(/^data:application\/pdf;base64,/, "");
        const binary = atob(cleanBase64);
        const pdfBytes = new Uint8Array(binary.length);
        for (let b = 0; b < binary.length; b++) {
          pdfBytes[b] = binary.charCodeAt(b);
        }

        const { bytes, resolvedSignerName } = await signUploadedArPdfBytes(
          pdfBytes,
          signerName,
          userSigProfile?.image_digiSigned || item.supervisorSignatureImage,
          p12Options,
          supervisorTitle
        );

        let outBinary = "";
        const len = bytes.byteLength;
        for (let j = 0; j < len; j++) {
          outBinary += String.fromCharCode(bytes[j]);
        }
        const signedPdfDataUrl = `data:application/pdf;base64,${btoa(outBinary)}`;
        setCachedPdfDataUrl(item.id, signedPdfDataUrl);
        return { pdfDataUrl: signedPdfDataUrl, resolvedSignerName: resolvedSignerName || signerName };
      }
    }

    // Standard DTR document signing
    const { bytes, resolvedSignerName } = await getSignedDtrVectorPdfBytes(
      {
        employeeName: item.employeeName,
        supervisorName,
        supervisorTitle,
        periodText: item.periodText,
        regularHours: item.regularHours,
        saturdayHours: item.saturdayHours,
        month: item.month,
        year: item.year,
        scope: item.scope,
        status: "Verified",
        employeeSignatureImage: item.employeeSignatureImage || item.signatureImage,
        employeeHasP12: item.employeeHasP12 ?? item.hasP12,
        employeeSignerName: item.employeeSignerName || item.employeeName,
        supervisorSignatureImage: userSigProfile?.image_digiSigned || item.supervisorSignatureImage,
        supervisorHasP12: true,
        signerName: signerName,
      } as any,
      item.rows,
      userSigProfile?.image_digiSigned || item.supervisorSignatureImage || item.signatureImage,
      hasP12Cert,
      p12Options
    );

    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const pdfDataUrl = `data:application/pdf;base64,${btoa(binary)}`;
    return { pdfDataUrl, resolvedSignerName: resolvedSignerName || signerName };
  };

  // Single Record Signing with user's credentials
  const handleSignRecord = async (item: DtrStorageItem) => {
    if (item.status === "Approved" || item.status === "Verified") {
      return;
    }

    if (!canBulkSign) {
      showNotification("Signing authority required: Only assigned Provincial Officers or Super Admin can sign documents.");
      return;
    }

    if (!isSigningAssetsReady) {
      showNotification(`Cannot sign: ${signingAssetsTooltip}`);
      return;
    }

    try {
      const supervisorName = (item.supervisorName || "RENE JANE R. BUENA").trim();
      const supervisorTitle = (item.supervisorTitle || (item.province ? `Provincial Officer - ${item.province}` : "Provincial Officer")).trim();
      const signerName = (userSigProfile?.Name || currentUser?.name || "Super Admin").trim();

      const p12Options = userSigProfile
        ? {
            profileId: userSigProfile.id,
            user_Id: userSigProfile.user_Id || String(currentUser?.id || ""),
            p12Base64: userSigProfile.p12 || undefined,
            signerName,
          }
        : {
            signerName,
          };

      const { pdfDataUrl, resolvedSignerName } = await signSingleItem(
        item,
        supervisorName,
        supervisorTitle,
        signerName,
        p12Options
      );

      const updatedFields: Partial<DtrStorageItem> = {
        status: "Verified",
        supervisorName,
        supervisorTitle,
        signerName: resolvedSignerName || signerName,
        supervisorSignatureImage: userSigProfile?.image_digiSigned || item.supervisorSignatureImage,
        supervisorHasP12: true,
        hasP12: true,
        signatureImage: userSigProfile?.image_digiSigned || item.signatureImage,
        pdfDataUrl,
      };

      // Optimistic update in state immediately!
      setRecords((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, ...updatedFields } : r))
      );

      updateDtrRecord(item.id, updatedFields);

      const docLabel = item.docType === "AR" ? "Accomplishment Report" : "DTR";
      showNotification(`✓ ${docLabel} for ${item.employeeName} digitally verified & signed by ${resolvedSignerName || signerName}!`);
    } catch (err: any) {
      console.error("Single document signing failed:", err);
      showNotification(`Failed to digitally sign document: ${err.message || "Error"}`);
    }
  };

  // Bulk Signing Execution (Batch signing of selected or pending records)
  const handleBulkSignExecute = async () => {
    if (!isSigningAssetsReady) {
      showNotification(`Cannot proceed: ${signingAssetsTooltip}`);
      return;
    }

    // Determine target records: if user selected specific records, sign those; otherwise sign all eligible pending records
    let targets = filteredRecords.filter((r) => selectedIds.includes(r.id));
    if (targets.length === 0) {
      targets = eligibleRecords;
    }

    // Filter out records that are already signed/verified/approved to prevent duplicate signing
    const recordsToSign = targets.filter((r) => r.status !== "Approved" && r.status !== "Verified");

    if (recordsToSign.length === 0) {
      showNotification("All selected documents are already digitally signed.");
      return;
    }

    setIsBulkSigning(true);
    setBulkSignProgress({ current: 0, total: recordsToSign.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < recordsToSign.length; i++) {
      const item = recordsToSign[i];
      setBulkSignProgress({ current: i + 1, total: recordsToSign.length });

      const supervisorName = (item.supervisorName || "RENE JANE R. BUENA").trim();
      const supervisorTitle = (item.supervisorTitle || (item.province ? `Provincial Officer - ${item.province}` : "Provincial Officer")).trim();
      const signerName = (userSigProfile?.Name || currentUser?.name || "Super Admin").trim();

      const p12Options = userSigProfile
        ? {
            profileId: userSigProfile.id,
            user_Id: userSigProfile.user_Id || String(currentUser?.id || ""),
            p12Base64: userSigProfile.p12 || undefined,
            signerName,
          }
        : {
            signerName,
          };

      try {
        const { pdfDataUrl, resolvedSignerName } = await signSingleItem(
          item,
          supervisorName,
          supervisorTitle,
          signerName,
          p12Options
        );

        const updatedFields: Partial<DtrStorageItem> = {
          status: "Verified",
          supervisorName,
          supervisorTitle,
          signerName: resolvedSignerName || signerName,
          supervisorSignatureImage: userSigProfile?.image_digiSigned || item.supervisorSignatureImage,
          supervisorHasP12: true,
          hasP12: true,
          signatureImage: userSigProfile?.image_digiSigned || item.signatureImage,
          pdfDataUrl,
        };

        // Instant optimistic update per item as it finishes signing
        setRecords((prev) =>
          prev.map((r) => (r.id === item.id ? { ...r, ...updatedFields } : r))
        );

        updateDtrRecord(item.id, updatedFields);

        successCount++;
      } catch (err: any) {
        console.error(`Failed to bulk sign document for ${item.employeeName}:`, err);
        failCount++;
      }
    }

    setIsBulkSigning(false);
    setBulkSignProgress(null);
    setSelectedIds([]);

    if (failCount === 0) {
      showNotification(`✓ ${successCount} document(s) successfully signed.`);
    } else {
      showNotification(`${successCount} document(s) successfully signed. ${failCount} failed to sign.`);
    }
  };

  const handleDelete = async (id: string) => {
    setRecords((prev) => prev.filter((item) => item !== id));
    deleteDtrRecord(id);
    setSelectedIds((prev) => prev.filter((item) => item !== id));
    setDeleteConfirmId(null);
    showNotification("DTR record deleted from storage.");
    try {
      await dtrStorageApi.deleteRecord(id);
      await syncDtrStorageWithBackend();
    } catch {}
  };

  const handleStatusChange = (id: string, newStatus: "Submitted" | "Verified" | "Approved") => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    updateDtrRecord(id, { status: newStatus });
    showNotification(`Status updated to ${newStatus}`);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner with Stats */}
      <div className="bg-[#0C101D] border border-[#18233C] p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
              DTR Document Storage
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
              {module === "PROVINCIAL" ? `Provincial: ${province}` : `${module} Module`}
            </span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            {title}
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            {description}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {notification && (
            <div className="px-3.5 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl animate-in fade-in flex items-center gap-1.5 shadow-lg">
              <Check className="w-4 h-4 text-emerald-400" />
              {notification}
            </div>
          )}

          {canBulkSign && (
            <div className="relative group/bulk">
              <button
                type="button"
                onClick={handleBulkSignExecute}
                disabled={!isSigningAssetsReady || isBulkSigning || (eligibleRecords.length === 0 && selectedIds.length === 0)}
                title={!isSigningAssetsReady ? signingAssetsTooltip : isBulkSigning ? "Signing documents with PNPKI keystore..." : `Digitally sign ${selectedIds.length > 0 ? selectedIds.length : eligibleRecords.length} pending document(s)`}
                className={`flex items-center gap-2 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg select-none shrink-0 ${
                  isSigningAssetsReady && (eligibleRecords.length > 0 || selectedIds.length > 0) && !isBulkSigning
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/40 cursor-pointer active:scale-95"
                    : "bg-slate-800/80 text-slate-400 border border-slate-700/60 cursor-not-allowed opacity-60 shadow-none"
                }`}
              >
                {isBulkSigning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    <span>Signing... ({bulkSignProgress ? `${bulkSignProgress.current} of ${bulkSignProgress.total}` : "processing"})</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4" />
                    <span>
                      Bulk Signing
                      {selectedIds.length > 0
                        ? ` (${selectedIds.length})`
                        : eligibleRecords.length > 0
                        ? ` (${eligibleRecords.length})`
                        : ""}
                    </span>
                  </>
                )}
              </button>

              {/* Explanatory Tooltip when credentials are not configured */}
              {!isSigningAssetsReady && (
                <div className="absolute right-0 top-full mt-2 hidden group-hover/bulk:flex flex-col z-50 w-72 p-2.5 bg-[#080B14] border border-amber-500/40 rounded-xl shadow-2xl text-[11px] text-amber-200 pointer-events-none animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300 mb-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Signing Assets Required</span>
                  </div>
                  <p className="leading-snug text-slate-300">
                    {signingAssetsTooltip}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800">
                    Configure your credentials in the <strong>DTR Generator</strong> profile.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Upload AR (Accomplishment Report) Button */}
          <button
            type="button"
            onClick={() => {
              setUploadDocType("AR");
              setIsUploadModalOpen(true);
            }}
            className="flex items-center gap-2 font-bold px-4 py-2.5 rounded-xl text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/40 transition-all cursor-pointer select-none active:scale-95 shrink-0"
            title="Upload Personnel Accomplishment Report (AR) PDF"
          >
            <Upload className="w-4 h-4" />
            <span>Upload AR</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total DTR Records
          </div>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {totalCount}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Archived personnel submissions
          </div>
        </div>

        <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
          <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved & Verified
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
            {approvedCount + verifiedCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {approvedCount} Approved • {verifiedCount} Verified
          </div>
        </div>

        <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Pending Review
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">
            {pendingCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Awaiting focal verification
          </div>
        </div>

        <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
          <div className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
            Total Rendered Hours
          </div>
          <div className="text-2xl font-black text-purple-400 font-mono mt-1">
            {totalHours.toLocaleString()} hrs
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Official regular working time
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl overflow-hidden shadow-xl flex flex-col">
        
        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-[#18233C] bg-[#080B14] flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          <div className="relative flex-1 md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="search"
              placeholder="Search by personnel name, position, ID, or period..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[#1C2844] bg-[#111728] pl-10 pr-4 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none placeholder:text-slate-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Verified">Verified</option>
              <option value="Submitted">Submitted (Pending)</option>
              <option value="For Revision">For Revision</option>
            </select>
          </div>
        </div>

        {/* Table of Stored DTR Documents */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-extrabold text-slate-400 uppercase bg-[#111728] border-b border-[#18233C] tracking-wider">
              <tr>
                {canBulkSign && (
                  <th className="px-4 py-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredRecords.length > 0 &&
                        selectedIds.length > 0 &&
                        (selectedIds.length === filteredRecords.length || (eligibleRecords.length > 0 && selectedIds.length === eligibleRecords.length))
                      }
                      onChange={handleSelectAll}
                      title="Select all eligible pending DTR records"
                      className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500/30 cursor-pointer w-4 h-4"
                    />
                  </th>
                )}
                <th className="px-6 py-4">Personnel Profile</th>
                <th className="px-5 py-4">Designation & Unit</th>
                <th className="px-5 py-4">Attached Document</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-6 py-4 text-right">PDF Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#18233C]/60 text-xs">
              {filteredRecords.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const isSigned = item.status === "Approved" || item.status === "Verified";
                const displayStatus = item.status || "Submitted";
                const statusBadge =
                  displayStatus === "Approved"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : displayStatus === "Verified"
                    ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    : displayStatus === "For Revision"
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    : "bg-slate-700/40 text-slate-300 border-slate-600/40";

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-[#111728]/40 transition-colors group ${
                      isSelected ? "bg-blue-900/15" : ""
                    }`}
                  >
                    {/* Select Checkbox */}
                    {canBulkSign && (
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.id)}
                          title={isSigned ? "Record already signed" : "Select for bulk signing"}
                          className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500/30 cursor-pointer w-4 h-4"
                        />
                      </td>
                    )}
                    {/* Personnel Profile */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-sm text-blue-400 shrink-0">
                          {item.employeeName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {item.employeeName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {item.employeeId}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Designation & Unit */}
                    <td className="px-5 py-4 space-y-1">
                      <div className="font-semibold text-slate-200">
                        {item.position}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#111728] border border-[#1C2844] text-slate-400">
                          {item.employmentStatus}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {item.sectionDivision}
                        </span>
                      </div>
                    </td>

                    {/* Attached Document info */}
                    <td className="px-5 py-4 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        {item.docType === "AR" || item.pdfFileName.startsWith("AR_") ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            AR
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                            PDF
                          </span>
                        )}
                        <span className="font-mono text-[11px] truncate max-w-[170px]" title={item.pdfFileName}>
                          {item.pdfFileName}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Size: {item.pdfFileSize} • {item.submittedDate}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border inline-flex items-center gap-1 ${statusBadge}`}>
                        {displayStatus === "Approved" && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                        {displayStatus === "Verified" && <ShieldCheck className="w-3 h-3 text-blue-400" />}
                        {displayStatus === "Submitted" && <Clock className="w-3 h-3 text-slate-400" />}
                        {displayStatus}
                      </span>
                    </td>

                    {/* PDF Actions (View PDF Modal, Sign, or Delete) */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        {/* View PDF Button (Opens Modal Viewer) */}
                        <button
                          type="button"
                          onClick={() => handleOpenPdf(item)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 hover:border-blue-500 text-blue-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                          title="Open PDF in Modal Viewer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View PDF</span>
                        </button>

                        {/* Download button when Verified / Approved, or Sign button when Submitted */}
                        {isSigned ? (
                          <button
                            type="button"
                            onClick={() => handleDownloadRecord(item)}
                            disabled={downloadingId === item.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 text-emerald-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                            title="Download PDF with embedded P12 digital signature"
                          >
                            {downloadingId === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            <span>Download</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSignRecord(item)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 text-emerald-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                            title={item.docType === "AR" || item.pdfFileName.startsWith("AR_") ? "Sign Accomplishment Report with PNPKI .p12 Keystore" : "Sign DTR with PNPKI .p12 Keystore"}
                          >
                            <FileSignature className="w-3.5 h-3.5" />
                            <span>{item.docType === "AR" || item.pdfFileName.startsWith("AR_") ? "Sign AR" : "Sign DTR"}</span>
                          </button>
                        )}

                        {/* Delete Record */}
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                      </div>
                    </td>

                  </tr>
                );
              })}

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={canBulkSign ? 6 : 5} className="px-6 py-12 text-center text-slate-500">
                    <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
                    <p className="text-sm font-semibold text-slate-400">
                      No document records found
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {search ? `No records matching "${search}"` : "No pending submissions in this storage archive."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0C101D] border border-[#18233C] p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Delete Document Record</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to remove this record and attached document from the storage archive?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30 transition-colors"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Modal Viewer */}
      <DtrPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => {
          setIsPdfModalOpen(false);
          setSelectedRecordForPdf(null);
        }}
        record={selectedRecordForPdf}
      />

      {/* Bulk Signing / Add DTR / Upload AR Modal */}
      <DtrUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        defaultModule={module}
        defaultProvince={province}
        defaultDocType={uploadDocType}
        onRecordSaved={(newRec) => {
          const label = newRec.docType === "AR" ? "Accomplishment Report" : "DTR record";
          showNotification(`✓ ${label} added for ${newRec.employeeName}`);
          setRecords((prev) => [newRec, ...prev.filter((r) => r.id !== newRec.id)]);
          loadData();
          syncDtrStorageWithBackend().then((synced) => {
            if (synced && synced.length > 0) setRecords(synced);
          }).catch(() => {});
        }}
      />

    </div>
  );
}
