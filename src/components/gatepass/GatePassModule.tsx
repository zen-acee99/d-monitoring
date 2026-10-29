import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Clock,
  MapPin,
  Check,
  ShieldCheck,
  Building2,
  Users2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  Zap,
  Ticket,
  FileCheck2,
  Info,
  Archive,
  FolderArchive,
  Plus,
  Trash2,
  Edit3,
  Save,
  Search,
  X,
  Layers,
  Database
} from "lucide-react";
import { getCurrentUser } from "@/services/authStore";
import { UserRecord } from "@/data/userStore";
import { PROVINCIAL_TABS, ProvincialTab } from "@/data/dtrStorage";
import { dtrGeneratorApi, DtrGeneratorSignatureRecord, dtrUserSetupApi, DtrUserSetup } from "@/services/api";
import { formatPnpkiDate } from "@/utils/dtrUtils";
import {
  parseInclusivePassDates,
  saveGatePassToRegistry,
  getGatePassRegistry,
  deleteGatePassFromRegistry,
  incrementGatePassSeq,
  mergeAllGatePassesIntoDtrRows,
  GatePassRecord,
} from "@/utils/gatePassStorage";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export interface GatePassData {
  filingDate: string; // e.g. "October 7, 2026"
  filingDateIso: string; // e.g. "2026-10-07"
  controlNo: string; // e.g. "GP-POV 2026-10-0015"
  category: "official" | "personal";
  officialChoice: "travel" | "seminar" | "pickup" | "others" | "";
  personalChoice: "medication" | "family" | "others" | "";
  // Underline blank lines for Official:
  travelLine1: string;
  travelLine2: string;
  seminarLine1: string;
  seminarLine2: string;
  seminarLine3: string;
  seminarLine4: string;
  othersLine1: string;
  othersLine2: string;
  othersLine3: string;
  // Underline blank line for Personal:
  personalOthersLine1: string;
  // Activity Details (2nd date input, start time, venue):
  activityDates: string; // e.g. "October 8, 2026"
  activityDateIso: string; // e.g. "2026-10-08"
  startTime: string; // e.g. "7:00 AM - 6:00PM"
  venue: string; // e.g. "Legazpi Convention Center, Legazpi City"
  selectedPO: ProvincialTab;
  // Requested By (Personnel):
  requestedByName: string; // e.g. "Ace M. Malto"
  requestedByTitle: string; // e.g. "Project Development Officer II"
  requestedBySigner: string; // e.g. "Malto Ace Mara"
  includeRequestedByP12?: boolean;
  signatureImage?: string | null;
  p12FileName?: string | null;
  // Approved By (Supervisor):
  approvedByName: string; // e.g. "Rene Jane R. Buena"
  approvedByTitle: string; // e.g. "Provincial Officer - Albay"
  approvedBySigner: string; // e.g. "Buena Rene Jane Rosendo"
  includeApprovedByP12?: boolean;
}

const DEFAULT_GATEPASS: GatePassData = {
  filingDate: "October 7, 2026",
  filingDateIso: "2026-10-07",
  controlNo: "GP-POV 2026-10-0015",
  category: "official",
  officialChoice: "others",
  personalChoice: "",
  travelLine1: "",
  travelLine2: "",
  seminarLine1: "",
  seminarLine2: "",
  seminarLine3: "",
  seminarLine4: "",
  othersLine1: "Free-Wifi Connectivity Hardware and Network",
  othersLine2: "Management Training at Legazpi City",
  othersLine3: "",
  personalOthersLine1: "",
  activityDates: "October 8, 2026",
  activityDateIso: "2026-10-08",
  startTime: "7:00 AM - 6:00PM",
  venue: "Legazpi Convention Center, Legazpi City",
  selectedPO: "Albay",
  requestedByName: "ACE MATA MALTO",
  requestedByTitle: "Project Development Officer II",
  requestedBySigner: "Malto Ace Mata",
  signatureImage: null,
  p12FileName: null,
  approvedByName: "RENE JANE R. BUENA",
  approvedByTitle: "Provincial Officer - Albay",
  approvedBySigner: "Buena Rene Jane Rosendo",
};

/**
 * Strict Security Verification Rule:
 * Ensures the personnel on the Gate Pass matches the currently logged-in user.
 * user == userLogin  -> TRUE  (CS Form 48 .p12 credentials & digital signature are bound)
 * user != userLogin  -> FALSE (Strictly exclude signature/p12; leave signature area 100% blank)
 */
export function isUserMatch(
  user: UserRecord | null,
  requestedName: string,
  userSetupName?: string,
  profileSignerName?: string
): boolean {
  if (!user || !requestedName) return false;

  const normalize = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();

  const reqNorm = normalize(requestedName);
  const curNorm = normalize(user.name || "");
  const setupNorm = userSetupName ? normalize(userSetupName) : "";
  const signerNorm = profileSignerName ? normalize(profileSignerName) : "";

  if (!reqNorm) return false;

  // Direct exact string matches
  if (reqNorm === curNorm) return true;
  if (setupNorm && reqNorm === setupNorm) return true;
  if (signerNorm && reqNorm === signerNorm) return true;

  // Token-level inspection (handles e.g. "Ace M. Malto" vs "ACE MATA MALTO" vs "Malto, Ace")
  const reqTokens = reqNorm.split(/\s+/).filter((t) => t.length > 1);
  const curTokens = curNorm.split(/\s+/).filter((t) => t.length > 1);
  const setupTokens = setupNorm.split(/\s+/).filter((t) => t.length > 1);
  const signerTokens = signerNorm.split(/\s+/).filter((t) => t.length > 1);

  // Match against current logged-in user name
  const curMatches = reqTokens.filter((t) => curTokens.includes(t));
  if (curMatches.length >= 2) return true;
  if (curMatches.length >= 1 && (curTokens.length === 1 || reqTokens.length === 1)) return true;

  // Match against CS Form 48 setup employee name
  if (setupTokens.length > 0) {
    const setupMatches = reqTokens.filter((t) => setupTokens.includes(t));
    if (setupMatches.length >= 2) return true;
    if (setupMatches.length >= 1 && (setupTokens.length === 1 || reqTokens.length === 1)) return true;
  }

  // Match against CS Form 48 .p12 certificate signer name
  if (signerTokens.length > 0) {
    const signerMatches = reqTokens.filter((t) => signerTokens.includes(t));
    if (signerMatches.length >= 2) return true;
    if (signerMatches.length >= 1 && (signerTokens.length === 1 || reqTokens.length === 1)) return true;
  }

  // Match against DICT email local-part tokens (e.g. "ace.malto" -> "ace", "malto")
  const emailLocal = (user.email || "").split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, " ");
  const emailTokens = emailLocal.split(/\s+/).filter((t) => t.length > 1);
  const emailMatches = reqTokens.filter((t) => emailTokens.includes(t));
  if (emailMatches.length >= 2) return true;
  if (emailMatches.length >= 1 && emailTokens.length === 1) return true;

  return false;
}

const PO_CONFIG_MAP: Record<ProvincialTab, { prefix: string; supervisor: string; supervisorTitle: string }> = {
  "Albay": { prefix: "GP-POV", supervisor: "RENE JANE R. BUENA", supervisorTitle: "Provincial Officer - Albay" },
  "Camarines Sur": { prefix: "GP-POCAS", supervisor: "ENGR. ANTONIO M. REYES", supervisorTitle: "Provincial Officer - Camarines Sur" },
  "Camarines Norte": { prefix: "GP-POCAN", supervisor: "MARIA ELENA D. SANTOS", supervisorTitle: "Provincial Officer - Camarines Norte" },
  "Catanduanes": { prefix: "GP-POCAT", supervisor: "ENGR. CARLO V. ROMERO", supervisorTitle: "Provincial Officer - Catanduanes" },
  "Masbate": { prefix: "GP-POMAS", supervisor: "RAMON T. FERNANDEZ", supervisorTitle: "Provincial Officer - Masbate" },
  "Sorsogon": { prefix: "GP-POSOR", supervisor: "CYNTHIA P. MORALES", supervisorTitle: "Provincial Officer - Sorsogon" },
  "Regional Off": { prefix: "GP-ROV", supervisor: "RENE JANE R. BUENA", supervisorTitle: "Provincial Officer - Albay / OIC TOD" },
};

