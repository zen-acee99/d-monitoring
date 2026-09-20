import React, { useState, useEffect } from "react";
import {
  X,
  Upload,
  FileText,
  User,
  Building,
  Calendar,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2
} from "lucide-react";
import {
  DtrModuleCategory,
  ProvincialTab,
  PROVINCIAL_TABS,
  DtrStorageItem,
  addDtrRecord,
  syncDtrStorageWithBackend
} from "@/data/dtrStorage";
import { MONTH_NAMES, createEmptyDtrRows, autoFillWeekendsAndHolidays } from "@/utils/dtrUtils";
import { getCurrentUser } from "@/services/authStore";
import { dtrStorageApi } from "@/services/api";

interface DtrUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultModule?: DtrModuleCategory;
  defaultProvince?: ProvincialTab;
  defaultDocType?: "DTR" | "AR";
  onRecordSaved?: (record: DtrStorageItem) => void;
}

export function DtrUploadModal({
  isOpen,
  onClose,
  defaultModule = "TOD",
  defaultProvince = "Albay",
  defaultDocType = "DTR",
  onRecordSaved
}: DtrUploadModalProps) {
  const [docType, setDocType] = useState<"DTR" | "AR">(defaultDocType);
  const [module, setModule] = useState<DtrModuleCategory>(defaultModule);
  const [province, setProvince] = useState<ProvincialTab>(defaultProvince);

  // Sync default docType, module, and province when modal opens / props change
  useEffect(() => {
    setDocType(defaultDocType);
    setModule(defaultModule);
    setProvince(defaultProvince);
    setErrorMsg(null);
    setPdfFile(null);
    setPdfFileName("");
    setPdfFileSize("");
    setPdfDataUrl(undefined);
  }, [defaultDocType, defaultModule, defaultProvince, isOpen]);

  const [employeeName, setEmployeeName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [position, setPosition] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState<"Regular" | "COS" | "Job Order" | "Contractual">("Regular");
  const [sectionDivision, setSectionDivision] = useState("");

  const [month, setMonth] = useState(7); // August (0-indexed)
  const [year, setYear] = useState(2026);
  const [scope, setScope] = useState<"full" | "first-half" | "second-half">("first-half");

  const [supervisorName, setSupervisorName] = useState("NORLY A. TABO");
  const [supervisorTitle, setSupervisorTitle] = useState("OIC Chief - Technical Operations Division");

  const [status, setStatus] = useState<"Submitted" | "Verified" | "Approved">("Submitted");
  const [remarks, setRemarks] = useState("");

  // Uploaded PDF file state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfFileSize, setPdfFileSize] = useState("");
  const [pdfDataUrl, setPdfDataUrl] = useState<string | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  // Handle module change and adjust defaults
  const handleModuleChange = (newModule: DtrModuleCategory) => {
    setModule(newModule);
    if (newModule === "TOD") {
      setSupervisorName("NORLY A. TABO");
      setSupervisorTitle("OIC Chief - Technical Operations Division");
      setSectionDivision("Technical Operations Division");
    } else if (newModule === "HRM") {
      setSupervisorName("MARIA ELENA SANTOS");
      setSupervisorTitle("Administrative Officer V (HRMO III)");
      setSectionDivision("Human Resource Management Division");
    } else {
      setSupervisorName("NORLY A. TABO");
      setSupervisorTitle("OIC Chief - Technical Operations Division");
      setSectionDivision(`${province} Provincial Operations`);
    }
  };

  // Handle Province change
  const handleProvinceChange = (newProv: ProvincialTab) => {
    setProvince(newProv);
    setSectionDivision(`${newProv} Provincial Operations`);
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Handle File Input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
        setErrorMsg("Please upload a valid PDF document (.pdf).");
        return;
      }
      setErrorMsg(null);
      setPdfFile(file);
      setPdfFileName(file.name);
      const sizeKb = Math.round(file.size / 1024);
      setPdfFileSize(`${sizeKb} KB`);

      // Read file as Data URL for previewing and storage
      const reader = new FileReader();
      reader.onload = (event) => {
        setPdfDataUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    let currentDataUrl = pdfDataUrl;
    if (!currentDataUrl && pdfFile) {
      try {
        currentDataUrl = await readFileAsDataUrl(pdfFile);
        setPdfDataUrl(currentDataUrl);
      } catch (err) {
        console.error("Error reading file:", err);
      }
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      // Handling AR (Accomplishment Report) Quick Upload
      if (docType === "AR") {
        if (!pdfFile && !currentDataUrl) {
          setErrorMsg("Please attach an Accomplishment Report (AR) PDF file before saving.");
          setIsSaving(false);
          return;
        }

        const currentUser = getCurrentUser();
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const pText = `${MONTH_NAMES[currentMonth].toUpperCase()} 01-${daysInMonth}, ${currentYear}`;

        const safeEmployeeName = (currentUser?.name || employeeName || "ACE M. MALTO").trim().toUpperCase();
        const generatedFileName =
          pdfFileName ||
          `AR_${safeEmployeeName.replace(/[^a-zA-Z0-9]/g, "_")}_${MONTH_NAMES[currentMonth]}_${currentYear}.pdf`;
        const generatedFileSize = pdfFileSize || "320 KB";

        const targetProvince = module === "PROVINCIAL" ? (province || defaultProvince) : undefined;
        const targetSection = module === "PROVINCIAL" ? `${targetProvince} Provincial Operations` : `${module} Division`;
        const targetSupervisor = module === "PROVINCIAL" ? "RENE JANE R. BUENA" : module === "TOD" ? "NORLY A. TABO" : "MARIA ELENA SANTOS";
        const targetSupervisorTitle = module === "PROVINCIAL" ? `Provincial Officer - ${targetProvince}` : module === "TOD" ? "OIC Chief - Technical Operations Division" : "Administrative Officer V (HRMO III)";

        const emptyRows = createEmptyDtrRows();
        const populatedRows = autoFillWeekendsAndHolidays(emptyRows, currentMonth, currentYear, "full");

        const newRecord = addDtrRecord({
          docType: "AR",
          userId: currentUser?.id ? String(currentUser.id) : undefined,
          employeeName: safeEmployeeName,
          employeeId: currentUser?.id ? String(currentUser.id) : (employeeId.trim() || `DICT-R5-${currentYear}-${Math.floor(100 + Math.random() * 900)}`),
          position: (currentUser as any)?.position || currentUser?.role || position.trim() || "Technical Specialist",
          employmentStatus: "Regular",
          module,
          province: targetProvince,
          sectionDivision: targetSection,
          periodText: pText,
          month: currentMonth,
          year: currentYear,
          scope: "full",
          regularHours: "8:00 AM - 5:00 PM",
          saturdayHours: "As Required",
          supervisorName: targetSupervisor,
          supervisorTitle: targetSupervisorTitle,
          totalDaysRendered: 22,
          totalHoursRendered: 176,
          undertimeHours: 0,
          undertimeMinutes: 0,
          status: "Submitted",
          pdfFileName: generatedFileName,
          pdfFileSize: generatedFileSize,
          pdfDataUrl: currentDataUrl,
          rows: populatedRows,
          remarks: "Accomplishment Report submission",
        });

        // Ensure database write completes
        await dtrStorageApi.saveRecord(newRecord);
        await syncDtrStorageWithBackend();

        if (onRecordSaved) {
          onRecordSaved(newRecord);
        }

        onClose();
        return;
      }

      // Standard DTR Form Save
      if (!employeeName.trim()) {
        setErrorMsg("Please provide the employee full name.");
        setIsSaving(false);
        return;
      }

      const mName = MONTH_NAMES[month].toUpperCase();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      let pText = `${mName} 01-${daysInMonth}, ${year}`;
      if (scope === "first-half") pText = `${mName} 01-15, ${year}`;
      if (scope === "second-half") pText = `${mName} 16-${daysInMonth}, ${year}`;

      // Auto-generate standard working rows
      const emptyRows = createEmptyDtrRows();
      const withHolidays = autoFillWeekendsAndHolidays(emptyRows, month, year, scope);
      const populatedRows = withHolidays.map((row) => {
        if (scope === "first-half" && row.day > 15) return row;
        if (scope === "second-half" && (row.day <= 15 || row.day > daysInMonth)) return row;
        if (scope === "full" && row.day > daysInMonth) return row;
        if (row.isCustomLabel) return row;

        return {
          ...row,
          amArrival: "07:55 AM",
          amDeparture: "12:00 PM",
          pmArrival: "12:58 PM",
          pmDeparture: "05:00 PM",
          undertimeHours: "",
          undertimeMinutes: ""
        };
      });

      const renderedDays = populatedRows.filter((r) => !r.isCustomLabel && r.amArrival).length;
      const renderedHours = renderedDays * 8;

      const currentUser = getCurrentUser();
      const safeEmployeeName = employeeName.trim().toUpperCase();
      const generatedFileName =
        pdfFileName ||
        `DTR_${safeEmployeeName.replace(/[^a-zA-Z0-9]/g, "_")}_${MONTH_NAMES[month]}_${year}.pdf`;
      const generatedFileSize = pdfFileSize || "320 KB";

      const newRecord = addDtrRecord({
        docType: "DTR",
        userId: currentUser?.id ? String(currentUser.id) : undefined,
        employeeName: safeEmployeeName,
        employeeId: employeeId.trim() || `DICT-R5-${year}-${Math.floor(100 + Math.random() * 900)}`,
        position: position.trim() || "Technical Specialist",
        employmentStatus,
        module,
        province: module === "PROVINCIAL" ? province : undefined,
        sectionDivision: sectionDivision.trim() || (module === "PROVINCIAL" ? `${province} Operations` : `${module} Division`),
        periodText: pText,
        month,
        year,
        scope,
        regularHours: "8:00 AM - 5:00 PM",
        saturdayHours: "As Required",
        supervisorName: supervisorName.trim() || "NORLY A. TABO",
        supervisorTitle: supervisorTitle.trim() || "OIC Chief - Technical Operations Division",
        totalDaysRendered: renderedDays,
        totalHoursRendered: renderedHours,
        undertimeHours: 0,
        undertimeMinutes: 0,
        status,
        pdfFileName: generatedFileName,
        pdfFileSize: generatedFileSize,
        pdfDataUrl: currentDataUrl,
        rows: populatedRows,
        remarks: remarks.trim()
      });

      // Ensure database write completes
      await dtrStorageApi.saveRecord(newRecord);
      await syncDtrStorageWithBackend();

      if (onRecordSaved) {
        onRecordSaved(newRecord);
      }

      onClose();
    } catch (err: any) {
      console.error("Save error:", err);
      setErrorMsg(err.message || "Failed to save record");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="bg-[#0C101D] border border-[#1E293B] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
              docType === "AR"
                ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                : "bg-blue-500/10 border-blue-500/20 text-blue-400"
            }`}>
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  {docType === "AR" ? "Upload Accomplishment Report (AR)" : "Upload / Add DTR Document Record"}
                </h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border ${
                  docType === "AR"
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                    : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                }`}>
                  {docType}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {docType === "AR"
                  ? "Submit personnel monthly accomplishment report to DICT Region V storage archive"
                  : "Submit personnel daily time record to DICT Region V storage archive"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          
          {docType === "AR" ? (
            /* ========================================================================= */
            /* AR (Accomplishment Report) Quick Upload - Only Yellow Dropzone & Save     */
            /* ========================================================================= */
            <div className="space-y-4">
              {/* PDF File Upload Dropzone */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Attach Signed AR PDF File *
                </label>
                <div className="border-2 border-dashed border-[#232F4D] hover:border-purple-500/60 rounded-2xl p-8 text-center bg-[#080B14] transition-colors relative cursor-pointer group">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                      <FileText className="w-6 h-6" />
                    </div>
                    {pdfFileName ? (
                      <div className="space-y-0.5">
                        <p className="font-bold text-emerald-400 flex items-center justify-center gap-1.5 text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          {pdfFileName}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {pdfFileSize} • Ready for storage & PDF viewing
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-200 text-sm">
                          Click to browse or drag & drop Accomplishment Report (AR) PDF here
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Attach your official multi-page Accomplishment Report PDF document.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors font-semibold cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!pdfFileName || isSaving}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg shadow-purple-900/40 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving to Storage...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Save to AR Storage</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* Standard DTR Form View (Full fields)                                      */
            /* ========================================================================= */
            <>
              {/* Target Module / Division */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Sub-Module / Division Destination *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["HRM", "TOD", "PROVINCIAL"] as DtrModuleCategory[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleModuleChange(cat)}
                      className={`py-2 px-3 rounded-xl font-bold border transition-all text-center cursor-pointer ${
                        module === cat
                          ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/30"
                          : "bg-[#111728] border-[#1C2844] text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      {cat === "HRM"
                        ? "HRM Module"
                        : cat === "TOD"
                        ? "TOD Module"
                        : "Provincial Module"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Provincial Tab Selector (if Provincial is active) */}
              {module === "PROVINCIAL" && (
                <div className="space-y-1.5 p-3 rounded-xl bg-[#111728] border border-[#1C2844]">
                  <label className="block font-bold text-emerald-400 uppercase tracking-wider text-[10.5px]">
                    Select Provincial Unit / Tab *
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PROVINCIAL_TABS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleProvinceChange(p)}
                        className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] border transition-all cursor-pointer ${
                          province === p
                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm"
                            : "bg-[#080B14] border-[#18233C] text-slate-400 hover:text-white"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Employee Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    Employee Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    placeholder="e.g. JUAN D. DELA CRUZ"
                    className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    Employee ID Number
                  </label>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="e.g. DICT-R5-2026-001"
                    className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    Position / Job Title
                  </label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="e.g. Field Technical Officer"
                    className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    Employment Status
                  </label>
                  <select
                    value={employmentStatus}
                    onChange={(e) => setEmploymentStatus(e.target.value as any)}
                    className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Regular">Regular (Plantilla)</option>
                    <option value="COS">Contract of Service (COS)</option>
                    <option value="Job Order">Job Order (JO)</option>
                    <option value="Contractual">Contractual</option>
                  </select>
                </div>
              </div>

              {/* Period Target */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-[#080B14] border border-[#18233C]">
                <div>
                  <label className="block text-[10.5px] text-slate-400 font-medium mb-1">
                    Target Month
                  </label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                    className="w-full bg-[#111728] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] text-slate-400 font-medium mb-1">
                    Target Year
                  </label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value, 10) || 2026)}
                    className="w-full bg-[#111728] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] text-slate-400 font-medium mb-1">
                    Period Scope
                  </label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as any)}
                    className="w-full bg-[#111728] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="first-half">1st Half (01-15)</option>
                    <option value="second-half">2nd Half (16-31)</option>
                    <option value="full">Full Month (01-31)</option>
                  </select>
                </div>
              </div>

              {/* Supervisor Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    Supervisor Full Name
                  </label>
                  <input
                    type="text"
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    Supervisor Designation
                  </label>
                  <input
                    type="text"
                    value={supervisorTitle}
                    onChange={(e) => setSupervisorTitle(e.target.value)}
                    className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* PDF File Upload Dropzone */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Attach Signed PDF File (Optional)
                </label>
                <div className="border-2 border-dashed border-[#232F4D] hover:border-blue-500/60 rounded-2xl p-4 text-center bg-[#080B14] transition-colors relative cursor-pointer group">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    {pdfFileName ? (
                      <div className="space-y-0.5">
                        <p className="font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          {pdfFileName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {pdfFileSize} • Ready for storage & PDF viewing
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <p className="font-semibold text-slate-300">
                          Click to browse or drag & drop DTR PDF file here
                        </p>
                        <p className="text-[10px] text-slate-500">
                          If no file is attached, an official Civil Service Form 48 PDF will be automatically generated.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status & Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    Initial Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Submitted">Submitted (For Review)</option>
                    <option value="Verified">Verified by Focal/Lead</option>
                    <option value="Approved">Approved</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-medium mb-1">
                    Remarks / Notes
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Verified against biometric portal"
                    className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/40 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving to Storage...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Save to DTR Storage</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

        </form>

      </div>
    </div>
  );
}
