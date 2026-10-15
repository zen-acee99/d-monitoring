import React, { useState, useMemo, useEffect } from "react";
import {
  Globe,
  Users,
  LifeBuoy,
  CreditCard,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Copy,
  ExternalLink,
  ChevronRight,
  Eye,
  X,
  Sparkles,
  MapPin,
  Calendar,
  Building,
  FileText,
  UserCheck,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  ShieldCheck,
  User,
  Phone,
  Mail,
  Award
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
  EgovphActivity,
  EgovphTicket,
  EgovPayActivity,
  EGOVPH_ACTIVITIES_DATA,
  EGOVPH_TICKETS_DATA,
  EGOVPAY_ACTIVITIES_DATA,
  EGOVPH_PROVINCES,
  getEgovphSummary,
  getEgovphProvincialBreakdown,
  getEgovphActivityTypeDistribution,
  getEgovphMonthlyTrajectory,
  getEgovphTicketStatusDistribution
} from "@/data/egovphData";
import { getStoredUsers, resolveProjectFocalPerson } from "@/data/userStore";
import { projectApi } from "@/services/api";
import { Modal } from "@/components/ui/modal";

interface EgovphAnalyticsProps {
  records?: EgovphActivity[];
}

export function EgovphAnalytics({ records }: EgovphAnalyticsProps) {
  // Use dynamically synced records if provided, otherwise default dataset
  const activities: EgovphActivity[] = useMemo(() => {
    if (records && records.length > 0) {
      return records.map((r: any, idx: number) => ({
        id: r.id || `egov-act-${idx}`,
        rowNo: r.rowNo || idx + 1,
        month: r.month || "Unknown",
        province: r.province || "Unknown",
        municipality: r.municipality || "",
        activityTitle: r.activityTitle || r.name || "eGovPH Activity",
        venue: r.venue || "",
        partnerName: r.partnerName || "",
        startDate: r.startDate || "",
        endDate: r.endDate || "",
        typeOfActivity: r.typeOfActivity || "Orientation",
        maleAttendees: Number(r.maleAttendees || 0),
        femaleAttendees: Number(r.femaleAttendees || 0),
        totalAttendees: Number(r.totalAttendees || (Number(r.maleAttendees || 0) + Number(r.femaleAttendees || 0))),
        afterActivityReport: r.afterActivityReport || "",
        todaInput: r.todaInput || "",
        dictPersonnel: r.dictPersonnel || "",
        fbPostingUrl: r.fbPostingUrl || "",
        rawPhotos: r.rawPhotos || "",
        status: r.status || "Completed",
        remarks: r.remarks || "",
        nga: r.nga,
        lgu: r.lgu,
        othersSector: r.othersSector,
      }));
    }
    return EGOVPH_ACTIVITIES_DATA;
  }, [records]);

  const [tickets, setTickets] = useState<EgovphTicket[]>(EGOVPH_TICKETS_DATA);
  const [egovPayList, setEgovPayList] = useState<EgovPayActivity[]>(EGOVPAY_ACTIVITIES_DATA);

  // Sync live tickets & eGovPay records from Turso database
  useEffect(() => {
    let active = true;
    projectApi.getTableRecords("egovph_tickets").then((res: any) => {
      const records = Array.isArray(res) ? res : res?.records;
      if (active && Array.isArray(records) && records.length > 0) {
        setTickets(records as EgovphTicket[]);
      }
    }).catch(() => {});

    projectApi.getTableRecords("egovpay").then((res: any) => {
      const records = Array.isArray(res) ? res : res?.records;
      if (active && Array.isArray(records) && records.length > 0) {
        setEgovPayList(records as EgovPayActivity[]);
      }
    }).catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"overview" | "activities" | "tickets" | "egovpay" | "provinces">("overview");

  // Filter States for Activities
  const [actSearch, setActSearch] = useState("");
  const [actProvince, setActProvince] = useState<string>("ALL");
  const [actType, setActType] = useState<string>("ALL");

  // Filter States for Tickets
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketStatus, setTicketStatus] = useState<string>("ALL");

  // Filter States for eGovPay
  const [egovPaySearch, setEgovPaySearch] = useState("");

  // Modal inspection states
  const [selectedActivity, setSelectedActivity] = useState<EgovphActivity | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<EgovphTicket | null>(null);

  // Compute summary and analytics
  const summary = useMemo(() => getEgovphSummary(activities, tickets, egovPayList), [activities, tickets, egovPayList]);
  const provincialBreakdown = useMemo(() => getEgovphProvincialBreakdown(activities), [activities]);
  const typeDistribution = useMemo(() => getEgovphActivityTypeDistribution(activities), [activities]);
  const monthlyTrajectory = useMemo(() => getEgovphMonthlyTrajectory(activities), [activities]);
  const ticketDistribution = useMemo(() => getEgovphTicketStatusDistribution(tickets), [tickets]);

  // Project Focal Person resolution
  const storedUsers = useMemo(() => getStoredUsers(), []);
  const focalPerson = useMemo(() => resolveProjectFocalPerson("egovph", storedUsers), [storedUsers]);

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      const matchSearch =
        !actSearch ||
        act.activityTitle.toLowerCase().includes(actSearch.toLowerCase()) ||
        act.municipality.toLowerCase().includes(actSearch.toLowerCase()) ||
        act.venue.toLowerCase().includes(actSearch.toLowerCase()) ||
        act.dictPersonnel.toLowerCase().includes(actSearch.toLowerCase()) ||
        act.partnerName.toLowerCase().includes(actSearch.toLowerCase());

      const matchProv = actProvince === "ALL" || act.province.toLowerCase().includes(actProvince.toLowerCase());
      const matchType = actType === "ALL" || act.typeOfActivity === actType;

      return matchSearch && matchProv && matchType;
    });
  }, [activities, actSearch, actProvince, actType]);

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchSearch =
        !ticketSearch ||
        t.ticketNo.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        t.clientName.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        t.issueDescription.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        t.email.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        t.assistedBy.toLowerCase().includes(ticketSearch.toLowerCase());

      const matchStatus = ticketStatus === "ALL" || t.status === ticketStatus;
      return matchSearch && matchStatus;
    });
  }, [tickets, ticketSearch, ticketStatus]);

  // Filtered eGovPay
  const filteredEgovPay = useMemo(() => {
    return egovPayList.filter((item) => {
      return (
        !egovPaySearch ||
        item.lguName.toLowerCase().includes(egovPaySearch.toLowerCase()) ||
        item.activityName.toLowerCase().includes(egovPaySearch.toLowerCase()) ||
        item.venue.toLowerCase().includes(egovPaySearch.toLowerCase()) ||
        item.dictPersonnel.toLowerCase().includes(egovPaySearch.toLowerCase())
      );
    });
  }, [egovPayList, egovPaySearch]);

  return (
    <div className="space-y-6">
      {/* Top Focal Banner */}
      <div className="bg-gradient-to-r from-[#0E1528] via-[#121D38] to-[#0E1528] border border-blue-500/20 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 border border-white/20">
              <Globe className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white tracking-tight">eGovPH Super App &amp; Services</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  Regional Operations
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Comprehensive regional promotion, grassroots orientations, eGovPay LGU onboarding, and citizen technical assistance.
              </p>
            </div>
          </div>

          {/* Focal Officer Pill */}
          <div className="flex items-center gap-3 bg-[#1A243F]/80 border border-blue-500/30 px-4 py-2.5 rounded-xl backdrop-blur-sm">
            <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300 font-bold text-xs">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 block">Lead Focal Officer</span>
              <span className="text-sm font-semibold text-white block">
                {focalPerson?.name || "Cyryl L. Montales"}
              </span>
              <span className="text-[11px] text-slate-400 block font-mono">
                {focalPerson?.email || "cyryl.montales@dict.gov.ph"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Activities */}
        <div className="bg-[#0C101A] border-t-2 border-t-blue-500 border-x border-b border-[#1A2235] rounded-xl p-5 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Promotional &amp; Orientations</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono text-white mb-1">
            {summary.totalActivities}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="text-blue-400 font-semibold">{summary.totalActivities}</span> activities logged across 6 provinces
          </div>
        </div>

        {/* Total Citizens Reached */}
        <div className="bg-[#0C101A] border-t-2 border-t-emerald-500 border-x border-b border-[#1A2235] rounded-xl p-5 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Citizens &amp; Personnel Reached</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono text-emerald-400 mb-1">
            {summary.totalAttendees.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>♂ {summary.totalMale.toLocaleString()} Male</span>
            <span>•</span>
            <span>♀ {summary.totalFemale.toLocaleString()} Female</span>
          </div>
        </div>

        {/* Support Tickets */}
        <div className="bg-[#0C101A] border-t-2 border-t-amber-500 border-x border-b border-[#1A2235] rounded-xl p-5 relative overflow-hidden group hover:border-amber-500/50 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Helpdesk &amp; Support Tickets</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <LifeBuoy className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono text-white mb-1">
            {summary.totalTickets}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="text-emerald-400 font-semibold">{summary.resolutionRate}%</span> resolved ({summary.resolvedTickets}/{summary.totalTickets})
          </div>
        </div>

        {/* eGovPay LGUs */}
        <div className="bg-[#0C101A] border-t-2 border-t-purple-500 border-x border-b border-[#1A2235] rounded-xl p-5 relative overflow-hidden group hover:border-purple-500/50 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">eGovPay UAT &amp; Onboarding</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono text-purple-300 mb-1">
            {summary.totalEgovPayActivities} <span className="text-sm font-normal text-slate-400">LGUs</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span>{summary.egovPayAttendees} LGU personnel trained</span>
          </div>
        </div>
      </div>

      {/* Navigation Tab Pills */}
      <div className="flex items-center gap-2 border-b border-[#1E293B] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "overview"
              ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
              : "bg-[#0C101A] text-slate-400 hover:text-white hover:bg-[#161F33] border border-[#1E293B]"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Executive Overview
        </button>

        <button
          onClick={() => setActiveTab("activities")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "activities"
              ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
              : "bg-[#0C101A] text-slate-400 hover:text-white hover:bg-[#161F33] border border-[#1E293B]"
          }`}
        >
          <Globe className="w-4 h-4" />
          Orientations &amp; Activities ({activities.length})
        </button>

        <button
          onClick={() => setActiveTab("tickets")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "tickets"
              ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
              : "bg-[#0C101A] text-slate-400 hover:text-white hover:bg-[#161F33] border border-[#1E293B]"
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          Support &amp; Helpdesk Tickets ({tickets.length})
        </button>

        <button
          onClick={() => setActiveTab("egovpay")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "egovpay"
              ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
              : "bg-[#0C101A] text-slate-400 hover:text-white hover:bg-[#161F33] border border-[#1E293B]"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          eGovPay Integration ({egovPayList.length})
        </button>

        <button
          onClick={() => setActiveTab("provinces")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "provinces"
              ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
              : "bg-[#0C101A] text-slate-400 hover:text-white hover:bg-[#161F33] border border-[#1E293B]"
          }`}
        >
          <MapPin className="w-4 h-4" />
          Provincial Breakdown (6)
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Monthly Trajectory Area Chart */}
            <div className="lg:col-span-2 bg-[#0C101A] border border-[#1A2235] rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-white tracking-wide">Monthly Activity &amp; Reach Trajectory</h4>
                  <p className="text-xs text-slate-400">Total participants reached and events conducted per month</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  FY 2026
                </span>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsAreaChart data={monthlyTrajectory}>
                    <defs>
                      <linearGradient id="attendeesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                      labelStyle={{ color: "#F8FAFC", fontWeight: "bold" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                    <Area type="monotone" dataKey="attendees" name="Attendees" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#attendeesGrad)" />
                    <Area type="monotone" dataKey="activities" name="Activities" stroke="#10B981" strokeWidth={2} fill="none" />
                  </RechartsAreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Activity Type Distribution Pie */}
            <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5 shadow-lg">
              <h4 className="text-sm font-bold text-white tracking-wide mb-1">Activity Classification</h4>
              <p className="text-xs text-slate-400 mb-4">Breakdown by promotion &amp; orientation mode</p>
              
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={typeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {typeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 mt-2">
                {typeDistribution.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-300 truncate max-w-[170px]">{item.name}</span>
                    </div>
                    <span className="font-mono font-bold text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Provincial Reach Bar Chart & Ticket Status Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#0C101A] border border-[#1A2235] rounded-xl p-5 shadow-lg">
              <h4 className="text-sm font-bold text-white tracking-wide mb-1">Provincial Reach &amp; Activity Volume</h4>
              <p className="text-xs text-slate-400 mb-4">Events conducted and attendees reached per province</p>
              
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={provincialBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                    <XAxis dataKey="province" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                    <Bar dataKey="activities" name="Activities" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="orientations" name="Orientations" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="promotions" name="Promotional Events" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Support Ticket Status Cards */}
            <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-white tracking-wide mb-1">Support Desk Health</h4>
                <p className="text-xs text-slate-400 mb-4">Current status of 86 citizen assistance requests</p>
                
                <div className="space-y-3">
                  {ticketDistribution.map((t, idx) => (
                    <div key={idx} className="bg-[#121929] border border-[#1E293B] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-slate-300">{t.name}</span>
                        <span className="text-xs font-mono font-bold text-white">{t.value} tickets</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(t.value / tickets.length) * 100}%`,
                            backgroundColor: t.color
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[#1E293B] flex items-center justify-between text-xs text-slate-400">
                <span>Total Assistance Tickets</span>
                <span className="font-mono font-bold text-white">{tickets.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVITIES & ORIENTATIONS */}
      {activeTab === "activities" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0C101A] border border-[#1A2235] p-3 rounded-xl">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search activities, municipality, venue..."
                value={actSearch}
                onChange={(e) => setActSearch(e.target.value)}
                className="w-full bg-[#121929] border border-[#1E293B] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={actProvince}
                onChange={(e) => setActProvince(e.target.value)}
                className="bg-[#121929] border border-[#1E293B] text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Provinces (6)</option>
                {EGOVPH_PROVINCES.map((prov) => (
                  <option key={prov} value={prov}>{prov}</option>
                ))}
              </select>

              <select
                value={actType}
                onChange={(e) => setActType(e.target.value)}
                className="bg-[#121929] border border-[#1E293B] text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Types</option>
                <option value="Orientation">Orientation</option>
                <option value="Promotional Activity">Promotional Activity</option>
                <option value="Orientation with Promotional Activity">Orientation with Promotional Activity</option>
              </select>

              <span className="text-xs text-slate-400 font-mono pl-2">
                {filteredActivities.length} rows
              </span>
            </div>
          </div>

          {/* Activities Table */}
          <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#121929] text-slate-400 uppercase tracking-wider text-[11px] font-bold sticky top-0 z-10 border-b border-[#1E293B]">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Activity Title</th>
                    <th className="px-4 py-3">Province &amp; LGU</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Attendees</th>
                    <th className="px-4 py-3">DICT Personnel</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2235]">
                  {filteredActivities.map((act) => (
                    <tr key={act.id} className="hover:bg-[#121929]/60 transition-colors">
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{act.rowNo}</td>
                      <td className="px-4 py-3 font-semibold text-white max-w-[280px]">
                        <div className="truncate" title={act.activityTitle}>{act.activityTitle}</div>
                        {act.partnerName && (
                          <div className="text-[10px] text-slate-400 truncate">Partner: {act.partnerName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30 mb-0.5">
                          {act.province}
                        </span>
                        <div className="text-[11px] text-slate-300 truncate max-w-[160px]">{act.municipality}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          act.typeOfActivity === "Orientation" ? "bg-blue-500/15 text-blue-300 border border-blue-500/30" :
                          act.typeOfActivity === "Promotional Activity" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" :
                          "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                        }`}>
                          {act.typeOfActivity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-white">
                        {act.totalAttendees > 0 ? act.totalAttendees.toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-[11px] max-w-[160px] truncate" title={act.dictPersonnel}>
                        {act.dictPersonnel || "DICT Team"}
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {act.startDate}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedActivity(act)}
                          className="px-2.5 py-1 rounded bg-[#1A243F] hover:bg-blue-600 text-blue-300 hover:text-white transition-colors text-[11px] font-semibold cursor-pointer border border-blue-500/30"
                        >
                          Dossier
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredActivities.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-500">
                        No activity records matched your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CITIZEN SUPPORT TICKETS */}
      {activeTab === "tickets" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0C101A] border border-[#1A2235] p-3 rounded-xl">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search ticket #, client, email, issue..."
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                className="w-full bg-[#121929] border border-[#1E293B] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={ticketStatus}
                onChange={(e) => setTicketStatus(e.target.value)}
                className="bg-[#121929] border border-[#1E293B] text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="ESCALATED">ESCALATED</option>
                <option value="Pending">Pending</option>
                <option value="Duplicate Entry">Duplicate Entry</option>
              </select>

              <span className="text-xs text-slate-400 font-mono pl-2">
                {filteredTickets.length} tickets
              </span>
            </div>
          </div>

          {/* Tickets Table */}
          <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#121929] text-slate-400 uppercase tracking-wider text-[11px] font-bold sticky top-0 z-10 border-b border-[#1E293B]">
                  <tr>
                    <th className="px-4 py-3">Ticket No.</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Client Name</th>
                    <th className="px-4 py-3">Kind of Request / Issue</th>
                    <th className="px-4 py-3">Mode of Assistance</th>
                    <th className="px-4 py-3">Assisted By</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2235]">
                  {filteredTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-[#121929]/60 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-400">{t.ticketNo}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {t.timestamp.split(" ")[0]}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">
                        <div>{t.clientName}</div>
                        {t.contactNo && <div className="text-[10px] text-slate-400 font-mono">{t.contactNo}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-[260px]">
                        <div className="truncate font-medium" title={t.issueDescription}>
                          {t.issueDescription}
                        </div>
                        {t.kindOfRequest && (
                          <div className="text-[10px] text-slate-500 truncate">{t.kindOfRequest}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-[11px]">{t.modeOfAssistance}</td>
                      <td className="px-4 py-3 text-slate-300 text-[11px]">{t.assistedBy || "Cyryl L. Montales"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                          t.status === "RESOLVED" || t.status === "RESOVED"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : t.status === "ESCALATED"
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            : t.status === "Pending"
                            ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                            : "bg-slate-700/40 text-slate-400 border border-slate-600/30"
                        }`}>
                          {t.status === "RESOVED" ? "RESOLVED" : t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedTicket(t)}
                          className="px-2.5 py-1 rounded bg-[#1A243F] hover:bg-blue-600 text-blue-300 hover:text-white transition-colors text-[11px] font-semibold cursor-pointer border border-blue-500/30"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredTickets.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-500">
                        No support tickets matched your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EGOVPAY INTEGRATION */}
      {activeTab === "egovpay" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0C101A] border border-[#1A2235] p-3 rounded-xl">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search LGU name, activity, personnel..."
                value={egovPaySearch}
                onChange={(e) => setEgovPaySearch(e.target.value)}
                className="w-full bg-[#121929] border border-[#1E293B] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <span className="text-xs text-slate-400 font-mono">
              {filteredEgovPay.length} LGU Onboarding Sessions
            </span>
          </div>

          {/* eGovPay Table */}
          <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#121929] text-slate-400 uppercase tracking-wider text-[11px] font-bold sticky top-0 z-10 border-b border-[#1E293B]">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">LGU Name</th>
                    <th className="px-4 py-3">Activity</th>
                    <th className="px-4 py-3">Venue / Mode</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3 text-right">Attendees (M / F)</th>
                    <th className="px-4 py-3">DICT Personnel</th>
                    <th className="px-4 py-3">AAR Document</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2235]">
                  {filteredEgovPay.map((item) => (
                    <tr key={item.id} className="hover:bg-[#121929]/60 transition-colors">
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{item.rowNo}</td>
                      <td className="px-4 py-3 font-semibold text-white">
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-purple-400" />
                          <span>{item.lguName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          {item.activityName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-[11px]">{item.venue || "Online / Gmeet"}</td>
                      <td className="px-4 py-3 font-mono text-slate-400 text-[11px]">{item.startDate}</td>
                      <td className="px-4 py-3 text-right font-mono text-white">
                        <span className="font-bold text-emerald-400">{item.totalAttendees}</span>{" "}
                        <span className="text-[10px] text-slate-400">({item.maleAttendees}♂ / {item.femaleAttendees}♀)</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-[11px]">{item.dictPersonnel || "Regional Lead"}</td>
                      <td className="px-4 py-3 text-slate-400 text-[10px] max-w-[200px] truncate" title={item.afterActivityReport}>
                        {item.afterActivityReport ? (
                          <span className="flex items-center gap-1 text-blue-400">
                            <FileText className="w-3 h-3" />
                            {item.afterActivityReport}
                          </span>
                        ) : (
                          <span className="text-slate-600">Pending AAR</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PROVINCIAL BREAKDOWN */}
      {activeTab === "provinces" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {provincialBreakdown.map((p) => (
            <div key={p.province} className="bg-[#0C101A] border border-[#1A2235] hover:border-blue-500/40 rounded-xl p-5 shadow-lg transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white tracking-wide">{p.province}</h4>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Province</span>
                  </div>
                </div>
                <span className="font-mono text-sm font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded border border-blue-500/20">
                  {p.activities} Events
                </span>
              </div>

              <div className="space-y-3 pt-2 border-t border-[#1E293B]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Total Citizens Reached:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">{p.attendees.toLocaleString()}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#121929] p-2.5 rounded-lg border border-[#1E293B]">
                  <div>
                    <span className="text-slate-400 block">Orientations</span>
                    <span className="font-mono font-bold text-white">{p.orientations}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Promotions</span>
                    <span className="font-mono font-bold text-white">{p.promotions}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Male (♂)</span>
                    <span className="font-mono font-bold text-blue-400">{p.male.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Female (♀)</span>
                    <span className="font-mono font-bold text-pink-400">{p.female.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Activity Dossier Modal */}
      {selectedActivity && (
        <Modal
          isOpen={!!selectedActivity}
          onClose={() => setSelectedActivity(null)}
          title={`eGovPH Activity Dossier: #${selectedActivity.rowNo}`}
        >
          <div className="space-y-4 text-xs">
            <div className="bg-[#121929] border border-[#1E293B] p-4 rounded-xl space-y-2">
              <h3 className="text-base font-bold text-white">{selectedActivity.activityTitle}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/40">
                  {selectedActivity.province}
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40">
                  {selectedActivity.typeOfActivity}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                  {selectedActivity.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0C101A] border border-[#1E293B] p-3 rounded-lg">
                <span className="text-slate-400 block font-semibold">Location / Municipality</span>
                <span className="text-white font-medium">{selectedActivity.municipality || "N/A"}</span>
              </div>
              <div className="bg-[#0C101A] border border-[#1E293B] p-3 rounded-lg">
                <span className="text-slate-400 block font-semibold">Venue</span>
                <span className="text-white font-medium">{selectedActivity.venue || "N/A"}</span>
              </div>
              <div className="bg-[#0C101A] border border-[#1E293B] p-3 rounded-lg">
                <span className="text-slate-400 block font-semibold">Partner Organization</span>
                <span className="text-white font-medium">{selectedActivity.partnerName || "None"}</span>
              </div>
              <div className="bg-[#0C101A] border border-[#1E293B] p-3 rounded-lg">
                <span className="text-slate-400 block font-semibold">Activity Dates</span>
                <span className="text-white font-mono font-medium">{selectedActivity.startDate} {selectedActivity.endDate && selectedActivity.endDate !== selectedActivity.startDate ? `to ${selectedActivity.endDate}` : ''}</span>
              </div>
            </div>

            {/* Attendance & Demographic Stats */}
            <div className="bg-[#0C101A] border border-[#1E293B] p-4 rounded-xl">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Attendance Breakdown
              </span>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#121929] p-3 rounded-lg border border-[#1E293B]">
                  <span className="text-slate-400 block text-[10px]">Total Attendees</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    {selectedActivity.totalAttendees.toLocaleString()}
                  </span>
                </div>
                <div className="bg-[#121929] p-3 rounded-lg border border-[#1E293B]">
                  <span className="text-slate-400 block text-[10px]">Male (♂)</span>
                  <span className="text-lg font-bold font-mono text-blue-400">
                    {selectedActivity.maleAttendees.toLocaleString()}
                  </span>
                </div>
                <div className="bg-[#121929] p-3 rounded-lg border border-[#1E293B]">
                  <span className="text-slate-400 block text-[10px]">Female (♀)</span>
                  <span className="text-lg font-bold font-mono text-pink-400">
                    {selectedActivity.femaleAttendees.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Personnel & Reports */}
            <div className="space-y-2">
              <div className="bg-[#0C101A] border border-[#1E293B] p-3 rounded-lg">
                <span className="text-slate-400 block font-semibold mb-1">DICT Personnel Involved</span>
                <span className="text-white font-medium">{selectedActivity.dictPersonnel || "DICT Region V Field Team"}</span>
              </div>

              {selectedActivity.afterActivityReport && (
                <div className="bg-[#0C101A] border border-[#1E293B] p-3 rounded-lg">
                  <span className="text-slate-400 block font-semibold mb-1">After-Activity Report (AAR)</span>
                  <span className="text-blue-400 font-mono">{selectedActivity.afterActivityReport}</span>
                </div>
              )}

              {selectedActivity.fbPostingUrl && (
                <a
                  href={selectedActivity.fbPostingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-300 border border-blue-500/30 transition-colors"
                >
                  <span className="font-semibold flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4" /> Open Official Facebook Post
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Support Ticket Modal */}
      {selectedTicket && (
        <Modal
          isOpen={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          title={`Ticket Dossier: ${selectedTicket.ticketNo}`}
        >
          <div className="space-y-4 text-xs">
            <div className="bg-[#121929] border border-[#1E293B] p-4 rounded-xl flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{selectedTicket.clientName}</h3>
                <span className="text-slate-400 font-mono text-[11px]">{selectedTicket.email} • {selectedTicket.contactNo}</span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                selectedTicket.status === "RESOLVED" || selectedTicket.status === "RESOVED"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : selectedTicket.status === "ESCALATED"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : "bg-blue-500/20 text-blue-400 border border-blue-500/40"
              }`}>
                {selectedTicket.status}
              </span>
            </div>

            <div className="bg-[#0C101A] border border-[#1E293B] p-3.5 rounded-lg space-y-1.5">
              <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">Issue / Concern</span>
              <p className="text-white text-xs leading-relaxed">{selectedTicket.issueDescription}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0C101A] border border-[#1E293B] p-3 rounded-lg">
                <span className="text-slate-400 block font-semibold">Mode of Assistance</span>
                <span className="text-white font-medium">{selectedTicket.modeOfAssistance}</span>
              </div>
              <div className="bg-[#0C101A] border border-[#1E293B] p-3 rounded-lg">
                <span className="text-slate-400 block font-semibold">Assisted By</span>
                <span className="text-white font-medium">{selectedTicket.assistedBy || "Cyryl L. Montales"}</span>
              </div>
              {selectedTicket.coTicketNo && (
                <div className="bg-[#0C101A] border border-[#1E293B] p-3 rounded-lg col-span-2">
                  <span className="text-slate-400 block font-semibold">Central Office (CO) Ticket No</span>
                  <span className="text-blue-400 font-mono font-bold">{selectedTicket.coTicketNo}</span>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
