import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Wifi,
  Building2,
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  Radio,
  Server,
  Globe,
  Activity,
  Database,
  FolderKanban,
  Search,
  Filter,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Layers,
  Table as TableIcon,
  BarChart3,
  Sparkles,
  ArrowUpRight,
  FileText,
} from "lucide-react";
import { PROJECTS, Project } from "@/config/projects";
import { PROJECT_SCHEMAS, ProjectSchema } from "@/data/projectDataStore";
import { projectApi } from "@/services/api";
import { FreeWifiAnalytics } from "@/components/freewifi/FreeWifiAnalytics";
import { ElguAnalytics } from "@/components/elgu/ElguAnalytics";
import { PnpkiAnalytics } from "@/components/pnpki/PnpkiAnalytics";
import { CybersecurityAnalytics } from "@/components/cybersecurity/CybersecurityAnalytics";
import { IlcdbAnalytics } from "@/components/ilcdb/IlcdbAnalytics";
import { MissAnalytics } from "@/components/miss/MissAnalytics";
import { getCurrentUser, hasModuleAccess, AUTH_EVENT } from "@/services/authStore";
import { UserRecord } from "@/data/userStore";
import { Lock } from "lucide-react";
import { UniversalReportModal } from "@/components/reports/UniversalReportModal";

// Map project ID to icon component
const PROJECT_ICONS: Record<string, React.ElementType> = {
  freewifi: Wifi,
  elgu: Building2,
  pnpki: ShieldCheck,
  cybersecurity: ShieldAlert,
  ilcdb: GraduationCap,
  gecs: Radio,
  govnet: Server,
  nbp: Server,
  egovph: Globe,
  miss: Activity,
  iidb: FolderKanban,
};

