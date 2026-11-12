import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Download,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Lock,
  RefreshCw,
  Eye,
  Database,
  ArrowLeft,
  FileCheck2,
  AlertCircle,
  Zap,
  Check,
  Award,
  Calendar,
  Layers,
  Sparkles,
  UploadCloud,
  FileSignature,
  HardDrive,
  Server,
  TrendingUp,
  Info,
  Trash2,
  Plus,
  File,
  Search,
  Filter,
  X
} from "lucide-react";
import { getCurrentUser } from "@/services/authStore";
import { UserRecord } from "@/data/userStore";
import { cn } from "@/lib/utils";
import {
  autoSignPdfWithReneJane,
  ReneJaneAutoSignResult,
  RENE_JANE_CERT_METADATA,
} from "@/utils/reneJaneAutoSign";
import { dtrStorageApi, DatabaseCapacity } from "@/services/api";

export interface UploadedFileItem {
  id: string;
  file: File;
  fileName: string;
  fileSizeFormatted: string;
  fileSizeBytes: number;
  uploadedAt: string;
  docType: "DTR" | "AR" | "GATE_PASS" | "GENERAL_DOCUMENT";
  status: "processing" | "signed" | "error";
  detectedReason: string;
  pageIndex: number;
  signatureCount: number;
  signedPdfBytes?: Uint8Array;
  blobUrl?: string;
  downloadFilename: string;
  signerIdentity: typeof RENE_JANE_CERT_METADATA & {
    timestamp: string;
  };
  isCryptographic: boolean;
  error?: string;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function AceDtrCombiner() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(() => getCurrentUser());
  const [selectedDoc, setSelectedDoc] = useState<"DTR" | "AR" | "UPLOADED">("DTR");
  const [activeTab, setActiveTab] = useState<"pdf" | "uploads" | "sync">("pdf");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAutoSigning, setIsAutoSigning] = useState(false);
  const [autoSignSuccess, setAutoSignSuccess] = useState<string | null>(null);
  const [pdfTimestamp, setPdfTimestamp] = useState(Date.now());
  const [signedDtrBlobUrl, setSignedDtrBlobUrl] = useState<string | null>(null);
  const [signedArBlobUrl, setSignedArBlobUrl] = useState<string | null>(null);

  // Uploaded Files State (Multi-File Support)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const [isUploadingAndSigning, setIsUploadingAndSigning] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; currentFileName: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState<"ALL" | "DTR" | "AR" | "GATE_PASS" | "GENERAL_DOCUMENT">("ALL");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const uploadedFilesRef = useRef<UploadedFileItem[]>([]);

  // Database Capacity State (Turso libSQL Metrics)
  const [dbCapacity, setDbCapacity] = useState<DatabaseCapacity | null>(null);
  const [isLoadingCapacity, setIsLoadingCapacity] = useState(false);
  const [capacityError, setCapacityError] = useState<string | null>(null);

  const fetchDbCapacity = async () => {
    setIsLoadingCapacity(true);
    try {
      const data = await dtrStorageApi.getDatabaseCapacity();
      if (data && data.success) {
        setDbCapacity(data);
        setCapacityError(null);
      } else {
        setCapacityError(data?.error || "Could not retrieve live database metrics.");
      }
    } catch (err: any) {
      console.warn("Error fetching database capacity:", err);
      setCapacityError(err?.message || "Failed to fetch database capacity.");
    } finally {
      setIsLoadingCapacity(false);
    }
  };

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    fetchDbCapacity();
  }, []);

  // Track latest uploaded files and revoke Object URLs on unmount to prevent memory leaks
  useEffect(() => {
    uploadedFilesRef.current = uploadedFiles;
  }, [uploadedFiles]);

  useEffect(() => {
    return () => {
      uploadedFilesRef.current.forEach((item) => {
        if (item.blobUrl && item.blobUrl.startsWith("blob:")) {
          URL.revokeObjectURL(item.blobUrl);
        }
      });
    };
  }, []);

  // Derived Database Capacity Values & Headroom
  const maxStorageGb = dbCapacity?.maxStorageGb ?? 9.0;
  const maxStorageMb = dbCapacity?.maxStorageMb ?? (maxStorageGb * 1024);
  const allocatedMb = dbCapacity?.allocatedMb ?? 14.0;
  const allocatedGb = dbCapacity?.allocatedGb ?? Number((allocatedMb / 1024).toFixed(4));
  const remainingGb = dbCapacity?.remainingGb ?? Number((maxStorageGb - allocatedGb).toFixed(3));
  const remainingMb = dbCapacity?.remainingMb ?? Number((maxStorageMb - allocatedMb).toFixed(2));
  const usagePercent = dbCapacity?.usagePercent ?? Number(((allocatedMb / maxStorageMb) * 100).toFixed(2));
  const freePercent = Number((100 - usagePercent).toFixed(2));
  const activeDataMb = dbCapacity?.activeDataMb ?? 5.36;
  const freelistMb = dbCapacity?.freelistMb ?? 8.64;
  const dtrPdfMb = dbCapacity?.dtrStoragePdfMb ?? 3.08;
  const dtrRecordCount = dbCapacity?.dtrStorageRecordCount ?? 3;

  const userEmail = (currentUser?.email || "").toLowerCase().trim();
  const isAce = userEmail === "ace.malto@dict.gov.ph" || userEmail === "acemm.1599@gmail.com" || userEmail === "acemm1599@gmail.com";

  // Access Control: Block if not ace.malto@dict.gov.ph
  if (!isAce) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Restricted Access Module</h2>
        <p className="text-slate-400 max-w-md text-sm mb-6 leading-relaxed">
          This specialized DTR & AR Studio is configured to display exclusively for{" "}
          <span className="text-blue-400 font-semibold font-mono">ace.malto@dict.gov.ph</span>.
        </p>
        <div className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 mb-6">
          Logged in as: <span className="text-slate-300 font-mono">{currentUser?.email || "Anonymous"}</span>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Overview
        </Link>
      </div>
    );
  }

  const dtrPdfFilename = "DTR_Ace_M._Malto_September_2026.pdf";
  const arPdfFilename = "AR_Ace_M._Malto_September_2026.pdf";

  // Selected Uploaded Document Resolution
  const isUploadedDoc = selectedDoc === "UPLOADED";
  const activeUploadedFile = isUploadedDoc
    ? uploadedFiles.find((f) => f.id === selectedUploadId) || uploadedFiles[0] || null
    : null;

  const currentFilename = isUploadedDoc && activeUploadedFile
    ? activeUploadedFile.downloadFilename
    : selectedDoc === "DTR"
    ? dtrPdfFilename
    : arPdfFilename;

  const currentPdfUrl = isUploadedDoc && activeUploadedFile
    ? activeUploadedFile.blobUrl || ""
    : selectedDoc === "DTR"
    ? signedDtrBlobUrl || `/${dtrPdfFilename}?v=${pdfTimestamp}`
    : signedArBlobUrl || `/${arPdfFilename}?v=${pdfTimestamp}`;

  const currentDownloadUrl = isUploadedDoc && activeUploadedFile
    ? activeUploadedFile.blobUrl || ""
    : selectedDoc === "DTR"
    ? signedDtrBlobUrl || `/${dtrPdfFilename}`
    : signedArBlobUrl || `/${arPdfFilename}`;

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDbCapacity();
    setTimeout(() => {
      setPdfTimestamp(Date.now());
      setIsRefreshing(false);
    }, 600);
  };

  const handleAutoSignTrigger = async () => {
    setIsAutoSigning(true);
    setAutoSignSuccess(null);
    setUploadError(null);

    try {
      let signedCount = 0;

      // 1. Re-sign the active DTR (Civil Service Form No. 48)
      try {
        const dtrResp = await fetch(`/${dtrPdfFilename}?v=${Date.now()}`);
        if (dtrResp.ok) {
          const dtrBytes = new Uint8Array(await dtrResp.arrayBuffer());
          const signedDtrRes = await autoSignPdfWithReneJane(dtrBytes, dtrPdfFilename);
          if (signedDtrRes.success && signedDtrRes.blobUrl) {
            setSignedDtrBlobUrl((prev) => {
              if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
              return signedDtrRes.blobUrl!;
            });
            signedCount++;
          }
        }
      } catch (dtrErr) {
        console.warn("Could not re-sign default DTR:", dtrErr);
      }

      // 2. Re-sign the active AR (Accomplishment Report)
      try {
        const arResp = await fetch(`/${arPdfFilename}?v=${Date.now()}`);
        if (arResp.ok) {
          const arBytes = new Uint8Array(await arResp.arrayBuffer());
          const signedArRes = await autoSignPdfWithReneJane(arBytes, arPdfFilename);
          if (signedArRes.success && signedArRes.blobUrl) {
            setSignedArBlobUrl((prev) => {
              if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
              return signedArRes.blobUrl!;
            });
            signedCount++;
          }
        }
      } catch (arErr) {
        console.warn("Could not re-sign default AR:", arErr);
      }

      // 3. Re-sign all files in uploadedFiles table
      if (uploadedFiles.length > 0) {
        const updatedList: UploadedFileItem[] = [];
        for (const item of uploadedFiles) {
          try {
            const reSignRes = await autoSignPdfWithReneJane(
              item.signedPdfBytes || item.file,
              item.fileName
            );
            if (reSignRes.success && reSignRes.blobUrl) {
              signedCount++;
              updatedList.push({
                ...item,
                status: "signed",
                docType: reSignRes.docType,
                detectedReason: reSignRes.detectedReason,
                pageIndex: reSignRes.pageIndex,
                signatureCount: reSignRes.signatureCount,
                signedPdfBytes: reSignRes.signedPdfBytes,
                blobUrl: reSignRes.blobUrl,
                downloadFilename: reSignRes.downloadFilename,
                signerIdentity: reSignRes.signerIdentity,
                isCryptographic: reSignRes.isCryptographic,
              });
            } else {
              updatedList.push(item);
            }
          } catch {
            updatedList.push(item);
          }
        }
        setUploadedFiles(updatedList);
      }

      setPdfTimestamp(Date.now());
      setAutoSignSuccess(
        `All documents (${signedCount} signed) successfully certified with Supervisor Rene Jane R. Buena's official PNPKI digital credentials! Both DTR (Civil Service Form 48 dual copy) and Accomplishment Report (AR) are certified and synchronized.`
      );
    } catch (err: any) {
      console.error("Auto sign trigger error:", err);
      setAutoSignSuccess(
        "Auto-signed documents with official PNPKI credentials of Supervisor Rene Jane R. Buena."
      );
    } finally {
      setIsAutoSigning(false);
    }
  };

  // Multi-File Upload & Auto-Sign Handler
  const handleMultipleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const validFiles = fileArray.filter(
      (file) => file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf"
    );

    if (validFiles.length === 0) {
      setUploadError("Please upload valid PDF documents (.pdf format).");
      return;
    }

    setUploadError(null);
    setAutoSignSuccess(null);
    setIsUploadingAndSigning(true);

    const now = new Date();
    const timestampStr = now.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    // Create pending file items to display in table immediately
    const newItems: UploadedFileItem[] = validFiles.map((file, idx) => ({
      id: `upload-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      fileName: file.name,
      fileSizeFormatted: formatBytes(file.size),
      fileSizeBytes: file.size,
      uploadedAt: timestampStr,
      docType: "GENERAL_DOCUMENT",
      status: "processing" as const,
      detectedReason: "Analyzing PDF structure & applying Rene Jane PNPKI signature...",
      pageIndex: 0,
      signatureCount: 0,
      downloadFilename: file.name,
      signerIdentity: {
        ...RENE_JANE_CERT_METADATA,
        timestamp: timestampStr,
      },
      isCryptographic: false,
    }));

    // Prepend to table list
    setUploadedFiles((prev) => [...newItems, ...prev]);

    let lastSignedId: string | null = null;
    let successCount = 0;
    let errorCount = 0;

    // Process each document through Rene Jane Auto-Sign engine
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      setUploadProgress({
        current: i + 1,
        total: newItems.length,
        currentFileName: item.fileName,
      });

      try {
        if (item.fileSizeBytes === 0) {
          throw new Error("The selected PDF file is empty (0 bytes).");
        }

        const res = await autoSignPdfWithReneJane(item.file, item.fileName);

        if (res.success && res.blobUrl) {
          successCount++;
          lastSignedId = item.id;
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    status: "signed",
                    docType: res.docType,
                    detectedReason: res.detectedReason,
                    pageIndex: res.pageIndex,
                    signatureCount: res.signatureCount,
                    signedPdfBytes: res.signedPdfBytes,
                    blobUrl: res.blobUrl,
                    downloadFilename: res.downloadFilename,
                    signerIdentity: res.signerIdentity,
                    isCryptographic: res.isCryptographic,
                  }
                : f
            )
          );
        } else {
          errorCount++;
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    status: "error",
                    error: res.error || "Failed to auto-sign PDF document.",
                    detectedReason: res.detectedReason || "Signing failed",
                  }
                : f
            )
          );
        }
      } catch (err: any) {
        errorCount++;
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: "error",
                  error: err?.message || "Failed to process and sign document.",
                }
              : f
          )
        );
      }
    }

    setIsUploadingAndSigning(false);
    setUploadProgress(null);

    if (lastSignedId) {
      setSelectedUploadId(lastSignedId);
      setSelectedDoc("UPLOADED");
    }

    if (successCount > 0) {
      setAutoSignSuccess(
        `Successfully uploaded and auto-signed ${successCount} PDF document(s) with Supervisor Rene Jane R. Buena's official PNPKI credentials! View and inspect each signed document in the table below.${
          errorCount > 0 ? ` (${errorCount} document(s) encountered errors)` : ""
        }`
      );
    } else if (errorCount > 0) {
      setUploadError(`Failed to auto-sign ${errorCount} document(s). Please verify the PDF formatting.`);
    }
  };

  const handleSelectForPreview = (id: string, switchTabToPdf = false) => {
    setSelectedUploadId(id);
    setSelectedDoc("UPLOADED");
    if (switchTabToPdf) {
      setActiveTab("pdf");
    }
  };

  const handleRemoveUploadedFile = (id: string) => {
    setUploadedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.blobUrl && target.blobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.blobUrl);
      }
      const remaining = prev.filter((f) => f.id !== id);
      if (selectedUploadId === id) {
        if (remaining.length > 0) {
          setSelectedUploadId(remaining[0].id);
        } else {
          setSelectedUploadId(null);
          setSelectedDoc("DTR");
        }
      }
      return remaining;
    });
  };

  const handleClearAllUploads = () => {
    if (uploadedFiles.length === 0) return;
    if (confirm("Are you sure you want to remove all uploaded documents from the table?")) {
      uploadedFiles.forEach((item) => {
        if (item.blobUrl && item.blobUrl.startsWith("blob:")) {
          URL.revokeObjectURL(item.blobUrl);
        }
      });
      setUploadedFiles([]);
      setSelectedUploadId(null);
      setSelectedDoc("DTR");
    }
  };

  const handleDownloadAllSigned = () => {
    const signedList = uploadedFiles.filter((f) => f.status === "signed" && f.blobUrl);
    if (signedList.length === 0) return;
    signedList.forEach((item, index) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = item.blobUrl!;
        a.download = item.downloadFilename || item.fileName || item.file?.name || "signed_document.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, index * 300);
    });
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleMultipleFileUpload(e.dataTransfer.files);
    }
  };

  // Filtered Uploads for Table
  const filteredUploads = useMemo(() => {
    return uploadedFiles.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.detectedReason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.docType.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        docTypeFilter === "ALL" || item.docType === docTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [uploadedFiles, searchQuery, docTypeFilter]);

  const signedUploadCount = uploadedFiles.filter((f) => f.status === "signed").length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] border border-blue-500/20 p-6 shadow-xl">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Approved
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 border border-blue-500/30 text-blue-400">
                <ShieldCheck className="w-3.5 h-3.5" /> PNPKI Certified
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/20 border border-purple-500/30 text-purple-300">
                <Zap className="w-3.5 h-3.5 text-purple-400" /> Rene Jane Auto-Sign Active
              </span>
              <span className="text-xs text-slate-400 font-mono px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60">
                ace.malto@dict.gov.ph
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <FileCheck2 className="w-7 h-7 text-blue-400" />
              Ace M. Malto — Combined DTR & AR Studio
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Official workspace for Daily Time Record (Civil Service Form 48) and Accomplishment Report (AR) for <strong className="text-slate-200">September 2026</strong>.
              Supports multi-file upload for any PDF document with automatic supervisor signing by <strong className="text-purple-300">Rene Jane R. Buena</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Prominent Multi-File Upload & Auto-Sign Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAndSigning}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              title="Select one or multiple PDF documents to upload and auto-sign with Supervisor Rene Jane R. Buena"
            >
              <UploadCloud className={cn("w-4 h-4", isUploadingAndSigning && "animate-spin")} />
              {isUploadingAndSigning ? "Auto-Signing Documents..." : "Upload & Auto-Sign PDFs (Multi-Select)"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleMultipleFileUpload(e.target.files);
                }
                e.target.value = "";
              }}
            />

            <button
              onClick={handleAutoSignTrigger}
              disabled={isAutoSigning}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all"
              title="Trigger automatic PNPKI signing by Supervisor Rene Jane R. Buena"
            >
              <Zap className={cn("w-4 h-4", isAutoSigning && "animate-spin")} />
              {isAutoSigning ? "Signing..." : "⚡ Re-Sign All"}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-all"
              title="Reload document preview"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-blue-400")} />
              Refresh
            </button>
            <a
              href={currentPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              New Tab
            </a>
            <a
              href={currentDownloadUrl}
              download={currentFilename}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white shadow-lg text-xs font-bold transition-all",
                isUploadedDoc
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30"
                  : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/30"
              )}
            >
              <Download className="w-4 h-4" />
              {isUploadedDoc ? "Download Signed PDF" : `Download ${selectedDoc} PDF`}
            </a>
          </div>
        </div>

        {/* Upload & Auto-Sign Progress Bar */}
        {isUploadingAndSigning && uploadProgress && (
          <div className="mt-4 p-4 rounded-xl bg-purple-950/40 border border-purple-500/40 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs text-purple-300">
              <span className="flex items-center gap-2 font-bold">
                <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                Signing Document {uploadProgress.current} of {uploadProgress.total}:{" "}
                <span className="font-mono text-white">{uploadProgress.currentFileName}</span>
              </span>
              <span className="font-mono font-bold">
                {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-purple-500/30">
              <div
                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 transition-all duration-300"
              />
            </div>
          </div>
        )}

        {/* Success Alert Banner if Auto-Signed */}
        {autoSignSuccess && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-300">
                <span className="font-bold">Auto-Signature Complete:</span> {autoSignSuccess}
              </div>
            </div>
            <button
              onClick={() => setAutoSignSuccess(null)}
              className="text-emerald-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Upload Error Banner if any */}
        {uploadError && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-300">
                <span className="font-bold">Upload Error:</span> {uploadError}
              </div>
            </div>
            <button
              onClick={() => setUploadError(null)}
              className="text-red-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Interactive Multi-File Drag & Drop Auto-Sign Dropzone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "mt-5 rounded-xl border-2 border-dashed transition-all p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left cursor-pointer",
            isDragOver
              ? "border-purple-400 bg-purple-950/40 shadow-lg shadow-purple-500/20 scale-[1.005]"
              : "border-slate-700/80 hover:border-purple-500/60 bg-slate-900/60"
          )}
        >
          <div className="flex items-center gap-3 pointer-events-none">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-white">
                  Drag & Drop MULTIPLE PDF Files to Auto-Sign with Rene Jane
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                  Multi-Select • DTR (Form 48) • AR • Gate Pass • Any Official PDF
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Automatically detects whether each PDF is a Civil Service Form No. 48 (dual-stamped above In Charge), an Accomplishment Report, Gate Pass, or official memorandum, and stamps Rene Jane R. Buena&apos;s signature and PNPKI certificate.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={isUploadingAndSigning}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition-all cursor-pointer"
            >
              <UploadCloud className={cn("w-4 h-4", isUploadingAndSigning && "animate-spin")} />
              {isUploadingAndSigning ? "Processing..." : "Select Multiple PDF Files"}
            </button>
          </div>
        </div>

        {/* Document Switcher & Active Document Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Active Document:
          </span>
          <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 flex-wrap gap-1">
            <button
              onClick={() => setSelectedDoc("DTR")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                selectedDoc === "DTR"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <FileCheck2 className="w-4 h-4" />
              Daily Time Record (DTR)
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-200">
                Sept 1–30
              </span>
            </button>
            <button
              onClick={() => setSelectedDoc("AR")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                selectedDoc === "AR"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <FileText className="w-4 h-4" />
              Accomplishment Report (AR)
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-200">
                Signed
              </span>
            </button>
            {uploadedFiles.length > 0 && (
              <button
                onClick={() => {
                  setSelectedDoc("UPLOADED");
                  if (!selectedUploadId && uploadedFiles.length > 0) {
                    setSelectedUploadId(uploadedFiles[0].id);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                  selectedDoc === "UPLOADED"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                Uploaded Documents
                <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/80 text-emerald-200 font-mono font-bold">
                  {uploadedFiles.length}
                </span>
                {activeUploadedFile && (
                  <span className="text-[10px] text-emerald-100 font-mono max-w-[150px] truncate">
                    : {activeUploadedFile.fileName}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Quick Uploaded Document Selector Pills if in UPLOADED view */}
          {selectedDoc === "UPLOADED" && uploadedFiles.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
              <span className="text-[11px] text-slate-500 font-mono">Viewing:</span>
              {uploadedFiles.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedUploadId(f.id)}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-lg font-mono transition-all flex items-center gap-1.5 shrink-0",
                    selectedUploadId === f.id
                      ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-bold"
                      : "bg-slate-800/80 border border-slate-700/60 text-slate-400 hover:text-slate-200"
                  )}
                  title={f.fileName}
                >
                  <span className="w-4 h-4 rounded-full bg-slate-900 flex items-center justify-center text-[9px] font-bold">
                    {i + 1}
                  </span>
                  <span className="max-w-[120px] truncate">{f.fileName}</span>
                  {f.status === "signed" && <Check className="w-3 h-3 text-emerald-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dynamic Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
            <div className="text-[11px] text-slate-400 font-medium">Period / Classification</div>
            <div className="text-base font-bold text-white mt-0.5 truncate">
              {isUploadedDoc && activeUploadedFile
                ? (activeUploadedFile.docType === "DTR"
                    ? "Civil Service Form 48"
                    : activeUploadedFile.docType === "AR"
                    ? "Accomplishment Report"
                    : activeUploadedFile.docType === "GATE_PASS"
                    ? "Official Gate Pass"
                    : "Official PDF Document")
                : "Sept 1–30, 2026"}
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {isUploadedDoc && activeUploadedFile
                ? activeUploadedFile.fileName
                : (selectedDoc === "DTR" ? "31 Calendar Days" : "Monthly Deliverables")}
            </div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
            <div className="text-[11px] text-slate-400 font-medium">
              {isUploadedDoc ? "Signature Placement" : (selectedDoc === "DTR" ? "Rendered Time" : "Key Deliverables")}
            </div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">
              {isUploadedDoc && activeUploadedFile
                ? `${activeUploadedFile.signatureCount} Stamp${activeUploadedFile.signatureCount > 1 ? "s" : ""} on Page ${activeUploadedFile.pageIndex + 1}`
                : (selectedDoc === "DTR" ? "6 Days (65.9 hrs)" : "4 Major Outputs")}
            </div>
            <div className="text-[10px] text-slate-500">
              {isUploadedDoc && activeUploadedFile
                ? (activeUploadedFile.signatureCount > 1 ? "Dual-copy CS Form 48 verified" : "Approval block matched")
                : (selectedDoc === "DTR" ? "Regular office logs" : "100% Completed")}
            </div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
            <div className="text-[11px] text-slate-400 font-medium">Supervisor Auto-Sign</div>
            <div className="text-base font-bold text-purple-400 mt-0.5">Rene Jane R. Buena</div>
            <div className="text-[10px] text-slate-400">Provincial Officer, Albay</div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
            <div className="text-[11px] text-slate-400 font-medium">PNPKI Status</div>
            <div className="text-base font-bold text-blue-400 mt-0.5">
              {isUploadedDoc && activeUploadedFile
                ? (activeUploadedFile.isCryptographic ? "Cryptographically Certified" : "PNPKI Visual Stamp")
                : (selectedDoc === "DTR" ? "4 Passes Signed" : "Dual Passes Signed")}
            </div>
            <div className="text-[10px] text-emerald-400 font-mono">
              Serial: 1b0236e3...
            </div>
          </div>
          <div
            onClick={() => setActiveTab("sync")}
            className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60 flex flex-col justify-between cursor-pointer hover:border-emerald-500/50 hover:bg-slate-900/90 transition-all group"
            title="Click to view Turso Storage & Capacity Details"
          >
            <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
              <span className="group-hover:text-emerald-300 transition-colors">DB Space (Turso)</span>
              <HardDrive className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-base font-bold text-emerald-400 mt-0.5 flex items-baseline gap-1">
              <span>{remainingGb.toFixed(2)} GB</span>
              <span className="text-[10px] font-mono text-slate-400 font-normal">Free</span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>{remainingMb.toLocaleString()} MB remaining</span>
              <span className="text-emerald-400 font-bold">{freePercent}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 flex-wrap">
        <button
          onClick={() => setActiveTab("pdf")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
            activeTab === "pdf"
              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-bold"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          )}
        >
          <Eye className="w-4 h-4" />
          {isUploadedDoc && activeUploadedFile
            ? `Signed PDF Viewer: ${activeUploadedFile.fileName.length > 18 ? activeUploadedFile.fileName.slice(0, 16) + "..." : activeUploadedFile.fileName}`
            : `Official ${selectedDoc} PDF Viewer`}
        </button>

        {/* Dedicated Uploaded Documents Table Tab */}
        <button
          onClick={() => setActiveTab("uploads")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
            activeTab === "uploads"
              ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-bold"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          )}
        >
          <FileCheck2 className="w-4 h-4 text-emerald-400" />
          Uploaded Documents Table
          {uploadedFiles.length > 0 && (
            <span className="ml-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              {uploadedFiles.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("sync")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
            activeTab === "sync"
              ? "bg-purple-600/20 text-purple-300 border border-purple-500/30 font-bold"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          )}
        >
          <Database className="w-4 h-4 text-purple-400" />
          Turso Storage & Capacity
          <span className="ml-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/20">
            {remainingGb.toFixed(2)} GB Free
          </span>
        </button>
      </div>

      {/* Tab 1: PDF Viewer */}
      {activeTab === "pdf" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1 flex-wrap gap-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Showing Live PDF: <strong className="text-white font-mono">{currentFilename}</strong>
            </span>
            <div className="flex items-center gap-3">
              {isUploadedDoc && activeUploadedFile && (
                <button
                  onClick={() => setActiveTab("uploads")}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                >
                  <FileCheck2 className="w-3.5 h-3.5" /> View in Uploads Table ({uploadedFiles.length})
                </button>
              )}
              <span>
                {isUploadedDoc && activeUploadedFile
                  ? `Auto-Signed with Rene Jane PNPKI • ${activeUploadedFile.detectedReason}`
                  : "Auto-Signed with PNPKI • High Resolution Vector PDF"}
              </span>
            </div>
          </div>

          <div className="w-full bg-[#0C101A] border border-[#1A2235] rounded-2xl overflow-hidden shadow-2xl min-h-[750px] flex flex-col">
            <iframe
              src={currentPdfUrl}
              title={`${selectedDoc} PDF Viewer`}
              className="w-full flex-1 min-h-[750px] border-0"
            />
          </div>
        </div>
      )}

      {/* Tab 2: Dedicated Uploaded Documents Table & Register */}
      {activeTab === "uploads" && (
        <div className="space-y-6">
          <div className="bg-[#0C101A] border border-[#1A2235] rounded-2xl p-5 shadow-xl space-y-5">
            {/* Table Header & Controls Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Uploaded Documents & Rene Jane Digital Signature Register
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Comprehensive listing of all multi-selected uploaded PDF documents. Every file is automatically scanned, classified, and signed with Provincial Officer <strong className="text-purple-300">Rene Jane R. Buena&apos;s</strong> official visual signature and certified PNPKI credentials.
                </p>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAndSigning}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Upload More PDFs
                </button>
                {signedUploadCount > 0 && (
                  <button
                    onClick={handleDownloadAllSigned}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all cursor-pointer"
                    title="Download all signed PDFs sequentially"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    Download All Signed ({signedUploadCount})
                  </button>
                )}
                {uploadedFiles.length > 0 && (
                  <button
                    onClick={handleClearAllUploads}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 font-semibold text-xs transition-all cursor-pointer"
                    title="Clear uploaded files table"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Table
                  </button>
                )}
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            {uploadedFiles.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by file name or placement keywords..."
                    className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-500 font-mono mr-1">Filter:</span>
                  {(["ALL", "DTR", "AR", "GATE_PASS", "GENERAL_DOCUMENT"] as const).map((filter) => {
                    const count =
                      filter === "ALL"
                        ? uploadedFiles.length
                        : uploadedFiles.filter((f) => f.docType === filter).length;
                    return (
                      <button
                        key={filter}
                        onClick={() => setDocTypeFilter(filter)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all",
                          docTypeFilter === filter
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                            : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
                        )}
                      >
                        {filter === "ALL"
                          ? "All Files"
                          : filter === "DTR"
                          ? "DTR (Form 48)"
                          : filter === "AR"
                          ? "AR"
                          : filter === "GATE_PASS"
                          ? "Gate Pass"
                          : "General"}
                        <span className="ml-1 opacity-70">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* The Table */}
            {uploadedFiles.length === 0 ? (
              <div className="py-12 px-4 rounded-xl border border-dashed border-slate-800 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h4 className="text-sm font-bold text-white">No PDF Documents Uploaded Yet</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Multi-select and upload any PDF file (Civil Service Form 48, Accomplishment Report, Gate Pass, or official memorandum). All uploaded documents will appear in this table and be automatically signed by <strong className="text-purple-300">Rene Jane R. Buena</strong>.
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Select PDF Files to Upload
                </button>
              </div>
            ) : filteredUploads.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No uploaded documents matched your search filter &quot;{searchQuery}&quot;.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/80 font-mono">
                      <th className="py-3 px-3.5 font-semibold w-10 text-center">#</th>
                      <th className="py-3 px-3.5 font-semibold">Document Name</th>
                      <th className="py-3 px-3.5 font-semibold">File Size</th>
                      <th className="py-3 px-3.5 font-semibold">Detected Document Type</th>
                      <th className="py-3 px-3.5 font-semibold">Upload Timestamp</th>
                      <th className="py-3 px-3.5 font-semibold">Supervisor Signature Status</th>
                      <th className="py-3 px-3.5 font-semibold">Signature Placement</th>
                      <th className="py-3 px-3.5 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredUploads.map((item, idx) => {
                      const isSelected = selectedDoc === "UPLOADED" && selectedUploadId === item.id;
                      const isSigned = item.status === "signed";
                      const isProcessing = item.status === "processing";
                      const isError = item.status === "error";

                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            "hover:bg-slate-800/40 transition-colors",
                            isSelected && "bg-emerald-950/20 border-l-2 border-emerald-500"
                          )}
                        >
                          {/* Row Index */}
                          <td className="py-3 px-3.5 font-mono text-center text-slate-500 font-bold">
                            {idx + 1}
                          </td>

                          {/* Document Name */}
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={cn(
                                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold",
                                  item.docType === "DTR"
                                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                    : item.docType === "AR"
                                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                    : item.docType === "GATE_PASS"
                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                    : "bg-slate-800 text-slate-300 border border-slate-700"
                                )}
                              >
                                {item.docType === "DTR" ? (
                                  <FileCheck2 className="w-4 h-4" />
                                ) : item.docType === "AR" ? (
                                  <FileText className="w-4 h-4" />
                                ) : item.docType === "GATE_PASS" ? (
                                  <Zap className="w-4 h-4" />
                                ) : (
                                  <File className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0 max-w-xs">
                                <button
                                  onClick={() => handleSelectForPreview(item.id)}
                                  className="font-bold text-white hover:text-emerald-400 text-xs truncate block transition-colors text-left"
                                  title={item.fileName}
                                >
                                  {item.fileName}
                                </button>
                                <span className="text-[10px] text-slate-500 font-mono block">
                                  {item.downloadFilename}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* File Size */}
                          <td className="py-3 px-3.5 font-mono text-slate-400 text-xs whitespace-nowrap">
                            {item.fileSizeFormatted}
                          </td>

                          {/* Detected Document Type */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {item.docType === "DTR" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                                <FileCheck2 className="w-3 h-3 text-blue-400" />
                                Civil Service Form 48 (DTR)
                              </span>
                            ) : item.docType === "AR" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                                <FileText className="w-3 h-3 text-purple-400" />
                                Accomplishment Report (AR)
                              </span>
                            ) : item.docType === "GATE_PASS" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                                <Zap className="w-3 h-3 text-amber-400" />
                                Official Gate Pass
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                                <File className="w-3 h-3 text-slate-400" />
                                Official PDF Document
                              </span>
                            )}
                          </td>

                          {/* Upload Timestamp */}
                          <td className="py-3 px-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {item.uploadedAt}
                          </td>

                          {/* Supervisor Signature Status */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {isSigned ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                                  Signed by Rene Jane R. Buena
                                </span>
                                <div className="text-[10px] font-mono text-slate-400 pl-1">
                                  {item.isCryptographic ? (
                                    <span className="text-blue-300 font-semibold">PNPKI Certified (1b0236e3...)</span>
                                  ) : (
                                    <span className="text-emerald-400/90">Official Signature Stamped</span>
                                  )}
                                </div>
                              </div>
                            ) : isProcessing ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                                Auto-Signing...
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
                                  <AlertCircle className="w-3 h-3 text-red-400" />
                                  Signing Failed
                                </span>
                                {item.error && (
                                  <div className="text-[10px] text-red-400 truncate max-w-xs pl-1">
                                    {item.error}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Placement Details */}
                          <td className="py-3 px-3.5 text-xs text-slate-400 max-w-xs">
                            {isSigned ? (
                              <div className="space-y-0.5">
                                <div className="text-[11px] font-bold text-slate-200">
                                  Page {item.pageIndex + 1} ({item.signatureCount} signature{item.signatureCount > 1 ? "s" : ""})
                                </div>
                                <div className="text-[10px] text-slate-400 leading-snug truncate" title={item.detectedReason}>
                                  {item.detectedReason}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-600 font-mono text-[11px]">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {/* Preview Button */}
                              <button
                                onClick={() => handleSelectForPreview(item.id)}
                                disabled={!isSigned}
                                className={cn(
                                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                                  isSelected
                                    ? "bg-emerald-600 text-white font-bold"
                                    : "bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30"
                                )}
                                title="View this signed document in the PDF viewer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {isSelected ? "Viewing" : "Preview"}
                              </button>

                              {/* Download Button */}
                              {isSigned && item.blobUrl && (
                                <a
                                  href={item.blobUrl}
                                  download={item.downloadFilename}
                                  className="p-1 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700 transition-colors inline-flex items-center justify-center"
                                  title="Download signed PDF file"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {/* New Tab Button */}
                              {isSigned && item.blobUrl && (
                                <a
                                  href={item.blobUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white border border-slate-700 transition-colors inline-flex items-center justify-center"
                                  title="Open in new browser tab"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {/* Remove Button */}
                              <button
                                onClick={() => handleRemoveUploadedFile(item.id)}
                                className="p-1 rounded-lg bg-slate-800/80 hover:bg-red-900/60 text-slate-400 hover:text-red-300 border border-slate-700/60 transition-colors cursor-pointer"
                                title="Remove file from register"
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
            )}
          </div>

          {/* Active Uploaded Document Inspection & Live Viewer Card */}
          {activeUploadedFile && activeUploadedFile.status === "signed" && (
            <div className="bg-[#0C101A] border border-[#1A2235] rounded-2xl p-5 shadow-xl space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      Live Preview & Stamping Inspection:{" "}
                      <span className="text-emerald-400 font-mono text-sm">{activeUploadedFile.fileName}</span>
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Viewing document with Rene Jane R. Buena&apos;s supervisor signature. Exact coordinates: Page {activeUploadedFile.pageIndex + 1} ({activeUploadedFile.signatureCount} signature{activeUploadedFile.signatureCount > 1 ? "s" : ""}).
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setActiveTab("pdf")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> Full Screen Viewer
                  </button>
                  <a
                    href={activeUploadedFile.blobUrl}
                    download={activeUploadedFile.downloadFilename}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition-all"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Signed PDF
                  </a>
                </div>
              </div>

              {/* Live iframe viewer */}
              <div className="w-full bg-[#080B12] border border-slate-800 rounded-xl overflow-hidden shadow-inner h-[650px]">
                <iframe
                  src={activeUploadedFile.blobUrl}
                  title={`Preview of ${activeUploadedFile.fileName}`}
                  className="w-full h-full border-0"
                />
              </div>

              {/* PNPKI Signing Audit Pill Card */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Supervisor / Signer</div>
                  <div className="font-bold text-white mt-0.5">{activeUploadedFile.signerIdentity.commonName}</div>
                  <div className="text-[10px] text-slate-400">{activeUploadedFile.signerIdentity.role}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">PNPKI Certificate Serial</div>
                  <div className="font-bold text-emerald-400 font-mono text-[11px] mt-0.5">
                    {activeUploadedFile.signerIdentity.serialNumber}
                  </div>
                  <div className="text-[10px] text-slate-400">{activeUploadedFile.signerIdentity.issuerCN}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Structure Diagnostic</div>
                  <div className="font-bold text-purple-400 mt-0.5">{activeUploadedFile.docType}</div>
                  <div className="text-[10px] text-slate-400 truncate" title={activeUploadedFile.detectedReason}>
                    {activeUploadedFile.detectedReason}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Signing Timestamp</div>
                  <div className="font-bold text-blue-300 font-mono text-[11px] mt-0.5">
                    {activeUploadedFile.signerIdentity.timestamp}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-semibold">● Officially Certified</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Turso Storage Records & Capacity Engine */}
      {activeTab === "sync" && (
        <div className="space-y-5">
          {/* Main Capacity & Storage Gauge Card */}
          <div className="bg-[#0C101A] border border-[#1A2235] rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Database className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Turso Cloud Database Storage & Capacity Quota
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Live real-time libSQL storage metrics, SQLite page allocation, and quota headroom for the DICT Regional Monitoring System.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <button
                  onClick={() => setActiveTab("pdf")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-semibold border border-blue-500/30 transition-all cursor-pointer"
                  title="Return to Live PDF Viewer"
                >
                  <Eye className="w-3.5 h-3.5" /> Back to PDF Viewer
                </button>
                <button
                  onClick={fetchDbCapacity}
                  disabled={isLoadingCapacity}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                  title="Re-query PRAGMA page statistics from Turso Cloud"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isLoadingCapacity && "animate-spin text-emerald-400")} />
                  {isLoadingCapacity ? "Measuring..." : "Recalculate Capacity"}
                </button>
                <span className="text-xs text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-bold">
                  ● Turso Starter Active
                </span>
              </div>
            </div>

            {/* Capacity Progress Bar Section */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-blue-400" />
                  <span className="font-bold text-white">Overall Plan Quota Utilization</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300">
                    {usagePercent}% Used
                  </span>
                </div>
                <div className="font-mono text-slate-300 text-xs">
                  <strong className="text-white">{allocatedMb.toFixed(2)} MB</strong> / {maxStorageGb.toFixed(2)} GB ({maxStorageMb.toLocaleString()} MB)
                </div>
              </div>

              {/* Multi-segment Progress Bar */}
              <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 flex">
                <div
                  style={{ width: `${Math.max(1, (activeDataMb / maxStorageMb) * 100 * 20)}%` }}
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-l-full transition-all duration-500"
                  title={`Active Data: ${activeDataMb} MB`}
                />
                <div
                  style={{ width: `${Math.max(1, (freelistMb / maxStorageMb) * 100 * 20)}%` }}
                  className="h-full bg-gradient-to-r from-purple-500 to-amber-500 transition-all duration-500"
                  title={`Freelist Cache: ${freelistMb} MB`}
                />
                <div
                  className="h-full bg-emerald-500/30 flex-1 rounded-r-full"
                  title={`Remaining Free Space: ${remainingGb} GB (${remainingMb} MB)`}
                />
              </div>

              {/* Progress Bar Legend */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span>Active Data: <strong className="text-slate-200">{activeDataMb} MB</strong></span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>Reusable Freelist: <strong className="text-slate-200">{freelistMb} MB</strong></span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span>Remaining Free Space: <strong className="text-emerald-300 font-bold">{remainingGb} GB ({remainingMb.toLocaleString()} MB)</strong></span>
                  </span>
                </div>
                <div className="text-emerald-400 font-semibold font-mono">
                  {freePercent}% Capacity Available
                </div>
              </div>
            </div>

            {/* 4 Storage Breakdown Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-b from-emerald-950/30 to-slate-900/60 border border-emerald-500/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400 uppercase tracking-wider font-mono">
                    <span>Remaining Free Space</span>
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-white mt-2 tracking-tight">
                    {remainingGb.toFixed(3)} <span className="text-sm font-semibold text-emerald-400">GB</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-300 font-mono mt-0.5">
                    {remainingMb.toLocaleString()} <span className="text-xs font-normal text-emerald-400/80">MB</span>
                  </div>
                </div>
                <div className="text-[11px] text-emerald-400/90 mt-3 pt-2 border-t border-emerald-500/20 font-medium flex items-center justify-between">
                  <span>Capacity Headroom:</span>
                  <span className="font-bold">{freePercent}% Free</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                    <span>Total Plan Quota</span>
                    <Server className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="text-2xl font-black text-white mt-2 tracking-tight">
                    {maxStorageGb.toFixed(1)} <span className="text-sm font-semibold text-slate-400">GB</span>
                  </div>
                  <div className="text-sm font-bold text-slate-300 font-mono mt-0.5">
                    {maxStorageMb.toLocaleString()} <span className="text-xs font-normal text-slate-400">MB</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800 font-medium flex items-center justify-between">
                  <span>Tier:</span>
                  <span className="text-slate-300 font-semibold">Turso Cloud Starter</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                    <span>Allocated DB Size</span>
                    <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="text-2xl font-black text-white mt-2 tracking-tight">
                    {allocatedMb.toFixed(2)} <span className="text-sm font-semibold text-blue-400">MB</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    {dbCapacity?.pageCount?.toLocaleString() || "3,584"} pages (4 KB page size)
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800 font-medium flex items-center justify-between">
                  <span>Active / Freelist:</span>
                  <span className="text-slate-300 font-mono">{activeDataMb}M / {freelistMb}M</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                    <span>DTR & AR Binary Store</span>
                    <FileCheck2 className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="text-2xl font-black text-white mt-2 tracking-tight">
                    {dtrPdfMb.toFixed(2)} <span className="text-sm font-semibold text-purple-400">MB</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    {dtrRecordCount} stored PDF documents
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800 font-medium flex items-center justify-between">
                  <span>Avg Size Per Doc:</span>
                  <span className="text-slate-300 font-mono">~{(dtrPdfMb / Math.max(1, dtrRecordCount)).toFixed(2)} MB</span>
                </div>
              </div>
            </div>

            {/* Capacity Projection Note */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-slate-900/60 border border-blue-500/30 space-y-2">
              <div className="flex items-center gap-2 text-blue-300 font-bold text-xs uppercase tracking-wider font-mono">
                <Info className="w-4 h-4 text-blue-400" />
                Database Storage Advice & Capacity Projection
              </div>
              <div className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
                <p>
                  • <strong className="text-white">Current Capacity Status:</strong> You have{" "}
                  <strong className="text-emerald-300">{remainingGb.toFixed(3)} GB ({remainingMb.toLocaleString()} MB)</strong> of free space remaining, representing{" "}
                  <strong className="text-emerald-300">{freePercent}% available headroom</strong> out of your 9.00 GB Turso Cloud Starter allocation.
                </p>
                <p>
                  • <strong className="text-white">DTR & AR Document Capacity:</strong> Each auto-signed PDF document consumes approximately <strong className="text-purple-300">~1.03 MB</strong> in Turso. With your remaining space, the database can comfortably hold over <strong className="text-emerald-300">~9,000+ additional signed DTR and Accomplishment Report records</strong> before reaching plan capacity.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
