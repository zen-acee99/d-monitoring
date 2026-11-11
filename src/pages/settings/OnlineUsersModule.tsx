import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Radio,
  Users,
  Search,
  RefreshCw,
  Shield,
  ShieldAlert,
  Clock,
  Laptop,
  MapPin,
  ExternalLink,
  CheckCircle2,
  Copy,
  LayoutGrid,
  List,
  Sparkles,
  Wifi,
  WifiOff,
  UserCheck,
  UserX,
  Eye,
  Crown,
} from "lucide-react";
import { getCurrentUser } from "@/services/authStore";
import { fetchOnlineUsers, OnlineUserRecord, PresenceStats } from "@/services/presenceService";

interface OnlineUsersModuleProps {
  isAceUser?: boolean;
}

export function OnlineUsersModule({ isAceUser: propIsAce }: OnlineUsersModuleProps) {
  const currentUser = getCurrentUser();
  const currentUserEmail = (currentUser?.email || "").toLowerCase().trim();
  const isSuperAdmin =
    propIsAce ??
    (currentUserEmail === "ace.malto@dict.gov.ph" || currentUserEmail === "acemm.1599@gmail.com");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<OnlineUserRecord[]>([]);
  const [stats, setStats] = useState<PresenceStats>({
    totalUsers: 0,
    onlineCount: 0,
    awayCount: 0,
    offlineCount: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // Filters & Controls
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "away" | "offline">("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const loadData = useCallback(async (isManual = false) => {
    if (!isSuperAdmin) return;
    if (isManual) setRefreshing(true);
    setError(null);

    const res = await fetchOnlineUsers(currentUserEmail);
    if (res.success) {
      setUsers(res.users);
      setStats(res.stats);
      setLastRefreshedAt(new Date());
    } else {
      setError(res.error || "Failed to load presence data");
    }

    setLoading(false);
    if (isManual) setRefreshing(false);
  }, [currentUserEmail, isSuperAdmin]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Auto-refresh interval (15 seconds)
  useEffect(() => {
    if (!autoRefresh || !isSuperAdmin) return;
    const interval = setInterval(() => {
      loadData(false);
    }, 15_000);
    return () => clearInterval(interval);
  }, [autoRefresh, isSuperAdmin, loadData]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(text);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Unique roles and provinces for filter dropdowns
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.role) set.add(u.role);
    });
    return Array.from(set).sort();
  }, [users]);

  const availableProvinces = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.focalProvince) set.add(u.focalProvince);
    });
    return Array.from(set).sort();
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Status filter
      if (statusFilter === "online" && user.presenceStatus !== "online") return false;
      if (statusFilter === "away" && user.presenceStatus !== "away") return false;
      if (statusFilter === "offline" && user.presenceStatus !== "offline") return false;

      // Role filter
      if (roleFilter !== "all" && user.role !== roleFilter) return false;

      // Province filter
      if (provinceFilter !== "all" && user.focalProvince !== provinceFilter) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesName = user.name?.toLowerCase().includes(term);
        const matchesEmail = user.email?.toLowerCase().includes(term);
        const matchesRole = user.role?.toLowerCase().includes(term);
        const matchesProvince = user.focalProvince?.toLowerCase().includes(term);
        const matchesPage = user.currentPage?.toLowerCase().includes(term);
        if (!matchesName && !matchesEmail && !matchesRole && !matchesProvince && !matchesPage) {
          return false;
        }
      }

      return true;
    });
  }, [users, statusFilter, roleFilter, provinceFilter, searchTerm]);

  // Strict Super Admin Access Guard
  if (!isSuperAdmin) {
    return (
      <div className="bg-[#0C101D] border border-red-500/30 rounded-2xl p-8 text-center max-w-2xl mx-auto my-8 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-black text-white tracking-wide">ACCESS RESTRICTED</h2>
        <p className="text-sm text-slate-400 mt-2">
          The <span className="text-white font-semibold">Online Users & Live Presence</span> module is exclusively restricted to Super Admin.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-mono text-red-300">
          Authorized Principal: ace.malto@dict.gov.ph
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Module Banner / Header */}
      <div className="bg-[#0A0E1A] border border-[#18233C] rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <Radio className="w-3 h-3 text-emerald-400" />
                LIVE PRESENCE MONITOR
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/15 border border-purple-500/30 text-purple-300">
                <Crown className="w-3 h-3 text-amber-400" />
                Super Admin Only (ace.malto@dict.gov.ph)
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              Online Users Directory
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Real-time activity tracking of DICT Region V personnel. See who is currently online, idle, or offline, including active workspace pages, devices, and session history.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Auto-refresh Switch */}
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                autoRefresh
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-[#111728] border-[#1C2844] text-slate-400 hover:text-slate-200"
              }`}
              title="Automatically poll for presence changes every 15 seconds"
            >
              <div
                className={`w-2 h-2 rounded-full transition-all ${
                  autoRefresh ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-slate-600"
                }`}
              />
              <span>Auto-refresh (15s)</span>
            </button>

            {/* Manual Refresh Button */}
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 bg-[#111728] hover:bg-[#18233C] text-slate-200 border border-[#1C2844] hover:border-slate-600 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Refresh online status from Turso cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Updating..." : "Refresh"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Personnel */}
        <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Personnel
            </div>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {stats.totalUsers}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Registered in system</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
        </div>

        {/* Currently Online */}
        <div className="bg-[#0C101D] border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
          <div>
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Online Now
            </div>
            <div className="text-2xl font-black text-emerald-300 font-mono mt-1 flex items-baseline gap-2">
              <span>{stats.onlineCount}</span>
              <span className="text-[11px] text-emerald-400/80 font-normal">
                ({stats.totalUsers > 0 ? Math.round((stats.onlineCount / stats.totalUsers) * 100) : 0}%)
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Active in last 90s</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Wifi className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        {/* Away / Idle */}
        <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
              Away / Idle
            </div>
            <div className="text-2xl font-black text-amber-300 font-mono mt-1">
              {stats.awayCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Active within 5 mins</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        {/* Offline */}
        <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Offline
            </div>
            <div className="text-2xl font-black text-slate-300 font-mono mt-1">
              {stats.offlineCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">No active heartbeat</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
            <WifiOff className="w-5 h-5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl p-4 shadow-lg flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, role, or province..."
            className="w-full pl-10 pr-4 py-2 bg-[#07090E] border border-[#1C2844] focus:border-blue-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="bg-[#07090E] p-1 border border-[#1C2844] rounded-xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All ({stats.totalUsers})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("online")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === "online"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30"
                  : "text-slate-400 hover:text-emerald-300"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Online ({stats.onlineCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("away")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === "away"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-900/30"
                  : "text-slate-400 hover:text-amber-300"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Away ({stats.awayCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("offline")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === "offline"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Offline ({stats.offlineCount})
            </button>
          </div>

          {/* Role Dropdown */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-[#07090E] border border-[#1C2844] text-slate-300 text-xs rounded-xl px-3 py-2 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">All Roles</option>
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          {/* Province Dropdown */}
          <select
            value={provinceFilter}
            onChange={(e) => setProvinceFilter(e.target.value)}
            className="bg-[#07090E] border border-[#1C2844] text-slate-300 text-xs rounded-xl px-3 py-2 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">All Provinces</option>
            {availableProvinces.map((prov) => (
              <option key={prov} value={prov}>
                {prov}
              </option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="bg-[#07090E] p-1 border border-[#1C2844] rounded-xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "table" ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "grid" ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
              title="Grid Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-xs text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadData(true)}
            className="underline font-bold hover:text-white ml-2"
          >
            Try Again
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl p-12 text-center">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
          <div className="text-sm font-semibold text-white">Loading online users & presence telemetry...</div>
          <div className="text-xs text-slate-500 mt-1">Connecting to Turso Cloud presence store</div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl p-12 text-center">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <div className="text-sm font-bold text-white">No personnel matching the current criteria</div>
          <div className="text-xs text-slate-500 mt-1">
            Try adjusting your search query or switching the status filter.
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("all");
              setRoleFilter("all");
              setProvinceFilter("all");
            }}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === "table" ? (
        /* TABLE VIEW */
        <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] font-extrabold text-slate-400 uppercase bg-[#090C15] border-b border-[#18233C] tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Personnel & Role
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Live Status
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Active Workspace Page
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Unit / Province
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Last Seen
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Device & IP
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141C30]">
                {filteredUsers.map((user) => {
                  const isOnline = user.presenceStatus === "online";
                  const isAway = user.presenceStatus === "away";
                  const isAce =
                    user.email.toLowerCase() === "ace.malto@dict.gov.ph" ||
                    user.email.toLowerCase() === "acemm.1599@gmail.com";

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-[#111728]/70 transition-colors group"
                    >
                      {/* Personnel Name & Role */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {/* Avatar with Status Beacon */}
                          <div className="relative">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 border border-[#1C2844] flex items-center justify-center text-xs font-black text-white shadow-inner">
                              {user.name
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0C101D] ${
                                isOnline
                                  ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                                  : isAway
                                  ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                                  : "bg-slate-600"
                              }`}
                            />
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                              <span>{user.name}</span>
                              {isAce && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  SUPER ADMIN
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-slate-400">{user.email}</span>
                              <span className="text-slate-600">•</span>
                              <span className="text-[11px] text-slate-400 font-semibold">{user.role}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Live Status Pill */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            <span>Online</span>
                          </span>
                        ) : isAway ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>Away</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 border border-slate-700 text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            <span>Offline</span>
                          </span>
                        )}
                      </td>

                      {/* Active Workspace Page */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {isOnline || isAway ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-mono">
                              {user.currentPage || "/overview"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600 font-mono">—</span>
                        )}
                      </td>

                      {/* Unit / Province */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span>{user.focalProvince || user.region || "Region V"}</span>
                        </div>
                      </td>

                      {/* Last Seen */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="text-xs font-semibold text-slate-300">
                          {user.lastSeenText}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {user.lastLogin && user.lastLogin !== "Never"
                            ? user.lastLogin.replace(/Just now \((.*)\)/, "$1")
                            : "No session record"}
                        </div>
                      </td>

                      {/* Device & IP */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Laptop className="w-3.5 h-3.5 text-slate-500" />
                          <span>{user.clientDevice || "Web Browser"}</span>
                        </div>
                        {user.ipAddress && (
                          <div className="text-[10px] font-mono text-slate-500">
                            {user.ipAddress}
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(user.email)}
                          className="p-1.5 rounded-lg bg-[#111728] border border-[#1C2844] hover:border-slate-500 text-slate-400 hover:text-white transition-all cursor-pointer inline-flex items-center gap-1 text-[11px]"
                          title="Copy Email"
                        >
                          {copiedEmail === user.email ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-3.5 bg-[#090C15] border-t border-[#18233C] flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing <span className="text-white font-bold">{filteredUsers.length}</span> of{" "}
              <span className="text-white font-bold">{users.length}</span> registered personnel
            </div>
            <div className="text-[11px] text-slate-500">
              Last synchronized: {lastRefreshedAt.toLocaleTimeString()}
            </div>
          </div>
        </div>
      ) : (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUsers.map((user) => {
            const isOnline = user.presenceStatus === "online";
            const isAway = user.presenceStatus === "away";
            const isAce =
              user.email.toLowerCase() === "ace.malto@dict.gov.ph" ||
              user.email.toLowerCase() === "acemm.1599@gmail.com";

            return (
              <div
                key={user.id}
                className={`bg-[#0C101D] rounded-2xl p-4 border transition-all relative overflow-hidden flex flex-col justify-between ${
                  isOnline
                    ? "border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:border-emerald-500/50"
                    : isAway
                    ? "border-amber-500/30 hover:border-amber-500/50"
                    : "border-[#18233C] hover:border-slate-700"
                }`}
              >
                <div>
                  {/* Top Bar with Status Pill */}
                  <div className="flex items-center justify-between mb-3">
                    {isOnline ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Online Now
                      </span>
                    ) : isAway ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Away
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-400">
                        Offline
                      </span>
                    )}

                    <span className="text-[10px] text-slate-500 font-medium">
                      {user.lastSeenText}
                    </span>
                  </div>

                  {/* User Profile Info */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 border border-[#1C2844] flex items-center justify-center text-sm font-black text-white shrink-0 shadow-inner">
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-sm truncate flex items-center gap-1.5">
                        <span className="truncate">{user.name}</span>
                        {isAce && (
                          <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Super Admin" />
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-semibold truncate mt-0.5">
                        {user.role}
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 text-[11px] pt-2 border-t border-[#18233C]/60 text-slate-400">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Email:</span>
                      <span className="font-mono text-slate-300 truncate max-w-[170px]">
                        {user.email}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Unit / Province:</span>
                      <span className="text-slate-300 font-semibold">
                        {user.focalProvince || user.region || "Region V"}
                      </span>
                    </div>

                    {isOnline && user.currentPage && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Active Page:</span>
                        <span className="font-mono text-blue-400 truncate max-w-[170px]">
                          {user.currentPage}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-4 pt-3 border-t border-[#18233C] flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Laptop className="w-3 h-3 text-slate-600" />
                    {user.clientDevice || "Web Browser"}
                  </span>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(user.email)}
                    className="p-1.5 rounded-lg bg-[#111728] border border-[#1C2844] hover:border-slate-500 text-slate-400 hover:text-white transition-all cursor-pointer"
                    title="Copy Email"
                  >
                    {copiedEmail === user.email ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
