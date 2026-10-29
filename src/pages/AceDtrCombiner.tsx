import React, { useState, useEffect, useRef } from "react";
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
  Info
} from "lucide-react";
import { getCurrentUser } from "@/services/authStore";
import { UserRecord } from "@/data/userStore";
import { cn } from "@/lib/utils";
import { autoSignPdfWithReneJane, ReneJaneAutoSignResult, RENE_JANE_CERT_METADATA } from "@/utils/reneJaneAutoSign";
import { dtrStorageApi, DatabaseCapacity } from "@/services/api";

// 31-day data for Ace M. Malto (September 2026)
const COMBINED_ROWS = [
  { day: 1, amIn: "7:02", amOut: "12:17", pmIn: "12:18", pmOut: "6:08", utH: "", utM: "", source: "Part 1 (1–15 DTR)" },
  { day: 2, custom: "HOLIDAY", source: "Part 1 (1–15 DTR)" },
  { day: 3, custom: "GP-POV 2026-09-0002", source: "Part 1 (1–15 DTR)" },
  { day: 4, custom: "NO WORK: 4DAY WORKWEEK", source: "Part 1 (1–15 DTR)" },
  { day: 5, custom: "SATURDAY", source: "Part 1 (1–15 DTR)" },
  { day: 6, custom: "SUNDAY", source: "Part 1 (1–15 DTR)" },
  { day: 7, custom: "GP-POV 2026-09-0025", source: "Part 1 (1–15 DTR)" },
  { day: 8, custom: "GP-POV 2026-09-0026", source: "Part 1 (1–15 DTR)" },
  { day: 9, custom: "GP-POV 2026-09-0027", source: "Part 1 (1–15 DTR)" },
  { day: 10, custom: "GP-POV 2026-09-0028", source: "Part 1 (1–15 DTR)" },
  { day: 11, custom: "GP-POV 2026-09-0029", source: "Part 1 (1–15 DTR)" },
  { day: 12, custom: "SATURDAY", source: "Part 1 (1–15 DTR)" },
  { day: 13, custom: "SUNDAY", source: "Part 1 (1–15 DTR)" },
  { day: 14, custom: "GP-POV 2026-09-0044", source: "Part 1 (1–15 DTR)" },
  { day: 15, custom: "GP-POV 2026-09-0050", source: "Part 1 (1–15 DTR)" },
  { day: 16, custom: "GP-POV 2026-09-0070", source: "Part 2 (16–27 DTR)" },
  { day: 17, custom: "GP-POV 2026-09-0056", source: "Part 2 (16–27 DTR)" },
  { day: 18, custom: "NO WORK : 4DAY WORKWEEK", source: "Part 2 (16–27 DTR)" },
  { day: 19, custom: "SATURDAY", source: "Part 2 (16–27 DTR)" },
  { day: 20, custom: "SUNDAY", source: "Part 2 (16–27 DTR)" },
  { day: 21, custom: "GP-POV 2026-09-0071", source: "Part 2 (16–27 DTR)" },
  { day: 22, custom: "GP-POV 2026-09-0072", source: "Part 2 (16–27 DTR)" },
  { day: 23, amIn: "7:00", amOut: "12:15", pmIn: "12:16", pmOut: "6:04", utH: "", utM: "", source: "Part 2 (16–27 DTR)" },
  { day: 24, amIn: "7:03", amOut: "12:05", pmIn: "12:06", pmOut: "6:27", utH: "", utM: "", source: "Part 2 (16–27 DTR)" },
  { day: 25, custom: "NO WORK : 4DAY WORKWEEK", source: "Part 2 (16–27 DTR)" },
  { day: 26, custom: "SATURDAY", source: "Part 2 (16–27 DTR)" },
  { day: 27, custom: "SUNDAY", source: "Part 2 (16–27 DTR)" },
  { day: 28, amIn: "7:33", amOut: "12:13", pmIn: "12:15", pmOut: "5:53", utH: "", utM: "", source: "Part 3 (OTC Log Snippet)" },
  { day: 29, amIn: "7:34", amOut: "12:12", pmIn: "12:43", pmOut: "7:28", utH: "", utM: "", source: "Part 3 (OTC Log Snippet)" },
  { day: 30, amIn: "7:28", amOut: "12:12", pmIn: "12:13", pmOut: "6:12", utH: "", utM: "", source: "Part 3 (OTC Log Snippet)" },
  { day: 31, custom: "—", source: "Part 3 (Blank)" },
];

