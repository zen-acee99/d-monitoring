import React, { useState, useMemo, useRef } from "react";
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
  HardDrive
} from "lucide-react";
import {
  FreeWifiSite,
  SITE_TYPE_CONFIG,
  getSiteTypeConfig,
  getLinkTypeConfig,
  getMunicipalityDistribution,
  getFreeWifiSummary
} from "@/data/freewifiData";
import { exportFreeWifiToExcel, printFreeWifiReport } from "@/utils/freewifiReportGenerator";

interface FreeWifiReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: FreeWifiSite[];
}

export function FreeWifiReportModal({ isOpen, onClose, sites }: FreeWifiReportModalProps) {
  const [reportTitle, setReportTitle] = useState("FREE WIFI 4 ALL  OPERATIONAL REPORT");
  const [reportSubtitle, setReportSubtitle] = useState("DICT Region V (Bicol) - Provincial Monitoring & Omada Northbound Telemetry");
  const [preparedBy, setPreparedBy] = useState("Engr. Juan Dela Cruz");
  const [designation, setDesignation] = useState("Technical Operations Lead, Free Wi-Fi 4 All");
  const [approvedBy, setApprovedBy] = useState("Regional Director");
  const [approvedDesignation, setApprovedDesignation] = useState("Regional Director, DICT Region V");
  
  // Filters
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>("ALL");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("ALL");
  const [selectedSiteType, setSelectedSiteType] = useState<string>("ALL");
  const [selectedLinkType, setSelectedLinkType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Options
  const [includeHardware, setIncludeHardware] = useState(true);
  const [includeMunicipalMatrix, setIncludeMunicipalMatrix] = useState(true);
  const [includeKpis, setIncludeKpis] = useState(true);
  const [includeAnalytics, setIncludeAnalytics] = useState(true);
  const [includeSignatures, setIncludeSignatures] = useState(true);

  const printableRef = useRef<HTMLDivElement>(null);

  // Municipalities list
  const municipalitiesList = useMemo(() => {
    return Array.from(new Set(sites.map((s) => s.municipality).filter(Boolean))).sort();
  }, [sites]);

  // Filtered sites for the report
  const reportSites = useMemo(() => {
    return sites.filter((s) => {
      const sAny = s as any;
      if (selectedMunicipality !== "ALL" && s.municipality !== selectedMunicipality) return false;
      if (selectedSupplier !== "ALL") {
        const supp = (sAny.omadaSupplier || sAny.omadaSupplierId || "").toLowerCase();
        if (!supp.includes(selectedSupplier.toLowerCase())) return false;
      }
      if (selectedSiteType !== "ALL" && s.siteType !== selectedSiteType) return false;
      if (selectedLinkType !== "ALL" && s.linkType !== selectedLinkType) return false;
      if (selectedStatus !== "ALL" && s.status !== selectedStatus) return false;
      return true;
    });
  }, [sites, selectedMunicipality, selectedSupplier, selectedSiteType, selectedLinkType, selectedStatus]);

  // KPIs
  const reportSummary = useMemo(() => {
    const totalSites = reportSites.length;
    const totalAps = reportSites.reduce((sum, s) => sum + (s.apCount || 0), 0);
    const fiberCount = reportSites.filter((s) => (s.linkType || "").toLowerCase().includes("fiber") || s.linkType === "FOC").length;
    const satCount = reportSites.filter((s) => (s.linkType || "").toLowerCase().includes("satellite") || s.linkType === "LEO").length;
    const supp1Count = reportSites.filter((s) => ((s as any).omadaSupplier || "").includes("1")).length;
    const supp2Count = reportSites.filter((s) => ((s as any).omadaSupplier || "").includes("2")).length;
    const schoolsCount = reportSites.filter((s) => s.siteType === "PES" || s.siteType === "PHS" || s.siteType === "HEI-LUC").length;
    const lgusCount = reportSites.filter((s) => s.siteType === "LGU-HALL" || s.siteType === "PC" || s.siteType === "PFO").length;

    return {
      totalSites,
      totalAps,
      fiberCount,
      satCount,
      supp1Count,
      supp2Count,
      schoolsCount,
      lgusCount,
    };
  }, [reportSites]);

  // Analytics Computation
  const reportAnalytics = useMemo(() => {
    const total = reportSites.length || 1;
    const totalAps = reportSites.reduce((sum, s) => sum + (s.apCount || 0), 0);

    // Sectoral counts
    const elemSchools = reportSites.filter((s) => s.siteType === "PES");
    const highSchools = reportSites.filter((s) => s.siteType === "PHS");
    const colleges = reportSites.filter((s) => s.siteType === "HEI-LUC");
    const totalEducation = elemSchools.length + highSchools.length + colleges.length;
    const educationAps = [...elemSchools, ...highSchools, ...colleges].reduce((sum, s) => sum + (s.apCount || 0), 0);

    const lguHalls = reportSites.filter((s) => s.siteType === "LGU-HALL");
    const capitols = reportSites.filter((s) => s.siteType === "PC");
    const pfoOffices = reportSites.filter((s) => s.siteType === "PFO");
    const totalGovernance = lguHalls.length + capitols.length + pfoOffices.length;
    const governanceAps = [...lguHalls, ...capitols, ...pfoOffices].reduce((sum, s) => sum + (s.apCount || 0), 0);

    const otherSites = reportSites.filter((s) => !["PES", "PHS", "HEI-LUC", "LGU-HALL", "PC", "PFO"].includes(s.siteType));
    const totalOther = otherSites.length;
    const otherAps = otherSites.reduce((sum, s) => sum + (s.apCount || 0), 0);

    // Backhaul
    const fiberSites = reportSites.filter((s) => (s.linkType || "").toLowerCase().includes("fiber") || s.linkType === "FOC");
    const satSites = reportSites.filter((s) => (s.linkType || "").toLowerCase().includes("satellite") || s.linkType === "LEO");
    const fiberPct = Math.round((fiberSites.length / total) * 100);
    const satPct = Math.round((satSites.length / total) * 100);

    // Controllers
    const supp1Sites = reportSites.filter((s) => ((s as any).omadaSupplier || "").includes("1"));
    const supp2Sites = reportSites.filter((s) => ((s as any).omadaSupplier || "").includes("2"));
    const supp1Pct = Math.round((supp1Sites.length / total) * 100);
    const supp2Pct = Math.round((supp2Sites.length / total) * 100);

    // Operational Health
    const operationalCount = reportSites.filter((s) => (s.status || "").toLowerCase() === "operational" || !s.status).length;
    const healthIndex = Math.round((operationalCount / total) * 100);

    // Estimated capacity
    const avgApsPerSite = reportSites.length > 0 ? (totalAps / reportSites.length).toFixed(1) : "0";
    const estConcurrentUsers = totalAps * 45;
    const estDailyCitizenReach = reportSites.reduce((sum, s) => sum + (s.estimatedDailyUsers || (s.apCount || 2) * 120), 0);

    // Top 3 LGUs
    const munCounts = getMunicipalityDistribution(reportSites);
    const top3Mun = munCounts.slice(0, 3).map((m) => m.municipality).join(", ");
    const top3ApCount = munCounts.slice(0, 3).reduce((sum, m) => sum + m.totalAps, 0);
    const top3ApPct = totalAps > 0 ? Math.round((top3ApCount / totalAps) * 100) : 0;

    return {
      totalSites: reportSites.length,
      totalAps,
      education: {
        count: totalEducation,
        pct: Math.round((totalEducation / total) * 100),
        aps: educationAps,
        elem: elemSchools.length,
        high: highSchools.length,
        hei: colleges.length,
      },
      governance: {
        count: totalGovernance,
        pct: Math.round((totalGovernance / total) * 100),
        aps: governanceAps,
        lgus: lguHalls.length,
        capitol: capitols.length,
        pfo: pfoOffices.length,
      },
      other: {
        count: totalOther,
        pct: Math.round((totalOther / total) * 100),
        aps: otherAps,
      },
      fiber: {
        count: fiberSites.length,
        pct: fiberPct,
      },
      satellite: {
        count: satSites.length,
        pct: satPct,
      },
      supplier1: {
        count: supp1Sites.length,
        pct: supp1Pct,
      },
      supplier2: {
        count: supp2Sites.length,
        pct: supp2Pct,
      },
      healthIndex,
      avgApsPerSite,
      estConcurrentUsers,
      estDailyCitizenReach,
      top3Mun,
      top3ApPct,
    };
  }, [reportSites]);

  // Municipal density data
  const reportMunData = useMemo(() => {
    return getMunicipalityDistribution(reportSites);
  }, [reportSites]);

  if (!isOpen) return null;

  // Trigger Excel Export
  const handleExportExcel = () => {
    exportFreeWifiToExcel(reportSites, {
      reportTitle,
      preparedBy,
      designation,
      approvedBy,
      approvedDesignation,
      reportDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    });
  };

  // Trigger Native Print / PDF
  const handlePrint = () => {
    if (!printableRef.current) return;
    printFreeWifiReport(printableRef.current.innerHTML, reportTitle);
  };

  const currentDateFormatted = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Top Header */}
        <div className="px-6 py-3.5 border-b border-[#18233C] flex items-center justify-between bg-[#111728]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Free Wi-Fi 4 All Precise Report Generator</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  {reportSites.length} Sites Selected
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Generate official executive reports with live Omada Northbound telemetry, hardware inventories, and signatures
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
          
          {/* Left Configuration Sidebar */}
          <div className="w-full lg:w-80 bg-[#080B14] border-b lg:border-b-0 lg:border-r border-[#18233C] p-4 overflow-y-auto space-y-4 custom-scrollbar">
            <div className="flex items-center gap-2 pb-2 border-b border-[#18233C]">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Report Parameters</h4>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-slate-400">Report Header Title</label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Scope Filters */}
            <div className="space-y-3 pt-2 border-t border-[#18233C]/60">
              <span className="text-[11px] font-bold text-slate-300 block">Filter Scope</span>

              {/* Municipality */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">City / Municipality</label>
                <select
                  value={selectedMunicipality}
                  onChange={(e) => setSelectedMunicipality(e.target.value)}
                  className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Municipalities ({municipalitiesList.length})</option>
                  {municipalitiesList.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Supplier / Controller */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Omada Controller</label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Controllers (Supplier 1 & 2)</option>
                  <option value="Supplier 1">Supplier 1 Only</option>
                  <option value="Supplier 2">Supplier 2 Only</option>
                </select>
              </div>

              {/* Facility Type */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Facility Category</label>
                <select
                  value={selectedSiteType}
                  onChange={(e) => setSelectedSiteType(e.target.value)}
                  className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Facility Types</option>
                  <option value="LGU-HALL">Municipal Halls & Capitols</option>
                  <option value="PES">Public Elementary Schools</option>
                  <option value="PHS">Public High Schools</option>
                  <option value="HEI-LUC">Colleges & Universities</option>
                  <option value="PC">Provincial Capitols</option>
                  <option value="PFO">Provincial Field Offices</option>
                </select>
              </div>

              {/* Link Type */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Backhaul Technology</label>
                <select
                  value={selectedLinkType}
                  onChange={(e) => setSelectedLinkType(e.target.value)}
                  className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Backhaul Types</option>
                  <option value="FOC">Fiber Optic (FOC)</option>
                  <option value="LEO">Satellite (LEO)</option>
                </select>
              </div>
            </div>

            {/* Sections Inclusion Toggles */}
            <div className="space-y-2 pt-2 border-t border-[#18233C]/60">
              <span className="text-[11px] font-bold text-slate-300 block">Report Sections</span>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeKpis}
                  onChange={(e) => setIncludeKpis(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Executive Summary & KPIs</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAnalytics}
                  onChange={(e) => setIncludeAnalytics(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Network Analytics & Sectoral Breakdown</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMunicipalMatrix}
                  onChange={(e) => setIncludeMunicipalMatrix(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Municipal Density Breakdown</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeHardware}
                  onChange={(e) => setIncludeHardware(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Live Omada Hardware & IP Details</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSignatures}
                  onChange={(e) => setIncludeSignatures(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Signatures & Approval Block</span>
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
                const municipalSecNum = includeMunicipalMatrix ? secCount++ : null;
                const siteListSecNum = secCount++;

                return (
                  <>
                    {/* Section 1: Executive KPI Summary */}
                    {includeKpis && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-300 pb-1">
                          <span>{kpiSecNum}. Executive Summary & Operational Metrics</span>
                        </h4>

                        <div className="grid grid-cols-4 gap-2.5 text-center">
                          <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-lg">
                            <div className="text-[10px] font-bold text-slate-600 uppercase">Operational Sites</div>
                            <div className="text-lg font-black font-mono text-blue-950">{reportSummary.totalSites}</div>
                          </div>

                          <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg">
                            <div className="text-[10px] font-bold text-emerald-800 uppercase">Total Access Points</div>
                            <div className="text-lg font-black font-mono text-emerald-700">{reportSummary.totalAps} APs</div>
                          </div>

                          <div className="p-2.5 bg-sky-50 border border-sky-300 rounded-lg">
                            <div className="text-[10px] font-bold text-sky-800 uppercase">Fiber (FOC) Sites</div>
                            <div className="text-lg font-black font-mono text-sky-700">{reportSummary.fiberCount}</div>
                          </div>

                          <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg">
                            <div className="text-[10px] font-bold text-amber-800 uppercase">Satellite (LEO) Sites</div>
                            <div className="text-lg font-black font-mono text-amber-700">{reportSummary.satCount}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5 text-center pt-1">
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs">
                            <span className="text-[10px] text-slate-500 block">Supplier 1 Controller:</span>
                            <strong className="text-blue-900 font-mono text-sm">{reportSummary.supp1Count} Sites</strong>
                          </div>

                          <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs">
                            <span className="text-[10px] text-slate-500 block">Supplier 2 Controller:</span>
                            <strong className="text-emerald-900 font-mono text-sm">{reportSummary.supp2Count} Sites</strong>
                          </div>

                          <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs">
                            <span className="text-[10px] text-slate-500 block">Schools & Colleges:</span>
                            <strong className="text-slate-900 font-mono text-sm">{reportSummary.schoolsCount} Facilities</strong>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section: Network Analytics & Sectoral Distribution */}
                    {includeAnalytics && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between border-b border-slate-300 pb-1">
                          <span>{analyticsSecNum}. Network Analytics & Sectoral Distribution</span>
                          <span className="text-[10px] text-emerald-800 font-semibold font-mono">
                            Health Index: {reportAnalytics.healthIndex}% Operational
                          </span>
                        </h4>

                        {/* 2-Column Analytics Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          
                          {/* Left Column: Sectoral / Target Beneficiary Distribution */}
                          <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                Sectoral Allocation Breakdown
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {reportAnalytics.totalSites} Total Sites
                              </span>
                            </div>

                            {/* Education Row */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="font-semibold text-slate-800">
                                  🎓 Education (Schools & HEIs)
                                </span>
                                <span className="font-mono font-bold text-blue-950">
                                  {reportAnalytics.education.count} Sites ({reportAnalytics.education.pct}%) • {reportAnalytics.education.aps} APs
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-blue-600 h-full rounded-full transition-all"
                                  style={{ width: `${reportAnalytics.education.pct}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-slate-500 font-mono pl-1">
                                <span>Elem: {reportAnalytics.education.elem}</span>
                                <span>High School: {reportAnalytics.education.high}</span>
                                <span>Colleges: {reportAnalytics.education.hei}</span>
                              </div>
                            </div>

                            {/* Governance Row */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="font-semibold text-slate-800">
                                  🏛️ Local Governance & Field Offices
                                </span>
                                <span className="font-mono font-bold text-indigo-950">
                                  {reportAnalytics.governance.count} Sites ({reportAnalytics.governance.pct}%) • {reportAnalytics.governance.aps} APs
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-indigo-600 h-full rounded-full transition-all"
                                  style={{ width: `${reportAnalytics.governance.pct}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-slate-500 font-mono pl-1">
                                <span>Municipal Halls: {reportAnalytics.governance.lgus}</span>
                                <span>Capitols: {reportAnalytics.governance.capitol}</span>
                                <span>DICT Offices: {reportAnalytics.governance.pfo}</span>
                              </div>
                            </div>

                            {/* Other / Public Convergence if any */}
                            {reportAnalytics.other.count > 0 && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px]">
                                  <span className="font-semibold text-slate-800">
                                    🌳 Public Plazas & Health Facilities
                                  </span>
                                  <span className="font-mono font-bold text-emerald-950">
                                    {reportAnalytics.other.count} Sites ({reportAnalytics.other.pct}%) • {reportAnalytics.other.aps} APs
                                  </span>
                                </div>
                                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-emerald-600 h-full rounded-full transition-all"
                                    style={{ width: `${reportAnalytics.other.pct}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Right Column: Infrastructure & Capacity Estimations */}
                          <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                Connectivity & Capacity Reach
                              </span>
                              <span className="text-[10px] text-emerald-700 font-bold font-mono">
                                {reportAnalytics.healthIndex}% Active Fleet
                              </span>
                            </div>

                            {/* Backhaul Segment Bar */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="font-semibold text-slate-800">
                                  Backhaul Medium (Fiber vs Satellite)
                                </span>
                                <span className="font-mono font-bold text-slate-900">
                                  FOC {reportAnalytics.fiber.pct}% | LEO {reportAnalytics.satellite.pct}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                                <div
                                  className="bg-sky-500 h-full transition-all"
                                  style={{ width: `${reportAnalytics.fiber.pct}%` }}
                                  title={`Fiber: ${reportAnalytics.fiber.count} sites`}
                                />
                                <div
                                  className="bg-amber-500 h-full transition-all"
                                  style={{ width: `${reportAnalytics.satellite.pct}%` }}
                                  title={`Satellite: ${reportAnalytics.satellite.count} sites`}
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                                <span>Fiber (FOC): {reportAnalytics.fiber.count} sites</span>
                                <span>Satellite (LEO): {reportAnalytics.satellite.count} sites</span>
                              </div>
                            </div>

                            {/* Capacity Metrics Mini Grid */}
                            <div className="grid grid-cols-2 gap-2 pt-0.5">
                              <div className="p-1.5 bg-white border border-slate-200 rounded">
                                <div className="text-[9px] text-slate-500 uppercase font-bold">Concurrent Capacity</div>
                                <div className="text-xs font-mono font-bold text-blue-900">
                                  ~{reportAnalytics.estConcurrentUsers.toLocaleString()} Users
                                </div>
                              </div>
                              <div className="p-1.5 bg-white border border-slate-200 rounded">
                                <div className="text-[9px] text-slate-500 uppercase font-bold">AP Deployment Density</div>
                                <div className="text-xs font-mono font-bold text-emerald-900">
                                  {reportAnalytics.avgApsPerSite} APs / Site
                                </div>
                              </div>
                              <div className="p-1.5 bg-white border border-slate-200 rounded">
                                <div className="text-[9px] text-slate-500 uppercase font-bold">Est. Daily Public Reach</div>
                                <div className="text-xs font-mono font-bold text-slate-900">
                                  ~{reportAnalytics.estDailyCitizenReach.toLocaleString()} Citizens/Day
                                </div>
                              </div>
                              <div className="p-1.5 bg-white border border-slate-200 rounded">
                                <div className="text-[9px] text-slate-500 uppercase font-bold">Fleet Management</div>
                                <div className="text-xs font-mono font-bold text-indigo-900">
                                  S1: {reportAnalytics.supplier1.count} | S2: {reportAnalytics.supplier2.count}
                                </div>
                              </div>
                            </div>

                          </div>

                        </div>

                        {/* Strategic Analytical Insights & Highlights Callout */}
                        <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-950 flex items-center gap-1">
                            <span>📌 Key Analytical Findings & Operational Takeaways:</span>
                          </div>
                          <ul className="text-[10px] text-slate-700 space-y-0.5 list-disc pl-4 leading-relaxed">
                            <li>
                              <strong>Educational Priority:</strong> Academic institutions constitute <strong>{reportAnalytics.education.pct}%</strong> ({reportAnalytics.education.count} facilities) of all sites, deploying <strong>{reportAnalytics.education.aps} access points</strong> to empower students and faculty.
                            </li>
                            <li>
                              <strong>GIDA & Satellite Resilience:</strong> Satellite (LEO) backhaul empowers <strong>{reportAnalytics.satellite.count} remote sites ({reportAnalytics.satellite.pct}%)</strong>, ensuring continuous broadband in geographically isolated areas where terrestrial fiber is unfeasible.
                            </li>
                            <li>
                              <strong>Provincial Reach & Footprint:</strong> The deployment provides an aggregate concurrent capacity of <strong>~{reportAnalytics.estConcurrentUsers.toLocaleString()} citizens</strong> across <strong>{municipalitiesList.length} LGUs</strong>, anchored by key regional population centers in {reportAnalytics.top3Mun || "the province"}.
                            </li>
                          </ul>
                        </div>

                      </div>
                    )}

                    {/* Section: Municipal Density Matrix */}
                    {includeMunicipalMatrix && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-300 pb-1">
                          <span>{municipalSecNum}. Municipal Distribution Matrix</span>
                        </h4>

                        <table className="w-full text-left text-[11px] border border-slate-300">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 uppercase text-[9px]">
                            <tr>
                              <th className="p-1.5 pl-2">City / Municipality</th>
                              <th className="p-1.5 text-center">Sites</th>
                              <th className="p-1.5 text-center text-emerald-800">Total APs</th>
                              <th className="p-1.5 text-center">Fiber (FOC)</th>
                              <th className="p-1.5 text-center">Satellite (LEO)</th>
                              <th className="p-1.5 text-center">Schools</th>
                              <th className="p-1.5 text-center">LGU Halls</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {reportMunData.slice(0, 8).map((m) => (
                              <tr key={m.municipality} className="hover:bg-slate-50">
                                <td className="p-1.5 pl-2 font-bold text-slate-900">{m.municipality}</td>
                                <td className="p-1.5 text-center font-mono font-bold">{m.totalSites}</td>
                                <td className="p-1.5 text-center font-mono font-bold text-emerald-700 bg-emerald-50/50">{m.totalAps}</td>
                                <td className="p-1.5 text-center font-mono">{m.focCount}</td>
                                <td className="p-1.5 text-center font-mono">{m.leoCount}</td>
                                <td className="p-1.5 text-center font-mono">{m.schoolCount}</td>
                                <td className="p-1.5 text-center font-mono">{m.lguCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {reportMunData.length > 8 && (
                          <div className="text-[10px] text-slate-500 italic text-right">
                            * Showing top 8 LGUs. Complete roster available in Excel export.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section: Detailed Site Telemetry Table */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between border-b border-slate-300 pb-1">
                        <span>{siteListSecNum}. Public Hotspot Site Inventory & Live Telemetry</span>
                        <span className="text-[10px] text-slate-500 font-mono">Total Listed: {reportSites.length}</span>
                      </h4>

                      <table className="w-full text-left text-[10px] border border-slate-300">
                        <thead className="bg-[#0F172A] text-white font-bold border-b border-slate-400 uppercase text-[9px]">
                          <tr>
                            <th className="p-1.5 text-center w-8">#</th>
                            <th className="p-1.5">Site / Location Name</th>
                            <th className="p-1.5">LGU & Barangay</th>
                            <th className="p-1.5">Facility Type</th>
                            <th className="p-1.5 text-center">APs</th>
                            {includeHardware && <th className="p-1.5">Hardware / Router</th>}
                            {includeHardware && <th className="p-1.5">Public WAN IP</th>}
                            <th className="p-1.5 text-center">Controller</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {reportSites.map((site, index) => {
                            const sAny = site as any;
                            const typeCfg = getSiteTypeConfig(site.siteType);
                            const isSupp1 = (sAny.omadaSupplier || "").includes("1");

                            return (
                              <tr key={site.id || index} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                <td className="p-1.5 text-center font-mono text-slate-500">{index + 1}</td>
                                <td className="p-1.5 font-bold text-slate-900">
                                  <div>{site.locationName}</div>
                                  <div className="text-[9px] text-slate-500 font-mono">ID: #{site.nationwideId || "—"}</div>
                                </td>
                                <td className="p-1.5">
                                  <div className="font-semibold text-slate-800">{site.municipality}</div>
                                  <div className="text-[9px] text-slate-500">{site.barangay}</div>
                                </td>
                                <td className="p-1.5">
                                  <span className="font-semibold text-slate-700">{typeCfg.shortLabel}</span>
                                </td>
                                <td className="p-1.5 text-center font-mono font-bold text-emerald-800">
                                  {site.apCount || 2}
                                </td>
                                {includeHardware && (
                                  <td className="p-1.5 font-mono text-[9px] text-blue-900">
                                    <div>{sAny.omadaRouterModel || "ER605"}</div>
                                    <div className="text-slate-500">{sAny.omadaApModels || "EAP225-Outdoor"}</div>
                                  </td>
                                )}
                                {includeHardware && (
                                  <td className="p-1.5 font-mono text-[9px] text-slate-700">
                                    {sAny.omadaPublicIp || "—"}
                                  </td>
                                )}
                                <td className="p-1.5 text-center">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono uppercase ${
                                      isSupp1 ? "bg-blue-100 text-blue-900" : "bg-emerald-100 text-emerald-900"
                                    }`}
                                  >
                                    {sAny.omadaSupplier || "Omada"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
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
                <div>DICT Monitoring System v2.0 • Free Wi-Fi 4 All Telemetry Roster</div>
                <div>Generated: {new Date().toISOString()}</div>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
