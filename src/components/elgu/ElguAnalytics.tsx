import React, { useState, useMemo, useEffect } from "react";
import { 
  CheckCircle2, 
  Hammer, 
  FlaskConical, 
  AlertCircle, 
  HelpCircle, 
  Cpu, 
  Search, 
  Filter, 
  Download, 
  TrendingUp, 
  Building2, 
  Layers, 
  Eye, 
  ChevronRight, 
  BarChart3, 
  PieChart as PieChartIcon, 
  X, 
  Sparkles, 
  Server, 
  ShieldCheck, 
  Zap, 
  Tag 
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  AreaChart as RechartsAreaChart, 
  Area, 
  Legend 
} from "recharts";
import { 
  ElguDeploymentStatus, 
  ElguVersion, 
  LguRecord, 
  ELGU_STATUS_CONFIG, 
  ELGU_VERSION_CONFIG, 
  ELGU_VERSIONS_LIST, 
  PROVINCES_LIST, 
  getElguStatusSummaries, 
  getProvincialStatusBreakdown, 
  getVersionAdoptionAnalytics, 
  ELGU_TRAJECTORY_DATA 
} from "@/data/elguData";
import { projectApi } from "@/services/api";
import { Modal } from "@/components/ui/modal";

export function ElguAnalytics({ records }: { records?: LguRecord[] }) {
  const [lgus, setLgus] = useState<LguRecord[]>(records || []);

  const reloadLgus = () => {
    projectApi.getTableRecords("elgu").then((data) => {
      if (Array.isArray(data)) {
        setLgus(data as LguRecord[]);
      }
    });
  };

  useEffect(() => {
    if (records) {
      setLgus(records);
      return;
    }
    reloadLgus();

    const handleDataUpdate = (e?: any) => {
      const customEv = e as CustomEvent<any>;
      const targetProj = customEv?.detail?.projectId;
      if (!targetProj || targetProj === "elgu") {
        reloadLgus();
      }
    };

    window.addEventListener("dict_records_updated", handleDataUpdate);
    window.addEventListener("dict_project_data_updated", handleDataUpdate);
    return () => {
      window.removeEventListener("dict_records_updated", handleDataUpdate);
      window.removeEventListener("dict_project_data_updated", handleDataUpdate);
    };
  }, [records]);

  const [selectedStatusFilter, setSelectedStatusFilter] = useState<ElguDeploymentStatus | "ALL">("ALL");
  const [selectedVersionFilter, setSelectedVersionFilter] = useState<ElguVersion | "ALL" | "None" | "In-House">("ALL");
  const [selectedProvince, setSelectedProvince] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLgu, setSelectedLgu] = useState<LguRecord | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "versions" | "provincial" | "directory">("overview");

  // Summary statistics
  const statusSummaries = useMemo(() => getElguStatusSummaries(lgus), [lgus]);
  const provincialData = useMemo(() => getProvincialStatusBreakdown(lgus), [lgus]);
  const versionAnalytics = useMemo(() => getVersionAdoptionAnalytics(lgus), [lgus]);

  // Filtered LGUs based on controls
  const filteredLgus = useMemo(() => {
    return lgus.filter((lgu) => {
      // Status filter
      if (selectedStatusFilter !== "ALL" && lgu.status !== selectedStatusFilter) {
        return false;
      }
      // Version filter
      if (selectedVersionFilter !== "ALL") {
        if (selectedVersionFilter === "None" && (lgu.versions.length > 0 || lgu.status === "Own System")) {
          return false;
        } else if (selectedVersionFilter === "In-House" && lgu.status !== "Own System") {
          return false;
        } else if (selectedVersionFilter !== "None" && selectedVersionFilter !== "In-House") {
          if (!lgu.versions.includes(selectedVersionFilter as ElguVersion)) {
            return false;
          }
        }
      }
      // Province filter
      if (selectedProvince !== "ALL" && lgu.province !== selectedProvince) {
        return false;
      }
      // Search query
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesName = lgu.name.toLowerCase().includes(q);
        const matchesProvince = lgu.province.toLowerCase().includes(q);
        const matchesFocal = lgu.dictFocal.toLowerCase().includes(q);
        const matchesSystem = lgu.systemName?.toLowerCase().includes(q) || false;
        const matchesBlocker = lgu.blockers?.toLowerCase().includes(q) || false;
        const matchesNotes = lgu.notes?.toLowerCase().includes(q) || false;
        const matchesVersion = lgu.versions.some(v => v.toLowerCase().includes(q));
        if (!matchesName && !matchesProvince && !matchesFocal && !matchesSystem && !matchesBlocker && !matchesNotes && !matchesVersion) {
          return false;
        }
      }
      return true;
    });
  }, [selectedStatusFilter, selectedVersionFilter, selectedProvince, searchQuery]);

  // Pie chart data for status distribution
  const pieChartData = useMemo(() => {
    return statusSummaries.map((s) => ({
      name: s.status,
      value: s.count,
      percentage: s.percentage,
      color: s.accentColor,
    }));
  }, [statusSummaries]);

  // Handler to export CSV
  const handleExportCsv = () => {
    const headers = ["LGU Name", "Province", "Classification", "Deployment Status", "Active Version / Module", "Progress %", "Monthly Transactions", "DICT Focal Officer", "Target/Go-Live Date", "Notes / Blockers"];
    const rows = filteredLgus.map(l => [
      `"${l.name}"`,
      `"${l.province}"`,
      `"${l.classification}"`,
      `"${l.status}"`,
      `"${l.versions.join(', ') || (l.status === 'Own System' ? 'In-House System' : 'None')}"`,
      `${l.progressPercentage}%`,
      `${l.monthlyTransactions}`,
      `"${l.dictFocal}"`,
      `"${l.goLiveDate || l.targetGoLiveDate || 'N/A'}"`,
      `"${(l.blockers || l.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `eLGU_Deployment_Analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusIcon = (status: ElguDeploymentStatus) => {
    switch (status) {
      case "Live": return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case "Build UP": return <Hammer className="w-5 h-5 text-blue-400" />;
      case "UAT": return <FlaskConical className="w-5 h-5 text-purple-400" />;
      case "Inactive": return <AlertCircle className="w-5 h-5 text-amber-400" />;
      case "No System": return <HelpCircle className="w-5 h-5 text-slate-400" />;
      case "Own System": return <Cpu className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Context */}
      <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
                <Building2 className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  eLGU Regional Deployment Analytics
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                    {lgus.length} LGUs Monitored
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Accurate monitoring across 6 deployment statuses (Live, Build UP, UAT, Inactive, No System, Own System) & active modules (V1 BPCO, V1 BPBC, V2 eLGU)
                </p>
              </div>
            </div>
          </div>

          {/* Quick Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-[#07090E] border border-[#1A2235] p-1 rounded-lg flex">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "overview"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Overview & Trajectory
              </button>
              <button
                onClick={() => setActiveTab("versions")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "versions"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Active Modules ({versionAnalytics.length})
              </button>
              <button
                onClick={() => setActiveTab("provincial")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "provincial"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Provincial Matrix
              </button>
              <button
                onClick={() => setActiveTab("directory")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "directory"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                LGU Telemetry ({filteredLgus.length})
              </button>
            </div>

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 bg-[#1A2235] hover:bg-[#24304b] text-slate-200 px-3 py-2 rounded-lg text-xs font-semibold transition-colors border border-[#2A3650]"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* 6 Analytics Status Cards (Live, Build UP, UAT, Inactive, No System, Own System) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Deployment Status Breakdown</h4>
            <span className="text-[11px] text-slate-500">(Click a card to filter all analytics & tables)</span>
          </div>
          {(selectedStatusFilter !== "ALL" || selectedVersionFilter !== "ALL" || selectedProvince !== "ALL" || searchQuery !== "") && (
            <button
              onClick={() => {
                setSelectedStatusFilter("ALL");
                setSelectedVersionFilter("ALL");
                setSelectedProvince("ALL");
                setSearchQuery("");
              }}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
            >
              <X className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {statusSummaries.map((summary) => {
            const isSelected = selectedStatusFilter === summary.status;
            const cfg = ELGU_STATUS_CONFIG[summary.status];

            return (
              <div
                key={summary.status}
                onClick={() => setSelectedStatusFilter(isSelected ? "ALL" : summary.status)}
                className={`relative p-4 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden group ${
                  isSelected
                    ? "bg-[#131B2D] border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.25)] ring-1 ring-blue-500"
                    : "bg-[#0C101A] border-[#1A2235] hover:bg-[#101624] hover:border-slate-700"
                }`}
              >
                {/* Top status indicator bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 transition-all"
                  style={{ backgroundColor: cfg.color }}
                />

                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-lg bg-[#07090E] border border-[#1A2235]">
                    {getStatusIcon(summary.status)}
                  </div>
                  <span
                    className="text-xs font-bold font-mono px-2 py-0.5 rounded-full border"
                    style={{
                      color: cfg.textColor,
                      backgroundColor: cfg.bgColor,
                      borderColor: cfg.borderColor,
                    }}
                  >
                    {summary.percentage}%
                  </span>
                </div>

                <div className="mt-3">
                  <h5 className="text-sm font-bold text-white tracking-tight">{summary.status}</h5>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold font-mono text-white">{summary.count}</span>
                    <span className="text-[11px] text-slate-400 font-medium">LGUs</span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#1A2235] flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 truncate">{summary.keyMetricLabel}</span>
                  <span className="font-semibold font-mono text-slate-200">{summary.keyMetric}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3 Active Module / Version Highlight Cards */}
      <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Active Module Deployments (V1 BPCO, V1 BPBC, V2 eLGU)</h4>
          </div>
          <span className="text-[11px] text-slate-400">Click a version to filter</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {versionAnalytics.map((v) => {
            const isSelected = selectedVersionFilter === v.key;
            const cfg = ELGU_VERSION_CONFIG[v.key];

            return (
              <div
                key={v.key}
                onClick={() => setSelectedVersionFilter(isSelected ? "ALL" : v.key)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? "bg-[#131B2D] border-blue-500 ring-1 ring-blue-500 shadow-md"
                    : "bg-[#07090E] border-[#1A2235] hover:bg-[#0F1420] hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-8 rounded-full" style={{ backgroundColor: v.color }} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white font-mono">{v.key}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ backgroundColor: cfg.badgeBg, color: cfg.badgeText, border: `1px solid ${cfg.badgeBorder}` }}>
                        {v.totalCount} LGUs
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{v.name}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-emerald-400">{v.liveCount} Live</div>
                  {v.uatCount > 0 && <div className="text-[10px] font-mono text-purple-400">{v.uatCount} in UAT</div>}
                  {v.buildUpCount > 0 && <div className="text-[10px] font-mono text-blue-400">{v.buildUpCount} Build UP</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Tab: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Donut Chart: Status Distribution */}
            <div className="lg:col-span-5 bg-[#0C101A] border border-[#1A2235] rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-blue-400" />
                    Deployment Status Distribution
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">Total monitored: {lgus.length} LGUs in Region V</p>
                </div>
              </div>

              <div className="h-60 relative my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="#0C101A"
                      strokeWidth={2}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "#07090E",
                        borderColor: "#1A2235",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(val: any, name: any, item: any) => [
                        `${val} LGUs (${item.payload.percentage}%)`,
                        name,
                      ]}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold font-mono text-white">{lgus.length}</span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total LGUs</span>
                </div>
              </div>

              {/* Status List Legend with Fast Filter */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#1A2235]">
                {statusSummaries.map((item) => (
                  <button
                    key={item.status}
                    onClick={() => setSelectedStatusFilter(selectedStatusFilter === item.status ? "ALL" : item.status)}
                    className={`flex items-center justify-between p-2 rounded-lg text-left transition-colors text-xs ${
                      selectedStatusFilter === item.status ? "bg-blue-500/10 border border-blue-500/30" : "bg-[#07090E] border border-[#1A2235]/60 hover:bg-[#111520]"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.accentColor }} />
                      <span className="text-slate-300 truncate font-medium">{item.status}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono">
                      <span className="text-white font-bold">{item.count}</span>
                      <span className="text-slate-500 text-[10px]">({item.percentage}%)</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Area Chart: Rollout Trajectory */}
            <div className="lg:col-span-7 bg-[#0C101A] border border-[#1A2235] rounded-xl p-5 flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Regional Deployment Progression & Velocity
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">Historical movement across stages over the past 12 months</p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> 61 Live Deployed LGUs</span>
                </div>
              </div>

              <div className="h-64 my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsAreaChart data={ELGU_TRAJECTORY_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorLive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorUat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorBuild" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1A2235" />
                    <XAxis dataKey="month" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#1A2235', borderRadius: '8px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="Live" stroke="#10B981" strokeWidth={2} fill="url(#colorLive)" />
                    <Area type="monotone" dataKey="UAT" stroke="#8B5CF6" strokeWidth={2} fill="url(#colorUat)" />
                    <Area type="monotone" dataKey="Build UP" stroke="#3B82F6" strokeWidth={2} fill="url(#colorBuild)" />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  </RechartsAreaChart>
                </ResponsiveContainer>
              </div>

              {/* Conversion Pipeline summary */}
              <div className="pt-3 border-t border-[#1A2235] grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-[#07090E] p-2 rounded-lg border border-[#1A2235]">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">1. Discovery</p>
                  <p className="font-bold text-slate-300 mt-0.5">{statusSummaries.find(s => s.status === "No System")?.count} No System</p>
                </div>
                <div className="bg-[#07090E] p-2 rounded-lg border border-[#1A2235]">
                  <p className="text-[10px] text-blue-400 uppercase font-semibold">2. Build UP</p>
                  <p className="font-bold text-blue-300 mt-0.5">{statusSummaries.find(s => s.status === "Build UP")?.count} BUILDUPGLP</p>
                </div>
                <div className="bg-[#07090E] p-2 rounded-lg border border-[#1A2235]">
                  <p className="text-[10px] text-purple-400 uppercase font-semibold">3. Testing</p>
                  <p className="font-bold text-purple-300 mt-0.5">{statusSummaries.find(s => s.status === "UAT")?.count} in UAT</p>
                </div>
                <div className="bg-[#07090E] p-2 rounded-lg border border-[#1A2235]">
                  <p className="text-[10px] text-emerald-400 uppercase font-semibold">4. Operations</p>
                  <p className="font-bold text-emerald-300 mt-0.5">{statusSummaries.find(s => s.status === "Live")?.count} Live LGUs</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Active Modules (V1 BPCO, V1 BPBC, V2 eLGU) */}
      {activeTab === "versions" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {versionAnalytics.map((v) => {
              const cfg = ELGU_VERSION_CONFIG[v.key];
              return (
                <div key={v.key} className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded text-xs font-bold uppercase font-mono border" style={{ backgroundColor: cfg.badgeBg, color: cfg.badgeText, borderColor: cfg.badgeBorder }}>
                        {v.key}
                      </span>
                      <span className="text-xs font-bold font-mono text-emerald-400">{v.adoptionRate}% Regional Share</span>
                    </div>
                    <h4 className="text-base font-bold text-white mt-3">{v.fullName}</h4>
                    <p className="text-xs text-slate-400 mt-1">{v.desc}</p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-[#1A2235] space-y-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" /> Live Deployed
                      </span>
                      <span className="font-mono font-bold text-emerald-400">{v.liveCount} LGUs</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-400" /> In UAT Testing
                      </span>
                      <span className="font-mono font-bold text-purple-400">{v.uatCount} LGUs</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400" /> Build UP Phase
                      </span>
                      <span className="font-mono font-bold text-blue-400">{v.buildUpCount} LGUs</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold pt-1 border-t border-[#1A2235]/50">
                      <span className="text-slate-300">Total Deployment Base</span>
                      <span className="font-mono text-white">{v.totalCount} LGUs</span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedVersionFilter(v.key);
                        setActiveTab("directory");
                      }}
                      className="w-full mt-3 py-2 rounded-lg bg-[#1A2235] hover:bg-blue-600 text-slate-200 hover:text-white transition-colors text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      Filter Table by {v.key} <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Provincial Matrix */}
      {activeTab === "provincial" && (
        <div className="space-y-6">
          <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  Provincial Deployment & Active Module Matrix
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Distribution of Live, Build UP, UAT, Inactive, No System, and Own System across all 6 Bicol provinces
                </p>
              </div>
            </div>

            {/* Stacked Bar Chart per Province */}
            <div className="h-80 w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={provincialData} margin={{ top: 20, right: 20, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1A2235" />
                  <XAxis dataKey="province" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#07090E", borderColor: "#1A2235", borderRadius: "8px", fontSize: "12px" }}
                    cursor={{ fill: "#1A2235", opacity: 0.4 }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} />
                  <Bar dataKey="live" name="Live" fill="#10B981" stackId="a" />
                  <Bar dataKey="uat" name="UAT" fill="#8B5CF6" stackId="a" />
                  <Bar dataKey="buildUp" name="Build UP" fill="#3B82F6" stackId="a" />
                  <Bar dataKey="ownSystem" name="Own System" fill="#06B6D4" stackId="a" />
                  <Bar dataKey="inactive" name="Inactive" fill="#F59E0B" stackId="a" />
                  <Bar dataKey="noSystem" name="No System" fill="#64748B" stackId="a" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>

            {/* Provincial Statistics Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-slate-400 uppercase bg-[#07090E] border-y border-[#1A2235]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Province</th>
                    <th className="px-4 py-3 text-center font-semibold">Total LGUs</th>
                    <th className="px-4 py-3 text-center text-emerald-400 font-semibold">Live</th>
                    <th className="px-4 py-3 text-center text-purple-400 font-semibold">UAT</th>
                    <th className="px-4 py-3 text-center text-blue-400 font-semibold">Build UP</th>
                    <th className="px-4 py-3 text-center text-cyan-400 font-semibold">Own System</th>
                    <th className="px-4 py-3 text-center text-amber-400 font-semibold">Inactive</th>
                    <th className="px-4 py-3 text-center text-slate-400 font-semibold">No System</th>
                    <th className="px-4 py-3 text-center text-emerald-300 font-semibold">V2 eLGU</th>
                    <th className="px-4 py-3 text-center text-blue-300 font-semibold">V1 BPBC</th>
                    <th className="px-4 py-3 text-center text-purple-300 font-semibold">V1 BPCO</th>
                    <th className="px-4 py-3 text-right font-semibold">Readiness</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2235]/60">
                  {provincialData.map((p) => (
                    <tr key={p.province} className="hover:bg-[#111520] transition-colors">
                      <td className="px-4 py-3 font-bold text-white">{p.province}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-200">{p.total}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-emerald-400 bg-emerald-500/5">{p.live}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-purple-400 bg-purple-500/5">{p.uat}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-blue-400 bg-blue-500/5">{p.buildUp}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-cyan-400 bg-cyan-500/5">{p.ownSystem}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-amber-400 bg-amber-500/5">{p.inactive}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-slate-400 bg-slate-500/5">{p.noSystem}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-emerald-300">{p.v2Elgu}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-blue-300">{p.v1Bpbc}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-purple-300">{p.v1Bpco}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-blue-400">
                        <div className="flex items-center justify-end gap-2">
                          <span>{p.readinessScore}%</span>
                          <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${p.readinessScore}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedProvince(p.province);
                            setActiveTab("directory");
                          }}
                          className="px-2.5 py-1 rounded bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white transition-colors text-[11px] font-medium"
                        >
                          View LGUs
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: LGU Directory & Telemetry Table */}
      {(activeTab === "directory" || activeTab === "overview") && (
        <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl overflow-hidden">
          {/* Header Controls: Filters & Search */}
          <div className="p-4 border-b border-[#1A2235] bg-[#0E1422] space-y-3">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  LGU Deployment & Version Telemetry
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing {filteredLgus.length} of {lgus.length} local government units
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search LGU, province, version, focal..."
                  className="w-full rounded-lg border border-[#1A2235] bg-[#07090E] pl-9 pr-4 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1A2235]/60">
              {/* Status Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Status:
                </span>
                <button
                  onClick={() => setSelectedStatusFilter("ALL")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    selectedStatusFilter === "ALL"
                      ? "bg-white text-slate-900"
                      : "bg-[#07090E] text-slate-400 border border-[#1A2235] hover:text-white"
                  }`}
                >
                  All ({lgus.length})
                </button>
                {(["Live", "Build UP", "UAT", "Inactive", "No System", "Own System"] as ElguDeploymentStatus[]).map((status) => {
                  const cfg = ELGU_STATUS_CONFIG[status];
                  const count = lgus.filter((l) => l.status === status).length;
                  const isActive = selectedStatusFilter === status;

                  return (
                    <button
                      key={status}
                      onClick={() => setSelectedStatusFilter(isActive ? "ALL" : status)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all flex items-center gap-1.5 ${
                        isActive
                          ? "ring-1 ring-white/50"
                          : "hover:border-slate-600 opacity-80 hover:opacity-100"
                      }`}
                      style={{
                        backgroundColor: cfg.bgColor,
                        color: cfg.textColor,
                        borderColor: cfg.borderColor,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                      {status} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Version & Province Dropdowns */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedVersionFilter}
                  onChange={(e) => setSelectedVersionFilter(e.target.value as any)}
                  className="bg-[#07090E] border border-[#1A2235] text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:border-blue-500 focus:outline-none"
                >
                  <option value="ALL">All Active Modules</option>
                  <option value="V2 eLGU">V2 eLGU</option>
                  <option value="V1 BPBC">V1 BPBC</option>
                  <option value="V1 BPCO">V1 BPCO</option>
                  <option value="In-House">Own / In-House</option>
                  <option value="None">No Active Version</option>
                </select>

                <select
                  value={selectedProvince}
                  onChange={(e) => setSelectedProvince(e.target.value)}
                  className="bg-[#07090E] border border-[#1A2235] text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:border-blue-500 focus:outline-none"
                >
                  <option value="ALL">All Provinces</option>
                  {PROVINCES_LIST.map((p) => (
                    <option key={p} value={p}>{p}</option>
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
                  <th className="px-5 py-3.5 font-semibold">LGU Name & Province</th>
                  <th className="px-4 py-3.5 font-semibold">District</th>
                  <th className="px-4 py-3.5 font-semibold">Deployment Status</th>
                  <th className="px-4 py-3.5 font-semibold">Active Module / Version</th>
                  <th className="px-4 py-3.5 font-semibold">DICT Focal</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2235]/50">
                {filteredLgus.map((lgu) => {
                  const cfg = ELGU_STATUS_CONFIG[lgu.status];

                  return (
                    <tr key={lgu.id} className="hover:bg-[#111520] transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-white text-sm">{lgu.name}</div>
                        <div className="text-[11px] text-slate-400">{lgu.province}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#141B2D] border border-[#1E293B] text-slate-300">
                          {lgu.classification}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border"
                          style={{
                            backgroundColor: cfg.bgColor,
                            color: cfg.textColor,
                            borderColor: cfg.borderColor,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                          {lgu.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {lgu.versions.length > 0 ? (
                            lgu.versions.map((ver) => {
                              const vcfg = ELGU_VERSION_CONFIG[ver];
                              return (
                                <span
                                  key={ver}
                                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border"
                                  style={{
                                    backgroundColor: vcfg?.badgeBg || "rgba(255,255,255,0.05)",
                                    color: vcfg?.badgeText || "#fff",
                                    borderColor: vcfg?.badgeBorder || "rgba(255,255,255,0.1)",
                                  }}
                                >
                                  {ver}
                                </span>
                              );
                            })
                          ) : lgu.status === "Own System" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                              In-House System
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-300 font-medium">{lgu.dictFocal}</td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedLgu(lgu)}
                          className="px-2.5 py-1 rounded bg-[#1A2235] hover:bg-blue-600 text-slate-300 hover:text-white transition-colors text-[11px] font-medium flex items-center gap-1 ml-auto"
                        >
                          <Eye className="w-3 h-3" /> Dossier
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredLgus.length === 0 && (
              <div className="p-10 text-center text-slate-500">
                <p className="text-sm">No LGUs found matching the selected filters.</p>
                <button
                  onClick={() => { 
                    setSelectedStatusFilter("ALL"); 
                    setSelectedVersionFilter("ALL"); 
                    setSelectedProvince("ALL"); 
                    setSearchQuery(""); 
                  }}
                  className="mt-2 text-xs text-blue-400 hover:underline"
                >
                  Reset all filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LGU Dossier Modal */}
      {selectedLgu && (
        <Modal
          isOpen={!!selectedLgu}
          onClose={() => setSelectedLgu(null)}
          title={`LGU Deployment Dossier: ${selectedLgu.name}`}
        >
          <div className="space-y-5 text-sm">
            {/* Status Header Badge */}
            <div className="p-4 rounded-xl border flex items-center justify-between bg-[#07090E]" style={{ borderColor: ELGU_STATUS_CONFIG[selectedLgu.status].borderColor }}>
              <div className="flex items-center gap-3">
                {getStatusIcon(selectedLgu.status)}
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-base text-white">{selectedLgu.name}</h4>
                    <span className="text-xs text-slate-400">({selectedLgu.province})</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedLgu.classification} • DICT Focal: {selectedLgu.dictFocal}</p>
                </div>
              </div>
              <span
                className="px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider"
                style={{
                  backgroundColor: ELGU_STATUS_CONFIG[selectedLgu.status].bgColor,
                  color: ELGU_STATUS_CONFIG[selectedLgu.status].textColor,
                  borderColor: ELGU_STATUS_CONFIG[selectedLgu.status].borderColor,
                }}
              >
                {selectedLgu.status}
              </span>
            </div>

            {/* Active Modules / Version Info */}
            <div className="bg-[#0C101A] p-3.5 rounded-lg border border-[#1A2235]">
              <h5 className="text-xs font-bold uppercase text-slate-400 mb-2">Active eLGU Version / Module</h5>
              <div className="flex flex-wrap gap-2">
                {selectedLgu.versions.length > 0 ? (
                  selectedLgu.versions.map(v => (
                    <div key={v} className="p-2 rounded-lg border flex items-center gap-2" style={{ backgroundColor: ELGU_VERSION_CONFIG[v].badgeBg, borderColor: ELGU_VERSION_CONFIG[v].badgeBorder }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ELGU_VERSION_CONFIG[v].color }} />
                      <div>
                        <p className="font-bold text-xs" style={{ color: ELGU_VERSION_CONFIG[v].badgeText }}>{v}</p>
                        <p className="text-[10px] text-slate-400">{ELGU_VERSION_CONFIG[v].desc}</p>
                      </div>
                    </div>
                  ))
                ) : selectedLgu.status === "Own System" ? (
                  <div className="p-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs">
                    <strong>In-House / Custom Engine:</strong> {selectedLgu.systemName || "Local municipal revenue system"}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No eLGU version deployed yet (manual operations or onboarding stage).</p>
                )}
              </div>

              {selectedLgu.notes && (
                <div className="mt-3 pt-2.5 border-t border-[#1A2235] text-xs text-blue-300">
                  <strong>Notes:</strong> {selectedLgu.notes}
                </div>
              )}
              {selectedLgu.blockers && (
                <div className="mt-2 pt-2 border-t border-[#1A2235] text-xs text-amber-300">
                  <strong>Blockers / Action Needed:</strong> {selectedLgu.blockers}
                </div>
              )}
            </div>

            {/* Key Telemetry Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-[#07090E] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Progress</span>
                <p className="text-lg font-bold text-white font-mono mt-0.5">{selectedLgu.progressPercentage}%</p>
              </div>
              <div className="p-3 bg-[#07090E] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Monthly Vol.</span>
                <p className="text-lg font-bold text-white font-mono mt-0.5">{selectedLgu.monthlyTransactions.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-[#07090E] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Last Assessed</span>
                <p className="text-xs font-bold text-slate-300 font-mono mt-1">{selectedLgu.lastUpdated || "Current"}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-3 border-t border-[#1A2235]">
              <button
                onClick={() => setSelectedLgu(null)}
                className="px-4 py-2 rounded-lg bg-[#1A2235] hover:bg-[#25304b] text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