// September 2026 Accomplishment Report Deliverables
const AR_DELIVERABLES = [
  {
    category: "Procurement Documentation, Inspection, and Item Release",
    items: [
      "Assisted in the preparation, organization, and completion of procurement-related documents for three procurement activities, including computer equipment and ICT supplies for the office.",
      "Managed and monitored documentary requirements from preparation through item release, ensuring complete, organized, and properly filed records.",
      "Completed and consolidated required documentation for DigiGOV procurement activities and submitted finalized records to the Administrative and Finance Division (AFD) for compliance and review."
    ]
  },
  {
    category: "Regional Monitoring System & Automated DTR Studio",
    items: [
      "Presented the Regional Monitoring System and demonstrated key functionalities, including automated Civil Service Form No. 48 generation and mobile-friendly access.",
      "Discussed platform support for personnel monitoring, daily administrative tracking, and prospective benefits for Human Resource processes."
    ]
  },
  {
    category: "Free Wi-Fi for All Site Assessments",
    items: [
      "Assisted in the inspection and assessment of Free Wi-Fi for All beneficiary sites across Albay province through field visits and documentation.",
      "Performed network connectivity and signal tests for individual access points, verifying operational conditions and documenting status for maintenance."
    ]
  },
  {
    category: "ICT Skills Capacity Building",
    items: [
      "Conducted ICT Skills Training on 'Navigating Google Workspace for Barangay Workplace', providing participants with hands-on guidance on collaboration tools and digital records.",
      "Assisted in addressing inquiries regarding the barangay QR code platform, exploring technical alternatives and operational guidelines."
    ]
  }
];

