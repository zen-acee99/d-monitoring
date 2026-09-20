import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  Printer,
  FileSpreadsheet,
  Download,
  Filter,
  CheckCircle2,
  Calendar,
  Building2,
  Wifi,
  Sparkles,
  Server,
  Layers,
  FileText,
  User,
  Shield,
  Sliders,
  Check,
  Radio,
  HardDrive,
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  Activity,
  Globe,
  Database,
  FolderKanban,
  MapPin,
} from "lucide-react";
import { PROJECTS, Project } from "@/config/projects";
import { projectApi, MapSite } from "@/services/api";
import { exportUniversalReportToExcel, printUniversalReport } from "@/utils/universalReportGenerator";

interface UniversalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProjectId?: string; // "ALL" or specific project id (e.g. "freewifi", "elgu", etc.)
  records?: Record<string, any>[];
}

const PROJECT_TITLES: Record<string, { title: string; subtitle: string }> = {
  ALL: {
    title: "DICT REGION V CONSOLIDATED OPERATIONAL REPORT",
    subtitle: "Regional ICT Infrastructure, e-Government Systems, Cybersecurity & Digital Services",
  },
  freewifi: {
    title: "FREE WIFI 4 ALL  OPERATIONAL REPORT",
    subtitle: "DICT Region V (Bicol) - Provincial Monitoring & Omada Northbound Telemetry",
  },
  elgu: {
    title: "eLGU DIGITAL TRANSFORMATION OPERATIONAL REPORT",
    subtitle: "Local Government Unit Digitalization & eBPLS Rollout in Region V",
  },
  pnpki: {
    title: "PNPKI DIGITAL CERTIFICATES OPERATIONAL REPORT",
    subtitle: "Public Key Infrastructure & Digital Signature Issuance Operations",
  },
  cybersecurity: {
    title: "REGIONAL CSIRT CYBERSECURITY THREAT & INCIDENT REPORT",
    subtitle: "Cyber Threat Monitoring, Vulnerability Assessment & Incident Remediation",
  },
  ilcdb: {
    title: "ILCDB ICT CAPACITY DEVELOPMENT & TRAINING REPORT",
    subtitle: "ICT Literacy & Competency Development Bureau Training Operations",
  },
  gecs: {
    title: "GECS EMERGENCY COMMUNICATIONS OPERATIONAL REPORT",
    subtitle: "Government Emergency Communications System & Disaster Readiness Network",
  },
  govnet: {
    title: "GOVNET REGIONAL FIBER BACKBONE REPORT",
    subtitle: "Government Network Interconnectivity & Regional Agency Telemetry",
  },
  nbp: {
    title: "NATIONAL BROADBAND PLAN (NBP) INFRASTRUCTURE REPORT",
    subtitle: "Regional Fiber Backbone & Point-of-Presence Network Infrastructure",
  },
  egovph: {
    title: "eGOVPH UNIFIED SERVICES ADOPTION REPORT",
    subtitle: "National Government Portal & e-Services Utilization Across Bicol LGUs",
  },
  miss: {
    title: "MANAGEMENT INFORMATION SYSTEMS SERVICE (MISS) REPORT",
    subtitle: "Enterprise Systems, Security Infrastructure & Regional Technical Support",
  },
  iidb: {
    title: "ICT INDUSTRY DEVELOPMENT BUREAU (IIDB) REPORT",
    subtitle: "Digital Careers, Startups & Regional IT-BPM Ecosystem Development",
  },
};

const BICOL_PROVINCES = [
  "Albay",
  "Camarines Sur",
  "Camarines Norte",
  "Catanduanes",
  "Masbate",
  "Sorsogon",
];