// Formats an ISO string "YYYY-MM-DD" into formal English e.g. "October 7, 2026"
function formatIsoToEnglishDate(isoDate: string): string {
  if (!isoDate) return "";
  try {
    const [y, m, d] = isoDate.split("-");
    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    return dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return isoDate;
  }
}

export interface GatePassModuleProps {
  onMergeToCs48?: (pass: GatePassRecord) => void;
  onMergeAllToCs48?: (passes: GatePassRecord[]) => void;
}

export function GatePassModule({ onMergeToCs48, onMergeAllToCs48 }: GatePassModuleProps = {}) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const sheetRef = useRef<HTMLDivElement>(null);

  const [currentUser, setCurrentUser] = useState<UserRecord | null>(() => getCurrentUser());
  const [userCs48Profile, setUserCs48Profile] = useState<DtrGeneratorSignatureRecord | null>(null);
  const [p12SignerIdentity, setP12SignerIdentity] = useState<{ commonName?: string } | null>(null);
  const [signingDateTime] = useState<string>(() => formatPnpkiDate(new Date()));
  const [userSetup, setUserSetup] = useState<DtrUserSetup | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);

  const [data, setData] = useState<GatePassData>(() => {
    try {
      const saved = localStorage.getItem("dict_gatepass_active");
      if (saved) return { ...DEFAULT_GATEPASS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_GATEPASS;
  });

  const [savedGatePasses, setSavedGatePasses] = useState<GatePassRecord[]>(() => {
    const list = getGatePassRegistry();
    if (list.length === 0) {
      const initial = saveGatePassToRegistry(DEFAULT_GATEPASS);
      return [initial];
    }
    return list;
  });

  const [isStorageOpen, setIsStorageOpen] = useState(false);
  const [storageSearch, setStorageSearch] = useState("");

  const [notification, setNotification] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [quickDescription, setQuickDescription] = useState<string>(() => {
    return [data.othersLine1, data.othersLine2, data.othersLine3].filter(Boolean).join(" ");
  });

  // Dynamically parsed inclusive pass dates
  const parsedPassDates = parseInclusivePassDates(data.activityDates, data.activityDateIso);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const refreshStorageList = () => {
    setSavedGatePasses(getGatePassRegistry());
  };

  // Sync state to local storage and update gate pass registry
  useEffect(() => {
    try {
      localStorage.setItem("dict_gatepass_active", JSON.stringify(data));
      saveGatePassToRegistry(data);
      refreshStorageList();
    } catch {}
  }, [data]);

  // Save current gate pass explicitly into storage
  const handleSaveToStorage = () => {
    const record = saveGatePassToRegistry(data);
    refreshStorageList();
    showToast(`✓ Gate Pass ${record.controlNo} saved to Storage queue!`);
  };

  // Create a brand new Gate Pass with the next sequential Control Number
  const handleCreateNewGatePass = () => {
    saveGatePassToRegistry(data);
    const nextControl = incrementGatePassSeq(data.controlNo);
    const todayIso = new Date().toISOString().split("T")[0];
    const todayEnglish = formatIsoToEnglishDate(todayIso);

    const newPass: GatePassData = {
      ...data,
      controlNo: nextControl,
      filingDateIso: todayIso,
      filingDate: todayEnglish,
      activityDateIso: todayIso,
      activityDates: todayEnglish,
      category: "official",
      officialChoice: "others",
      personalChoice: "",
      travelLine1: "",
      travelLine2: "",
      seminarLine1: "",
      seminarLine2: "",
      seminarLine3: "",
      seminarLine4: "",
      othersLine1: "",
      othersLine2: "",
      othersLine3: "",
      personalOthersLine1: "",
      startTime: "8:00 AM - 5:00 PM",
      venue: "",
    };

    setData(newPass);
    saveGatePassToRegistry(newPass, true);
    refreshStorageList();
    setIsStorageOpen(false);
    showToast(`✓ Created new Gate Pass draft: ${nextControl}`);
  };

  // Load a saved Gate Pass from storage into the sheet editor
  const handleLoadFromStorage = (record: GatePassRecord) => {
    if (record.rawFormData) {
      setData(record.rawFormData);
    } else {
      setData((prev) => ({
        ...prev,
        controlNo: record.controlNo,
        filingDate: record.filingDate,
        filingDateIso: record.filingDateIso,
        activityDates: record.activityDates,
        activityDateIso: record.activityDateIso,
        category: record.category,
        selectedPO: record.selectedPO,
        requestedByName: record.requestedByName,
        approvedByName: record.approvedByName,
      }));
    }
    setIsStorageOpen(false);
    showToast(`✓ Loaded Gate Pass ${record.controlNo} into sheet editor!`);
  };

  // Delete a saved Gate Pass from storage
  const handleDeleteFromStorage = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = deleteGatePassFromRegistry(id);
    setSavedGatePasses(updated);
    showToast(`Gate Pass removed from storage.`);
  };

  // Handler for merging single Gate Pass into CS Form 48
  const handleAutoMergeToCs48 = () => {
    const record = saveGatePassToRegistry(data);
    refreshStorageList();
    const dayStr = record.days.length > 1 ? `Days ${record.days.join(", ")}` : `Day ${record.days[0]}`;
    showToast(
      `✓ Merged Control No. ${record.controlNo} into CS Form 48 for ${parsedPassDates.monthName} ${record.year} (${dayStr})!`
    );

    try {
      localStorage.setItem("dict_auto_merge_pending", JSON.stringify(record));
    } catch {}

    if (onMergeToCs48) {
      onMergeToCs48(record);
    } else {
      navigate(`/dtr?tab=generator&merged=gp&control=${encodeURIComponent(record.controlNo)}`);
    }
  };

  // Handler for merging ALL Gate Passes into CS Form 48 simultaneously
  const handleMergeAllToCs48 = () => {
    saveGatePassToRegistry(data);
    const allPasses = getGatePassRegistry();
    if (allPasses.length === 0) {
      showToast("No Gate Passes found in storage to merge.");
      return;
    }

    const allDays = Array.from(new Set(allPasses.flatMap((p) => p.days))).sort((a, b) => a - b);
    showToast(
      `✓ Merging all ${allPasses.length} Gate Passes (Days: ${allDays.join(", ")}) into CS Form 48...`
    );

    try {
      localStorage.setItem("dict_auto_merge_all_pending", JSON.stringify(allPasses));
    } catch {}

    if (onMergeAllToCs48) {
      onMergeAllToCs48(allPasses);
    } else if (onMergeToCs48 && allPasses.length === 1) {
      onMergeToCs48(allPasses[0]);
    } else {
      navigate(`/dtr?tab=generator&mergeAll=true`);
    }
    setIsStorageOpen(false);
  };

  // Load active user profile, digital signature image, and saved user setups from CS Form 48 (Turso DB) on mount
  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    if (!user) {
      setIsLoadingProfile(false);
      return;
    }

    setIsLoadingProfile(true);

    // 1. Check user setups for employee name, designation, province
    const setupPromise = dtrUserSetupApi.getSetup(String(user.id))
      .then((setup) => {
        if (setup) {
          setUserSetup(setup);
          const officialName = setup.employeeName || setup.employee_name;
          if (officialName) {
            setData((prev) => ({
              ...prev,
              requestedByName: officialName.toUpperCase(),
              requestedBySigner: officialName,
            }));
          }
        }
      })
      .catch((err) => console.warn("Failed to load user setup:", err));

    // 2. Query CS Form 48 saved signature & .p12 keystore in Turso DB
    const profilePromise = dtrGeneratorApi.getRecords({ user_Id: String(user.id) })
      .then(async (records) => {
        const match = records.find(
          (r) => r.hasP12 || r.p12 || r.image_digiSigned || r.hasImageDigiSigned
        );
        if (match) {
          let fullRecord = match;
          if (!fullRecord.image_digiSigned && (fullRecord.hasImageDigiSigned || fullRecord.hasP12)) {
            const single = await dtrGeneratorApi.getRecord(match.id);
            if (single) fullRecord = single;
          }
          setUserCs48Profile(fullRecord);

          // Retrieve verified cryptographic PNPKI signer identity from p12
          try {
            const idRes = await dtrGeneratorApi.getP12Identity({
              profileId: match.id,
              user_Id: match.user_Id || String(user.id),
            });
            if (idRes.success && idRes.identity) {
              setP12SignerIdentity(idRes.identity);
            }
          } catch (e) {
            console.warn("Could not inspect p12 identity:", e);
          }
        }
      })
      .catch((err) => console.warn("Failed to load CS Form 48 signature profile:", err));

    Promise.allSettled([setupPromise, profilePromise]).finally(() => {
      setIsLoadingProfile(false);
    });
  }, []);

  // Strict Security Rule Check: user == userLogin
  const isCurrentUser = isUserMatch(
    currentUser,
    data.requestedByName,
    userSetup?.employeeName || userSetup?.employee_name,
    userCs48Profile?.Name
  );

  const hasUserP12 = Boolean(
    userCs48Profile?.hasP12 ||
    userCs48Profile?.p12 ||
    userCs48Profile?.p12_filename
  );

  const resolvedP12SignerName =
    p12SignerIdentity?.commonName ||
    userCs48Profile?.Name ||
    userSetup?.employeeName ||
    userSetup?.employee_name ||
    currentUser?.name ||
    data.requestedByName ||
    "PERSONNEL";

  // If user == userLogin: automatically use CS Form 48 signature image!
  // If user != userLogin: strictly null (signature left blank for physical/wet signing)
  const effectiveSignatureImage = isCurrentUser
    ? userCs48Profile?.image_digiSigned || null
    : null;

  // Handle PO selection change
  const handlePoChange = (po: ProvincialTab) => {
    const config = PO_CONFIG_MAP[po] || PO_CONFIG_MAP["Albay"];
    const currentSeq = data.controlNo.split(" ").slice(1).join(" ") || "2026-10-0015";
    setData((prev) => ({
      ...prev,
      selectedPO: po,
      controlNo: `${config.prefix} ${currentSeq}`,
      approvedByName: config.supervisor,
      approvedByTitle: config.supervisorTitle,
      approvedBySigner: config.supervisor.includes("Rene Jane") ? "Buena Rene Jane Rosendo" : config.supervisor,
    }));
    showToast(`Provincial Office set to ${po}. Control No & Supervisor updated.`);
  };

  // Direct navigation to PO Module
  const handleDirectToPoModule = () => {
    navigate(`/dtr?tab=provincial&province=${encodeURIComponent(data.selectedPO)}`);
  };

  // Date 1 (Filing Date) change handler
  const handleFilingDateChange = (isoDate: string) => {
    if (!isoDate) return;
    const formatted = formatIsoToEnglishDate(isoDate);
    setData((prev) => ({
      ...prev,
      filingDateIso: isoDate,
      filingDate: formatted,
    }));
  };

  // Date 2 (Activity Date/s) change handler
  const handleActivityDateChange = (isoDate: string) => {
    if (!isoDate) return;
    const formatted = formatIsoToEnglishDate(isoDate);
    setData((prev) => ({
      ...prev,
      activityDateIso: isoDate,
      activityDates: formatted,
    }));
  };

  // Quick Description text distributor into underline lines of currently selected checkbox
  const handleQuickDescriptionChange = (text: string) => {
    setQuickDescription(text);
    const words = text.split(" ").filter(Boolean);
    const lines: string[] = ["", "", "", ""];
    let lineIdx = 0;
    const maxCharsPerLine = 48;

    for (const w of words) {
      if ((lines[lineIdx] + " " + w).trim().length <= maxCharsPerLine) {
        lines[lineIdx] = (lines[lineIdx] + " " + w).trim();
      } else {
        if (lineIdx < lines.length - 1) {
          lineIdx++;
          lines[lineIdx] = w;
        } else {
          lines[lineIdx] = (lines[lineIdx] + " " + w).trim();
        }
      }
    }

    setData((prev) => {
      if (prev.category === "official") {
        if (prev.officialChoice === "others") {
          return { ...prev, othersLine1: lines[0], othersLine2: lines[1], othersLine3: lines[2] };
        }
        if (prev.officialChoice === "seminar") {
          return { ...prev, seminarLine1: lines[0], seminarLine2: lines[1], seminarLine3: lines[2], seminarLine4: lines[3] };
        }
        if (prev.officialChoice === "travel") {
          return { ...prev, travelLine1: lines[0], travelLine2: lines[1] };
        }
      } else if (prev.category === "personal") {
        return { ...prev, personalOthersLine1: text };
      }
      return prev;
    });
  };

  // Reset to authentic official DICT template default
  const handleReset = () => {
    const resetName = userSetup?.employeeName || userSetup?.employee_name || currentUser?.name || DEFAULT_GATEPASS.requestedByName;
    setData({
      ...DEFAULT_GATEPASS,
      requestedByName: resetName.toUpperCase(),
      requestedBySigner: resetName,
    });
    setQuickDescription("Free-Wifi Connectivity Hardware and Network Management Training at Legazpi City");
    showToast("Gate Pass template reset to authentic DICT default.");
  };

  // Print gate pass
  const handlePrint = () => {
    window.print();
  };

  // Export as high-resolution PDF
  const handleExportPdf = async () => {
    if (!sheetRef.current) return;
    setIsExportingPdf(true);
    try {
      const canvas = await html2canvas(sheetRef.current, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: "#FFFFFF",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const maxImgW = pdfWidth - margin * 2;
      const imgProps = pdf.getImageProperties(imgData);
      const imgH = (imgProps.height * maxImgW) / imgProps.width;

      pdf.addImage(imgData, "PNG", margin, margin, maxImgW, Math.min(imgH, pdfHeight - margin * 2));
      const cleanControl = data.controlNo.replace(/\s+/g, "_");
      pdf.save(`DICT_Gate_Pass_${cleanControl}.pdf`);
      showToast("Gate Pass exported as high-resolution official A4 PDF!");
    } catch (err: any) {
      console.error("Failed to export PDF:", err);
      showToast("Failed to generate PDF. You can also use Print Sheet -> Save as PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#070A11] text-slate-100">
      
      {/* Specific Print Media Styles for Gate Pass (Official A4 Portrait) */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          body {
            background-color: #FFFFFF !important;
          }
          #gate-pass-print-area {
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* ========================================================================= */}
      {/* TOP ACTION BAR (Hidden when printing)                                     */}
      {/* ========================================================================= */}
      <div className="bg-[#0C101A] border-b border-[#1A2235] px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-md print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-500/20 text-white">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">
                DICT Official Gate Pass Module
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                Civil Service Standard
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive Underline Blanks • Dynamic Purpose Checkboxes • 2-Date Inputs • PNPKI .p12 Stamp • PO Integration
            </p>
          </div>
        </div>

        {/* Storage, Creation, Auto-Merge & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Gate Pass Storage Queue Button */}
          <button
            type="button"
            onClick={() => {
              refreshStorageList();
              setIsStorageOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#141C2E] text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/20 hover:border-indigo-400 transition-all shadow-sm cursor-pointer group"
            title="Open Gate Pass Storage Queue to manage and switch between saved passes"
          >
            <FolderArchive className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span>Gate Pass Storage</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
              {savedGatePasses.length}
            </span>
          </button>

          {/* New Gate Pass Draft Button */}
          <button
            type="button"
            onClick={handleCreateNewGatePass}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 transition-all shadow-sm cursor-pointer group"
            title="Create next sequential Gate Pass with auto-incremented Control No."
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400 group-hover:rotate-90 transition-transform" />
            <span>New Pass</span>
          </button>

          {/* Save to Storage Button */}
          <button
            type="button"
            onClick={handleSaveToStorage}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold bg-[#111827] text-slate-300 border border-slate-700 hover:bg-slate-800 hover:text-white transition-all cursor-pointer shadow-sm"
            title="Save current Gate Pass into Storage Queue"
          >
            <Save className="w-3.5 h-3.5 text-slate-400" />
            <span>Save</span>
          </button>

          {/* Merge All to CS Form 48 Button */}
          <button
            type="button"
            onClick={handleMergeAllToCs48}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 text-white hover:from-indigo-500 hover:to-cyan-500 transition-all shadow-md shadow-blue-900/40 cursor-pointer group"
            title={`Merge all ${savedGatePasses.length} Gate Pass(es) in storage simultaneously into CS Form 48`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300 group-hover:scale-110 transition-transform" />
            <span>Merge All to CS Form 48 ({savedGatePasses.length})</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-200 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Auto-Merge Current to CS Form 48 Button */}
          <button
            type="button"
            onClick={handleAutoMergeToCs48}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600/25 text-blue-300 border border-blue-500/40 hover:bg-blue-600/40 transition-all shadow-sm cursor-pointer group"
            title={`Auto-merge current Control No. ${data.controlNo} into CS Form 48`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400 group-hover:rotate-12 transition-transform" />
            <span>Auto-Merge Current</span>
          </button>

          {/* Direct to PO Module Button */}
          <button
            type="button"
            onClick={handleDirectToPoModule}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 transition-all shadow-sm cursor-pointer group"
            title="Jump directly to Provincial Offices DTR Module"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span>PO ({data.selectedPO})</span>
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all cursor-pointer shadow-sm"
            title="Trigger browser print dialog with official A4 dimensions"
          >
            <Printer className="w-3.5 h-3.5 text-slate-300" />
            <span>Print</span>
          </button>

          {/* Export PDF Button */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-md shadow-blue-900/30 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingPdf ? "Generating..." : "Export PDF"}</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xl border border-blue-400/40 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-white" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN: INTERACTIVE CONTROLS & CONFIGURATION DRAWER (Hidden on Print)*/}
        {/* ========================================================================= */}
        <div className="w-full lg:w-[410px] xl:w-[430px] bg-[#0C101A] border-r border-[#1A2235] p-5 space-y-6 shrink-0 print:hidden overflow-y-auto custom-scrollbar">
          
          {/* Section 1: PO (Provincial Office) Selector */}
          <div className="space-y-2.5 p-4 rounded-2xl bg-[#111728] border border-[#1E293B] shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-amber-400" />
                PO Module Selector (Provincial Offices)
              </label>
              <button
                type="button"
                onClick={handleDirectToPoModule}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Go to PO</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Select the Provincial Office to update the assigned Control No. prefix and supervisor credentials:
            </p>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {PROVINCIAL_TABS.map((po) => {
                const isSelected = data.selectedPO === po;
                return (
                  <button
                    key={po}
                    type="button"
                    onClick={() => handlePoChange(po)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-all border cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm shadow-amber-950/40"
                        : "bg-[#0A0E18] text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <span className="truncate">{po}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: 2-Date Inputs & Identifiers */}
          <div className="space-y-4 p-4 rounded-2xl bg-[#111728] border border-[#1E293B]">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              Gate Pass 2-Date Inputs & Identifiers
            </h3>

            {/* Date Input 1: Filing Date */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  1. Filing Date (<code className="text-blue-300 font-mono">Date:</code>)
                </label>
                <span className="text-[10px] text-slate-500 font-mono">Top-left header</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={data.filingDateIso}
                  onChange={(e) => handleFilingDateChange(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0A0E18] border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  value={data.filingDate}
                  onChange={(e) => setData((prev) => ({ ...prev, filingDate: e.target.value }))}
                  placeholder="e.g. October 7, 2026"
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0A0E18] border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Date Input 2: Activity Inclusive Date/s */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  2. Inclusive Pass Date/s (<code className="text-emerald-300 font-mono">Date/s:</code>)
                </label>
                <span className="text-[10px] text-slate-500 font-mono">Activity Section</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={data.activityDateIso}
                  onChange={(e) => handleActivityDateChange(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0A0E18] border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="text"
                  value={data.activityDates}
                  onChange={(e) => setData((prev) => ({ ...prev, activityDates: e.target.value }))}
                  placeholder="e.g. October 8, 2026 or Sept 16,17,21, 2026"
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0A0E18] border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Control Number Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Control No. (Underline Blank)
              </label>
              <input
                type="text"
                value={data.controlNo}
                onChange={(e) => setData((prev) => ({ ...prev, controlNo: e.target.value }))}
                placeholder="e.g. GP-POV 2026-10-0015"
                className="w-full px-3 py-2 rounded-xl bg-[#0A0E18] border border-slate-800 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Section 2.5: CS Form 48 Automatic Merge Integration */}
          <div className="space-y-3 p-4 rounded-2xl bg-gradient-to-br from-[#0F1829] to-[#131F38] border border-blue-500/30 shadow-lg shadow-blue-950/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                CS Form 48 Automatic Merge
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                Auto-Sync Active
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#090D18] border border-blue-900/40 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Target DTR:</span>
                <span className="font-semibold text-slate-200">
                  {parsedPassDates.monthName} {parsedPassDates.year}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Inclusive Pass Day(s):</span>
                <span className="font-mono font-bold text-emerald-400">
                  {parsedPassDates.days.length > 1
                    ? `Days ${parsedPassDates.days.join(", ")}`
                    : `Day ${parsedPassDates.days[0]}`}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Control No. to Stamp:</span>
                <span className="font-mono font-bold text-blue-300 truncate max-w-[180px]">
                  {data.controlNo || "GP-POV 2026-10-0015"}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-800">
                In CS Form 48, the row for {parsedPassDates.days.length > 1 ? `Days ${parsedPassDates.days.join(", ")}` : `Day ${parsedPassDates.days[0]}`} is automatically merged across AM/PM columns and stamped with this Control No.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              {/* Merge All Gate Passes button */}
              <button
                type="button"
                onClick={handleMergeAllToCs48}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-900/40 transition-all cursor-pointer group"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300 group-hover:scale-110 transition-transform" />
                <span>Merge All to CS Form 48 ({savedGatePasses.length})</span>
                <ArrowRight className="w-3.5 h-3.5 text-blue-200 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleAutoMergeToCs48}
                  className="py-2 px-2.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/40 border border-blue-500/40 text-blue-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Merge current Gate Pass into CS Form 48"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Merge Current</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    refreshStorageList();
                    setIsStorageOpen(true);
                  }}
                  className="py-2 px-2.5 rounded-xl bg-[#141C2E] hover:bg-[#1E293B] border border-indigo-500/40 text-indigo-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="View and manage all stored Gate Passes"
                >
                  <FolderArchive className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Storage ({savedGatePasses.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Dynamic Purpose Checkboxes & Quick Description */}
          <div className="space-y-4 p-4 rounded-2xl bg-[#111728] border border-[#1E293B]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400" />
                Dynamic Purpose & Event Title
              </h3>
            </div>
            <p className="text-[11px] text-slate-400">
              Selecting a purpose checkbox reveals and populates the official underline blanks on the form:
            </p>

            {/* Category Toggle: Official vs Personal */}
            <div className="flex rounded-xl bg-[#0A0E18] p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setData((prev) => ({ ...prev, category: "official" }))}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  data.category === "official"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Official Purpose
              </button>
              <button
                type="button"
                onClick={() => setData((prev) => ({ ...prev, category: "personal" }))}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  data.category === "personal"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Personal Purpose
              </button>
            </div>

            {/* Official Choices */}
            {data.category === "official" && (
              <div className="space-y-2 pt-1 animate-in fade-in">
                <label className="flex items-center gap-2.5 p-2 rounded-xl bg-[#0A0E18] border border-slate-800 hover:border-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="officialChoice"
                    checked={data.officialChoice === "others"}
                    onChange={() => setData((prev) => ({ ...prev, officialChoice: "others" }))}
                    className="text-blue-500 rounded focus:ring-0"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-white">Others</span>
                    <span className="text-[10px] text-slate-400 block">3 Underline Blank Lines (e.g. Free-Wifi Connectivity Training)</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-xl bg-[#0A0E18] border border-slate-800 hover:border-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="officialChoice"
                    checked={data.officialChoice === "travel"}
                    onChange={() => setData((prev) => ({ ...prev, officialChoice: "travel" }))}
                    className="text-blue-500 rounded focus:ring-0"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-white">Travel (Please Specify)</span>
                    <span className="text-[10px] text-slate-400 block">2 Underline Blank Lines</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-xl bg-[#0A0E18] border border-slate-800 hover:border-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="officialChoice"
                    checked={data.officialChoice === "seminar"}
                    onChange={() => setData((prev) => ({ ...prev, officialChoice: "seminar" }))}
                    className="text-blue-500 rounded focus:ring-0"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-white">Seminar / Training / Conference / Meeting</span>
                    <span className="text-[10px] text-slate-400 block">4 Underline Blank Lines</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-xl bg-[#0A0E18] border border-slate-800 hover:border-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="officialChoice"
                    checked={data.officialChoice === "pickup"}
                    onChange={() => setData((prev) => ({ ...prev, officialChoice: "pickup" }))}
                    className="text-blue-500 rounded focus:ring-0"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-white">Pick - up documents</span>
                  </div>
                </label>
              </div>
            )}

            {/* Personal Choices */}
            {data.category === "personal" && (
              <div className="space-y-2 pt-1 animate-in fade-in">
                <label className="flex items-center gap-2.5 p-2 rounded-xl bg-[#0A0E18] border border-slate-800 hover:border-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="personalChoice"
                    checked={data.personalChoice === "medication"}
                    onChange={() => setData((prev) => ({ ...prev, personalChoice: "medication" }))}
                    className="text-purple-500 rounded focus:ring-0"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-white">Medication / Physical Check-up</span>
                    <span className="text-[10px] text-slate-400 block">(subject to presentation of Doctor's certificate)</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-xl bg-[#0A0E18] border border-slate-800 hover:border-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="personalChoice"
                    checked={data.personalChoice === "family"}
                    onChange={() => setData((prev) => ({ ...prev, personalChoice: "family" }))}
                    className="text-purple-500 rounded focus:ring-0"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-white">Medical Attention to Family Member / Relative</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-xl bg-[#0A0E18] border border-slate-800 hover:border-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="personalChoice"
                    checked={data.personalChoice === "others"}
                    onChange={() => setData((prev) => ({ ...prev, personalChoice: "others" }))}
                    className="text-purple-500 rounded focus:ring-0"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-white">Others (Personal)</span>
                    <span className="text-[10px] text-slate-400 block">1 Underline Blank Line</span>
                  </div>
                </label>
              </div>
            )}

            {/* Quick Description Input */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Quick-Fill Description / Event Title:</span>
                <span className="text-[10px] text-blue-400 font-mono">Auto-distributes</span>
              </label>
              <textarea
                rows={3}
                value={quickDescription}
                onChange={(e) => handleQuickDescriptionChange(e.target.value)}
                placeholder="Type the title or description here to auto-fill the underline blanks..."
                className="w-full px-3 py-2 rounded-xl bg-[#0A0E18] border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 custom-scrollbar leading-relaxed"
              />
            </div>
          </div>

          {/* Section 4: Activity Schedule & Venue */}
          <div className="space-y-3.5 p-4 rounded-2xl bg-[#111728] border border-[#1E293B]">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Activity Schedule & Venue Details
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Start Time (<code className="text-amber-300 font-mono">Start Time:</code>)
              </label>
              <input
                type="text"
                value={data.startTime}
                onChange={(e) => setData((prev) => ({ ...prev, startTime: e.target.value }))}
                placeholder="e.g. 7:00 AM - 6:00PM"
                className="w-full px-3 py-2 rounded-xl bg-[#0A0E18] border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Venue (<code className="text-amber-300 font-mono">Venue:</code>)
              </label>
              <input
                type="text"
                value={data.venue}
                onChange={(e) => setData((prev) => ({ ...prev, venue: e.target.value }))}
                placeholder="e.g. Legazpi Convention Center, Legazpi City"
                className="w-full px-3 py-2 rounded-xl bg-[#0A0E18] border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>



          {/* Reset Action */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleReset}
              className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Authentic DICT Template</span>
            </button>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: HIGH-FIDELITY OFFICIAL DICT GATE PASS TEMPLATE SHEET        */}
        {/* ========================================================================= */}
        <div className="flex-1 bg-[#090D18] p-4 lg:p-8 overflow-y-auto custom-scrollbar flex flex-col items-center justify-start print:p-0 print:m-0 print:bg-white print:overflow-visible print:block">
          
          {/* Canvas Mode Info Banner (Hidden when printing) */}
          <div className="w-full max-w-[760px] sm:max-w-[794px] mb-3 flex items-center justify-between text-xs text-slate-400 print:hidden">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>Interactive Underline Blank Canvas — Type directly on the blanks below:</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
              <span>Standard A4 / 210mm × 297mm</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* THE OFFICIAL DICT GATE PASS SHEET (Exact replication of user reference)  */}
          {/* ========================================================================= */}
          <div
            ref={sheetRef}
            id="gate-pass-print-area"
            className="w-full max-w-[760px] sm:max-w-[794px] bg-white text-black p-8 sm:p-12 shadow-2xl rounded-sm font-sans select-text border border-slate-300 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full"
            style={{ minHeight: "1050px", color: "#000000" }}
          >
            {/* 1. OFFICIAL DICT HEADER */}
            <div className="flex items-center justify-center gap-4 pb-2">
              {/* DICT Official Circular Logo */}
              <img
                src="/dict-logo.png"
                alt="DICT Official Logo"
                className="h-16 w-16 object-contain shrink-0"
              />

              {/* Header Typography with Authentic DICT Blue Line Divider */}
              <div className="flex flex-col text-left">
                {/* Line 1: Republic of the Philippines */}
                <span
                  className="text-[11px] sm:text-[12px] tracking-[0.25em] font-serif uppercase font-semibold text-[#0038A8] leading-tight"
                  style={{ color: "#0038A8", fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  REPUBLIC OF THE PHILIPPINES
                </span>

                {/* Authentic Blue Divider Rule directly under Republic of the Philippines */}
                <div
                  className="w-full border-b-[1.8px] border-[#0038A8] my-0.5"
                  style={{ borderColor: "#0038A8" }}
                />

                {/* Line 2: Department of Information and */}
                <span
                  className="text-[14px] sm:text-[15.5px] font-sans font-black tracking-wider text-[#0038A8] uppercase leading-tight"
                  style={{ color: "#0038A8" }}
                >
                  DEPARTMENT OF INFORMATION AND
                </span>

                {/* Line 3: Communications Technology */}
                <span
                  className="text-[14px] sm:text-[15.5px] font-sans font-black tracking-wider text-[#0038A8] uppercase leading-tight"
                  style={{ color: "#0038A8" }}
                >
                  COMMUNICATIONS TECHNOLOGY
                </span>
              </div>
            </div>

            {/* 2. TOP ROW: DATE & CONTROL NO. WITH INTERACTIVE UNDERLINE BLANKS */}
            <div className="flex items-end justify-between text-[13px] pt-4 pb-2 font-sans">
              
              {/* Date with Interactive Underline Input */}
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-black">Date:</span>
                <div className="relative inline-flex items-baseline">
                  <input
                    type="text"
                    value={data.filingDate}
                    onChange={(e) => setData((prev) => ({ ...prev, filingDate: e.target.value }))}
                    placeholder="Enter date..."
                    className="border-b border-black w-44 sm:w-52 text-center font-bold px-1 pb-0.5 bg-transparent outline-none text-[13px] focus:bg-blue-50/40 transition-colors"
                  />
                  {/* Quick Calendar Picker Trigger (Hidden on Print) */}
                  <label className="absolute right-0 top-0 cursor-pointer text-slate-400 hover:text-blue-600 print:hidden p-0.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <input
                      type="date"
                      value={data.filingDateIso}
                      onChange={(e) => handleFilingDateChange(e.target.value)}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              {/* Control No. with Interactive Underline Input */}
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-black">Control No.:</span>
                <input
                  type="text"
                  value={data.controlNo}
                  onChange={(e) => setData((prev) => ({ ...prev, controlNo: e.target.value }))}
                  placeholder="e.g. GP-POV 2026-10-0015"
                  className="border-b border-black w-48 sm:w-56 text-center font-black tracking-wide px-1 pb-0.5 bg-transparent outline-none text-[13px] focus:bg-blue-50/40 transition-colors"
                />
              </div>

            </div>

            {/* 3. SOLID BLACK OUTLINED TITLE BANNER: GATE PASS */}
            <div className="my-3 border-[2.5px] border-black py-1 px-4 text-center">
              <h2 className="text-base sm:text-lg font-black tracking-[0.2em] uppercase font-sans">
                GATE PASS
              </h2>
            </div>

            {/* 4. OFFICIAL SECTION */}
            <div className="pt-1">
              <h3 className="text-[13px] font-bold text-black uppercase tracking-wider mb-2">
                Official:
              </h3>

              <div className="space-y-3.5 pl-6">
                
                {/* Official Checkbox 1: Travel (Please Specify) */}
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setData((prev) => ({ ...prev, category: "official", officialChoice: "travel" }))}
                      className="w-5 h-5 border-[1.5px] border-black flex items-center justify-center font-bold text-sm bg-white shrink-0 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                      title="Click to check Travel"
                    >
                      {data.category === "official" && data.officialChoice === "travel" ? "✓" : ""}
                    </button>
                    <span
                      onClick={() => setData((prev) => ({ ...prev, category: "official", officialChoice: "travel" }))}
                      className="text-[13px] font-medium text-black cursor-pointer select-none"
                    >
                      Travel (Please Specify):
                    </span>
                    {/* Line 1 Interactive Underline Input */}
                    <input
                      type="text"
                      value={data.travelLine1}
                      onChange={(e) => setData((prev) => ({ ...prev, travelLine1: e.target.value, category: "official", officialChoice: "travel" }))}
                      className="flex-1 border-b border-black min-h-[20px] text-[12px] font-bold px-2 bg-transparent outline-none focus:bg-blue-50/40 transition-colors"
                    />
                  </div>
                  {/* Line 2 Interactive Underline Input */}
                  <div className="ml-8">
                    <input
                      type="text"
                      value={data.travelLine2}
                      onChange={(e) => setData((prev) => ({ ...prev, travelLine2: e.target.value, category: "official", officialChoice: "travel" }))}
                      className="w-full border-b border-black min-h-[20px] text-[12px] font-bold px-2 bg-transparent outline-none focus:bg-blue-50/40 transition-colors"
                    />
                  </div>
                </div>

                {/* Official Checkbox 2: Seminar / Training / Conference / Meeting */}
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setData((prev) => ({ ...prev, category: "official", officialChoice: "seminar" }))}
                      className="w-5 h-5 border-[1.5px] border-black flex items-center justify-center font-bold text-sm bg-white shrink-0 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                      title="Click to check Seminar / Training"
                    >
                      {data.category === "official" && data.officialChoice === "seminar" ? "✓" : ""}
                    </button>
                    <span
                      onClick={() => setData((prev) => ({ ...prev, category: "official", officialChoice: "seminar" }))}
                      className="text-[13px] font-medium text-black cursor-pointer select-none"
                    >
                      Seminar / Training / Conference / Meeting:
                    </span>
                    {/* Line 1 Interactive Underline Input */}
                    <input
                      type="text"
                      value={data.seminarLine1}
                      onChange={(e) => setData((prev) => ({ ...prev, seminarLine1: e.target.value, category: "official", officialChoice: "seminar" }))}
                      className="flex-1 border-b border-black min-h-[20px] text-[12px] font-bold px-2 bg-transparent outline-none focus:bg-blue-50/40 transition-colors"
                    />
                  </div>
                  {/* Line 2 Interactive Underline Input */}
                  <div className="ml-8">
                    <input
                      type="text"
                      value={data.seminarLine2}
                      onChange={(e) => setData((prev) => ({ ...prev, seminarLine2: e.target.value, category: "official", officialChoice: "seminar" }))}
                      className="w-full border-b border-black min-h-[20px] text-[12px] font-bold px-2 bg-transparent outline-none focus:bg-blue-50/40 transition-colors"
                    />
                  </div>
                  {/* Line 3 Interactive Underline Input */}
                  <div className="ml-8">
                    <input
                      type="text"
                      value={data.seminarLine3}
                      onChange={(e) => setData((prev) => ({ ...prev, seminarLine3: e.target.value, category: "official", officialChoice: "seminar" }))}
                      className="w-full border-b border-black min-h-[20px] text-[12px] font-bold px-2 bg-transparent outline-none focus:bg-blue-50/40 transition-colors"
                    />
                  </div>
                  {/* Line 4 Interactive Underline Input */}
                  <div className="ml-8">
                    <input
                      type="text"
                      value={data.seminarLine4}
                      onChange={(e) => setData((prev) => ({ ...prev, seminarLine4: e.target.value, category: "official", officialChoice: "seminar" }))}
                      className="w-full border-b border-black min-h-[20px] text-[12px] font-bold px-2 bg-transparent outline-none focus:bg-blue-50/40 transition-colors"
                    />
                  </div>
                </div>

                {/* Official Checkbox 3: Pick - up documents */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setData((prev) => ({ ...prev, category: "official", officialChoice: "pickup" }))}
                    className="w-5 h-5 border-[1.5px] border-black flex items-center justify-center font-bold text-sm bg-white shrink-0 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                    title="Click to check Pick-up documents"
                  >
                    {data.category === "official" && data.officialChoice === "pickup" ? "✓" : ""}
                  </button>
                  <span
                    onClick={() => setData((prev) => ({ ...prev, category: "official", officialChoice: "pickup" }))}
                    className="text-[13px] font-medium text-black cursor-pointer select-none"
                  >
                    Pick - up documents:
                  </span>
                </div>

                {/* Official Checkbox 4: Others (Matches reference image with 3 underline lines) */}
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setData((prev) => ({ ...prev, category: "official", officialChoice: "others" }))}
                      className="w-5 h-5 border-[1.5px] border-black flex items-center justify-center font-bold text-sm bg-white shrink-0 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                      title="Click to check Others"
                    >
                      {data.category === "official" && data.officialChoice === "others" ? "✓" : ""}
                    </button>
                    <span
                      onClick={() => setData((prev) => ({ ...prev, category: "official", officialChoice: "others" }))}
                      className="text-[13px] font-medium text-black cursor-pointer select-none"
                    >
                      Others:
                    </span>
                    {/* Line 1 with Event Title (Interactive Underline Input) */}
                    <input
                      type="text"
                      value={data.othersLine1}
                      onChange={(e) => setData((prev) => ({ ...prev, othersLine1: e.target.value, category: "official", officialChoice: "others" }))}
                      placeholder="e.g. Free-Wifi Connectivity Hardware and Network"
                      className="flex-1 border-b border-black min-h-[20px] text-[12px] font-bold text-black px-2 bg-transparent outline-none focus:bg-blue-50/40 transition-colors"
                    />
                  </div>
                  {/* Line 2 with Event Title (Interactive Underline Input) */}
                  <div className="ml-8">
                    <input
                      type="text"
                      value={data.othersLine2}
                      onChange={(e) => setData((prev) => ({ ...prev, othersLine2: e.target.value, category: "official", officialChoice: "others" }))}
                      placeholder="e.g. Management Training at Legazpi City"
                      className="w-full border-b border-black min-h-[20px] text-[12px] font-bold text-black px-2 bg-transparent outline-none focus:bg-blue-50/40 transition-colors"
                    />
                  </div>
                  {/* Line 3 Underline Blank Line (Matches original template) */}
                  <div className="ml-8">
                    <input
                      type="text"
                      value={data.othersLine3}
                      onChange={(e) => setData((prev) => ({ ...prev, othersLine3: e.target.value, category: "official", officialChoice: "others" }))}
                      className="w-full border-b border-black min-h-[20px] text-[12px] font-bold text-black px-2 bg-transparent outline-none focus:bg-blue-50/40 transition-colors"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* 5. PERSONAL SECTION */}
            <div className="pt-5">
              <h3 className="text-[13px] font-bold text-black uppercase tracking-wider mb-2">
                Personal:
              </h3>

              <div className="space-y-3.5 pl-6">
                
                {/* Personal Checkbox 1: Medication / Physical Check-up */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setData((prev) => ({ ...prev, category: "personal", personalChoice: "medication" }))}
                    className="w-5 h-5 border-[1.5px] border-black flex items-center justify-center font-bold text-sm bg-white shrink-0 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  >
                    {data.category === "personal" && data.personalChoice === "medication" ? "✓" : ""}
                  </button>
                  <span
                    onClick={() => setData((prev) => ({ ...prev, category: "personal", personalChoice: "medication" }))}
                    className="text-[12.5px] font-medium text-black cursor-pointer select-none"
                  >
                    Medication / Physical Check-up (subject to presentation of Doctor's certificate)
                  </span>
                </div>

                {/* Personal Checkbox 2: Medical Attention to Family Member / Relative */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setData((prev) => ({ ...prev, category: "personal", personalChoice: "family" }))}
                    className="w-5 h-5 border-[1.5px] border-black flex items-center justify-center font-bold text-sm bg-white shrink-0 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  >
                    {data.category === "personal" && data.personalChoice === "family" ? "✓" : ""}
                  </button>
                  <span
                    onClick={() => setData((prev) => ({ ...prev, category: "personal", personalChoice: "family" }))}
                    className="text-[12.5px] font-medium text-black cursor-pointer select-none"
                  >
                    Medical Attention to Family Member / Relative
                  </span>
                </div>

                {/* Personal Option 3: Others */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setData((prev) => ({ ...prev, category: "personal", personalChoice: "others" }))}
                    className="w-5 h-5 border-[1.5px] border-black flex items-center justify-center font-bold text-sm bg-white shrink-0 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  >
                    {data.category === "personal" && data.personalChoice === "others" ? "✓" : ""}
                  </button>
                  <span
                    onClick={() => setData((prev) => ({ ...prev, category: "personal", personalChoice: "others" }))}
                    className="text-[13px] font-medium text-black cursor-pointer select-none shrink-0"
                  >
                    Others:
                  </span>
                  <input
                    type="text"
                    value={data.personalOthersLine1}
                    onChange={(e) => setData((prev) => ({ ...prev, personalOthersLine1: e.target.value, category: "personal", personalChoice: "others" }))}
                    placeholder="Specify personal purpose..."
                    className="flex-1 border-b border-black min-h-[20px] text-[12px] font-bold px-2 bg-transparent outline-none focus:bg-purple-50/40 transition-colors"
                  />
                </div>

              </div>
            </div>

            {/* 6. ACTIVITY DETAILS: 2ND DATE INPUT, START TIME, VENUE */}
            <div className="pt-6 space-y-3 font-sans text-[13px]">
              
              {/* Date Input 2: Date/s with Interactive Underline Input */}
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-black w-24">Date/s:</span>
                <div className="relative inline-flex items-baseline flex-1 sm:max-w-xs">
                  <input
                    type="text"
                    value={data.activityDates}
                    onChange={(e) => setData((prev) => ({ ...prev, activityDates: e.target.value }))}
                    placeholder="e.g. October 8, 2026 or Sept 16,17,21, 2026"
                    className="border-b border-black w-full font-bold px-1 pb-0.5 bg-transparent outline-none text-[13px] focus:bg-blue-50/40 transition-colors"
                  />
                  {/* Quick Calendar Picker Trigger (Hidden on Print) */}
                  <label className="absolute right-0 top-0 cursor-pointer text-slate-400 hover:text-emerald-600 print:hidden p-0.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <input
                      type="date"
                      value={data.activityDateIso}
                      onChange={(e) => handleActivityDateChange(e.target.value)}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              {/* Start Time with Interactive Underline Input */}
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-black w-24">Start Time:</span>
                <input
                  type="text"
                  value={data.startTime}
                  onChange={(e) => setData((prev) => ({ ...prev, startTime: e.target.value }))}
                  placeholder="e.g. 7:00 AM - 6:00PM"
                  className="border-b border-black flex-1 sm:max-w-xs font-bold px-1 pb-0.5 bg-transparent outline-none text-[13px] focus:bg-blue-50/40 transition-colors"
                />
              </div>

              {/* Venue with Interactive Underline Input */}
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-black w-24">Venue:</span>
                <input
                  type="text"
                  value={data.venue}
                  onChange={(e) => setData((prev) => ({ ...prev, venue: e.target.value }))}
                  placeholder="e.g. Legazpi Convention Center, Legazpi City"
                  className="border-b border-black flex-1 font-bold px-1 pb-0.5 bg-transparent outline-none text-[13px] focus:bg-blue-50/40 transition-colors"
                />
              </div>

            </div>

            {/* 7. SIGNATURE BLOCK (Clean Official Request Template - No DigiSigned) */}
            <div className="pt-12 grid grid-cols-2 gap-8 text-center font-sans">
              
              {/* Left Column: REQUESTED BY (Personnel) */}
              <div className="flex flex-col items-center">
                <span className="text-[11px] font-bold text-black tracking-wider uppercase mb-1">
                  REQUESTED BY:
                </span>

                {/* CS Form 48 Style PNPKI .p12 Digital Signature Stamp */}
                <div className="h-16 flex items-center justify-center relative w-full px-2 mb-1">
                  {isCurrentUser && hasUserP12 ? (
                    <div
                      className="bg-transparent px-2.5 py-1 flex items-center gap-2 rounded transition-all select-none"
                      title={`Official PNPKI Digital Signature (${userCs48Profile?.p12_filename || "p12 Active"})`}
                    >
                      {effectiveSignatureImage && (
                        <img
                          src={effectiveSignatureImage}
                          alt="Personnel Signature"
                          className="h-8 max-w-[75px] object-contain mix-blend-multiply shrink-0"
                        />
                      )}
                      <div className="text-[7.5px] font-sans text-left leading-tight text-black shrink-0">
                        <div className="font-bold text-[8px]">Digitally signed</div>
                        <div>by {resolvedP12SignerName.trim()}</div>
                      </div>
                    </div>
                  ) : effectiveSignatureImage ? (
                    <img
                      src={effectiveSignatureImage}
                      alt="Personnel Signature"
                      className="h-10 max-w-[120px] object-contain mix-blend-multiply"
                    />
                  ) : (
                    /* Strictly blank space when user != userLogin or signature not loaded */
                    <div className="h-12" />
                  )}
                </div>

                {/* Personnel Underline with Inline Input */}
                <input
                  type="text"
                  value={data.requestedByName}
                  onChange={(e) => setData((prev) => ({ ...prev, requestedByName: e.target.value }))}
                  placeholder="Personnel Full Name"
                  className="border-b border-black w-48 sm:w-56 text-center font-bold text-[12px] sm:text-[13px] uppercase text-black pb-0.5 bg-transparent outline-none focus:bg-blue-50/40 transition-colors"
                />
                <input
                  type="text"
                  value={data.requestedByTitle}
                  onChange={(e) => setData((prev) => ({ ...prev, requestedByTitle: e.target.value }))}
                  placeholder="Designation / Plantilla Title"
                  className="w-56 text-center text-[10px] sm:text-[11px] text-black pt-0.5 bg-transparent outline-none focus:bg-blue-50/40 transition-colors"
                />
              </div>

              {/* Right Column: APPROVED BY (Supervisor - Clean space on template; signed upon upload in Combine DTR) */}
              <div className="flex flex-col items-center">
                <span className="text-[11px] font-bold text-black tracking-wider uppercase mb-1">
                  APPROVED BY:
                </span>

                {/* Clean Blank Signature Area for Official Approval */}
                <div className="h-16 flex items-center justify-center relative w-full px-4">
                  {/* Kept 100% clean and blank on template. Signed by Rene Jane upon upload in Combine DTR */}
                </div>

                {/* Supervisor Underline with Inline Input */}
                <input
                  type="text"
                  value={data.approvedByName}
                  onChange={(e) => setData((prev) => ({ ...prev, approvedByName: e.target.value }))}
                  placeholder="Supervisor Full Name"
                  className="border-b border-black w-48 sm:w-56 text-center font-bold text-[12px] sm:text-[13px] uppercase text-black pb-0.5 bg-transparent outline-none focus:bg-blue-50/40 transition-colors"
                />
                <input
                  type="text"
                  value={data.approvedByTitle}
                  onChange={(e) => setData((prev) => ({ ...prev, approvedByTitle: e.target.value }))}
                  placeholder="Supervisor Position / Title"
                  className="w-56 text-center text-[10px] sm:text-[11px] text-black pt-0.5 bg-transparent outline-none focus:bg-blue-50/40 transition-colors"
                />
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* GATE PASS STORAGE MODAL / QUEUE DRAWER                                    */}
      {/* ========================================================================= */}
      {isStorageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 print:hidden animate-in fade-in duration-200">
          <div className="bg-[#0C111D] border border-[#222E4A] rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#1E293B] bg-[#0F1626] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <FolderArchive className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Gate Pass Storage & Creation Queue
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                      {savedGatePasses.length} Saved Passes
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Store and organize multiple gate passes. Load any pass into the editor, or merge all directly into CS Form 48.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsStorageOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Action & Filter Bar */}
            <div className="px-6 py-3 border-b border-[#1A2338] bg-[#0A0E18] flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={storageSearch}
                  onChange={(e) => setStorageSearch(e.target.value)}
                  placeholder="Filter by Control No., Date, Purpose, or PO..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#111728] border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateNewGatePass}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Gate Pass</span>
                </button>

                <button
                  type="button"
                  onClick={handleMergeAllToCs48}
                  disabled={savedGatePasses.length === 0}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white flex items-center gap-2 transition-all shadow-md shadow-blue-900/30 cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>Merge All to CS Form 48 ({savedGatePasses.length})</span>
                </button>
              </div>
            </div>

            {/* Modal Body: Cards List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
              {savedGatePasses.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center border border-indigo-500/20">
                    <FolderArchive className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">No Gate Passes in Storage</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                      Save your current Gate Pass or click below to create your first stored pass.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateNewGatePass}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white inline-flex items-center gap-1.5 transition-all shadow-md shadow-indigo-900/30 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create First Gate Pass</span>
                  </button>
                </div>
              ) : (
                (() => {
                  const filtered = savedGatePasses.filter((p) => {
                    if (!storageSearch.trim()) return true;
                    const q = storageSearch.toLowerCase();
                    return (
                      p.controlNo.toLowerCase().includes(q) ||
                      p.activityDates.toLowerCase().includes(q) ||
                      p.purpose.toLowerCase().includes(q) ||
                      p.selectedPO.toLowerCase().includes(q) ||
                      p.requestedByName.toLowerCase().includes(q)
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-8 text-xs text-slate-500">
                        No Gate Passes matching "{storageSearch}".
                      </div>
                    );
                  }

                  return filtered.map((record) => {
                    const isCurrent = record.controlNo === data.controlNo;
                    return (
                      <div
                        key={record.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                          isCurrent
                            ? "bg-gradient-to-r from-blue-950/40 via-[#10172A] to-[#121B30] border-blue-500/50 shadow-md shadow-blue-950/30"
                            : "bg-[#0E1424] border-[#1C263D] hover:border-slate-700 hover:bg-[#12182B]"
                        }`}
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40">
                              {record.controlNo}
                            </span>
                            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {record.activityDates} ({record.days.length > 1 ? `Days ${record.days.join(", ")}` : `Day ${record.days[0]}`})
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-slate-800 text-slate-400 border border-slate-700 uppercase">
                              {record.category}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              PO: {record.selectedPO}
                            </span>
                            {isCurrent && (
                              <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Active in Editor
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-200 font-medium truncate max-w-xl">
                            {record.purpose}
                          </div>

                          <div className="text-[11px] text-slate-400 flex items-center gap-3 flex-wrap">
                            {record.venue && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <MapPin className="w-3 h-3 text-slate-500" />
                                {record.venue}
                              </span>
                            )}
                            {record.startTime && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {record.startTime}
                              </span>
                            )}
                            <span className="text-slate-500">
                              Requested by: <strong className="text-slate-300">{record.requestedByName}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Card Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                          <button
                            type="button"
                            onClick={() => handleLoadFromStorage(record)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Load this Gate Pass into the printable sheet editor"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                            <span>Load</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleLoadFromStorage(record);
                              handleAutoMergeToCs48();
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40 hover:bg-blue-600/50 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Merge this Gate Pass into CS Form 48"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                            <span>Merge</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteFromStorage(record.id, e)}
                            className="p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-900/50 transition-all cursor-pointer"
                            title="Delete this Gate Pass from storage"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-[#1E293B] bg-[#0A0E18] flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-indigo-400" />
                <span>
                  All saved Gate Passes are stored locally and will be automatically remembered.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsStorageOpen(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Close Queue
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
