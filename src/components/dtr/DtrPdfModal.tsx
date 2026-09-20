import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Printer,
  Download,
  FileSpreadsheet,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building,
  User,
  Calendar,
  Loader2,
  ExternalLink
} from "lucide-react";
import { DtrStorageItem, getCachedPdfDataUrl, setCachedPdfDataUrl } from "@/data/dtrStorage";
import { exportDtrToExcel } from "@/utils/dtrUtils";
import { downloadDtrVectorPdf } from "@/utils/dtrVectorPdf";
import { dtrGeneratorApi, dtrStorageApi } from "@/services/api";
import { DtrSignatureValidationModal } from "./DtrSignatureValidationModal";

interface DtrPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DtrStorageItem | null;
}

function createPdfBlobUrl(dataUrl: string): string | null {
  try {
    if (!dataUrl) return null;
    let base64 = dataUrl;
    if (dataUrl.includes(",")) {
      base64 = dataUrl.split(",")[1];
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error("Error creating Blob URL from base64 PDF:", err);
    return null;
  }
}

export function DtrPdfModal({ isOpen, onClose, record }: DtrPdfModalProps) {
  const [zoom, setZoom] = useState(100);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showValidationStatusModal, setShowValidationStatusModal] = useState(false);
  const [validationTarget, setValidationTarget] = useState<"employee" | "supervisor">("supervisor");
  const printableAreaRef = useRef<HTMLDivElement>(null);

  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | undefined>(undefined);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  useEffect(() => {
    if (!record) {
      setCurrentPdfUrl(undefined);
      return;
    }

    const cached = record.pdfDataUrl || getCachedPdfDataUrl(record.id);
    if (cached) {
      setCurrentPdfUrl(cached);
      return;
    }

    if (record.docType === "AR" || record.pdfFileName?.toUpperCase().startsWith("AR_")) {
      setIsLoadingPdf(true);
      dtrStorageApi.getRecord(record.id).then((fullRec) => {
        if (fullRec && fullRec.pdfDataUrl) {
          setCurrentPdfUrl(fullRec.pdfDataUrl);
          setCachedPdfDataUrl(record.id, fullRec.pdfDataUrl);
        }
      }).catch((err) => {
        console.warn("Could not fetch remote AR PDF:", err);
      }).finally(() => {
        setIsLoadingPdf(false);
      });
    }
  }, [record]);

  // Convert raw base64 Data URL to Blob URL for fast native browser PDF embedding
  useEffect(() => {
    if (!currentPdfUrl) {
      setBlobUrl(null);
      return;
    }

    const url = createPdfBlobUrl(currentPdfUrl);
    setBlobUrl(url);

    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [currentPdfUrl]);

  if (!isOpen || !record) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 15, 160));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 15, 70));
  const handleResetZoom = () => setZoom(100);

  // Trigger Native Print for the modal
  const handlePrint = () => {
    if ((record.docType === "AR" || record.pdfFileName?.toUpperCase().startsWith("AR_")) && blobUrl) {
      const printWindow = window.open(blobUrl, "_blank");
      if (printWindow) {
        printWindow.focus();
        printWindow.print();
      }
      return;
    }

    const printContent = printableAreaRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Civil Service Form 48 - ${record.employeeName} - ${record.periodText}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page {
              size: letter portrait;
              margin: 6mm 4mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            img {
              max-height: 26px;
              max-width: 80px;
              object-fit: contain;
            }
          </style>
        </head>
        <body class="bg-white p-4">
          <div class="grid grid-cols-2 gap-5 w-full max-w-[860px] mx-auto text-black">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Direct Download PDF trigger using real vector PDF generator matching DTR Generator
  const handleDownloadPdf = async () => {
    if (!record) return;
    setIsDownloading(true);

    if (record.docType === "AR" || record.pdfFileName?.toUpperCase().startsWith("AR_")) {
      const downloadUrl = currentPdfUrl || record.pdfDataUrl || getCachedPdfDataUrl(record.id);
      if (downloadUrl) {
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = record.pdfFileName || `AR_${record.employeeName}_${record.year}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setIsDownloading(false);
      return;
    }

    try {
      // Fetch active PNPKI signature profile from Turso for full cryptographic signing
      let activeProfile: any = null;
      const signerName = record.supervisorName || record.employeeName;
      try {
        if (record.supervisorName) {
          const profiles = await dtrGeneratorApi.getRecords({ Name: record.supervisorName });
          activeProfile = profiles.find((p) => p.Name.toLowerCase() === record.supervisorName.toLowerCase()) || profiles[0];
        }
        if (!activeProfile && record.userId) {
          const profiles = await dtrGeneratorApi.getRecords({ user_Id: String(record.userId) });
          activeProfile = profiles.find((p) => p.user_Id === String(record.userId) || p.id === `dtr-sig-${record.userId}`) || profiles[0];
        }
        if (!activeProfile) {
          const allProfiles = await dtrGeneratorApi.getRecords();
          activeProfile = allProfiles.find(
            (p) =>
              p.Name.toLowerCase().includes((signerName || "").toLowerCase()) ||
              (signerName || "").toLowerCase().includes(p.Name.toLowerCase())
          );
        }
      } catch (err) {
        console.warn("Could not fetch signature profile for PO download:", err);
      }

      const hasP12Keystore = Boolean(record.hasP12 || record.supervisorHasP12 || record.status === "Verified" || record.status === "Approved" || activeProfile?.hasP12 || activeProfile?.p12);
      const p12Options = (activeProfile && (activeProfile.hasP12 || activeProfile.p12))
        ? {
            profileId: activeProfile.id,
            user_Id: activeProfile.user_Id,
            p12Base64: activeProfile.p12 || undefined,
            signerName: activeProfile.Name || signerName,
          }
        : null;

      await downloadDtrVectorPdf(
        {
          employeeName: record.employeeName,
          supervisorName: record.supervisorName,
          supervisorTitle: record.supervisorTitle,
          periodText: record.periodText,
          regularHours: record.regularHours,
          saturdayHours: record.saturdayHours,
          month: record.month,
          year: record.year,
          scope: record.scope,
          hasP12: hasP12Keystore,
          status: record.status,
          employeeSignatureImage: record.employeeSignatureImage || (record.status === "Submitted" ? record.signatureImage : undefined),
          employeeHasP12: record.employeeHasP12 ?? (record.status === "Submitted" ? record.hasP12 : false),
          employeeSignerName: record.employeeSignerName || record.employeeName,
          supervisorSignatureImage: record.supervisorSignatureImage || (record.status !== "Submitted" ? (record.signatureImage || activeProfile?.image_digiSigned) : undefined),
          supervisorHasP12: record.supervisorHasP12 || (record.status !== "Submitted" && hasP12Keystore),
          signerName: record.signerName || activeProfile?.Name || signerName,
        } as any,
        record.rows,
        record.supervisorSignatureImage || (record.status !== "Submitted" ? (record.signatureImage || activeProfile?.image_digiSigned) : undefined),
        hasP12Keystore,
        p12Options
      );
    } catch (err) {
      console.error("Error generating vector PDF:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Export to Excel
  const handleExcelExport = () => {
    exportDtrToExcel(
      {
        employeeName: record.employeeName,
        supervisorName: record.supervisorName,
        supervisorTitle: record.supervisorTitle,
        periodText: record.periodText,
        regularHours: record.regularHours,
        saturdayHours: record.saturdayHours,
        month: record.month,
        year: record.year,
        scope: record.scope
      },
      record.rows
    );
  };

  const statusBg =
    record.status === "Approved"
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : record.status === "Verified"
      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
      : record.status === "For Revision"
      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : "bg-slate-700/50 text-slate-300 border-slate-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in overflow-hidden">
      <div className="bg-[#0C101D] border border-[#1E293B] rounded-2xl w-full max-w-6xl h-[94vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Modal Top Control Bar */}
        <div className="bg-[#080B14] border-b border-[#1E293B] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                  {record.employeeName}
                </h2>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusBg}`}>
                  {record.status}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  {record.module === "PROVINCIAL" ? record.province : record.module}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Civil Service Form No. 48 • {record.periodText} • {record.pdfFileSize}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center gap-1 bg-[#111728] border border-[#1C2844] rounded-xl px-2 py-1 text-slate-300 text-xs">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 hover:text-white rounded hover:bg-slate-800 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="w-10 text-center font-mono font-bold text-[11px] select-none">
                {zoom}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 hover:text-white rounded hover:bg-slate-800 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1 hover:text-white rounded hover:bg-slate-800 transition-colors ml-1"
                title="Reset Zoom"
              >
                <Maximize2 className="w-3 h-3 text-slate-400" />
              </button>
            </div>

            {/* Open in New Window (for AR PDF) */}
            {blobUrl && (
              <a
                href={blobUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl bg-[#111728] hover:bg-[#1C2844] border border-[#1C2844] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Open PDF in a new browser tab"
              >
                <ExternalLink className="w-4 h-4 text-purple-400" />
                <span className="hidden md:inline">Open in Tab</span>
              </a>
            )}

            {/* Print */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-[#111728] hover:bg-[#1C2844] border border-[#1C2844] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-blue-400" />
              <span className="hidden md:inline">Print Document</span>
            </button>

            {/* Excel (only for tabular standard DTR) */}
            {record.docType !== "AR" && !record.pdfFileName?.toUpperCase().startsWith("AR_") && (
              <button
                type="button"
                onClick={handleExcelExport}
                className="px-3 py-2 rounded-xl bg-[#111728] hover:bg-[#1C2844] border border-[#1C2844] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Export as Excel .xlsx"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span className="hidden md:inline">Excel</span>
              </button>
            )}

            {/* Direct PDF Download Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-900/30 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? "Preparing PDF..." : "Download PDF"}</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Info Bar */}
        <div className="bg-[#101626] border-b border-[#18233C] px-5 py-2 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <strong className="text-white">Position:</strong> {record.position} ({record.employmentStatus})
            </span>
            <span className="hidden sm:flex items-center gap-1.5 text-slate-300">
              <Building className="w-3.5 h-3.5 text-purple-400" />
              <strong className="text-white">Division / Office:</strong> {record.sectionDivision}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <Clock className="w-3.5 h-3.5" />
              Total: {record.totalDaysRendered} Days ({record.totalHoursRendered} hrs)
            </span>
            <span className="text-slate-500">
              Submitted: {record.submittedDate}
            </span>
          </div>
        </div>

        {/* PDF Document Viewer Container */}
        <div className="flex-1 bg-[#06080F] p-4 sm:p-8 overflow-auto flex justify-center items-start custom-scrollbar">
          
          {record.docType === "AR" || record.pdfFileName?.toUpperCase().startsWith("AR_") ? (
            <div className="w-full h-full max-w-5xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col min-h-[640px] relative">
              {blobUrl ? (
                <iframe
                  src={`${blobUrl}#toolbar=1&navpanes=1`}
                  title={record.pdfFileName || "Accomplishment Report"}
                  className="w-full flex-1 min-h-[640px] border-0"
                />
              ) : isLoadingPdf ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-500 my-auto">
                  <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-3" />
                  <p className="text-sm font-semibold text-slate-300">Loading Accomplishment Report PDF...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-slate-500 my-auto text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto shadow-inner">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-bold text-slate-700">{record.pdfFileName}</p>
                    <p className="text-xs text-slate-500 max-w-md">
                      No embedded PDF byte stream was attached to this specific entry. Please delete and re-upload the AR PDF file using the <strong>Upload AR</strong> button.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Scalable Printable Document Wrapper */
            <div
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
              className="transition-transform duration-150 ease-out"
            >
              {/* White A4 Sheet with 2-in-1 Civil Service Form 48 */}
              <div
                ref={printableAreaRef}
                className="bg-white text-black p-6 rounded-sm shadow-2xl w-[860px] grid grid-cols-2 gap-5 select-text print:shadow-none print:w-full print:gap-3"
              >
                {/* COPY 1 (LEFT FORM) */}
                <Form48Strip
                  record={record}
                  onShowValidationStatus={(target) => {
                    setValidationTarget(target);
                    setShowValidationStatusModal(true);
                  }}
                />

                {/* COPY 2 (RIGHT FORM) */}
                <Form48Strip
                  record={record}
                  onShowValidationStatus={(target) => {
                    setValidationTarget(target);
                    setShowValidationStatusModal(true);
                  }}
                />
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Footer */}
        <div className="bg-[#080B14] border-t border-[#1E293B] px-5 py-2.5 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>DICT Region V Official Records & Document Management System</span>
          </div>
          <div>
            Verified by: <strong className="text-slate-300">{record.supervisorName}</strong> ({record.supervisorTitle})
          </div>
        </div>

      </div>

      {/* Signature Validation Status Modal (Matching Image 2 & Image 3) */}
      <DtrSignatureValidationModal
        isOpen={showValidationStatusModal}
        onClose={() => setShowValidationStatusModal(false)}
        signerName={
          validationTarget === "employee"
            ? (record.employeeSignerName || record.employeeName || "PERSONNEL")
            : (record.signerName || "Malto Ace Mata")
        }
      />
    </div>
  );
}

// Single CS Form 48 Strip Component
function Form48Strip({
  record,
  onShowValidationStatus,
}: {
  record: DtrStorageItem;
  onShowValidationStatus?: (target: "employee" | "supervisor") => void;
}) {
  const totalUndertime = record.rows.reduce(
    (acc, r) => {
      const h = parseInt(r.undertimeHours, 10) || 0;
      const m = parseInt(r.undertimeMinutes, 10) || 0;
      return { hours: acc.hours + h, minutes: acc.minutes + m };
    },
    { hours: 0, minutes: 0 }
  );

  return (
    <div className="p-1 flex flex-col justify-between font-serif text-[10.5px] leading-tight bg-white select-text">
      
      {/* Header */}
      <div className="text-center space-y-0.5">
        <div className="text-[8.5px] italic text-left text-slate-800 font-serif">
          Civil Service Form No. 48
        </div>

        <h2 className="text-[11px] font-bold tracking-wider uppercase font-sans mt-0.5 text-black">
          DAILY TIME RECORD
        </h2>
        <div className="text-[8.5px] tracking-widest text-slate-700">----- oOo -----</div>

        {/* Employee Name */}
        <div className="pt-1.5">
          <div className="border-b border-black text-center font-bold text-[11px] uppercase tracking-wide px-2 pb-0.5 min-h-[16px]">
            {record.employeeName || "PERSONNEL"}
          </div>
          <div className="text-[8.5px] text-center text-slate-700 mt-0.5 font-sans">
            (Name)
          </div>
        </div>

        {/* Period */}
        <div className="pt-0.5 text-left flex items-baseline gap-1 text-[9.5px]">
          <span className="italic font-serif whitespace-nowrap">For the month of</span>
          <span className="border-b border-black font-bold uppercase tracking-wider flex-1 text-center font-sans text-[9.5px]">
            {record.periodText || "MM DD-DD YYYY"}
          </span>
        </div>

      </div>

      {/* Grid Table */}
      <div className="mt-1.5 border border-black overflow-hidden font-sans">
        <table className="w-full text-center text-[8.5px] border-collapse">
          <thead>
            <tr className="border-b border-black bg-slate-100 font-bold">
              <th rowSpan={2} className="border-r border-black w-[24px] py-0.5 px-0.5">
                Days
              </th>
              <th colSpan={2} className="border-r border-black py-0.5">
                A.M.
              </th>
              <th colSpan={2} className="border-r border-black py-0.5">
                P.M.
              </th>
              <th colSpan={2} className="py-0.5">
                Undertime
              </th>
            </tr>
            <tr className="border-b border-black bg-slate-100 font-semibold text-[8px]">
              <th className="border-r border-black w-[48px] py-0.5">Arrival</th>
              <th className="border-r border-black w-[48px] py-0.5">Departure</th>
              <th className="border-r border-black w-[48px] py-0.5">Arrival</th>
              <th className="border-r border-black w-[48px] py-0.5">Departure</th>
              <th className="border-r border-black w-[30px] py-0.5">Hours</th>
              <th className="w-[30px] py-0.5">Minutes</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-black text-[8.5px]">
            {record.rows.map((row) => {
              if (row.isCustomLabel) {
                const labelUpper = (row.customLabel || "").trim().toUpperCase();
                const isWeekend = labelUpper.includes("SATURDAY") || labelUpper.includes("SUNDAY");
                const rowBg = isWeekend ? "#e5e7eb" : "#ffffff";
                const cellBgClass = isWeekend ? "bg-gray-200" : "bg-white";

                return (
                  <tr key={row.day} style={{ backgroundColor: rowBg }} className={`h-[13px] ${cellBgClass}`}>
                    <td 
                      style={{ backgroundColor: rowBg }}
                      className={`border-r border-black font-bold text-center px-0.5 py-0 ${cellBgClass} text-black`}
                    >
                      {row.day}
                    </td>
                    <td
                      colSpan={6}
                      style={{ backgroundColor: rowBg }}
                      className={`font-bold text-center text-black tracking-wider text-[8px] uppercase py-0 ${cellBgClass}`}
                    >
                      {row.customLabel || "—"}
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={row.day} className="h-[13px]">
                  <td className="border-r border-black font-bold text-center px-0.5 py-0 bg-slate-50/50">
                    {row.day}
                  </td>
                  <td className="border-r border-black py-0 px-0.5 font-medium">{row.amArrival || ""}</td>
                  <td className="border-r border-black py-0 px-0.5 font-medium">{row.amDeparture || ""}</td>
                  <td className="border-r border-black py-0 px-0.5 font-medium">{row.pmArrival || ""}</td>
                  <td className="border-r border-black py-0 px-0.5 font-medium">{row.pmDeparture || ""}</td>
                  <td className="border-r border-black py-0 px-0.5 text-slate-700">{row.undertimeHours || ""}</td>
                  <td className="py-0 px-0.5 text-slate-700">{row.undertimeMinutes || ""}</td>
                </tr>
              );
            })}

            {/* Total Row */}
            <tr className="border-t-2 border-black font-bold bg-slate-100 text-[8.5px]">
              <td colSpan={5} className="border-r border-black text-right pr-2 py-0.5 uppercase tracking-wider">
                TOTAL
              </td>
              <td className="border-r border-black text-center py-0.5">
                {totalUndertime.hours || "0"}
              </td>
              <td className="text-center py-0.5">
                {totalUndertime.minutes || "0"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Certification Footer (Strictly matching Image 2 - Fully stretched across table) */}
      <div className="mt-2.5 space-y-2 font-sans leading-tight">
        <div className="italic text-[11px] leading-[1.35] w-full select-text">
          <div className="flex justify-between w-full">
            {"I certify on my honor that the above is a true and correct report of the".split(" ").map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>
          <div className="flex justify-between w-full">
            {"hours of work performed, record of which was made daily at the time of".split(" ").map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>
          <div className="text-left">
            arrival and departure from office.
          </div>
        </div>

        {/* Employee Signature Area (Retains employee p12 and digital signature) */}
        <div className="pt-1 flex flex-col items-center">
          {record.employeeSignatureImage || (record.signatureImage && (record.status === "Submitted" || !record.supervisorSignatureImage)) || record.employeeHasP12 || record.hasP12 ? (
            <div
              onClick={() => onShowValidationStatus?.("employee")}
              className="bg-blue-50/60 hover:bg-blue-100/70 border border-blue-300/80 rounded-lg px-2.5 py-1 flex items-center gap-2 cursor-pointer shadow-xs hover:border-blue-500 transition-all mb-1 min-h-[30px] select-none"
              title="Click to view employee PNPKI Digital Signature Validation Status"
            >
              {(record.employeeSignatureImage || (record.status === "Submitted" ? record.signatureImage : undefined)) && (
                <img
                  src={record.employeeSignatureImage || record.signatureImage}
                  alt="Employee Signature"
                  className="h-6 max-w-[65px] object-contain mix-blend-multiply"
                />
              )}
              <div className="text-[7.5px] font-sans text-left leading-tight text-slate-900">
                <div className="font-bold text-[8.5px] text-black">Digitally signed</div>
                <div className="text-[8px] font-semibold text-slate-900">
                  by {(record.employeeSignerName || record.employeeName || "PERSONNEL").trim()}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-8 min-h-[32px] flex items-center justify-center mb-1 w-full" />
          )}
          <div className="border-b border-black text-center font-bold uppercase tracking-wider text-[11px] font-sans pb-0.5 w-full">
            {record.employeeName || "PERSONNEL"}
          </div>
        </div>

        <p className="italic text-left pt-1.5 leading-tight text-[11px]">
          VERIFIED as to the prescribed office hours:
        </p>

        {/* Supervisor Signature Area (Only populated when verified/signed by PO or Super Admin) */}
        <div className="pt-1 flex flex-col items-center">
          {(record.status === "Verified" || record.status === "Approved") && (record.supervisorSignatureImage || record.supervisorHasP12 || record.signerName) ? (
            <div
              onClick={() => onShowValidationStatus?.("supervisor")}
              className="bg-blue-50/60 hover:bg-blue-100/70 border border-blue-300/80 rounded-lg px-2.5 py-1 flex items-center gap-2 cursor-pointer shadow-xs hover:border-blue-500 transition-all mb-1 min-h-[30px] select-none"
              title="Click to view supervisor PNPKI Digital Signature Validation Status"
            >
              {record.supervisorSignatureImage && (
                <img
                  src={record.supervisorSignatureImage}
                  alt="Supervisor Signature"
                  className="h-6 max-w-[65px] object-contain mix-blend-multiply"
                />
              )}
              <div className="text-[7.5px] font-sans text-left leading-tight text-slate-900">
                <div className="font-bold text-[8.5px] text-black">Digitally signed</div>
                <div className="text-[8px] font-semibold text-slate-900">
                  by {(record.signerName || "Malto Ace Mata").trim()}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-8 min-h-[32px] flex items-center justify-center mb-1 w-full" />
          )}
          <div className="border-b border-black text-center font-bold uppercase tracking-wider text-[10.5px] font-sans pb-0.5 w-full">
            {record.supervisorName || "NORLY A. TABO"}
          </div>
          <div className="text-[8.5px] italic text-center font-serif text-black pt-0.5">
            {record.supervisorTitle || "OIC Chief - Technical Operations Division"}
          </div>
        </div>
      </div>

    </div>
  );
}
