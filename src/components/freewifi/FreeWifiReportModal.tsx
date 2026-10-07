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
  HardDrive,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Cpu,
  Cable,
  Satellite
} from "lucide-react";
import {
  FreeWifiSite,
  SITE_TYPE_CONFIG,
  getSiteTypeConfig,
  getLinkTypeConfig,
  getMunicipalityDistribution,
  getFreeWifiSummary,
  isSupplier1Site,
  isSupplier2Site,
} from "@/data/freewifiData";
import { exportFreeWifiToExcel, printFreeWifiReport, getSiteOperationalStatus } from "@/utils/freewifiReportGenerator";

interface FreeWifiReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: FreeWifiSite[];
  supplier1Name?: string;
  supplier2Name?: string;
}

export function FreeWifiReportModal({
  isOpen,
  onClose,
  sites,
  supplier1Name = "Supplier 1",
  supplier2Name = "Supplier 2",
}: FreeWifiReportModalProps) {
  const [reportTitle, setReportTitle] = useState("FREE WIFI 4 ALL  OPERATIONAL REPORT");
  const [reportSubtitle, setReportSubtitle] = useState("DICT Region V (Bicol) - Provincial Monitoring, Fleet Health & Omada Northbound Telemetry");
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
  const [rowDisplayLimit, setRowDisplayLimit] = useState<number>(0); // 0 = all

  // Section Visibility Options
  const [includeKpis, setIncludeKpis] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeSupplierComparison, setIncludeSupplierComparison] = useState(true);
  const [includeSectoralChart, setIncludeSectoralChart] = useState(true);
  const [includeMunicipalMatrix, setIncludeMunicipalMatrix] = useState(true);
  const [includeSiteRoster, setIncludeSiteRoster] = useState(true);
  const [includeHardware, setIncludeHardware] = useState(true);
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
        if (selectedSupplier === "supplier1" && !isSupplier1Site(s, supplier2Name)) return false;
        if (selectedSupplier === "supplier2" && !isSupplier2Site(s, supplier2Name)) return false;
      }
      
      if (selectedSiteType !== "ALL" && s.siteType !== selectedSiteType) return false;
      
      if (selectedLinkType !== "ALL") {
        const linkStr = (s.linkType || "").toLowerCase();
        if (selectedLinkType === "FOC" && !(linkStr.includes("fiber") || linkStr === "foc")) return false;
        if (selectedLinkType === "LEO" && !(linkStr.includes("sat") || linkStr.includes("leo") || linkStr.includes("vsat"))) return false;
      }

      if (selectedStatus !== "ALL") {
        const opStatus = getSiteOperationalStatus(s);
        if (opStatus !== selectedStatus) return false;
      }

      return true;
    });
  }, [sites, selectedMunicipality, selectedSupplier, selectedSiteType, selectedLinkType, selectedStatus, supplier2Name]);

  // KPIs & Health Summary
  const reportSummary = useMemo(() => {
    const totalSites = reportSites.length;
    const totalAps = reportSites.reduce((sum, s) => sum + (s.apCount || 0), 0);
    
    const onlineSites = reportSites.filter((s) => getSiteOperationalStatus(s) === "Online").length;
    const degradedSites = reportSites.filter((s) => getSiteOperationalStatus(s) === "Degraded").length;
    const offlineSites = reportSites.filter((s) => getSiteOperationalStatus(s) === "Offline").length;
    const availabilityRate = totalSites > 0 ? Math.round(((onlineSites + degradedSites * 0.5) / totalSites) * 100) : 100;

    const fiberCount = reportSites.filter((s) => (s.linkType || "").toLowerCase().includes("fiber") || s.linkType === "FOC").length;
    const satCount = reportSites.filter((s) => (s.linkType || "").toLowerCase().includes("satellite") || s.linkType === "LEO").length;
    
    const s1Sites = reportSites.filter((s) => isSupplier1Site(s, supplier2Name));
    const s2Sites = reportSites.filter((s) => isSupplier2Site(s, supplier2Name));

    const s1Online = s1Sites.filter(s => getSiteOperationalStatus(s) === "Online").length;
    const s1Offline = s1Sites.filter(s => getSiteOperationalStatus(s) === "Offline").length;
    const s1Aps = s1Sites.reduce((sum, s) => sum + (s.apCount || 0), 0);

    const s2Online = s2Sites.filter(s => getSiteOperationalStatus(s) === "Online").length;
    const s2Offline = s2Sites.filter(s => getSiteOperationalStatus(s) === "Offline").length;
    const s2Aps = s2Sites.reduce((sum, s) => sum + (s.apCount || 0), 0);

    const schoolsCount = reportSites.filter((s) => s.siteType === "PES" || s.siteType === "PHS" || s.siteType === "HEI-LUC").length;
    const lgusCount = reportSites.filter((s) => s.siteType === "LGU-HALL" || s.siteType === "PC" || s.siteType === "PFO").length;

    return {
      totalSites,
      totalAps,
      onlineSites,
      degradedSites,
      offlineSites,
      availabilityRate,
      fiberCount,
      satCount,
      s1: {
        total: s1Sites.length,
        online: s1Online,
        offline: s1Offline,
        aps: s1Aps,
        pct: totalSites > 0 ? Math.round((s1Sites.length / totalSites) * 100) : 0,
      },
      s2: {
        total: s2Sites.length,
        online: s2Online,
        offline: s2Offline,
        aps: s2Aps,
        pct: totalSites > 0 ? Math.round((s2Sites.length / totalSites) * 100) : 0,
      },
      schoolsCount,
      lgusCount,
    };
  }, [reportSites]);

  // Deep Sectoral & Capacity Analytics
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

    // Estimated capacity
    const avgApsPerSite = reportSites.length > 0 ? (totalAps / reportSites.length).toFixed(1) : "0";
    const estConcurrentUsers = totalAps * 45;
    const estDailyCitizenReach = reportSites.reduce((sum, s) => sum + (s.estimatedDailyUsers || (s.apCount || 2) * 120), 0);

    // Top Municipalities
    const munCounts = getMunicipalityDistribution(reportSites);
    const top5Mun = munCounts.slice(0, 5);

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
        aps: fiberSites.reduce((sum, s) => sum + (s.apCount || 0), 0),
      },
      satellite: {
        count: satSites.length,
        pct: satPct,
        aps: satSites.reduce((sum, s) => sum + (s.apCount || 0), 0),
      },
      avgApsPerSite,
      estConcurrentUsers,
      estDailyCitizenReach,
      top5Mun,
    };
  }, [reportSites]);

  // Municipal density data
  const reportMunData = useMemo(() => {
    return getMunicipalityDistribution(reportSites);
  }, [reportSites]);

  // Sliced sites for table display
  const displayedSites = useMemo(() => {
    if (rowDisplayLimit > 0) {
      return reportSites.slice(0, rowDisplayLimit);
    }
    return reportSites;
  }, [reportSites, rowDisplayLimit]);

  if (!isOpen) return null;

  // Trigger Excel Export
  const handleExportExcel = () => {
    exportFreeWifiToExcel(reportSites, {
      reportTitle,
      reportSubtitle,
      preparedBy,
      designation,
      approvedBy,
      approvedDesignation,
      supplier1Name,
      supplier2Name,
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
      <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Top Header */}
        <div className="px-6 py-3.5 border-b border-[#18233C] flex items-center justify-between bg-[#111728]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Free Wi-Fi 4 All Executive Telemetry & Analytics Report</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  {reportSites.length} Sites Selected
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {reportSummary.onlineSites} Online
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Official high-fidelity report featuring Omada fleet telemetry, charts, visual distribution, and certification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Multi-Sheet Excel</span>
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
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Report Customizer</h4>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-slate-400">Report Document Title</label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Scope Filters */}
            <div className="space-y-3 pt-2 border-t border-[#18233C]/60">
              <span className="text-[11px] font-bold text-slate-300 block">Scope & Target Filters</span>

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
                <label className="block text-[10px] text-slate-400 mb-1">Omada Controller / Fleet</label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Fleets ({supplier1Name} & {supplier2Name})</option>
                  <option value="supplier1">{supplier1Name} Fleet</option>
                  <option value="supplier2">{supplier2Name} Fleet</option>
                </select>
              </div>

              {/* Online Status */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Operational Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Statuses (Online, Degraded, Offline)</option>
                  <option value="Online">🟢 Online Sites Only ({sites.filter(s => getSiteOperationalStatus(s) === 'Online').length})</option>
                  <option value="Degraded">🟡 Degraded Sites Only ({sites.filter(s => getSiteOperationalStatus(s) === 'Degraded').length})</option>
                  <option value="Offline">🔴 Offline Sites Only ({sites.filter(s => getSiteOperationalStatus(s) === 'Offline').length})</option>
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
                <label className="block text-[10px] text-slate-400 mb-1">Backhaul Medium</label>
                <select
                  value={selectedLinkType}
                  onChange={(e) => setSelectedLinkType(e.target.value)}
                  className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Backhaul Types</option>
                  <option value="FOC">Fiber Optic (FOC)</option>
                  <option value="LEO">Satellite (LEO / VSAT)</option>
                </select>
              </div>

              {/* Row Limit */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Site Table Print Limit</label>
                <select
                  value={rowDisplayLimit}
                  onChange={(e) => setRowDisplayLimit(Number(e.target.value))}
                  className="w-full bg-[#0C101D] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value={0}>Show All Selected ({reportSites.length} Sites)</option>
                  <option value={20}>Top 20 Sites (Compact Executive)</option>
                  <option value={50}>Top 50 Sites</option>
                  <option value={100}>Top 100 Sites</option>
                </select>
              </div>
            </div>

            {/* Sections Inclusion Toggles */}
            <div className="space-y-2 pt-2 border-t border-[#18233C]/60">
              <span className="text-[11px] font-bold text-slate-300 block">Report Sections & Modules</span>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeKpis}
                  onChange={(e) => setIncludeKpis(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Executive Summary & Fleet KPIs</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCharts}
                  onChange={(e) => setIncludeCharts(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Visual SVG Charts & Analytics</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSupplierComparison}
                  onChange={(e) => setIncludeSupplierComparison(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>{supplier1Name} vs {supplier2Name} Fleet Matrix</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSectoralChart}
                  onChange={(e) => setIncludeSectoralChart(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Sectoral & Backhaul Breakdown</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMunicipalMatrix}
                  onChange={(e) => setIncludeMunicipalMatrix(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Municipal Density Distribution</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSiteRoster}
                  onChange={(e) => setIncludeSiteRoster(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Site Telemetry & Inventory Roster</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeHardware}
                  onChange={(e) => setIncludeHardware(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Hardware Models & Public WAN IP</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSignatures}
                  onChange={(e) => setIncludeSignatures(e.target.checked)}
                  className="rounded border-[#1C2844] bg-[#0C101D] text-blue-600 focus:ring-blue-500"
                />
                <span>Official Certification & Signatures</span>
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
          <div className="flex-1 bg-[#0a0e1a] p-4 sm:p-6 overflow-y-auto custom-scrollbar">
            
            {/* The Printable Page Sheet (A4 Styled) */}
            <div
              ref={printableRef}
              className="w-full max-w-[880px] mx-auto bg-white text-slate-900 rounded-lg p-8 shadow-2xl space-y-6 font-sans border border-slate-200 min-h-full"
              style={{ backgroundColor: "#ffffff" }}
            >
              
              {/* Official Header with Dual Official Logos (DICT & Bagong Pilipinas) */}
              <div className="border-b-2 border-[#0F172A] pb-4 flex items-center justify-between gap-4 bg-white">
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
                      Regional Office V (Bicol Region)
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right text-[10px] leading-tight text-slate-600 hidden sm:block">
                    <div className="font-bold text-slate-900 uppercase tracking-wide">DATE GENERATED:</div>
                    <div className="font-mono text-[10px] text-slate-600 mt-0.5">{currentDateFormatted}</div>
                    <div className="text-[9px] text-blue-800 font-semibold mt-0.5 tracking-wider font-mono">REF: DICT-R5-FW4A-OPS</div>
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
                const chartsSecNum = includeCharts ? secCount++ : null;
                const supplierSecNum = includeSupplierComparison ? secCount++ : null;
                const sectoralSecNum = includeSectoralChart ? secCount++ : null;
                const municipalSecNum = includeMunicipalMatrix ? secCount++ : null;
                const siteListSecNum = includeSiteRoster ? secCount++ : null;

                // SVG Donut calculation for Online/Degraded/Offline
                const tot = reportSummary.totalSites || 1;
                const onPct = Math.round((reportSummary.onlineSites / tot) * 100);
                const degPct = Math.round((reportSummary.degradedSites / tot) * 100);
                const offPct = Math.round((reportSummary.offlineSites / tot) * 100);
                
                // Circumference = 2 * PI * r = 2 * 3.14159 * 36 = 226.2
                const c = 226.2;
                const strokeOnline = (onPct / 100) * c;
                const strokeDegraded = (degPct / 100) * c;
                const strokeOffline = (offPct / 100) * c;
                const offsetOnline = 0;
                const offsetDegraded = -strokeOnline;
                const offsetOffline = -(strokeOnline + strokeDegraded);

                return (
                  <>
                    {/* Section 1: Executive KPI Summary */}
                    {includeKpis && (
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between border-b border-slate-300 pb-1">
                          <span>{kpiSecNum}. Executive Summary & Fleet Health Metrics</span>
                          <span className="text-[10px] text-slate-600 font-mono">
                            Scope: {selectedMunicipality === "ALL" ? "Regional Fleet" : selectedMunicipality}
                          </span>
                        </h4>

                        {/* Top 4 KPI Cards */}
                        <div className="grid grid-cols-4 gap-2.5 text-center">
                          <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-lg">
                            <div className="text-[10px] font-bold text-slate-600 uppercase">Total Sites</div>
                            <div className="text-xl font-black font-mono text-slate-900">{reportSummary.totalSites}</div>
                            <div className="text-[9px] text-slate-500 font-mono mt-0.5">S1: {reportSummary.s1.total} | S2: {reportSummary.s2.total}</div>
                          </div>

                          <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg">
                            <div className="text-[10px] font-bold text-emerald-800 uppercase flex items-center justify-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>Online Sites</span>
                            </div>
                            <div className="text-xl font-black font-mono text-emerald-700">{reportSummary.onlineSites}</div>
                            <div className="text-[9px] text-emerald-700 font-mono mt-0.5">
                              {tot > 0 ? Math.round((reportSummary.onlineSites / tot) * 100) : 0}% Fleet Online
                            </div>
                          </div>

                          <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg">
                            <div className="text-[10px] font-bold text-amber-800 uppercase flex items-center justify-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <span>Degraded / Warning</span>
                            </div>
                            <div className="text-xl font-black font-mono text-amber-700">{reportSummary.degradedSites}</div>
                            <div className="text-[9px] text-amber-700 font-mono mt-0.5">
                              Partial AP Reach
                            </div>
                          </div>

                          <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg">
                            <div className="text-[10px] font-bold text-rose-800 uppercase flex items-center justify-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              <span>Offline Sites</span>
                            </div>
                            <div className="text-xl font-black font-mono text-rose-700">{reportSummary.offlineSites}</div>
                            <div className="text-[9px] text-rose-700 font-mono mt-0.5">
                              Requires Field Dispatch
                            </div>
                          </div>
                        </div>

                        {/* Secondary 4 KPI Cards */}
                        <div className="grid grid-cols-4 gap-2.5 text-center pt-0.5">
                          <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                            <span className="text-[10px] text-blue-800 block uppercase font-bold">Total Access Points</span>
                            <strong className="text-blue-950 font-mono text-base">{reportSummary.totalAps} APs</strong>
                            <span className="text-[9px] text-blue-700 block font-mono">Avg {reportAnalytics.avgApsPerSite} APs/site</span>
                          </div>

                          <div className="p-2 bg-sky-50 border border-sky-200 rounded text-xs">
                            <span className="text-[10px] text-sky-800 block uppercase font-bold">Fiber (FOC) Sites</span>
                            <strong className="text-sky-950 font-mono text-base">{reportSummary.fiberCount} Sites</strong>
                            <span className="text-[9px] text-sky-700 block font-mono">{reportAnalytics.fiber.pct}% of deployment</span>
                          </div>

                          <div className="p-2 bg-purple-50 border border-purple-200 rounded text-xs">
                            <span className="text-[10px] text-purple-800 block uppercase font-bold">Satellite (LEO)</span>
                            <strong className="text-purple-950 font-mono text-base">{reportSummary.satCount} Sites</strong>
                            <span className="text-[9px] text-purple-700 block font-mono">{reportAnalytics.satellite.pct}% GIDA coverage</span>
                          </div>

                          <div className="p-2 bg-indigo-50 border border-indigo-200 rounded text-xs">
                            <span className="text-[10px] text-indigo-800 block uppercase font-bold">Fleet Health Index</span>
                            <strong className="text-indigo-950 font-mono text-base">{reportSummary.availabilityRate}%</strong>
                            <span className="text-[9px] text-indigo-700 block font-mono">Availability Score</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section: Visual SVG Charts & Analytics Breakdown */}
                    {includeCharts && (
                      <div className="space-y-3 pt-1">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between border-b border-slate-300 pb-1">
                          <span>{chartsSecNum}. Network Visual Telemetry & Fleet Distribution</span>
                          <span className="text-[10px] text-emerald-800 font-bold font-mono">
                            {reportSummary.onlineSites} of {reportSummary.totalSites} Sites Active
                          </span>
                        </h4>

                        {/* Chart Grid: Donut + Bar Analytics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          
                          {/* Left Chart: Operational Status Donut Chart */}
                          <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg space-y-2.5">
                            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                                📊 Fleet Operational Status Ratio
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {reportSummary.totalSites} Monitored
                              </span>
                            </div>

                            <div className="flex items-center justify-around gap-2 pt-1">
                              {/* Vector SVG Donut Chart */}
                              <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                  {/* Background ring */}
                                  <circle cx="50" cy="50" r="36" fill="transparent" stroke="#E2E8F0" strokeWidth="16" />
                                  {/* Online Segment (Green) */}
                                  <circle
                                    cx="50"
                                    cy="50"
                                    r="36"
                                    fill="transparent"
                                    stroke="#10B981"
                                    strokeWidth="16"
                                    strokeDasharray={`${strokeOnline} ${c}`}
                                    strokeDashoffset={offsetOnline}
                                  />
                                  {/* Degraded Segment (Amber) */}
                                  <circle
                                    cx="50"
                                    cy="50"
                                    r="36"
                                    fill="transparent"
                                    stroke="#F59E0B"
                                    strokeWidth="16"
                                    strokeDasharray={`${strokeDegraded} ${c}`}
                                    strokeDashoffset={offsetDegraded}
                                  />
                                  {/* Offline Segment (Rose) */}
                                  <circle
                                    cx="50"
                                    cy="50"
                                    r="36"
                                    fill="transparent"
                                    stroke="#EF4444"
                                    strokeWidth="16"
                                    strokeDasharray={`${strokeOffline} ${c}`}
                                    strokeDashoffset={offsetOffline}
                                  />
                                </svg>
                                <div className="absolute flex flex-col items-center justify-center text-center">
                                  <span className="text-base font-black font-mono text-slate-900 leading-none">{onPct}%</span>
                                  <span className="text-[8px] font-bold uppercase text-slate-500 mt-0.5">Online</span>
                                </div>
                              </div>

                              {/* Donut Legend */}
                              <div className="space-y-1.5 text-xs flex-1 pl-2">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                    <span>Online Fleet</span>
                                  </span>
                                  <span className="font-mono font-bold text-emerald-800">{reportSummary.onlineSites} ({onPct}%)</span>
                                </div>

                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                                    <span>Degraded / Partial</span>
                                  </span>
                                  <span className="font-mono font-bold text-amber-800">{reportSummary.degradedSites} ({degPct}%)</span>
                                </div>

                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                                    <span>Offline</span>
                                  </span>
                                  <span className="font-mono font-bold text-rose-800">{reportSummary.offlineSites} ({offPct}%)</span>
                                </div>

                                <div className="pt-1 border-t border-slate-200 flex justify-between text-[9px] text-slate-500 font-mono">
                                  <span>Total APs Deployed:</span>
                                  <span className="font-bold text-slate-700">{reportSummary.totalAps} APs</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right Chart: Capacity & Citizen Reach Metrics */}
                          <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg space-y-2.5">
                            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                                📈 Citizen Reach & Bandwidth Capacity
                              </span>
                              <span className="text-[10px] text-indigo-700 font-bold font-mono">
                                45 users/AP Avg
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                              <div className="p-2 bg-white border border-slate-200 rounded">
                                <span className="text-[9px] text-slate-500 font-bold uppercase block">Est. Concurrent Users</span>
                                <div className="text-sm font-black font-mono text-blue-900 mt-0.5">
                                  ~{reportAnalytics.estConcurrentUsers.toLocaleString()}
                                </div>
                                <span className="text-[8px] text-slate-400">Peak broadband load</span>
                              </div>

                              <div className="p-2 bg-white border border-slate-200 rounded">
                                <span className="text-[9px] text-slate-500 font-bold uppercase block">Est. Daily Reach</span>
                                <div className="text-sm font-black font-mono text-emerald-900 mt-0.5">
                                  ~{reportAnalytics.estDailyCitizenReach.toLocaleString()}
                                </div>
                                <span className="text-[8px] text-slate-400">Citizens & students/day</span>
                              </div>

                              <div className="p-2 bg-white border border-slate-200 rounded">
                                <span className="text-[9px] text-slate-500 font-bold uppercase block">AP Deployment Density</span>
                                <div className="text-sm font-black font-mono text-indigo-900 mt-0.5">
                                  {reportAnalytics.avgApsPerSite} APs / Site
                                </div>
                                <span className="text-[8px] text-slate-400">Outdoor + Indoor mix</span>
                              </div>

                              <div className="p-2 bg-white border border-slate-200 rounded">
                                <span className="text-[9px] text-slate-500 font-bold uppercase block">Municipalities Covered</span>
                                <div className="text-sm font-black font-mono text-purple-900 mt-0.5">
                                  {municipalitiesList.length} LGUs
                                </div>
                                <span className="text-[8px] text-slate-400">Regional coverage</span>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* Section: Supplier 1 vs Supplier 2 Comparative Matrix */}
                    {includeSupplierComparison && (
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between border-b border-slate-300 pb-1">
                          <span>{supplierSecNum}. Supplier Fleet Comparison ({supplier1Name} vs {supplier2Name})</span>
                          <span className="text-[10px] text-slate-600 font-mono">
                            Omada Northbound API Telemetry
                          </span>
                        </h4>

                        <div className="grid grid-cols-2 gap-3.5 text-xs">
                          {/* Supplier 1 Box */}
                          <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2">
                            <div className="flex items-center justify-between pb-1 border-b border-blue-200">
                              <span className="font-bold text-blue-950 text-xs">
                                📡 {supplier1Name} Fleet
                              </span>
                              <span className="font-mono font-bold px-1.5 py-0.5 bg-blue-100 text-blue-900 rounded text-[9px]">
                                {reportSummary.s1.total} Sites ({reportSummary.s1.pct}%)
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                              <div className="p-1.5 bg-white border border-blue-100 rounded">
                                <div className="text-slate-500">Online</div>
                                <div className="font-bold text-emerald-700 font-mono text-xs">{reportSummary.s1.online}</div>
                              </div>
                              <div className="p-1.5 bg-white border border-blue-100 rounded">
                                <div className="text-slate-500">Offline</div>
                                <div className="font-bold text-rose-700 font-mono text-xs">{reportSummary.s1.offline}</div>
                              </div>
                              <div className="p-1.5 bg-white border border-blue-100 rounded">
                                <div className="text-slate-500">Total APs</div>
                                <div className="font-bold text-blue-900 font-mono text-xs">{reportSummary.s1.aps}</div>
                              </div>
                            </div>

                            <div className="text-[9px] text-slate-600">
                              Primary Controller Fleet for Region V Albay Free Wi-Fi Operations.
                            </div>
                          </div>

                          {/* Supplier 2 Box */}
                          <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-2">
                            <div className="flex items-center justify-between pb-1 border-b border-emerald-200">
                              <span className="font-bold text-emerald-950 text-xs">
                                🌐 {supplier2Name} Fleet
                              </span>
                              <span className="font-mono font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-900 rounded text-[9px]">
                                {reportSummary.s2.total} Sites ({reportSummary.s2.pct}%)
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                              <div className="p-1.5 bg-white border border-emerald-100 rounded">
                                <div className="text-slate-500">Online</div>
                                <div className="font-bold text-emerald-700 font-mono text-xs">{reportSummary.s2.online}</div>
                              </div>
                              <div className="p-1.5 bg-white border border-emerald-100 rounded">
                                <div className="text-slate-500">Offline</div>
                                <div className="font-bold text-rose-700 font-mono text-xs">{reportSummary.s2.offline}</div>
                              </div>
                              <div className="p-1.5 bg-white border border-emerald-100 rounded">
                                <div className="text-slate-500">Total APs</div>
                                <div className="font-bold text-emerald-900 font-mono text-xs">{reportSummary.s2.aps}</div>
                              </div>
                            </div>

                            <div className="text-[9px] text-slate-600">
                              Primary Controller Fleet for Region V Albay Free Wi-Fi Operations.
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section: Sectoral & Backhaul Allocation Breakdown */}
                    {includeSectoralChart && (
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between border-b border-slate-300 pb-1">
                          <span>{sectoralSecNum}. Sectoral Allocation & Backhaul Infrastructure</span>
                          <span className="text-[10px] text-slate-600 font-mono">
                            {reportAnalytics.education.count} Schools • {reportAnalytics.governance.count} LGUs
                          </span>
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                          {/* Left: Sectoral Breakdown Bars */}
                          <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg space-y-2.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">
                              Target Beneficiary Sector Allocation
                            </span>

                            {/* Education */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="font-semibold text-slate-800">🎓 Basic & Higher Education</span>
                                <span className="font-mono font-bold text-blue-950">
                                  {reportAnalytics.education.count} Sites ({reportAnalytics.education.pct}%) • {reportAnalytics.education.aps} APs
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-blue-600 h-full rounded-full"
                                  style={{ width: `${reportAnalytics.education.pct}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                                <span>Elem: {reportAnalytics.education.elem}</span>
                                <span>High School: {reportAnalytics.education.high}</span>
                                <span>Colleges: {reportAnalytics.education.hei}</span>
                              </div>
                            </div>

                            {/* Governance */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="font-semibold text-slate-800">🏛️ Local Governance & Field Offices</span>
                                <span className="font-mono font-bold text-indigo-950">
                                  {reportAnalytics.governance.count} Sites ({reportAnalytics.governance.pct}%) • {reportAnalytics.governance.aps} APs
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-indigo-600 h-full rounded-full"
                                  style={{ width: `${reportAnalytics.governance.pct}%` }}
                                />
                              </div>
                            </div>

                            {/* Plazas / Public */}
                            {reportAnalytics.other.count > 0 && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px]">
                                  <span className="font-semibold text-slate-800">🌳 Public Plazas & Health Facilities</span>
                                  <span className="font-mono font-bold text-emerald-950">
                                    {reportAnalytics.other.count} Sites ({reportAnalytics.other.pct}%) • {reportAnalytics.other.aps} APs
                                  </span>
                                </div>
                                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-emerald-600 h-full rounded-full"
                                    style={{ width: `${reportAnalytics.other.pct}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Right: Backhaul Distribution */}
                          <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg space-y-2.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">
                              Backhaul Transmission Medium
                            </span>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="font-semibold text-slate-800">Fiber Optic (FOC) vs Satellite (LEO)</span>
                                <span className="font-mono font-bold text-slate-900">
                                  FOC {reportAnalytics.fiber.pct}% | LEO {reportAnalytics.satellite.pct}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                                <div
                                  className="bg-sky-500 h-full"
                                  style={{ width: `${reportAnalytics.fiber.pct}%` }}
                                />
                                <div
                                  className="bg-purple-500 h-full"
                                  style={{ width: `${reportAnalytics.satellite.pct}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-slate-600 font-mono pt-1">
                                <span>Fiber (FOC): <strong>{reportAnalytics.fiber.count} sites</strong> ({reportAnalytics.fiber.aps} APs)</span>
                                <span>Satellite (LEO): <strong>{reportAnalytics.satellite.count} sites</strong> ({reportAnalytics.satellite.aps} APs)</span>
                              </div>
                            </div>

                            <div className="p-2 bg-white border border-slate-200 rounded text-[9px] text-slate-600 space-y-1">
                              <div><strong>Fiber (FOC):</strong> High-capacity terrestrial broadband for city centers and school campuses.</div>
                              <div><strong>Satellite (LEO):</strong> Low Earth Orbit Starlink/VSAT for geographically isolated island LGUs.</div>
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
                              <strong>Educational Priority:</strong> Academic facilities account for <strong>{reportAnalytics.education.pct}%</strong> ({reportAnalytics.education.count} sites) of active deployments, delivering <strong>{reportAnalytics.education.aps} high-density access points</strong>.
                            </li>
                            <li>
                              <strong>GIDA Resilience:</strong> Satellite backhaul powers <strong>{reportAnalytics.satellite.count} remote sites ({reportAnalytics.satellite.pct}%)</strong>, maintaining critical emergency connectivity in island and mountainous municipalities.
                            </li>
                            <li>
                              <strong>Fleet Health:</strong> Overall fleet availability stands at <strong>{reportSummary.availabilityRate}%</strong> with <strong>{reportSummary.onlineSites} sites currently online</strong> transmitting real-time Omada telemetry.
                            </li>
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Section: Municipal Density Matrix */}
                    {includeMunicipalMatrix && (
                      <div className="space-y-2 bg-white">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between border-b border-slate-300 pb-1">
                          <span>{municipalSecNum}. Municipal Distribution & Density Matrix</span>
                          <span className="text-[10px] text-slate-500 font-mono">Showing Top Municipalities</span>
                        </h4>

                        <table className="w-full text-left text-[11px] border border-slate-300 bg-white">
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
                          <tbody className="divide-y divide-slate-200 bg-white">
                            {reportMunData.slice(0, 10).map((m) => (
                              <tr key={m.municipality} className="hover:bg-slate-50 bg-white">
                                <td className="p-1.5 pl-2 font-bold text-slate-900">{m.municipality}</td>
                                <td className="p-1.5 text-center font-mono font-bold text-slate-800">{m.totalSites}</td>
                                <td className="p-1.5 text-center font-mono font-bold text-emerald-700 bg-emerald-50/50">{m.totalAps}</td>
                                <td className="p-1.5 text-center font-mono text-slate-700">{m.focCount}</td>
                                <td className="p-1.5 text-center font-mono text-slate-700">{m.leoCount}</td>
                                <td className="p-1.5 text-center font-mono text-slate-700">{m.schoolCount}</td>
                                <td className="p-1.5 text-center font-mono text-slate-700">{m.lguCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {reportMunData.length > 10 && (
                          <div className="text-[10px] text-slate-500 italic text-right">
                            * Showing top 10 LGUs. Complete roster available in multi-sheet Excel export.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section: Detailed Site Telemetry Table */}
                    {includeSiteRoster && (
                      <div className="space-y-2 bg-white">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between border-b border-slate-300 pb-1">
                          <span>{siteListSecNum}. Public Hotspot Site Inventory & Live Telemetry</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Displaying {displayedSites.length} of {reportSites.length} Sites
                          </span>
                        </h4>

                        <table className="w-full text-left text-[10px] border border-slate-300 bg-white">
                          <thead className="bg-[#0F172A] text-white font-bold border-b border-slate-400 uppercase text-[9px]">
                            <tr>
                              <th className="p-1.5 text-center w-8">#</th>
                              <th className="p-1.5">Site / Location Name</th>
                              <th className="p-1.5">LGU & Barangay</th>
                              <th className="p-1.5">Facility Type</th>
                              <th className="p-1.5 text-center">Status</th>
                              <th className="p-1.5 text-center">APs</th>
                              {includeHardware && <th className="p-1.5">Hardware Model</th>}
                              {includeHardware && <th className="p-1.5">Public WAN IP</th>}
                              <th className="p-1.5 text-center">Controller</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white">
                            {displayedSites.map((site, index) => {
                              const sAny = site as any;
                              const typeCfg = getSiteTypeConfig(site.siteType);
                              const isSupp1 = isSupplier1Site(site, supplier2Name);
                              const opStatus = getSiteOperationalStatus(site);

                              return (
                                <tr key={site.id || index} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/90"}>
                                  <td className="p-1.5 text-center font-mono text-slate-500">{index + 1}</td>
                                  <td className="p-1.5 font-bold text-slate-900">
                                    <div>{site.locationName}</div>
                                    <div className="text-[8px] text-slate-500 font-mono">ID: #{site.nationwideId || "—"}</div>
                                  </td>
                                  <td className="p-1.5">
                                    <div className="font-semibold text-slate-800">{site.municipality}</div>
                                    <div className="text-[8px] text-slate-500">{site.barangay}</div>
                                  </td>
                                  <td className="p-1.5">
                                    <span className="font-semibold text-slate-700">{typeCfg.shortLabel}</span>
                                  </td>
                                  <td className="p-1.5 text-center">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono uppercase ${
                                        opStatus === "Online"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : opStatus === "Degraded"
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-rose-100 text-rose-800"
                                      }`}
                                    >
                                      {opStatus}
                                    </span>
                                  </td>
                                  <td className="p-1.5 text-center font-mono font-bold text-emerald-800">
                                    {site.apCount || 2}
                                  </td>
                                  {includeHardware && (
                                    <td className="p-1.5 font-mono text-[8px] text-blue-900">
                                      <div>{sAny.omadaRouterModel || "ER605"}</div>
                                      <div className="text-slate-500">{sAny.omadaApModels || "EAP225-Outdoor"}</div>
                                    </td>
                                  )}
                                  {includeHardware && (
                                    <td className="p-1.5 font-mono text-[8px] text-slate-700">
                                      {sAny.omadaPublicIp || "—"}
                                    </td>
                                  )}
                                  <td className="p-1.5 text-center">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono uppercase ${
                                        isSupp1 ? "bg-blue-100 text-blue-900" : "bg-emerald-100 text-emerald-900"
                                      }`}
                                    >
                                      {sAny.omadaSupplier || (isSupp1 ? supplier1Name : supplier2Name)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {rowDisplayLimit > 0 && reportSites.length > rowDisplayLimit && (
                          <div className="text-[10px] text-slate-500 italic text-right">
                            * Display truncated to top {rowDisplayLimit} sites for concise executive printing. Full {reportSites.length} sites included in Excel export.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Signatures & Certification Block */}
              {includeSignatures && (
                <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-xs bg-white text-slate-900">
                  <div className="bg-white">
                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-8">Prepared & Verified By:</div>
                    <div className="border-b border-slate-800 pb-1 font-bold text-slate-900 uppercase">
                      {preparedBy}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">{designation}</div>
                    <div className="text-[9px] text-slate-500">DICT Regional Operations Team</div>
                  </div>

                  <div className="bg-white">
                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-8">Approved & Noted By:</div>
                    <div className="border-b border-slate-800 pb-1 font-bold text-slate-900 uppercase">
                      {approvedBy}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">{approvedDesignation}</div>
                    <div className="text-[9px] text-slate-500">Regional Executive Direction</div>
                  </div>
                </div>
              )}

              {/* Document Footer */}
              <div className="pt-4 border-t border-slate-200 text-[9px] text-slate-500 flex items-center justify-between bg-white">
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