export function DashboardProjectsTabs() {
  const [currentUser, setCurrentUserState] = useState<UserRecord | null>(() => getCurrentUser());
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    const user = getCurrentUser();
    const firstAllowed = PROJECTS.find((p) => hasModuleAccess(user, `MOD_${p.id.toUpperCase()}`));
    return firstAllowed ? firstAllowed.id : "freewifi";
  });
  const [activeViewMode, setActiveViewMode] = useState<"table" | "analytics">("table");
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleAuth = () => {
      const u = getCurrentUser();
      setCurrentUserState(u);
      // If current activeProjectId is not accessible, switch to an accessible one if possible
      if (u && !hasModuleAccess(u, `MOD_${activeProjectId.toUpperCase()}`)) {
        const firstAllowed = PROJECTS.find((p) => hasModuleAccess(u, `MOD_${p.id.toUpperCase()}`));
        if (firstAllowed) setActiveProjectId(firstAllowed.id);
      }
    };
    window.addEventListener(AUTH_EVENT, handleAuth);
    window.addEventListener("dict_users_updated", handleAuth);
    return () => {
      window.removeEventListener(AUTH_EVENT, handleAuth);
      window.removeEventListener("dict_users_updated", handleAuth);
    };
  }, [activeProjectId]);

  // Records state mapped by project ID
  const [recordsCache, setRecordsCache] = useState<Record<string, Record<string, any>[]>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [countsMap, setCountsMap] = useState<Record<string, number>>({});

  // Table filters & pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Active project metadata and schema
  const activeProject = useMemo(() => {
    return PROJECTS.find((p) => p.id === activeProjectId) || PROJECTS[0];
  }, [activeProjectId]);

  const activeSchema: ProjectSchema = useMemo(() => {
    return PROJECT_SCHEMAS[activeProjectId] || PROJECT_SCHEMAS.freewifi;
  }, [activeProjectId]);

  // Load table counts for all projects from /api/health
  const loadCounts = async () => {
    try {
      const health = await projectApi.checkHealth();
      if (health && health.projectTables) {
        setCountsMap(health.projectTables);
      }
    } catch (e) {
      console.warn("Failed to load table counts", e);
    }
  };

  useEffect(() => {
    loadCounts();
  }, []);

  // Fetch records from Turso database table whenever active project changes
  const loadActiveRecords = async (force: boolean = false) => {
    if (!force && recordsCache[activeProjectId] !== undefined) {
      return;
    }

    setLoading(true);
    try {
      const data = await projectApi.getTableRecords(activeProjectId);
      if (Array.isArray(data)) {
        setRecordsCache((prev) => ({ ...prev, [activeProjectId]: data }));
        setCountsMap((prev) => ({ ...prev, [activeProjectId]: data.length }));
      }
    } catch (err) {
      console.error(`Failed to load ${activeProjectId} records`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveRecords();
    setSearchQuery("");
    setProvinceFilter("ALL");
    setStatusFilter("ALL");
    setCurrentPage(1);
  }, [activeProjectId]);

  // Reactive listener: automatically reload records and project counts on any database update
  useEffect(() => {
    const handleDataUpdate = (e?: any) => {
      const customEv = e as CustomEvent<any>;
      const targetProj = customEv?.detail?.projectId;
      if (targetProj) {
        setRecordsCache((prev) => {
          const next = { ...prev };
          delete next[targetProj];
          return next;
        });
      } else {
        setRecordsCache({});
      }
      loadCounts();
      loadActiveRecords(true);
    };

    window.addEventListener("dict_records_updated", handleDataUpdate);
    window.addEventListener("dict_project_data_updated", handleDataUpdate);
    window.addEventListener("dict_freewifi_updated", handleDataUpdate);
    return () => {
      window.removeEventListener("dict_records_updated", handleDataUpdate);
      window.removeEventListener("dict_project_data_updated", handleDataUpdate);
      window.removeEventListener("dict_freewifi_updated", handleDataUpdate);
    };
  }, [activeProjectId]);

  // Current active records
  const currentRecords = useMemo(() => {
    return recordsCache[activeProjectId] || [];
  }, [recordsCache, activeProjectId]);

  // Extract unique provinces for the active dataset
  const availableProvinces = useMemo(() => {
    const set = new Set<string>();
    currentRecords.forEach((r) => {
      if (r.province) set.add(r.province);
    });
    return Array.from(set).sort();
  }, [currentRecords]);

  // Extract unique statuses for the active dataset
  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    currentRecords.forEach((r) => {
      if (r.status) set.add(r.status);
    });
    return Array.from(set).sort();
  }, [currentRecords]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return currentRecords.filter((record) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === "" ||
        Object.values(record).some((val) =>
          String(val).toLowerCase().includes(q)
        );

      const matchesProvince =
        provinceFilter === "ALL" || record.province === provinceFilter;

      const matchesStatus =
        statusFilter === "ALL" || record.status === statusFilter;

      return matchesSearch && matchesProvince && matchesStatus;
    });
  }, [currentRecords, searchQuery, provinceFilter, statusFilter]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Status metrics
  const activeCount = useMemo(() => {
    return currentRecords.filter((r) =>
      ["Active", "Live", "Operational", "Completed", "Deployed", "PROCESSED"].includes(
        String(r.status)
      )
    ).length;
  }, [currentRecords]);

  return (
    <div className="bg-[#0C101A] border border-[#1A2235] rounded-2xl p-5 md:p-6 shadow-2xl space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1A2235]/70 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Project Data & Operations Explorer
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Turso Cloud Database Connected
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Browse, search, and inspect real-time provincial records and deep analytics for each DICT project
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer"
            title={`Generate official executive report for ${activeProject.name}`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Generate Report</span>
          </button>

          <button
            onClick={() => loadActiveRecords(true)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111520] hover:bg-[#1A2235] border border-[#1A2235] text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Reload from Turso Database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${loading ? "animate-spin" : ""}`} />
            <span>Sync DB</span>
          </button>

          <Link
            to={`/projects/${activeProjectId}`}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all hover:translate-x-0.5"
          >
            <span>Full Project Page</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Horizontal Project Tabs */}
      <div className="relative">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 pt-0.5">
          {PROJECTS.map((proj) => {
            const Icon = PROJECT_ICONS[proj.id] || Database;
            const isActive = activeProjectId === proj.id;
            const hasTabAccess = hasModuleAccess(currentUser, `MOD_${proj.id.toUpperCase()}`);
            const count = countsMap[proj.id] ?? recordsCache[proj.id]?.length ?? 0;

            return (
              <button
                key={proj.id}
                onClick={() => {
                  if (!hasTabAccess) return;
                  setActiveProjectId(proj.id);
                }}
                title={hasTabAccess ? proj.name : `Locked: No access to ${proj.name} (MOD_${proj.id.toUpperCase()})`}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 border shrink-0 select-none ${
                  !hasTabAccess
                    ? "bg-[#07090E] border-[#1A2235] text-slate-500/60 opacity-50 cursor-not-allowed"
                    : isActive
                    ? "bg-gradient-to-r from-blue-600/25 to-blue-500/10 border-blue-500/50 text-white shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30 cursor-pointer"
                    : "bg-[#07090E] border-[#1A2235] text-slate-400 hover:text-slate-200 hover:bg-[#111520] hover:border-slate-700 cursor-pointer"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-blue-400" : hasTabAccess ? "text-slate-500" : "text-amber-500/60"
                  }`}
                />
                <span>{proj.shortName}</span>
                {!hasTabAccess && <Lock className="w-3 h-3 text-amber-500/80 shrink-0" />}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    isActive
                      ? "bg-blue-500/30 text-blue-200 border border-blue-400/40"
                      : "bg-[#141C2E] text-slate-400 border border-slate-700/50"
                  }`}
                >
                  {count !== undefined ? count : 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Project Banner & Sub-Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-[#07090E] border border-[#1A2235]">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            {React.createElement(PROJECT_ICONS[activeProjectId] || Database, {
              className: "w-6 h-6",
            })}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-white tracking-tight">
                {activeProject.name}
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Table: <code className="text-blue-300 font-mono">{activeProjectId}</code>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
              {activeProject.description}
            </p>
          </div>
        </div>

        {/* Sub-view toggle (Live Data Table vs Deep Visual Analytics) */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0C101A] border border-[#1A2235] shrink-0 self-start md:self-auto">
          <button
            onClick={() => setActiveViewMode("table")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeViewMode === "table"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Database Table ({filteredRecords.length})</span>
          </button>

          <button
            onClick={() => setActiveViewMode("analytics")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeViewMode === "analytics"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Deep Analytics</span>
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: LIVE DATABASE TABLE */}
      {activeViewMode === "table" && (
        <div className="space-y-4">
          
          {/* Controls: Search, Province Filter, Status Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder={`Search ${activeProject.shortName} records...`}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#07090E] border border-[#1A2235] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
              {/* Province filter */}
              {availableProvinces.length > 0 && (
                <div className="flex items-center gap-1.5 bg-[#07090E] border border-[#1A2235] rounded-xl px-3 py-1.5 text-xs text-slate-300">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={provinceFilter}
                    onChange={(e) => {
                      setProvinceFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="ALL" className="bg-[#0C101A]">All Provinces</option>
                    {availableProvinces.map((prov) => (
                      <option key={prov} value={prov} className="bg-[#0C101A]">
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status filter */}
              {availableStatuses.length > 0 && (
                <div className="flex items-center gap-1.5 bg-[#07090E] border border-[#1A2235] rounded-xl px-3 py-1.5 text-xs text-slate-300">
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="ALL" className="bg-[#0C101A]">All Statuses</option>
                    {availableStatuses.map((st) => (
                      <option key={st} value={st} className="bg-[#0C101A]">
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <span className="text-xs text-slate-400 font-mono ml-auto sm:ml-2">
                Showing {filteredRecords.length} records
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-[#1A2235] bg-[#07090E] overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#111520] text-slate-400 font-semibold border-b border-[#1A2235]">
                  <tr>
                    <th className="py-3 px-4 w-12 text-slate-500 font-mono">#</th>
                    {activeSchema.columns.map((col) => (
                      <th
                        key={col.key}
                        className="py-3 px-4 whitespace-nowrap text-slate-300 font-semibold uppercase tracking-wider text-[11px]"
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2235]/60">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={activeSchema.columns.length + 2}
                        className="py-12 text-center text-slate-400"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                          <span>Loading records from Turso table "{activeProjectId}"...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={activeSchema.columns.length + 2}
                        className="py-14 text-center text-slate-400"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Database className="w-8 h-8 text-slate-600 stroke-[1.5]" />
                          <p className="text-slate-300 font-medium">No records found in table "{activeProjectId}".</p>
                          <p className="text-[11px] text-slate-500 max-w-sm">
                            This project table has no active records in the Turso Cloud database.
                          </p>
                          <Link
                            to="/settings/projects"
                            className="mt-2 px-3.5 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-semibold hover:bg-blue-600 hover:text-white transition-all inline-flex items-center gap-1.5"
                          >
                            Go to Project Data Management
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((row, idx) => {
                      const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                      return (
                        <tr
                          key={row.id || idx}
                          className="hover:bg-white/[0.02] transition-colors group"
                        >
                          <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                            {rowNumber}
                          </td>
                          {activeSchema.columns.map((col) => {
                            const val = row[col.key];

                            if (col.isStatus) {
                              const isGood =
                                val === "Active" ||
                                val === "Live" ||
                                val === "Operational" ||
                                val === "Completed" ||
                                val === "Deployed" ||
                                val === "PROCESSED";
                              const isWarn =
                                val === "Degraded" ||
                                val === "Build UP" ||
                                val === "Ongoing" ||
                                val === "Under Maintenance" ||
                                val === "Standby" ||
                                val === "Expiring Soon";

                              return (
                                <td key={col.key} className="py-3 px-4 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                      isGood
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                        : isWarn
                                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                        : "bg-red-500/10 text-red-400 border-red-500/30"
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        isGood
                                          ? "bg-emerald-400"
                                          : isWarn
                                          ? "bg-amber-400"
                                          : "bg-red-400"
                                      }`}
                                    />
                                    {val || "N/A"}
                                  </span>
                                </td>
                              );
                            }

                            if (col.isBadge) {
                              return (
                                <td key={col.key} className="py-3 px-4 whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded-md bg-[#141C2E] border border-slate-700 text-slate-300 text-[11px] font-medium">
                                    {val || "—"}
                                  </span>
                                </td>
                              );
                            }

                            return (
                              <td
                                key={col.key}
                                className="py-3 px-4 text-slate-300 whitespace-nowrap max-w-xs truncate font-medium"
                              >
                                {val !== undefined && val !== null ? String(val) : "—"}
                              </td>
                            );
                          })}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className="text-[11px] font-mono text-slate-500 group-hover:text-blue-400 transition-colors">
                              {row.id}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-[#111520] border-t border-[#1A2235] text-xs text-slate-400">
                <span>
                  Page <strong className="text-white">{currentPage}</strong> of{" "}
                  <strong className="text-white">{totalPages}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg bg-[#07090E] border border-[#1A2235] text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg bg-[#07090E] border border-[#1A2235] text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: DEEP VISUAL ANALYTICS */}
      {activeViewMode === "analytics" && (
        <div className="space-y-4">
          {activeProjectId === "freewifi" ? (
            <FreeWifiAnalytics />
          ) : activeProjectId === "elgu" ? (
            <ElguAnalytics />
          ) : activeProjectId === "pnpki" ? (
            <PnpkiAnalytics />
          ) : activeProjectId === "cybersecurity" ? (
            <CybersecurityAnalytics />
          ) : activeProjectId === "ilcdb" ? (
            <IlcdbAnalytics />
          ) : activeProjectId === "miss" ? (
            <MissAnalytics />
          ) : (
            /* Fallback generic analytics for GECS, eGOVPH, NBP, GovNet, IIDB */
            <div className="p-8 text-center rounded-xl bg-[#07090E] border border-[#1A2235] space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  {activeProject.name} Operational Metrics
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {currentRecords.length} records indexed in Turso database table "{activeProjectId}".
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setActiveViewMode("table")}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                >
                  View Database Table
                </button>
                <Link
                  to={`/projects/${activeProjectId}`}
                  className="px-4 py-2 rounded-lg bg-[#111520] hover:bg-[#1A2235] border border-[#1A2235] text-slate-200 text-xs font-semibold transition-colors"
                >
                  Open Project Details
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Project Operational Report Modal */}
      <UniversalReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        initialProjectId={activeProjectId}
        records={currentRecords}
      />
    </div>
  );
}
