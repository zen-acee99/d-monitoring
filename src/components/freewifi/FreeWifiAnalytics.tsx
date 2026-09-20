import React, { useState, useMemo, useEffect } from "react";
import {
  Wifi,
  Radio,
  Building2,
  GraduationCap,
  BookOpen,
  School,
  Landmark,
  ShieldCheck,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Layers,
  MapPin,
  BarChart3,
  PieChart as PieChartIcon,
  Cable,
  Satellite,
  TrendingUp,
  Cpu,
  Info,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Server,
  Activity,
  HardDrive,
  FileText
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  FreeWifiSite,
  SiteType,
  LinkType,
  SITE_TYPE_CONFIG,
  LINK_TYPE_CONFIG,
  getFreeWifiSummary,
  getSiteTypeDistribution,
  getMunicipalityDistribution,
  getSiteTypeConfig,
  getLinkTypeConfig,
} from "@/data/freewifiData";
import { projectApi } from "@/services/api";
import { omadaApi, OmadaOverview, OmadaSyncResult } from "@/services/omadaApi";
import { Modal } from "@/components/ui/modal";
import { FreeWifiReportModal } from "./FreeWifiReportModal";

export function FreeWifiAnalytics({ records }: { records?: FreeWifiSite[] }) {
  const [sites, setSites] = useState<FreeWifiSite[]>(records || []);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [omadaOverview, setOmadaOverview] = useState<OmadaOverview | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("ALL");
  const [highlightApiData, setHighlightApiData] = useState<boolean>(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const reloadFreeWifiData = () => {
    projectApi.getTableRecords("freewifi").then((data) => {
      if (Array.isArray(data)) {
        setSites(data as FreeWifiSite[]);
      }
    });
    omadaApi.getOverview().then((ov) => {
      if (ov) setOmadaOverview(ov);
    });
  };

  useEffect(() => {
    if (records) {
      setSites(records);
      return;
    }
    reloadFreeWifiData();

    const handleDataUpdate = (e?: any) => {
      const customEv = e as CustomEvent<any>;
      const targetProj = customEv?.detail?.projectId;
      if (!targetProj || targetProj === "freewifi") {
        reloadFreeWifiData();
      }
    };

    window.addEventListener("dict_records_updated", handleDataUpdate);
    window.addEventListener("dict_project_data_updated", handleDataUpdate);
    window.addEventListener("dict_freewifi_updated", handleDataUpdate);
    return () => {
      window.removeEventListener("dict_records_updated", handleDataUpdate);
      window.removeEventListener("dict_project_data_updated", handleDataUpdate);
      window.removeEventListener("dict_freewifi_updated", handleDataUpdate);
    };
  }, [records]);

  // Load Omada overview statistics on mount
  useEffect(() => {
    omadaApi.getOverview().then((ov) => {
      if (ov) setOmadaOverview(ov);
    });
  }, []);

  // Trigger sync from Omada Controller into DB
  const handleSyncOmada = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await omadaApi.syncNow();
      if (res && res.success) {
        setSyncFeedback(`Successfully synchronized ${res.updatedRecords} sites from Omada Controller!`);
        reloadFreeWifiData();
        // Dispatch bi-directional update events across the entire application
        window.dispatchEvent(new CustomEvent("dict_records_updated", { detail: { projectId: "freewifi", source: "freewifi_analytics", timestamp: Date.now() } }));
        window.dispatchEvent(new CustomEvent("dict_project_data_updated", { detail: { projectId: "freewifi", source: "freewifi_analytics", timestamp: Date.now() } }));
        window.dispatchEvent(new CustomEvent("dict_freewifi_updated", { detail: { source: "freewifi_analytics", timestamp: Date.now() } }));
      } else {
        setSyncFeedback("Sync failed. Check connection settings in Project Settings.");
      }
    } catch (e: any) {
      setSyncFeedback(`Sync error: ${e.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 4500);
    }
  };

  const [activeTab, setActiveTab] = useState<"overview" | "directory" | "municipal">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvince, setSelectedProvince] = useState<string>("ALL");
  const [selectedSiteType, setSelectedSiteType] = useState<string>("ALL");
  const [selectedLinkType, setSelectedLinkType] = useState<string>("ALL");
  const [selectedFundSource, setSelectedFundSource] = useState<string>("ALL");
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>("ALL");
  const [selectedSite, setSelectedSite] = useState<FreeWifiSite | null>(null);

  // Compute analytics
  const summary = useMemo(() => getFreeWifiSummary(sites), [sites]);
  const siteTypeData = useMemo(() => getSiteTypeDistribution(sites), [sites]);
  const municipalData = useMemo(() => getMunicipalityDistribution(sites), [sites]);

  // Province list
  const provincesList = useMemo(() => {
    const set = new Set(sites.map((s) => s.province || "Albay").filter(Boolean));
    return Array.from(set).sort();
  }, [sites]);

  // Filtered sites for table
  const filteredSites = useMemo(() => {
    return sites.filter((s) => {
      const locationName = s.locationName || (s as any).siteName || "";
      const barangay = s.barangay || "";
      const municipality = s.municipality || "";
      const locationCode = s.locationCode || s.id || "";
      const nationwideId = s.nationwideId ? s.nationwideId.toString() : "";
      const omadaSupplier = ((s as any).omadaSupplier || (s as any).omadaSupplierId || "").toLowerCase();
      const omadaRouter = ((s as any).omadaRouterModel || "").toLowerCase();
      const omadaAp = ((s as any).omadaApModels || "").toLowerCase();

      const matchesSearch =
        locationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        barangay.toLowerCase().includes(searchQuery.toLowerCase()) ||
        municipality.toLowerCase().includes(searchQuery.toLowerCase()) ||
        locationCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        omadaSupplier.includes(searchQuery.toLowerCase()) ||
        omadaRouter.includes(searchQuery.toLowerCase()) ||
        omadaAp.includes(searchQuery.toLowerCase()) ||
        nationwideId.includes(searchQuery);

      const typeCfg = getSiteTypeConfig(s.siteType);
      const matchesType =
        selectedSiteType === "ALL" ||
        s.siteType === selectedSiteType ||
        typeCfg.shortLabel === (SITE_TYPE_CONFIG as any)[selectedSiteType]?.shortLabel;

      const linkStr = (s.linkType || "").toLowerCase();
      const matchesLink =
        selectedLinkType === "ALL" ||
        (selectedLinkType === "FOC"
          ? linkStr.includes("fiber") || linkStr === "foc"
          : linkStr.includes("sat") || linkStr.includes("leo") || linkStr.includes("vsat"));

      const matchesFund = selectedFundSource === "ALL" || s.fundSource === selectedFundSource;
      const matchesProvince = selectedProvince === "ALL" || (s.province || "Albay") === selectedProvince;
      const matchesMun = selectedMunicipality === "ALL" || s.municipality === selectedMunicipality;

      const matchesSupplier =
        selectedSupplier === "ALL" ||
        (selectedSupplier === "supplier1" && (omadaSupplier.includes("supplier 1") || omadaSupplier === "supplier1")) ||
        (selectedSupplier === "supplier2" && (omadaSupplier.includes("supplier 2") || omadaSupplier === "supplier2"));

      return matchesSearch && matchesType && matchesLink && matchesFund && matchesProvince && matchesMun && matchesSupplier;
    });
  }, [sites, searchQuery, selectedSiteType, selectedLinkType, selectedFundSource, selectedProvince, selectedMunicipality, selectedSupplier]);

  // Municipal list for dropdown
  const municipalitiesList = useMemo(() => {
    const relevantSites = selectedProvince === "ALL" ? sites : sites.filter((s) => (s.province || "Albay") === selectedProvince);
    const set = new Set(relevantSites.map((s) => s.municipality).filter(Boolean));
    return Array.from(set).sort();
  }, [sites, selectedProvince]);

  const getSiteTypeIcon = (type?: string) => {
    const t = (type || "").toLowerCase();
    if (t.includes("college") || t.includes("hei") || t.includes("university")) {
      return <School className="w-4 h-4 text-cyan-400" />;
    }
    if (t.includes("high school") || t.includes("phs")) {
      return <BookOpen className="w-4 h-4 text-pink-400" />;
    }
    if (t.includes("elementary") || t.includes("pes") || t.includes("school")) {
      return <GraduationCap className="w-4 h-4 text-amber-400" />;
    }
    if (t.includes("capitol") || t.includes("pc")) {
      return <Landmark className="w-4 h-4 text-purple-400" />;
    }
    if (t.includes("field office") || t.includes("regional office") || t.includes("pfo")) {
      return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
    }
    return <Building2 className="w-4 h-4 text-blue-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Header */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Operational Sites */}
        <div className="bg-[#0C101A] border-t-2 border-t-blue-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Total Sites</span>
            <Wifi className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{summary.totalSites}</div>
          <p className="text-[11px] text-blue-400 mt-0.5 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" /> 100% Operational
          </p>
        </div>

        {/* Total Access Points (APs) */}
        <div className="bg-[#0C101A] border-t-2 border-t-emerald-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Access Points</span>
            <Radio className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{summary.totalAccessPoints}</div>
          <p className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1 font-medium">
            Avg. {summary.totalSites > 0 ? (summary.totalAccessPoints / summary.totalSites).toFixed(1) : 0} APs / Site
          </p>
        </div>

        {/* Fiber Optic (FOC) */}
        <div className="bg-[#0C101A] border-t-2 border-t-teal-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-teal-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Fiber (FOC)</span>
            <Cable className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{summary.focSitesCount}</div>
          <p className="text-[11px] text-teal-400 mt-0.5 font-medium">
            {summary.totalSites > 0 ? Math.round((summary.focSitesCount / summary.totalSites) * 100) : 0}% Terrestrial Fiber
          </p>
        </div>

        {/* Satellite (LEO) */}
        <div className="bg-[#0C101A] border-t-2 border-t-sky-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-sky-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Satellite (LEO)</span>
            <Satellite className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{summary.leoSitesCount}</div>
          <p className="text-[11px] text-sky-400 mt-0.5 font-medium">
            {summary.totalSites > 0 ? Math.round((summary.leoSitesCount / summary.totalSites) * 100) : 0}% Starlink / LEO Dish
          </p>
        </div>

        {/* Educational Beneficiaries */}
        <div className="bg-[#0C101A] border-t-2 border-t-amber-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-amber-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Schools & HEIs</span>
            <GraduationCap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {sites.filter((s) => {
              const t = (s.siteType || "").toLowerCase();
              return t.includes("school") || t.includes("college") || t.includes("hei") || t === "pes" || t === "phs" || t === "hei-luc";
            }).length}
          </div>
          <p className="text-[11px] text-amber-400 mt-0.5 font-medium">
            Elementary, High Schools & Colleges
          </p>
        </div>

        {/* Municipal Reach */}
        <div className="bg-[#0C101A] border-t-2 border-t-purple-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-purple-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Municipalities</span>
            <MapPin className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{summary.totalMunicipalities}</div>
          <p className="text-[11px] text-purple-400 mt-0.5 font-medium">
            Across Albay Province
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Live Omada Quick Sync */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-[#1A2235] pb-3 gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "overview"
                ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                : "bg-[#0C101A] text-slate-400 hover:text-white border border-[#1A2235]"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Executive Visual Analytics
          </button>
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "directory"
                ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                : "bg-[#0C101A] text-slate-400 hover:text-white border border-[#1A2235]"
            }`}
          >
            <Wifi className="w-4 h-4" />
            Live Public Site Telemetry ({sites.length})
          </button>
          <button
            onClick={() => setActiveTab("municipal")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "municipal"
                ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                : "bg-[#0C101A] text-slate-400 hover:text-white border border-[#1A2235]"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Municipal Distribution Matrix
          </button>
        </div>

        {/* Live Omada Sync Action & Status */}
        <div className="flex items-center gap-3 self-stretch md:self-auto justify-end flex-wrap">
          {omadaOverview && (
            <div className="hidden xl:flex items-center gap-2 text-xs font-mono bg-[#0C101A] border border-[#1A2235] px-3 py-1.5 rounded-lg text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Omada Cloud: <strong>{omadaOverview.totalSites} Sites</strong> (S1: {omadaOverview.supplier1.count}, S2: {omadaOverview.supplier2.count})</span>
            </div>
          )}

          <button
            onClick={() => setIsReportModalOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-emerald-500/30 bg-emerald-600/15 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-all cursor-pointer shadow-sm shadow-emerald-950/40"
            title="Generate precise executive telemetry and site inventory report for Free Wi-Fi 4 All"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Generate Report</span>
          </button>

          <button
            onClick={handleSyncOmada}
            disabled={isSyncing}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer shadow-sm ${
              isSyncing
                ? "bg-blue-900/60 border-blue-500/40 text-blue-200 cursor-wait"
                : "bg-blue-600/15 hover:bg-blue-600 border-blue-500/30 text-blue-300 hover:text-white"
            }`}
            title="Pull latest live device states, AP counts, and telemetry from Supplier 1 & 2 Omada Northbound APIs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing Omada..." : "Sync with Omada"}</span>
          </button>
        </div>
      </div>

      {/* Sync Feedback Toast */}
      {syncFeedback && (
        <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-200 animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400">Live DB Updated</span>
        </div>
      )}

      {/* Tab: Executive Visual Analytics */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Grid of Analytical Visualizations */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Donut Chart: Site Type & Facility Breakdown */}
            <div className="lg:col-span-5 bg-[#0C101A] border border-[#1A2235] rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-blue-400" />
                    Facility & Beneficiary Classification
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">{summary.totalSites} Total Sites</span>
                </div>
                <p className="text-xs text-slate-400">Institutional site category & public space footprint</p>
              </div>

              {/* Chart Visual */}
              <div className="relative h-60 my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={siteTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="count"
                    >
                      {siteTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#0C101A" strokeWidth={2} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "#07090E",
                        borderColor: "#1A2235",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(val: number, name: string, item: any) => [
                        `${val} Sites (${item.payload.apTotal} APs)`,
                        item.payload.fullName,
                      ]}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold font-mono text-white">{summary.totalSites}</span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Live Sites</span>
                </div>
              </div>

              {/* Facility Legend Badges */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#1A2235]">
                {siteTypeData.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => {
                      setSelectedSiteType(selectedSiteType === item.type ? "ALL" : item.type);
                      setActiveTab("directory");
                    }}
                    className="flex items-center justify-between p-2 rounded-lg text-left bg-[#07090E] border border-[#1A2235]/60 hover:bg-[#111520] transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-300 truncate font-medium">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono">
                      <span className="text-white font-bold">{item.count}</span>
                      <span className="text-slate-500 text-[10px]">({item.percentage}%)</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Backhaul Architecture & Project Initiatives */}
            <div className="lg:col-span-7 space-y-6">
              {/* Backhaul Technology Matrix */}
              <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-emerald-400" />
                      Backhaul Link & Connectivity Technology
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">Terrestrial Fiber (FOC) vs Satellite (LEO) Infrastructure</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* FOC Card */}
                  <div className="p-4 rounded-xl border border-teal-500/30 bg-teal-500/5 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Cable className="w-5 h-5 text-teal-400" />
                        <span className="font-bold text-sm text-white">Fiber Optic Cable (FOC)</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                        High Throughput
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{LINK_TYPE_CONFIG.FOC.desc}</p>
                    <div className="flex items-end justify-between pt-2 border-t border-teal-500/20 font-mono">
                      <div>
                        <span className="text-2xl font-bold text-teal-400">{summary.focSitesCount}</span>
                        <span className="text-xs text-slate-400 ml-1.5">Sites ({summary.focSitesCount * 4 - 1} APs)</span>
                      </div>
                      <span className="text-xs text-teal-300 font-bold">4 APs / LGU Hall</span>
                    </div>
                  </div>

                  {/* LEO Card */}
                  <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/5 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Satellite className="w-5 h-5 text-sky-400" />
                        <span className="font-bold text-sm text-white">Low Earth Orbit (LEO)</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                        Rapid Satellite Drop
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{LINK_TYPE_CONFIG.LEO.desc}</p>
                    <div className="flex items-end justify-between pt-2 border-t border-sky-500/20 font-mono">
                      <div>
                        <span className="text-2xl font-bold text-sky-400">{summary.leoSitesCount}</span>
                        <span className="text-xs text-slate-400 ml-1.5">Sites ({summary.leoSitesCount * 3} APs)</span>
                      </div>
                      <span className="text-xs text-sky-300 font-bold">3 APs / Public Space</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Program & Initiative Breakdown */}
              <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-400" />
                    DICT Funding Source & Project Initiatives
                  </h4>
                  <span className="text-xs text-slate-400">Phase 1 & Centrally Allocated</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-[#07090E] border border-[#1A2235] rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-400">PICS-MUN Phase I</span>
                      <span className="text-sm font-bold font-mono text-white">{summary.picsMunCount} Sites</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Provision of Internet Connectivity Services in Municipalities Region 5 Phase I (LGU Halls, Capitols & Field Offices).
                    </p>
                  </div>

                  <div className="p-3.5 bg-[#07090E] border border-[#1A2235] rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400">PFIAPS (CA)</span>
                      <span className="text-sm font-bold font-mono text-white">{summary.pfiapsCount} Sites</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Provision of Free Internet Access in Public Spaces (Centrally Allocated Satellite for Elementary, High Schools & Community Colleges).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Municipal Density Bar Chart */}
          <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  Municipal Site & Access Point Density Matrix
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">Comparison of deployed public sites and total active APs across Albay LGUs</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Total Sites</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Total APs</span>
              </div>
            </div>

            <div className="h-72 my-2">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={municipalData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1A2235" />
                  <XAxis
                    dataKey="municipality"
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "#07090E",
                      borderColor: "#1A2235",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="totalSites" name="Public Sites" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalAps" name="Access Points (APs)" fill="#10B981" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Municipal Distribution Matrix Table */}
      {activeTab === "municipal" && (
        <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#1A2235] bg-[#0E1422] flex justify-between items-center">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                Albay Municipal Free WiFi Deployment Matrix
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Aggregated distribution of public WiFi hotspots across all 14 covered municipalities & cities
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-400 uppercase bg-[#07090E] border-b border-[#1A2235]">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">City / Municipality</th>
                  <th className="px-4 py-3.5 text-center font-semibold">Total Sites</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-emerald-400">Total APs</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-teal-300">Fiber (FOC)</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-sky-300">Satellite (LEO)</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-amber-300">Public Schools</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-blue-300">LGU Halls & Offices</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-cyan-300">Colleges / HEIs</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2235]/50">
                {municipalData.map((m) => (
                  <tr key={m.municipality} className="hover:bg-[#111520] transition-colors">
                    <td className="px-5 py-3.5 font-bold text-white text-sm">{m.municipality}</td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-white">{m.totalSites}</td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-400 bg-emerald-500/5">{m.totalAps}</td>
                    <td className="px-4 py-3.5 text-center font-mono text-teal-300">{m.focCount}</td>
                    <td className="px-4 py-3.5 text-center font-mono text-sky-300">{m.leoCount}</td>
                    <td className="px-4 py-3.5 text-center font-mono text-amber-300">{m.schoolCount}</td>
                    <td className="px-4 py-3.5 text-center font-mono text-blue-300">{m.lguCount}</td>
                    <td className="px-4 py-3.5 text-center font-mono text-cyan-300">{m.collegeCount}</td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => {
                          setSelectedMunicipality(m.municipality);
                          setActiveTab("directory");
                        }}
                        className="px-2.5 py-1 rounded bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white transition-colors text-[11px] font-medium"
                      >
                        View Sites
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Public Site Telemetry Directory Table */}
      {(activeTab === "directory" || activeTab === "overview") && (
        <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl overflow-hidden">
          {/* Header Controls: Filters & Search */}
          <div className="p-4 border-b border-[#1A2235] bg-[#0E1422] space-y-3">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  Free WiFi 4 All Site Telemetry & Inventory Roster
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing {filteredSites.length} of {sites.length} operational public access points in Albay
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search site, barangay, LGU, ID, code..."
                  className="w-full rounded-lg border border-[#1A2235] bg-[#07090E] pl-9 pr-4 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1A2235]/60">
              {/* Supplier & Facility Filters */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Supplier Filter Group */}
                <div className="flex items-center gap-1 mr-2 pr-2 border-r border-[#1A2235]">
                  <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                    <Server className="w-3 h-3 text-blue-400" /> Controller:
                  </span>
                  <button
                    onClick={() => setSelectedSupplier("ALL")}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                      selectedSupplier === "ALL"
                        ? "bg-blue-600 text-white"
                        : "bg-[#07090E] text-slate-400 border border-[#1A2235] hover:text-white"
                    }`}
                  >
                    All ({sites.length})
                  </button>
                  <button
                    onClick={() => setSelectedSupplier(selectedSupplier === "supplier1" ? "ALL" : "supplier1")}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all flex items-center gap-1 ${
                      selectedSupplier === "supplier1"
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/50"
                        : "bg-[#07090E] text-slate-400 border-[#1A2235] hover:text-white"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    Supplier 1 ({sites.filter((s) => ((s as any).omadaSupplier || "").includes("Supplier 1")).length})
                  </button>
                  <button
                    onClick={() => setSelectedSupplier(selectedSupplier === "supplier2" ? "ALL" : "supplier2")}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all flex items-center gap-1 ${
                      selectedSupplier === "supplier2"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                        : "bg-[#07090E] text-slate-400 border-[#1A2235] hover:text-white"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Supplier 2 ({sites.filter((s) => ((s as any).omadaSupplier || "").includes("Supplier 2")).length})
                  </button>
                </div>

                {/* Facility Category Filters */}
                <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Facility:
                </span>
                <button
                  onClick={() => setSelectedSiteType("ALL")}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                    selectedSiteType === "ALL"
                      ? "bg-white text-slate-900"
                      : "bg-[#07090E] text-slate-400 border border-[#1A2235] hover:text-white"
                  }`}
                >
                  All
                </button>
                {(["LGU-HALL", "PES", "PHS", "HEI-LUC", "PC", "PFO"] as SiteType[]).map((st) => {
                  const cfg = SITE_TYPE_CONFIG[st];
                  const count = sites.filter((s) => getSiteTypeConfig(s.siteType).shortLabel === cfg.shortLabel).length;
                  const isActive = selectedSiteType === st;

                  return (
                    <button
                      key={st}
                      onClick={() => setSelectedSiteType(isActive ? "ALL" : st)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all flex items-center gap-1 ${
                        isActive ? "ring-1 ring-white/50" : "hover:border-slate-600 opacity-80 hover:opacity-100"
                      }`}
                      style={{
                        backgroundColor: isActive ? cfg.bgColor : "#07090E",
                        color: isActive ? cfg.textColor : "#94A3B8",
                        borderColor: isActive ? cfg.borderColor : "#1A2235",
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                      {cfg.shortLabel} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Secondary Filters: Link Type, Municipality, and API Highlight Toggle */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* API Highlighting Toggle Button */}
                <button
                  type="button"
                  onClick={() => setHighlightApiData(!highlightApiData)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    highlightApiData
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                      : "bg-[#07090E] text-slate-400 border-[#1A2235] hover:text-white"
                  }`}
                  title="Highlight data fetched directly from TP-Link Omada Northbound Open APIs"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${highlightApiData ? "text-amber-400 animate-pulse" : "text-slate-500"}`} />
                  <span>{highlightApiData ? "Highlight Omada API: ON" : "Highlight Omada API: OFF"}</span>
                </button>

                {/* Link Type Filter */}
                <select
                  value={selectedLinkType}
                  onChange={(e) => setSelectedLinkType(e.target.value)}
                  className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-[11px] text-slate-300 font-medium focus:border-blue-500 focus:outline-none"
                >
                  <option value="ALL">All Backhauls</option>
                  <option value="FOC">Fiber Optic (FOC)</option>
                  <option value="LEO">Satellite (LEO)</option>
                </select>

                {/* Province Selector */}
                <select
                  value={selectedProvince}
                  onChange={(e) => {
                    setSelectedProvince(e.target.value);
                    setSelectedMunicipality("ALL");
                  }}
                  className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-[11px] text-slate-300 font-medium focus:border-blue-500 focus:outline-none"
                >
                  <option value="ALL">All Provinces ({provincesList.length})</option>
                  {provincesList.map((prov) => (
                    <option key={prov} value={prov}>
                      {prov}
                    </option>
                  ))}
                </select>

                {/* Municipality Selector */}
                <select
                  value={selectedMunicipality}
                  onChange={(e) => setSelectedMunicipality(e.target.value)}
                  className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-[11px] text-slate-300 font-medium focus:border-blue-500 focus:outline-none"
                >
                  <option value="ALL">All Municipalities ({municipalitiesList.length})</option>
                  {municipalitiesList.map((mun) => (
                    <option key={mun} value={mun}>
                      {mun}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Table Body */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-400 uppercase bg-[#07090E] border-b border-[#1A2235]">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Location / Public Facility</th>
                  <th className="px-4 py-3.5 font-semibold">Municipality & Barangay</th>
                  <th className="px-4 py-3.5 font-semibold">Facility Type</th>
                  <th className="px-4 py-3.5 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span>Backhaul & Hardware</span>
                      {highlightApiData && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-500/25 text-blue-300 border border-blue-500/40">
                          ⚡ API
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-center font-semibold">AP Count</th>
                  <th className="px-4 py-3.5 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span>Omada Controller & IP</span>
                      {highlightApiData && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-500/40">
                          ⚡ API
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3.5 font-semibold">Location Code</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2235]/50">
                {filteredSites.map((site) => {
                  const typeCfg = getSiteTypeConfig(site.siteType);
                  const linkCfg = getLinkTypeConfig(site.linkType);
                  const isFiber = (site.linkType || "").toLowerCase().includes("fiber") || site.linkType === "FOC";
                  const omadaSupplier = (site as any).omadaSupplier;
                  const omadaRouter = (site as any).omadaRouterModel;
                  const omadaAp = (site as any).omadaApModels;
                  const omadaIp = (site as any).omadaPublicIp;
                  const isApiSynced = Boolean(omadaSupplier || omadaRouter || omadaIp || (site as any).omadaSiteId);

                  return (
                    <tr
                      key={site.id}
                      className={`transition-colors group ${
                        isApiSynced && highlightApiData
                          ? `bg-[#0B1120] hover:bg-[#111A30] border-l-4 ${
                              omadaSupplier?.includes("1") ? "border-l-blue-500" : "border-l-emerald-400"
                            }`
                          : "hover:bg-[#111520]"
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-md ${isApiSynced && highlightApiData ? "bg-[#18233C] border border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.3)]" : "bg-[#141B2D] border border-[#1E293B]"}`}>
                            {getSiteTypeIcon(site.siteType)}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm flex items-center gap-1.5 flex-wrap">
                              <span>{site.locationName}</span>
                              {omadaSupplier && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase inline-flex items-center gap-1 border ${
                                    omadaSupplier.includes("1")
                                      ? "bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                                  }`}
                                  title="Synchronized live from TP-Link Omada Controller API"
                                >
                                  <Sparkles className="w-2.5 h-2.5" />
                                  <span>{omadaSupplier}</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              NationWide ID: <span className="text-slate-300 font-bold">#{site.nationwideId}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-200">{site.municipality}</div>
                        <div className="text-[11px] text-slate-400">{site.barangay}</div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border"
                          style={{
                            backgroundColor: typeCfg.bgColor,
                            color: typeCfg.textColor,
                            borderColor: typeCfg.borderColor,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: typeCfg.color }} />
                          {typeCfg.shortLabel}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="space-y-1.5">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border"
                            style={{
                              backgroundColor: linkCfg.badgeBg,
                              color: linkCfg.badgeText,
                              borderColor: linkCfg.badgeBorder,
                            }}
                          >
                            {isFiber ? <Cable className="w-3 h-3" /> : <Satellite className="w-3 h-3" />}
                            {site.linkType}
                          </span>

                          {/* Live Hardware fetched from Omada API */}
                          {(omadaRouter || omadaAp) && (
                            <div
                              className={`flex items-center gap-1.5 flex-wrap ${
                                highlightApiData
                                  ? "p-1 rounded-md bg-blue-950/70 border border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.25)]"
                                  : "text-[10px] text-slate-400 font-mono"
                              }`}
                            >
                              <div className="flex items-center gap-1 text-[10px] font-mono text-blue-300 font-bold">
                                <HardDrive className="w-3 h-3 text-blue-400 shrink-0" />
                                <span>{omadaRouter || "ER605"}</span>
                              </div>
                              {omadaAp && (
                                <span className="text-[10px] font-mono text-slate-300">
                                  ({omadaAp})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                            isApiSynced && highlightApiData
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                              : "bg-[#141B2D] border-[#1E293B] text-emerald-400"
                          }`}
                        >
                          <Radio className="w-3 h-3 text-emerald-400" />
                          <span>{site.apCount} APs</span>
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="space-y-1.5">
                          {omadaSupplier ? (
                            <div className="flex items-center gap-1">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                  omadaSupplier.includes("1")
                                    ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                }`}
                              >
                                {omadaSupplier}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] font-mono text-slate-300 font-semibold block">{site.fundSource}</span>
                          )}

                          {/* Live Public IP from Omada API */}
                          {omadaIp ? (
                            <div
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                highlightApiData
                                  ? "bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold shadow-[0_0_8px_rgba(6,182,212,0.25)]"
                                  : "text-blue-400"
                              }`}
                              title="Public IP Address fetched from Omada Cloud Controller"
                            >
                              <Activity className="w-3 h-3 text-cyan-400 shrink-0" />
                              <span>{omadaIp}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 block truncate max-w-[140px]">{site.contact}</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">
                        {site.locationCode}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedSite(site)}
                          className="px-2.5 py-1 rounded bg-[#1A2235] hover:bg-blue-600 text-slate-300 hover:text-white transition-colors text-[11px] font-medium flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <Eye className="w-3 h-3" /> Dossier
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredSites.length === 0 && (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Info className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold">No Free WiFi sites matched your search filter criteria.</p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedSupplier("ALL");
                    setSelectedSiteType("ALL");
                    setSelectedLinkType("ALL");
                    setSelectedMunicipality("ALL");
                  }}
                  className="text-xs text-blue-400 underline hover:text-blue-300 cursor-pointer"
                >
                  Reset all filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Site Technical Dossier Modal */}
      {selectedSite && (
        <Modal
          isOpen={!!selectedSite}
          onClose={() => setSelectedSite(null)}
          title={`Free WiFi Site Dossier: ${selectedSite.locationName}`}
        >
          <div className="space-y-4 text-sm">
            {/* Status Header Badge */}
            <div className="p-4 rounded-xl border border-blue-500/30 bg-[#07090E] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Wifi className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-base text-white">{selectedSite.locationName}</h4>
                    {(selectedSite as any).omadaSupplier && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        {(selectedSite as any).omadaSupplier}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedSite.barangay}, {selectedSite.municipality}, {selectedSite.province}
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 uppercase tracking-wider">
                {selectedSite.status}
              </span>
            </div>

            {/* Live Omada Controller Hardware Specifications */}
            {((selectedSite as any).omadaRouterModel || (selectedSite as any).omadaApModels || (selectedSite as any).omadaPublicIp) && (
              <div className="bg-[#080C16] border border-blue-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#1A2235]">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Server className="w-4 h-4 text-blue-400" />
                    <span>TP-Link Omada Live Telemetry & Hardware Roster</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Cloud Controller Linked
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Gateway / Router</span>
                    <span className="font-mono font-bold text-blue-400 mt-0.5 block">
                      {(selectedSite as any).omadaRouterModel || "ER605"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Access Point Model</span>
                    <span className="font-mono font-bold text-emerald-400 mt-0.5 block truncate">
                      {(selectedSite as any).omadaApModels || "EAP225-Outdoor"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Public WAN IP</span>
                    <span className="font-mono font-bold text-white mt-0.5 block">
                      {(selectedSite as any).omadaPublicIp || "Dynamic / ISP"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Omada Site ID</span>
                    <span className="font-mono font-bold text-slate-300 mt-0.5 block truncate" title={(selectedSite as any).omadaSiteId}>
                      {(selectedSite as any).omadaSiteId ? (selectedSite as any).omadaSiteId.slice(0, 8) + "..." : "Synced"}
                    </span>
                  </div>
                </div>

                {/* Deployed Devices List (if populated) */}
                {Array.isArray((selectedSite as any).omadaDevices) && (selectedSite as any).omadaDevices.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Connected Omada Hardware ({((selectedSite as any).omadaDevices).length} Devices):</span>
                    <div className="max-h-36 overflow-y-auto space-y-1 custom-scrollbar">
                      {((selectedSite as any).omadaDevices).map((dev: any, i: number) => (
                        <div key={dev.mac || i} className="flex items-center justify-between p-2 bg-[#07090E] border border-[#1A2235] rounded text-xs font-mono">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${dev.active !== false ? "bg-emerald-400" : "bg-red-400"}`} />
                            <span className="text-white font-bold">{dev.name || dev.model}</span>
                            <span className="text-[10px] text-slate-500">({dev.type?.toUpperCase()})</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                            <span>MAC: {dev.mac}</span>
                            <span>IP: {dev.ip}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Technical Specifications Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Facility Category</span>
                <p className="text-sm font-bold text-white mt-1">{selectedSite.siteTypeLabel}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-mono">Code: {selectedSite.siteType}</p>
              </div>

              <div className="p-3 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Backhaul Connection</span>
                <p className="text-sm font-bold text-teal-400 mt-1 flex items-center gap-1.5">
                  {(selectedSite.linkType || "").toLowerCase().includes("fiber") || selectedSite.linkType === "FOC" ? (
                    <Cable className="w-4 h-4" />
                  ) : (
                    <Satellite className="w-4 h-4" />
                  )}
                  {getLinkTypeConfig(selectedSite.linkType).label}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Installed: {selectedSite.apCount} Access Points</p>
              </div>
            </div>

            {/* Location & Program Details */}
            <div className="bg-[#0C101A] p-4 rounded-lg border border-[#1A2235] space-y-2.5">
              <h5 className="text-xs font-bold uppercase text-slate-400 mb-2">Program & Registry Information</h5>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block">NationWide ID:</span>
                  <span className="font-mono font-bold text-white">#{selectedSite.nationwideId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Location Code:</span>
                  <span className="font-mono font-bold text-white">{selectedSite.locationCode}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Funding Source:</span>
                  <span className="font-semibold text-blue-400">{selectedSite.fundSource} ({selectedSite.contact})</span>
                </div>
                <div>
                  <span className="text-slate-500 block">DepEd / Remark Code:</span>
                  <span className="font-mono font-semibold text-slate-300">{selectedSite.remarks ? `#${selectedSite.remarks}` : "None"}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#1A2235]">
                <span className="text-slate-500 text-xs block">Project Name:</span>
                <p className="text-xs text-slate-300 font-medium mt-0.5">{selectedSite.projectName}</p>
              </div>
            </div>

            {/* Estimated Utilization Telemetry */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-[#07090E] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Active APs</span>
                <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">{selectedSite.apCount}</p>
              </div>
              <div className="p-3 bg-[#07090E] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Est. Daily Users</span>
                <p className="text-lg font-bold text-white font-mono mt-0.5">{selectedSite.estimatedDailyUsers.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-[#07090E] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Avg. Bandwidth</span>
                <p className="text-sm font-bold text-sky-400 font-mono mt-1">{selectedSite.averageBandwidthMbps} Mbps</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-3 border-t border-[#1A2235]">
              <button
                onClick={() => setSelectedSite(null)}
                className="px-4 py-2 rounded-lg bg-[#1A2235] hover:bg-[#25304b] text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Free Wi-Fi Precise Report Generator Modal */}
      <FreeWifiReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        sites={sites}
      />
    </div>
  );
}