export function UniversalReportModal({
  isOpen,
  onClose,
  initialProjectId = "ALL",
  records: initialRecords,
}: UniversalReportModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  const [rawRecords, setRawRecords] = useState<Record<string, any>[]>(initialRecords || []);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [reportTitle, setReportTitle] = useState(PROJECT_TITLES[initialProjectId]?.title || PROJECT_TITLES.ALL.title);
  const [reportSubtitle, setReportSubtitle] = useState(PROJECT_TITLES[initialProjectId]?.subtitle || PROJECT_TITLES.ALL.subtitle);
  const [preparedBy, setPreparedBy] = useState("Engr. Juan Dela Cruz");
  const [designation, setDesignation] = useState("Technical Operations Lead, DICT Region V");
  const [approvedBy, setApprovedBy] = useState("Regional Director");
  const [approvedDesignation, setApprovedDesignation] = useState("Regional Director, DICT Regional Office V");

  // Filter states
  const [selectedProvince, setSelectedProvince] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Section Toggles
  const [includeKpis, setIncludeKpis] = useState(true);
  const [includeAnalytics, setIncludeAnalytics] = useState(true);
  const [includeProvincialMatrix, setIncludeProvincialMatrix] = useState(true);
  const [includeRoster, setIncludeRoster] = useState(true);
  const [includeSignatures, setIncludeSignatures] = useState(true);

  const printableRef = useRef<HTMLDivElement>(null);

  // Update title/subtitle when project changes
  useEffect(() => {
    if (PROJECT_TITLES[selectedProjectId]) {
      setReportTitle(PROJECT_TITLES[selectedProjectId].title);
      setReportSubtitle(PROJECT_TITLES[selectedProjectId].subtitle);
    }
  }, [selectedProjectId]);

  // Sync initialProjectId prop
  useEffect(() => {
    if (initialProjectId) {
      setSelectedProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  // Load records from backend API or tables
  useEffect(() => {
    if (!isOpen) return;

    if (initialRecords && initialRecords.length > 0 && selectedProjectId === initialProjectId) {
      setRawRecords(initialRecords);
      return;
    }

    setIsLoading(true);
    if (selectedProjectId === "ALL") {
      // Fetch map sites across all projects to get a comprehensive consolidated roster
      projectApi.getMapSites().then((sites) => {
        if (Array.isArray(sites) && sites.length > 0) {
          setRawRecords(sites);
        } else {
          // Fallback to table records for freewifi
          projectApi.getTableRecords("freewifi").then((fw) => {
            setRawRecords(Array.isArray(fw) ? fw : []);
          });
        }
        setIsLoading(false);
      });
    } else {
      // Fetch dedicated project table records
      projectApi.getTableRecords(selectedProjectId).then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setRawRecords(data);
        } else {
          // Fallback to map sites filtered by project
          projectApi.getMapSites().then((sites) => {
            const filtered = sites.filter((s) => s.projectId === selectedProjectId);
            setRawRecords(filtered);
          });
        }
        setIsLoading(false);
      });
    }
  }, [isOpen, selectedProjectId, initialProjectId, initialRecords]);

  // Filtered records for the report
  const filteredRecords = useMemo(() => {
    return rawRecords.filter((r) => {
      if (selectedProvince !== "ALL" && r.province !== selectedProvince) return false;
      if (selectedStatus !== "ALL") {
        const stat = String(r.status || "").toLowerCase();
        if (selectedStatus === "OPERATIONAL" && !["operational", "active", "live", "completed", "deployed", "processed"].includes(stat)) {
          return false;
        }
        if (selectedStatus === "WARNING" && !["warning", "degraded", "under maintenance", "build up", "expiring soon"].includes(stat)) {
          return false;
        }
        if (selectedStatus === "CRITICAL" && !["critical", "offline", "inactive", "revoked"].includes(stat)) {
          return false;
        }
      }
      return true;
    });
  }, [rawRecords, selectedProvince, selectedStatus]);

  // KPIs & Analytics Calculations
  const analyticsData = useMemo(() => {
    const total = filteredRecords.length || 1;
    const operationalCount = filteredRecords.filter((r) =>
      ["operational", "active", "live", "completed", "deployed", "processed"].includes(
        String(r.status || "operational").toLowerCase()
      )
    ).length;
    const warningCount = filteredRecords.filter((r) =>
      ["warning", "degraded", "under maintenance", "build up", "expiring soon"].includes(
        String(r.status || "").toLowerCase()
      )
    ).length;
    const criticalCount = filteredRecords.filter((r) =>
      ["critical", "offline", "inactive", "revoked"].includes(String(r.status || "").toLowerCase())
    ).length;

    const healthIndex = filteredRecords.length > 0 ? Math.round((operationalCount / total) * 100) : 100;

    // Provincial breakdown
    const provStats = BICOL_PROVINCES.map((prov) => {
      const pRecords = filteredRecords.filter((r) => (r.province || "Albay").toLowerCase() === prov.toLowerCase());
      const pOp = pRecords.filter((r) =>
        ["operational", "active", "live", "completed", "deployed", "processed"].includes(
          String(r.status || "operational").toLowerCase()
        )
      ).length;
      const pHealth = pRecords.length > 0 ? Math.round((pOp / pRecords.length) * 100) : 100;
      const muniCount = new Set(pRecords.map((r) => r.municipality || r.city).filter(Boolean)).size;
      return {
        province: prov,
        total: pRecords.length,
        operational: pOp,
        health: pHealth,
        municipalities: muniCount,
      };
    });

    // Sectoral / Category Breakdown
    const categoryMap = new Map<string, number>();
    const projectMap = new Map<string, Project>(PROJECTS.map((p) => [p.id, p]));

    for (const r of filteredRecords) {
      const projId = r.projectId || r.project_id || selectedProjectId;
      const meta = projectMap.get(projId);
      const cat = meta?.category || r.category || r.siteType || "General Infrastructure";
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    }

    const categories = Array.from(categoryMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // Infrastructure / Technology (Fiber vs Satellite vs Radio)
    const fiberCount = filteredRecords.filter((r) => {
      const text = `${r.linkType || ""} ${r.facilityType || ""} ${r.details || ""}`.toLowerCase();
      return text.includes("fiber") || text.includes("foc") || text.includes("ftth");
    }).length;

    const satCount = filteredRecords.filter((r) => {
      const text = `${r.linkType || ""} ${r.facilityType || ""} ${r.details || ""}`.toLowerCase();
      return text.includes("sat") || text.includes("leo") || text.includes("vsat") || text.includes("starlink");
    }).length;

    const fiberPct = Math.round((fiberCount / total) * 100);
    const satPct = Math.round((satCount / total) * 100);

    // Total Access Points or Capacity if applicable
    const totalAps = filteredRecords.reduce((sum, r) => sum + (Number(r.apCount) || 0), 0);
    const estBeneficiaries = filteredRecords.reduce((sum, r) => {
      return sum + (Number(r.participantsCount) || Number(r.registeredUsers) || Number(r.estimatedDailyUsers) || (Number(r.apCount) || 2) * 120);
    }, 0);

    // Active project metadata
    const currentProjMeta = PROJECTS.find((p) => p.id === selectedProjectId);

    return {
      totalRecords: filteredRecords.length,
      operationalCount,
      warningCount,
      criticalCount,
      healthIndex,
      provStats,
      categories,
      fiberCount,
      satCount,
      fiberPct,
      satPct,
      totalAps,
      estBeneficiaries,
      currentProjMeta,
    };
  }, [filteredRecords, selectedProjectId]);

  if (!isOpen) return null;

  const currentDateFormatted = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleExportExcel = () => {
    exportUniversalReportToExcel(filteredRecords, {
      reportTitle,
      reportSubtitle,
      preparedBy,
      designation,
      approvedBy,
      approvedDesignation,
      projectFilter: selectedProjectId,
      provinceFilter: selectedProvince,
      statusFilter: selectedStatus,
      reportDate: currentDateFormatted,
    });
  };

  const handlePrint = () => {
    if (!printableRef.current) return;
    printUniversalReport(printableRef.current.innerHTML, reportTitle);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Top Header Bar */}
        <div className="px-6 py-3.5 border-b border-[#18233C] flex items-center justify-between bg-[#111728]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>DICT Region V Official Operational Report Generator</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  {filteredRecords.length} Records Loaded
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Generate official executive reports with multi-project analytics, provincial breakdown, field asset roster, and certification signatures
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel (.xlsx)</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-900/30 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Main Body (Split View) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Left Sidebar Configuration */}
          <div className="w-full lg:w-80 bg-[#080B14] border-b lg:border-b-0 lg:border-r border-[#18233C] p-4 overflow-y-auto space-y-4 custom-scrollbar">
            
            <div className="flex items-center gap-2 pb-2 border-b border-[#18233C]">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Report Scope & Parameters</h4>
            </div>

            {/* Project / Initiative Scope */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-300">Project / Program Scope</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">🌐 All Projects (Consolidated Regional Overview)</option>
                {PROJECTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shortName} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Province Scope */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-300">Province Filter</label>
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All 6 Bicol Provinces</option>
                {BICOL_PROVINCES.map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>
            </div>

            {/* Operational Status */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-300">Operational Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Operational Statuses</option>
                <option value="OPERATIONAL">Live / Operational Only</option>
                <option value="WARNING">Degraded / Maintenance Only</option>
                <option value="CRITICAL">Critical / Inactive Only</option>
              </select>
            </div>

            {/* Titles & Customization */}
            <div className="space-y-2 pt-2 border-t border-[#18233C]/60">
              <span className="text-[11px] font-bold text-slate-300 block">Report Titles</span>
              
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Header Title</label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Subtitle / Context</label>
                <input
                  type="text"
                  value={reportSubtitle}
                  onChange={(e) => setReportSubtitle(e.target.value)}
                  className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Sections Toggles */}
            <div className="space-y-2 pt-2 border-t border-[#18233C]/60">
              <span className="text-[11px] font-bold text-slate-300 block">Report Sections</span>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeKpis}
                  onChange={(e) => setIncludeKpis(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Executive Summary & High-Level KPIs</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAnalytics}
                  onChange={(e) => setIncludeAnalytics(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Domain Analytics & Sectoral Breakdown</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeProvincialMatrix}
                  onChange={(e) => setIncludeProvincialMatrix(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Provincial Distribution Matrix</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeRoster}
                  onChange={(e) => setIncludeRoster(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Field Asset & Telemetry Roster</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSignatures}
                  onChange={(e) => setIncludeSignatures(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Signatures & Certification Block</span>
              </label>
            </div>

            {/* Sign-off Details */}
            {includeSignatures && (
              <div className="space-y-2.5 pt-2 border-t border-[#18233C]/60 text-xs">
                <span className="text-[11px] font-bold text-slate-300 block">Sign-off Authority</span>
                
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Prepared By (Name)</label>
                  <input
                    type="text"
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Approved By (Name)</label>
                  <input
                    type="text"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Approved Designation</label>
                  <input
                    type="text"
                    value={approvedDesignation}
                    onChange={(e) => setApprovedDesignation(e.target.value)}
                    className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>
              </div>
            )}

          </div>

          {/* Right Live Preview Canvas */}
          <div className="flex-1 bg-[#141B2D]/40 p-4 sm:p-6 overflow-y-auto custom-scrollbar flex justify-center">
            
            {/* The Printable Page Sheet (A4 Styled) */}
            <div
              ref={printableRef}
              className="w-full max-w-[850px] bg-white text-slate-900 rounded-lg p-8 shadow-2xl space-y-6 font-sans border border-slate-200"
              style={{ minHeight: "1000px" }}
            >
              
              {/* Official Header with Dual Official Logos (DICT & Bagong Pilipinas) */}
              <div className="border-b-2 border-[#0F172A] pb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <img
                    src="/dict-logo.png"
                    alt="DICT Logo"
                    className="w-14 h-14 object-contain shrink-0"
                  />
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                      Republic of the Philippines
                    </div>
                    <div className="text-base font-black text-slate-950 uppercase tracking-tight">
                      Department of Information and Communications Technology
                    </div>
                    <div className="text-xs font-semibold text-blue-900">
                      Regional Office V
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right text-[10px] leading-tight text-slate-600 hidden sm:block">
                    <div className="font-bold text-slate-900 uppercase tracking-wide">DATE GENERATED:</div>
                    <div className="font-mono text-[10px] text-slate-600 mt-0.5">{currentDateFormatted}</div>
                    <div className="text-[9px] text-emerald-700 font-semibold mt-0.5 tracking-wider">● CONFIDENTIAL / OFFICIAL</div>
                  </div>
                  <img
                    src="/bagong-pilipinas-logo.png"
                    alt="Bagong Pilipinas Logo"
                    className="w-13 h-13 object-contain shrink-0"
                  />
                </div>
              </div>

              {/* Report Document Title Banner */}
              <div className="bg-[#0F172A] text-white p-3.5 rounded-lg text-center space-y-0.5">
                <h2 className="text-sm font-black uppercase tracking-wider">{reportTitle}</h2>
                <p className="text-[11px] text-slate-300">{reportSubtitle}</p>
              </div>

              {/* Dynamic Section Sequence Helper */}
              {(() => {
                let secCount = 1;
                const kpiSecNum = includeKpis ? secCount++ : null;
                const analyticsSecNum = includeAnalytics ? secCount++ : null;
                const provincialSecNum = includeProvincialMatrix ? secCount++ : null;
                const rosterSecNum = includeRoster ? secCount++ : null;

                return (
                  <>
                    {/* Section 1: Executive KPI Summary */}
                    {includeKpis && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between border-b border-slate-300 pb-1">
                          <span>{kpiSecNum}. Executive Summary & Regional Operational Metrics</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Scope: {selectedProjectId === "ALL" ? "All Projects" : analyticsData.currentProjMeta?.shortName || selectedProjectId}
                          </span>
                        </h4>

                        <div className="grid grid-cols-4 gap-2.5 text-center">
                          <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-lg">
                            <div className="text-[10px] font-bold text-slate-600 uppercase">Monitored Deployments</div>
                            <div className="text-lg font-black font-mono text-blue-950">{analyticsData.totalRecords}</div>
                          </div>

                          <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg">
                            <div className="text-[10px] font-bold text-emerald-800 uppercase">Operational Assets</div>
                            <div className="text-lg font-black font-mono text-emerald-700">{analyticsData.operationalCount} Live</div>
                          </div>

                          <div className="p-2.5 bg-sky-50 border border-sky-300 rounded-lg">
                            <div className="text-[10px] font-bold text-sky-800 uppercase">Operational Health</div>
                            <div className="text-lg font-black font-mono text-sky-700">{analyticsData.healthIndex}%</div>
                          </div>

                          <div className="p-2.5 bg-indigo-50 border border-indigo-300 rounded-lg">
                            <div className="text-[10px] font-bold text-indigo-800 uppercase">Public Reach / Users</div>
                            <div className="text-lg font-black font-mono text-indigo-700">
                              ~{analyticsData.estBeneficiaries.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5 text-center pt-1">
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs">
                            <span className="text-[10px] text-slate-500 block">Provinces Covered:</span>
                            <strong className="text-blue-900 font-mono text-sm">
                              {analyticsData.provStats.filter((p) => p.total > 0).length} of 6 Bicol Provinces
                            </strong>
                          </div>

                          <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs">
                            <span className="text-[10px] text-slate-500 block">High-Priority Operations:</span>
                            <strong className="text-emerald-900 font-mono text-sm">
                              {analyticsData.operationalCount} Validated Sites
                            </strong>
                          </div>

                          <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs">
                            <span className="text-[10px] text-slate-500 block">Attention Required:</span>
                            <strong className="text-amber-900 font-mono text-sm">
                              {analyticsData.warningCount + analyticsData.criticalCount} Degraded/Offline
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section 2: Domain Analytics & Sectoral Breakdown */}
                    {includeAnalytics && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between border-b border-slate-300 pb-1">
                          <span>{analyticsSecNum}. Domain Analytics & Sectoral Distribution</span>
                          <span className="text-[10px] text-emerald-800 font-semibold font-mono">
                            Operational Health: {analyticsData.healthIndex}%
                          </span>
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          
                          {/* Left: Category / Sector Breakdown */}
                          <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                Sectoral / Portfolio Share
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {analyticsData.totalRecords} Total Records
                              </span>
                            </div>

                            {analyticsData.categories.slice(0, 4).map((cat, idx) => {
                              const colors = ["bg-blue-600", "bg-indigo-600", "bg-emerald-600", "bg-amber-600"];
                              const color = colors[idx % colors.length];
                              return (
                                <div key={cat.name} className="space-y-1">
                                  <div className="flex justify-between text-[10px]">
                                    <span className="font-semibold text-slate-800 truncate pr-2">
                                      {cat.name}
                                    </span>
                                    <span className="font-mono font-bold text-slate-900 shrink-0">
                                      {cat.count} ({cat.pct}%)
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                    <div
                                      className={`${color} h-full rounded-full transition-all`}
                                      style={{ width: `${cat.pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Right: Connectivity & Regional Reach */}
                          <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                Connectivity & Infrastructure Medium
                              </span>
                              <span className="text-[10px] text-emerald-700 font-bold font-mono">
                                {analyticsData.healthIndex}% Active Fleet
                              </span>
                            </div>

                            {/* Backhaul Segment */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="font-semibold text-slate-800">
                                  Fiber Optic (FOC) vs Satellite (LEO)
                                </span>
                                <span className="font-mono font-bold text-slate-900">
                                  FOC {analyticsData.fiberPct}% | LEO {analyticsData.satPct}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                                <div
                                  className="bg-sky-500 h-full transition-all"
                                  style={{ width: `${Math.max(10, analyticsData.fiberPct)}%` }}
                                  title={`Fiber: ${analyticsData.fiberCount} sites`}
                                />
                                <div
                                  className="bg-amber-500 h-full transition-all"
                                  style={{ width: `${Math.max(10, analyticsData.satPct)}%` }}
                                  title={`Satellite: ${analyticsData.satCount} sites`}
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                                <span>Fiber / Core: {analyticsData.fiberCount} records</span>
                                <span>Satellite / Remote: {analyticsData.satCount} records</span>
                              </div>
                            </div>

                            {/* Metrics mini grid */}
                            <div className="grid grid-cols-2 gap-2 pt-0.5">
                              <div className="p-1.5 bg-white border border-slate-200 rounded">
                                <div className="text-[9px] text-slate-500 uppercase font-bold">Estimated Public Reach</div>
                                <div className="text-xs font-mono font-bold text-blue-900">
                                  ~{analyticsData.estBeneficiaries.toLocaleString()} Citizens
                                </div>
                              </div>
                              <div className="p-1.5 bg-white border border-slate-200 rounded">
                                <div className="text-[9px] text-slate-500 uppercase font-bold">Target Municipalities</div>
                                <div className="text-xs font-mono font-bold text-emerald-900">
                                  {analyticsData.provStats.reduce((s, p) => s + p.municipalities, 0)} LGUs Covered
                                </div>
                              </div>
                            </div>

                          </div>

                        </div>

                        {/* Strategic Takeaways Box */}
                        <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-950 flex items-center gap-1">
                            <span>📌 Key Operational Findings & Strategic Takeaways:</span>
                          </div>
                          <ul className="text-[10px] text-slate-700 space-y-0.5 list-disc pl-4 leading-relaxed">
                            <li>
                              <strong>Programmatic Footprint:</strong> Across {selectedProjectId === "ALL" ? "all 11 DICT Regional programs" : analyticsData.currentProjMeta?.name || selectedProjectId}, a total of <strong>{analyticsData.totalRecords} assets</strong> are monitored with an operational health index of <strong>{analyticsData.healthIndex}%</strong>.
                            </li>
                            <li>
                              <strong>Provincial Deployment Balance:</strong> Operations span across <strong>{analyticsData.provStats.filter(p => p.total > 0).length} Bicol provinces</strong>, ensuring digital inclusion and infrastructure reliability in both urban government centers and rural communities.
                            </li>
                            <li>
                              <strong>Executive Direction:</strong> Priority focus remains on sustaining 100% SLA uptime, proactive maintenance of degraded links, and ongoing collaboration with LGUs and partner agencies.
                            </li>
                          </ul>
                        </div>

                      </div>
                    )}

                    {/* Section 3: Provincial Distribution Matrix */}
                    {includeProvincialMatrix && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-300 pb-1">
                          <span>{provincialSecNum}. Provincial Distribution Matrix (Region V)</span>
                        </h4>

                        <table className="w-full text-left text-[11px] border border-slate-300">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 uppercase text-[9px]">
                            <tr>
                              <th className="p-1.5 pl-2">Province (Region V)</th>
                              <th className="p-1.5 text-center">Total Deployments</th>
                              <th className="p-1.5 text-center text-emerald-800">Operational</th>
                              <th className="p-1.5 text-center">Health Index (%)</th>
                              <th className="p-1.5 text-center">Municipalities</th>
                              <th className="p-1.5 text-center">Regional Share</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {analyticsData.provStats.map((p) => {
                              const share = analyticsData.totalRecords > 0 ? Math.round((p.total / analyticsData.totalRecords) * 100) : 0;
                              return (
                                <tr key={p.province} className="hover:bg-slate-50">
                                  <td className="p-1.5 pl-2 font-bold text-slate-900">{p.province}</td>
                                  <td className="p-1.5 text-center font-mono font-bold">{p.total}</td>
                                  <td className="p-1.5 text-center font-mono font-bold text-emerald-700 bg-emerald-50/50">
                                    {p.operational}
                                  </td>
                                  <td className="p-1.5 text-center font-mono">
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                        p.health >= 90 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                      }`}
                                    >
                                      {p.health}%
                                    </span>
                                  </td>
                                  <td className="p-1.5 text-center font-mono">{p.municipalities} LGUs</td>
                                  <td className="p-1.5 text-center font-mono">{share}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Section 4: Field Asset / Site Telemetry Roster */}
                    {includeRoster && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between border-b border-slate-300 pb-1">
                          <span>{rosterSecNum}. Field Asset & Telemetry Roster</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Total Records: {filteredRecords.length}
                          </span>
                        </h4>

                        <table className="w-full text-left text-[10px] border border-slate-300">
                          <thead className="bg-[#0F172A] text-white font-bold border-b border-slate-400 uppercase text-[9px]">
                            <tr>
                              <th className="p-1.5 text-center w-8">#</th>
                              <th className="p-1.5">Site / Asset / Facility Name</th>
                              <th className="p-1.5">Location (Province & LGU)</th>
                              <th className="p-1.5">Project / Initiative</th>
                              <th className="p-1.5 text-center">Status</th>
                              <th className="p-1.5">Key Metric / Capacity</th>
                              <th className="p-1.5">Focal Person</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {filteredRecords.slice(0, 20).map((record, index) => {
                              const projId = record.projectId || record.project_id || selectedProjectId;
                              const projMeta = PROJECTS.find((p) => p.id === projId);
                              const siteName = record.siteName || record.locationName || record.lguName || record.applicantName || record.trainingTitle || record.name || "—";
                              const province = record.province || "Albay";
                              const municipality = record.municipality || record.city || record.location || "—";
                              const status = String(record.status || "Operational");
                              const isOp = ["operational", "active", "live", "completed", "deployed", "processed"].includes(status.toLowerCase());
                              const metric = record.apCount ? `${record.apCount} APs` : record.bandwidth ? `${record.bandwidth} Mbps` : record.participantsCount ? `${record.participantsCount} Trainees` : record.classification || record.linkType || "Standard Node";
                              const focal = record.dictFocal || record.contact || record.focalPerson || "—";

                              return (
                                <tr key={record.id || index} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                  <td className="p-1.5 text-center font-mono text-slate-500">{index + 1}</td>
                                  <td className="p-1.5 font-bold text-slate-900">
                                    <div>{siteName}</div>
                                    <div className="text-[8px] text-slate-500 font-mono">
                                      {record.siteType || record.facilityType || "Asset Node"}
                                    </div>
                                  </td>
                                  <td className="p-1.5">
                                    <div className="font-semibold text-slate-800">{province}</div>
                                    <div className="text-[9px] text-slate-500">{municipality}</div>
                                  </td>
                                  <td className="p-1.5">
                                    <span className="font-bold text-blue-900 font-mono text-[9px]">
                                      {projMeta ? projMeta.shortName : String(projId).toUpperCase()}
                                    </span>
                                  </td>
                                  <td className="p-1.5 text-center">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono uppercase ${
                                        isOp ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
                                      }`}
                                    >
                                      {status}
                                    </span>
                                  </td>
                                  <td className="p-1.5 font-mono text-[9px] text-slate-800">
                                    {metric}
                                  </td>
                                  <td className="p-1.5 text-[9px] text-slate-600 truncate max-w-[120px]">
                                    {focal}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {filteredRecords.length > 20 && (
                          <div className="text-[9px] text-slate-500 italic text-right">
                            * Showing first 20 records. Full {filteredRecords.length} records available in Excel export.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Signatures & Certification Block */}
              {includeSignatures && (
                <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-8">Prepared & Verified By:</div>
                    <div className="border-b border-slate-800 pb-1 font-bold text-slate-900 uppercase">
                      {preparedBy}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">{designation}</div>
                    <div className="text-[9px] text-slate-400">DICT Provincial Operations Team</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-8">Approved & Noted By:</div>
                    <div className="border-b border-slate-800 pb-1 font-bold text-slate-900 uppercase">
                      {approvedBy}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">{approvedDesignation}</div>
                    <div className="text-[9px] text-slate-400">Regional Executive Direction</div>
                  </div>
                </div>
              )}

              {/* Document Footer */}
              <div className="pt-4 border-t border-slate-200 text-[9px] text-slate-400 flex items-center justify-between">
                <div>DICT Monitoring System v2.0 • Regional Operations Command Center</div>
                <div>Generated: {new Date().toISOString()}</div>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