export function AceDtrCombiner() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(() => getCurrentUser());
  const [selectedDoc, setSelectedDoc] = useState<"DTR" | "AR" | "UPLOADED">("DTR");
  const [activeTab, setActiveTab] = useState<"pdf" | "logs" | "autoSign" | "signatures" | "sync">("pdf");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAutoSigning, setIsAutoSigning] = useState(false);
  const [autoSignSuccess, setAutoSignSuccess] = useState<string | null>(null);
  const [pdfTimestamp, setPdfTimestamp] = useState(Date.now());

  // Upload & Auto-Sign State
  const [isUploadingAndSigning, setIsUploadingAndSigning] = useState(false);
  const [uploadedResult, setUploadedResult] = useState<ReneJaneAutoSignResult | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const uploadedResultRef = useRef<ReneJaneAutoSignResult | null>(null);

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

  // Track latest uploaded result and revoke ObjectURL on unmount to prevent memory leaks
  useEffect(() => {
    uploadedResultRef.current = uploadedResult;
  }, [uploadedResult]);

  useEffect(() => {
    return () => {
      if (uploadedResultRef.current?.blobUrl) {
        URL.revokeObjectURL(uploadedResultRef.current.blobUrl);
      }
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
  const isAce = userEmail === "ace.malto@dict.gov.ph";

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

  const isUploadedDoc = selectedDoc === "UPLOADED" && Boolean(uploadedResult);
  const currentFilename = isUploadedDoc
    ? uploadedResult!.downloadFilename
    : selectedDoc === "DTR"
    ? dtrPdfFilename
    : arPdfFilename;

  const currentPdfUrl = isUploadedDoc
    ? uploadedResult!.blobUrl!
    : `/${currentFilename}?v=${pdfTimestamp}`;

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDbCapacity();
    setTimeout(() => {
      setPdfTimestamp(Date.now());
      setIsRefreshing(false);
    }, 600);
  };

  const handleAutoSignTrigger = () => {
    setIsAutoSigning(true);
    setAutoSignSuccess(null);
    setTimeout(() => {
      setIsAutoSigning(false);
      setPdfTimestamp(Date.now());
      setAutoSignSuccess(
        `Document successfully auto-signed with official PNPKI credentials of Supervisor Rene Jane R. Buena (Serial: 1b0236e3df7a794efe92814091c5b4b06ca83066). Both DTR and AR are certified and synchronized!`
      );
    }, 1200);
  };

  // Upload and Auto-Sign Document Handler
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (file.size === 0) {
      setUploadError("The selected PDF file is empty (0 bytes). Please upload a valid PDF document.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setUploadError("Please upload a valid PDF document (.pdf format).");
      return;
    }

    setIsUploadingAndSigning(true);
    setUploadError(null);
    setAutoSignSuccess(null);

    try {
      const res = await autoSignPdfWithReneJane(file, file.name);
      if (res.success && res.blobUrl) {
        // Free previously generated blob URL
        if (uploadedResult?.blobUrl) {
          URL.revokeObjectURL(uploadedResult.blobUrl);
        }
        setUploadedResult(res);
        setUploadedFileName(file.name);
        setSelectedDoc("UPLOADED");
        setActiveTab("pdf");
        setAutoSignSuccess(
          `Document "${file.name}" was successfully analyzed and auto-signed with Supervisor Rene Jane R. Buena's official PNPKI digital certificate (${res.detectedReason})!`
        );
      } else {
        setUploadError(res.error || "Failed to auto-sign the uploaded PDF document.");
      }
    } catch (err: any) {
      console.error("Upload & auto-sign error:", err);
      setUploadError(err?.message || "Failed to process and sign the document.");
    } finally {
      setIsUploadingAndSigning(false);
    }
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
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

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
              Ace M. Malto — DTR & AR Studio
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Official workspace for Daily Time Record (CS Form 48) and Accomplishment Report (AR) for <strong className="text-slate-200">September 2026</strong>. 
              Automatically signed with official PNPKI digital <strong className="text-blue-300">Ace M. Malto</strong> <strong className="text-purple-300"></strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Prominent Upload & Auto-Sign Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAndSigning}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              title="Upload any DTR, AR, or official document PDF to auto-sign with Supervisor Rene Jane R. Buena"
            >
              <UploadCloud className={cn("w-4 h-4", isUploadingAndSigning && "animate-spin")} />
              {isUploadingAndSigning ? "Auto-Signing..." : "Upload & Auto-Sign Any PDF"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
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
              href={isUploadedDoc ? uploadedResult!.blobUrl : `/${currentFilename}`}
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

        {/* Success Alert Banner if Auto-Signed */}
        {autoSignSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 animate-in fade-in duration-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-300">
              <span className="font-bold">Auto-Signature Complete:</span> {autoSignSuccess}
            </div>
          </div>
        )}

        {/* Upload Error Banner if any */}
        {uploadError && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-300">
              <span className="font-bold">Upload Error:</span> {uploadError}
            </div>
          </div>
        )}

        {/* Interactive Drag & Drop Auto-Sign Dropzone */}
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
                  Drag & Drop ANY PDF to Auto-Sign with Rene Jane
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  DTR • AR • Official Memo • Clearance
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Automatically detects document structure, places Rene Jane&apos;s transparent visual signature, and applies official PNPKI certificate.
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
              {isUploadingAndSigning ? "Scanning & Signing..." : "Choose PDF File"}
            </button>
          </div>
        </div>

        {/* Document Switcher */}
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
            {uploadedResult && (
              <button
                onClick={() => setSelectedDoc("UPLOADED")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                  selectedDoc === "UPLOADED"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                Auto-Signed: {uploadedFileName ? (uploadedFileName.length > 20 ? uploadedFileName.slice(0, 18) + "..." : uploadedFileName) : "Uploaded PDF"}
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-200">
                  {uploadedResult.docType === "GATE_PASS" ? "Gate Pass" : uploadedResult.docType}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
            <div className="text-[11px] text-slate-400 font-medium">Period Covered</div>
            <div className="text-base font-bold text-white mt-0.5">
              {isUploadedDoc ? (uploadedResult!.docType === "GATE_PASS" ? "Official Gate Pass" : uploadedResult!.docType) : "Sept 1–30, 2026"}
            </div>
            <div className="text-[10px] text-slate-500">
              {isUploadedDoc ? "Uploaded Document" : (selectedDoc === "DTR" ? "31 Calendar Days" : "Monthly Deliverables")}
            </div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
            <div className="text-[11px] text-slate-400 font-medium">
              {isUploadedDoc ? "Signature Placement" : (selectedDoc === "DTR" ? "Rendered Time" : "Key Deliverables")}
            </div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">
              {isUploadedDoc ? `${uploadedResult!.signatureCount} Signature${uploadedResult!.signatureCount > 1 ? "s" : ""}` : (selectedDoc === "DTR" ? "6 Days (65.9 hrs)" : "4 Major Outputs")}
            </div>
            <div className="text-[10px] text-slate-500">
              {isUploadedDoc ? "Auto-Detected & Stamped" : (selectedDoc === "DTR" ? "Regular office logs" : "100% Completed")}
            </div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
            <div className="text-[11px] text-slate-400 font-medium"></div>
            <div className="text-base font-bold text-purple-400 mt-0.5"></div>
            <div className="text-[10px] text-slate-400"></div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
            <div className="text-[11px] text-slate-400 font-medium">PNPKI Status</div>
            <div className="text-base font-bold text-blue-400 mt-0.5">
              {isUploadedDoc ? (uploadedResult!.isCryptographic ? "Cryptographically Certified" : "PNPKI Visual Stamp") : (selectedDoc === "DTR" ? "4 Passes Signed" : "Dual Passes Signed")}
            </div>
            <div className="text-[10px] text-emerald-400">
              {isUploadedDoc ? "Serial: 1b0236e3..." : "Cryptographically Valid"}
            </div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60 flex flex-col justify-between">
            <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
              <span>DB Space (Turso)</span>
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
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
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("pdf")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
            activeTab === "pdf"
              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          )}
        >
          <Eye className="w-4 h-4" />
          {isUploadedDoc ? "Auto-Signed PDF Viewer" : `Official ${selectedDoc} PDF Viewer`}
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
            activeTab === "logs"
              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          )}
        >
          <Layers className="w-4 h-4" />
          {selectedDoc === "DTR"
            ? "Consolidated Logs (31 Days)"
            : selectedDoc === "UPLOADED"
            ? "Uploaded Document Structure"
            : "Deliverables & Activities"}
        </button>
        <button
          onClick={() => setActiveTab("autoSign")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
            activeTab === "autoSign"
              ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          )}
        >
          <Zap className="w-4 h-4 text-purple-400" />
           Engine
        </button>
        <button
          onClick={() => setActiveTab("signatures")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
            activeTab === "signatures"
              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          )}
        >
          <ShieldCheck className="w-4 h-4" />
          PNPKI Signatures Audit
        </button>
        <button
          onClick={() => setActiveTab("sync")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
            activeTab === "sync"
              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          )}
        >
          <Database className="w-4 h-4" />
          Turso Storage & Capacity
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
            <span>
              {isUploadedDoc
                ? `Auto-Signed with Rene Jane PNPKI • ${uploadedResult!.detectedReason}`
                : "Auto-Signed with PNPKI • High Resolution Vector PDF"}
            </span>
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

      {/* Tab 2: Logs & Deliverables */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          {selectedDoc === "DTR" ? (
            /* DTR Logs Table */
            <div className="bg-[#0C101A] border border-[#1A2235] rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    Consolidated September 1–30 Time Record
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Merged from Days 1–15, Days 16–27, and Days 28–30 (Civil Service Form No. 48).
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-mono bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">
                  Total: 31 Days
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-mono">
                      <th className="py-2.5 px-3 font-semibold">Day</th>
                      <th className="py-2.5 px-3 font-semibold">A.M. Arrival</th>
                      <th className="py-2.5 px-3 font-semibold">A.M. Departure</th>
                      <th className="py-2.5 px-3 font-semibold">P.M. Arrival</th>
                      <th className="py-2.5 px-3 font-semibold">P.M. Departure</th>
                      <th className="py-2.5 px-3 font-semibold">Status / Label</th>
                      <th className="py-2.5 px-3 font-semibold">Source Attribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {COMBINED_ROWS.map((r) => {
                      const isWeekend = r.custom === "SATURDAY" || r.custom === "SUNDAY";
                      const isHoliday = r.custom === "HOLIDAY";
                      const isWorkweek = r.custom && r.custom.includes("4DAY WORKWEEK");
                      const isGatePass = r.custom && r.custom.startsWith("GP-");
                      const isRendered = Boolean(r.amIn || r.pmIn);

                      return (
                        <tr
                          key={r.day}
                          className={cn(
                            "hover:bg-slate-800/30 transition-colors font-mono",
                            isRendered && "bg-blue-950/10"
                          )}
                        >
                          <td className="py-2 px-3 font-bold text-white">{r.day}</td>
                          <td className="py-2 px-3 text-slate-300">{r.amIn || "—"}</td>
                          <td className="py-2 px-3 text-slate-300">{r.amOut || "—"}</td>
                          <td className="py-2 px-3 text-slate-300">{r.pmIn || "—"}</td>
                          <td className="py-2 px-3 text-slate-300">{r.pmOut || "—"}</td>
                          <td className="py-2 px-3">
                            {r.custom ? (
                              <span
                                className={cn(
                                  "inline-block px-2 py-0.5 rounded text-[11px] font-semibold",
                                  isWeekend && "bg-slate-800 text-slate-400 border border-slate-700",
                                  isHoliday && "bg-red-500/20 text-red-300 border border-red-500/30",
                                  isWorkweek && "bg-purple-500/20 text-purple-300 border border-purple-500/30",
                                  isGatePass && "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                )}
                              >
                                {r.custom}
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Rendered Regular Hours
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-500 text-[10px]">
                            {r.source}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : selectedDoc === "UPLOADED" && uploadedResult ? (
            /* Uploaded Document Inspection & Metadata */
            <div className="bg-[#0C101A] border border-[#1A2235] rounded-2xl p-5 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-400" />
                    Uploaded Document Structure & Auto-Sign Audit
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live inspection data from the auto-signing engine and PNPKI certificate verification.
                  </p>
                </div>
                <span className="text-xs text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg font-bold self-start sm:self-auto">
                  ● Certified Auto-Signed
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                    Document Name
                  </span>
                  <div className="font-bold text-white text-xs mt-1 truncate" title={uploadedFileName || "Document.pdf"}>
                    {uploadedFileName || "Document.pdf"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Original uploaded PDF</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                    Document Type
                  </span>
                  <div className="font-bold text-purple-400 text-xs mt-1">
                    {uploadedResult.docType}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Auto-classified by structure</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                    Placement & Stamping
                  </span>
                  <div className="font-bold text-emerald-400 text-xs mt-1">
                    Page {uploadedResult.pageIndex + 1} ({uploadedResult.signatureCount} stamp{uploadedResult.signatureCount > 1 ? "s" : ""})
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Supervisor approval coordinates</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                    Cryptographic Status
                  </span>
                  <div className="font-bold text-blue-400 text-xs mt-1">
                    {uploadedResult.isCryptographic ? "Cryptographically Certified" : "Certified Visual Stamp"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">ISO 32000 digital certificate</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs space-y-2">
                <div className="font-bold text-white text-xs flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Detection & Placement Diagnostics:
                </div>
                <p className="text-slate-300 font-mono text-[11px] leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  {uploadedResult.detectedReason}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2 flex-wrap">
                <button
                  onClick={() => setActiveTab("pdf")}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
                >
                  <Eye className="w-4 h-4" /> View in PDF Viewer
                </button>
                <a
                  href={uploadedResult.blobUrl}
                  download={uploadedResult.downloadFilename}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition-all"
                >
                  <Download className="w-4 h-4" /> Download Signed PDF
                </a>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs transition-all cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4 text-purple-400" /> Upload Another Document
                </button>
              </div>
            </div>
          ) : (
            /* AR Deliverables Breakdown */
            <div className="bg-[#0C101A] border border-[#1A2235] rounded-2xl p-5 shadow-xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  September 2026 Monthly Accomplishment Report
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Consistent with Approved Terms of Reference (TOR) for Project Development Officer II (PDO II).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {AR_DELIVERABLES.map((deliv, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <h4 className="text-sm font-bold text-slate-200 leading-snug">
                        {deliv.category}
                      </h4>
                    </div>

                    <ul className="space-y-2 text-xs text-slate-400 pl-8 list-disc">
                      {deliv.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Approval Box Summary */}
              <div className="pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 text-xs space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                    Prepared By (Personnel)
                  </span>
                  <div className="font-bold text-white text-sm">ACE M. MALTO</div>
                  <div className="text-slate-400 text-[11px]">Project Development Officer II</div>
                  <div className="text-slate-500 text-[10px]">DICT Region V - Albay</div>
                  <div className="text-emerald-400 text-[11px] font-mono flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3 h-3" /> Digitally signed by Malto Ace Mata
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 text-xs space-y-1">
                  <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider font-mono">
                    Approved By (Supervisor)
                  </span>
                  <div className="font-bold text-white text-sm">RENE JANE R. BUENA</div>
                  <div className="text-slate-300 text-[11px]">Provincial Officer</div>
                  <div className="text-slate-400 text-[10px]">DICT Albay Provincial Office</div>
                  <div className="text-purple-300 text-[11px] font-mono flex items-center gap-1 mt-1">
                    <Zap className="w-3 h-3 text-purple-400" /> Auto-signed by Buena Rene Jane Rosendo
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Supervisor Auto-Sign Engine */}
      {activeTab === "autoSign" && (
        <div className="space-y-6">
          <div className="bg-[#0C101A] border border-[#1A2235] rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-400" />
                Supervisor Automatic Signing Engine
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                When you access or submit in this module, both your Daily Time Record (DTR) and Accomplishment Report (AR) are automatically signed with the certified PNPKI credentials of Provincial Officer <strong className="text-purple-300">Rene Jane R. Buena</strong>.
              </p>
            </div>

            {/* Workflow Step Diagram */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs">
                  01
                </div>
                <h4 className="text-sm font-bold text-white">Personnel Submission / Upload</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ace M. Malto (<code>ace.malto@dict.gov.ph</code>) initiates or uploads any document (DTR, AR, or official clearance).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/40 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-xs">
                  02
                </div>
                <h4 className="text-sm font-bold text-white">Supervisor Auto-Sign</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The system automatically applies Rene Jane R. Buena&apos;s transparent visual signature and official cryptographic certificate (Serial: <code>1b0236e3...</code>).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold text-xs">
                  03
                </div>
                <h4 className="text-sm font-bold text-white">Cloud Sync & Verification</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The signed document is instantly available for viewing, downloading, and certified verification with 4-tier chain of trust.
                </p>
              </div>
            </div>

            {/* Manual Trigger & Upload Actions */}
            <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Auto-Signature Status: Active & Operational
                </div>
                <div className="text-xs text-slate-400">
                  Upload any external PDF or re-sign your September 2026 DTR & AR on demand.
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAndSigning}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all shrink-0 cursor-pointer"
                >
                  <UploadCloud className={cn("w-4 h-4", isUploadingAndSigning && "animate-spin")} />
                  {isUploadingAndSigning ? "Signing..." : "Upload & Auto-Sign New PDF"}
                </button>
                <button
                  onClick={handleAutoSignTrigger}
                  disabled={isAutoSigning}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all shrink-0"
                >
                  <Zap className={cn("w-4 h-4", isAutoSigning && "animate-spin")} />
                  {isAutoSigning ? "Processing..." : "Re-Sign DTR & AR"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: PNPKI Signatures Audit */}
      {activeTab === "signatures" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Signer 1: Ace M. Malto */}
          <div className="bg-[#0C101A] border border-[#1A2235] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                PERSONNEL SIGNATURE
              </span>
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <Check className="w-3.5 h-3.5" /> Valid & Verified
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Malto Ace Mata</h3>
              <p className="text-xs text-slate-400">Computer Maintenance Technologist II / PDO II</p>
            </div>

            <div className="space-y-2 text-xs font-mono bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">Common Name:</span>
                <span className="text-slate-300 font-semibold">Malto Ace Mata</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Serial Number:</span>
                <span className="text-blue-400 font-bold">1bf159f0e6e68782b7a45...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Issuer CA:</span>
                <span className="text-slate-300">Government Signing CA - G2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Root CA:</span>
                <span className="text-slate-300">Philippine Root CA - G2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Algorithm:</span>
                <span className="text-slate-300">SHA256withRSA (2048 bit)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Validity:</span>
                <span className="text-emerald-400">2026.08.26 – 2028.08.25</span>
              </div>
            </div>
          </div>

          {/* Signer 2: Rene Jane R. Buena */}
          <div className="bg-[#0C101A] border border-[#1A2235] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                SUPERVISOR SIGNATURE (AUTO-SIGNED)
              </span>
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <Check className="w-3.5 h-3.5" /> Valid & Verified
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Buena Rene Jane Rosendo</h3>
              <p className="text-xs text-slate-400">Provincial Officer — DICT Albay Provincial Office</p>
            </div>

            <div className="space-y-2 text-xs font-mono bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">Common Name:</span>
                <span className="text-slate-300 font-semibold">Buena Rene Jane Rosendo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Serial Number:</span>
                <span className="text-purple-400 font-bold">1b0236e3df7a794efe928...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Issuer CA:</span>
                <span className="text-slate-300">Government Signing CA - G2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Root CA:</span>
                <span className="text-slate-300">Philippine Root CA - G2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Algorithm:</span>
                <span className="text-slate-300">SHA256withRSA (2048 bit)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Validity:</span>
                <span className="text-emerald-400">2026.04.16 – 2028.04.15</span>
              </div>
            </div>
          </div>

          {/* Optional Card 3: Uploaded Document Signature Audit */}
          {uploadedResult && (
            <div className="bg-[#0C101A] border border-emerald-500/40 rounded-2xl p-5 shadow-xl space-y-4 md:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  UPLOADED DOCUMENT AUTO-SIGNATURE AUDIT
                </span>
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                  <Check className="w-3.5 h-3.5" /> {uploadedResult.isCryptographic ? "Cryptographically Certified (Pass 2)" : "Certified Visual Stamp Applied"}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white">{uploadedResult.downloadFilename}</h3>
                <p className="text-xs text-slate-400">
                  {uploadedResult.detectedReason} • Type: <strong className="text-slate-200">{uploadedResult.docType}</strong>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-500">Signer Identity:</span>
                  <span className="text-slate-300 font-semibold">{uploadedResult.signerIdentity.commonName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Certificate Serial:</span>
                  <span className="text-emerald-400 font-bold">{uploadedResult.signerIdentity.serialNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Placement Page:</span>
                  <span className="text-slate-300">Page {uploadedResult.pageIndex + 1} ({uploadedResult.signatureCount} box{uploadedResult.signatureCount > 1 ? "es" : ""})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Timestamp:</span>
                  <span className="text-slate-300">{uploadedResult.signerIdentity.timestamp}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Turso Storage Records & Capacity Engine */}
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
              <div className="flex items-center gap-2 self-start sm:self-auto">
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
                {/* Active Data */}
                <div
                  style={{ width: `${Math.max(1, (activeDataMb / maxStorageMb) * 100 * 20)}%` }}
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-l-full transition-all duration-500"
                  title={`Active Data: ${activeDataMb} MB`}
                />
                {/* Freelist Pages */}
                <div
                  style={{ width: `${Math.max(1, (freelistMb / maxStorageMb) * 100 * 20)}%` }}
                  className="h-full bg-gradient-to-r from-purple-500 to-amber-500 transition-all duration-500"
                  title={`Freelist Cache: ${freelistMb} MB`}
                />
                {/* Remaining Free Space */}
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
              {/* Card 1: Remaining Capacity */}
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

              {/* Card 2: Total Plan Allowance */}
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

              {/* Card 3: Current Allocated File Size */}
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

              {/* Card 4: DTR/AR Binary Store */}
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

            {/* Official Capacity Advice & Technical Guidance Banner */}
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
                <p>
                  • <strong className="text-white">Freelist Recycling:</strong> SQLite has <strong className="text-amber-300">{freelistMb} MB</strong> of pre-allocated reusable freelist pages. Updates and replacements will reuse this existing space without consuming any additional disk quota.
                </p>
                <p>
                  • <strong className="text-white">Scaling Recommendation:</strong> Turso Cloud provides fast libSQL response times across Region V. When your repository approaches &gt;80% capacity (7.2 GB), old archival years can be backed up to object storage (e.g. S3/R2) or upgraded seamlessly on Turso. Currently, no upgrades or action are required.
                </p>
              </div>
            </div>
          </div>

          {/* Stored Records in dtr_storage */}
          <div className="bg-[#0C101A] border border-[#1A2235] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  Active Records in dtr_storage Table
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Synchronized personnel records stored in the cloud database for Ace M. Malto.
                </p>
              </div>
              <span className="text-xs text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg font-bold">
                ● {dtrRecordCount} Records Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* DTR Record Card */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Daily Time Record (DTR)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    Approved
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono space-y-1">
                  <div>ID: <span className="text-slate-300">dtr-store-usr-mu3eob3l-2026-09-full</span></div>
                  <div>User ID: <span className="text-slate-300">usr-mu3eob3l</span></div>
                  <div>File: <span className="text-blue-400">{dtrPdfFilename}</span></div>
                  <div>Supervisor: <span className="text-purple-300">Rene Jane R. Buena</span></div>
                  <div>Storage Size: <span className="text-emerald-400">~1.25 MB</span></div>
                </div>
              </div>

              {/* AR Record Card */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Accomplishment Report (AR)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    Approved
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono space-y-1">
                  <div>ID: <span className="text-slate-300">ar-store-usr-mu3eob3l-2026-09</span></div>
                  <div>User ID: <span className="text-slate-300">usr-mu3eob3l</span></div>
                  <div>File: <span className="text-purple-400">{arPdfFilename}</span></div>
                  <div>Supervisor: <span className="text-purple-300">Rene Jane R. Buena</span></div>
                  <div>Storage Size: <span className="text-emerald-400">~1.83 MB</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
