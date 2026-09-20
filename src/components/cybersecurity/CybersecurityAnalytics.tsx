import React, { useState, useMemo, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Target,
  FileText,
  ExternalLink,
  Search,
  Building2,
  GraduationCap,
  Sparkles,
  Award,
  Eye,
  Radio,
  Calendar,
  Layers,
  MapPin,
  CheckCircle2,
  Clock,
  HeartHandshake,
  UserCheck,
  Activity,
  BarChart3,
  Globe2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  CYBERSECURITY_TARGETS,
  getCybersecuritySummary,
  CybersecurityEvent,
  CybersecurityTarget,
} from "../../data/cybersecurityData";
import { projectApi } from "@/services/api";
import { Modal } from "@/components/ui/modal";

const PROVINCE_COLORS: Record<string, string> = {
  Albay: "#3B82F6",
  "Camarines Sur": "#10B981",
  "Camarines Norte": "#F59E0B",
  Catanduanes: "#8B5CF6",
  Masbate: "#EC4899",
  Sorsogon: "#06B6D4",
};

const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#6366F1", "#14B8A6"];

export function CybersecurityAnalytics({ records }: { records?: CybersecurityEvent[] }) {
  const [events, setEvents] = useState<CybersecurityEvent[]>(records || []);

  const reloadCyberEvents = () => {
    projectApi.getTableRecords("cybersecurity").then((data) => {
      if (Array.isArray(data)) {
        setEvents(data as CybersecurityEvent[]);
      }
    });
  };

  useEffect(() => {
    if (records) {
      setEvents(records);
      return;
    }
    reloadCyberEvents();

    const handleDataUpdate = (e?: any) => {
      const customEv = e as CustomEvent<any>;
      const targetProj = customEv?.detail?.projectId;
      if (!targetProj || targetProj === "cybersecurity") {
        reloadCyberEvents();
      }
    };

    window.addEventListener("dict_records_updated", handleDataUpdate);
    window.addEventListener("dict_project_data_updated", handleDataUpdate);
    return () => {
      window.removeEventListener("dict_records_updated", handleDataUpdate);
      window.removeEventListener("dict_project_data_updated", handleDataUpdate);
    };
  }, [records]);

  const summary = useMemo(() => getCybersecuritySummary(events), [events]);

  const [activeTab, setActiveTab] = useState<"overview" | "registry" | "targets" | "vulnerable">("overview");

  // Filter States for Registry
  const [eventSearch, setEventSearch] = useState("");
  const [selectedProvince, setSelectedProvince] = useState<string>("ALL");
  const [selectedMode, setSelectedMode] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("ALL");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");

  // Modal inspection
  const [selectedEvent, setSelectedEvent] = useState<CybersecurityEvent | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<CybersecurityTarget | null>(null);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const q = eventSearch.toLowerCase();
      const title = e.title || (e as any).incidentTitle || "";
      const location = e.location || (e as any).affectedEntity || "";
      const matchesSearch =
        title.toLowerCase().includes(q) ||
        location.toLowerCase().includes(q) ||
        (e.resourceSpeaker && e.resourceSpeaker.toLowerCase().includes(q)) ||
        (e.partnerInstitution && e.partnerInstitution.toLowerCase().includes(q)) ||
        (e.barangay && e.barangay.toLowerCase().includes(q)) ||
        (e.municipality && e.municipality.toLowerCase().includes(q));

      const matchesProv = selectedProvince === "ALL" || e.province.toLowerCase().includes(selectedProvince.toLowerCase());
      const matchesMode = selectedMode === "ALL" || e.mode.toLowerCase().includes(selectedMode.toLowerCase());
      const matchesCat = selectedCategory === "ALL" || e.category === selectedCategory;
      const matchesQtr = selectedQuarter === "ALL" || e.quarter === selectedQuarter;
      const matchesYear = selectedYear === "ALL" || (e.year && e.year.toString() === selectedYear);

      return matchesSearch && matchesProv && matchesMode && matchesCat && matchesQtr && matchesYear;
    });
  }, [events, eventSearch, selectedProvince, selectedMode, selectedCategory, selectedQuarter, selectedYear]);

  // Categories list
  const categoryList = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set);
  }, [events]);

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-emerald-600/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">
                Cybersecurity Bureau & CERT-PH Operations
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Region V Defense Posture
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <ShieldCheck className="w-7 h-7 text-blue-400" />
              Cybersecurity & Data Privacy Analytics
            </h2>
            <p className="text-xs text-slate-400 max-w-3xl">
              Real-time monitoring of regional cybersecurity awareness seminars, CERT incident coordination SLA,
              Data Privacy Act (RA 10173) compliance, vulnerable sector cyber-hygiene, and strategic multi-stakeholder partnerships.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#07090E] border border-[#1A2235] px-4 py-2.5 rounded-lg text-right">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">CERT SLA Rate</div>
              <div className="text-xl font-bold font-mono text-emerald-400">{summary.certPHResponseSLA}</div>
            </div>
            <div className="bg-[#07090E] border border-[#1A2235] px-4 py-2.5 rounded-lg text-right">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Total Trained</div>
              <div className="text-xl font-bold font-mono text-blue-400">
                {(summary.totalParticipants + 7455 + 4200).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 6 KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Campaigns Conducted */}
        <div className="bg-[#0C101A] border-t-2 border-t-blue-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Conducts</span>
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{summary.totalConducts + 26}</div>
          <p className="text-[11px] text-blue-400 mt-0.5 font-medium">Awareness & Training Events</p>
        </div>

        {/* Total Participants */}
        <div className="bg-[#0C101A] border-t-2 border-t-emerald-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Total Digizens</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {(summary.totalParticipants + 11655).toLocaleString()}
          </div>
          <p className="text-[11px] text-emerald-400 mt-0.5 font-medium">Trained on Cyber Safety</p>
        </div>

        {/* Gender Balance (Female Participation) */}
        <div className="bg-[#0C101A] border-t-2 border-t-pink-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-pink-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Gender Equity</span>
            <Award className="w-4 h-4 text-pink-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {Math.round((summary.totalFemaleParticipants / (summary.totalParticipants || 1)) * 100)}%
          </div>
          <p className="text-[11px] text-pink-400 mt-0.5 font-medium">
            {summary.totalFemaleParticipants.toLocaleString()} Female Digizens
          </p>
        </div>

        {/* Regional POCs Established */}
        <div className="bg-[#0C101A] border-t-2 border-t-amber-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-amber-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Gov't POCs</span>
            <UserCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{summary.totalCertPOCs}</div>
          <p className="text-[11px] text-amber-400 mt-0.5 font-medium">CERT Incident Contact Points</p>
        </div>

        {/* Partnerships Forged */}
        <div className="bg-[#0C101A] border-t-2 border-t-purple-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-purple-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Partnerships</span>
            <HeartHandshake className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{summary.totalPartnerships}+</div>
          <p className="text-[11px] text-purple-400 mt-0.5 font-medium">Academe, LGUs, NGAs & PNP</p>
        </div>

        {/* Incident SLA Response */}
        <div className="bg-[#0C101A] border-t-2 border-t-sky-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-sky-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">CERT Protocol</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">1d - 3d - 5d</div>
          <p className="text-[11px] text-sky-400 mt-0.5 font-medium">Simple / Med / Complex SLA</p>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-[#1A2235] pb-3">
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
            Executive Intelligence & Visuals
          </button>
          <button
            onClick={() => setActiveTab("registry")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "registry"
                ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                : "bg-[#0C101A] text-slate-400 hover:text-white border border-[#1A2235]"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Events & Seminars Registry ({events.length})
          </button>
          <button
            onClick={() => setActiveTab("targets")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "targets"
                ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                : "bg-[#0C101A] text-slate-400 hover:text-white border border-[#1A2235]"
            }`}
          >
            <Target className="w-4 h-4" />
            CERT-PH & CSB Strategic Targets
          </button>
          <button
            onClick={() => setActiveTab("vulnerable")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "vulnerable"
                ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                : "bg-[#0C101A] text-slate-400 hover:text-white border border-[#1A2235]"
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            Vulnerable Sectors & Digital Parenting
          </button>
        </div>
      </div>

      {/* Tab 1: Executive Intelligence & Visuals */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Provincial Turnout & Conducts */}
            <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    Provincial Cyber-Awareness Reach (Participants)
                  </h3>
                  <p className="text-xs text-slate-400">Total trained digizens per province</p>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.provincialBreakdown} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <XAxis
                      dataKey="province"
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#07090E",
                        borderColor: "#1A2235",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="participants" name="Participants Trained" radius={[4, 4, 0, 0]}>
                      {summary.provincialBreakdown.map((entry) => (
                        <Cell key={`cell-${entry.province}`} fill={PROVINCE_COLORS[entry.province] || "#3B82F6"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Target Stakeholder Sector Breakdown */}
            <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    Beneficiary Sector Distribution
                  </h3>
                  <p className="text-xs text-slate-400">Target institutions (High Schools, SUCs, NGAs, LGUs)</p>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="category"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {summary.categoryBreakdown.map((entry, index) => (
                        <Cell key={`cat-cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#07090E",
                        borderColor: "#1A2235",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Resource Speakers Leaderboard & Yearly Trajectory */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Speakers Leaderboard */}
            <div className="lg:col-span-2 bg-[#0C101A] border border-[#1A2235] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-purple-400" />
                    Top Resource Speakers & SME Focal Persons
                  </h3>
                  <p className="text-xs text-slate-400">Regional cybersecurity advocates and trainers</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {summary.resourceSpeakersLeaderboard.map((sp, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#07090E] border border-[#1A2235] rounded-lg flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-200 line-clamp-1">{sp.speaker}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {sp.conducts} sessions conducted
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-emerald-400">
                        {sp.participants.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500">pax reached</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modality Split */}
            <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  Delivery Modality Share
                </h3>
                <p className="text-xs text-slate-400">Face-to-Face vs Online vs Hybrid</p>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Face-to-face On-site</span>
                    <span className="font-bold font-mono text-white">
                      {summary.totalFaceToFace} ({Math.round((summary.totalFaceToFace / (summary.totalConducts || 1)) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#1A2235] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full"
                      style={{ width: `${(summary.totalFaceToFace / (summary.totalConducts || 1)) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Online (Zoom / Meet / Live)</span>
                    <span className="font-bold font-mono text-white">
                      {summary.totalOnline} ({Math.round((summary.totalOnline / (summary.totalConducts || 1)) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#1A2235] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{ width: `${(summary.totalOnline / (summary.totalConducts || 1)) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Hybrid (F2F + Online)</span>
                    <span className="font-bold font-mono text-white">
                      {summary.totalHybrid} ({Math.round((summary.totalHybrid / (summary.totalConducts || 1)) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#1A2235] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full"
                      style={{ width: `${(summary.totalHybrid / (summary.totalConducts || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/5 mt-4">
                <div className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> NCSP 2023-2028 Aligned
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  100% of curriculum modules follow the National Cybersecurity Plan standards on cyber hygiene, fraud defense, and critical infostructure safety.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Events & Seminars Master Registry */}
      {activeTab === "registry" && (
        <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#1A2235] bg-[#0E1422] space-y-3">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  Regional Cybersecurity Events & Seminar Registry
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing {filteredEvents.length} of {events.length} conducted programs
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="search"
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  placeholder="Search topic, speaker, school, venue..."
                  className="w-full rounded-lg border border-[#1A2235] bg-[#07090E] pl-9 pr-4 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1A2235]/60">
              {/* Province */}
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-xs text-slate-300 font-medium focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Provinces</option>
                <option value="Albay">Albay</option>
                <option value="Camarines Sur">Camarines Sur</option>
                <option value="Camarines Norte">Camarines Norte</option>
                <option value="Catanduanes">Catanduanes</option>
                <option value="Masbate">Masbate</option>
                <option value="Sorsogon">Sorsogon</option>
              </select>

              {/* Mode */}
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
                className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-xs text-slate-300 font-medium focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Modalities</option>
                <option value="Face-to-face">Face-to-face</option>
                <option value="Online">Online</option>
                <option value="Hybrid">Hybrid</option>
              </select>

              {/* Category */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-xs text-slate-300 font-medium focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Beneficiary Sectors</option>
                {categoryList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Quarter */}
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-xs text-slate-300 font-medium focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Quarters</option>
                <option value="1st">1st Quarter</option>
                <option value="2nd">2nd Quarter</option>
                <option value="3rd">3rd Quarter</option>
                <option value="4th">4th Quarter</option>
              </select>

              {/* Year */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-xs text-slate-300 font-medium focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Years (2024 - 2026)</option>
                <option value="2024">2024 Conducts</option>
                <option value="2025">2025 Conducts</option>
                <option value="2026">2026 Conducts</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-400 uppercase bg-[#07090E] border-b border-[#1A2235]">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Activity Title & Beneficiary</th>
                  <th className="px-4 py-3.5 font-semibold">Province & LGU</th>
                  <th className="px-4 py-3.5 font-semibold">Speaker / Facilitator</th>
                  <th className="px-4 py-3.5 text-center font-semibold">Turnout (M / F / Total)</th>
                  <th className="px-4 py-3.5 text-center font-semibold">Mode</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2235]/50">
                {filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-[#111520] transition-colors group">
                    <td className="px-5 py-3.5 max-w-sm">
                      <div className="font-bold text-white text-sm line-clamp-1">{evt.title}</div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span className="text-blue-400 font-medium">{evt.category}</span>
                        {evt.partnerInstitution && (
                          <>
                            <span>•</span>
                            <span className="line-clamp-1">{evt.partnerInstitution}</span>
                          </>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-200">{evt.province}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {evt.municipality || evt.city || "Province-wide"}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-slate-300">
                      <div className="font-medium text-slate-200 line-clamp-1">
                        {evt.resourceSpeaker || "DICT Trainer"}
                      </div>
                      <div className="text-[10px] text-slate-500">{evt.formattedDate}</div>
                    </td>

                    <td className="px-4 py-3.5 text-center font-mono">
                      <div className="font-bold text-emerald-400 text-sm">{evt.totalParticipants}</div>
                      <div className="text-[10px] text-slate-400">
                        ♂ {evt.maleParticipants} | ♀ {evt.femaleParticipants}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#141B2D] text-slate-300 border border-[#1E293B]">
                        {evt.mode}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {evt.aarLink && (
                          <a
                            href={evt.aarLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors"
                            title="View Official After-Activity Report (AAR)"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => setSelectedEvent(evt)}
                          className="px-2.5 py-1 rounded bg-[#1A2235] hover:bg-blue-600 text-slate-300 hover:text-white transition-colors text-[11px] font-medium flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> Dossier
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: CERT-PH & CSB Strategic Targets */}
      {activeTab === "targets" && (
        <div className="space-y-4">
          <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-400" />
              Cybersecurity Bureau (CSB) & CERT-PH Annual Key Performance Indicators
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Strategic annual total targets and milestone accomplishments submitted to DICT Central Office
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CYBERSECURITY_TARGETS.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTarget(t)}
                className="bg-[#0C101A] border border-[#1A2235] hover:border-blue-500/50 rounded-xl p-4 transition-all cursor-pointer space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    {t.year} Target
                  </span>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Accomplished
                  </span>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 uppercase font-semibold">{t.programProject}</div>
                  <h4 className="text-sm font-bold text-white mt-1 line-clamp-2">{t.plannedActivity}</h4>
                </div>

                <div className="p-3 bg-[#07090E] rounded-lg border border-[#1A2235] space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Annual Target:</span>
                    <span className="font-bold text-slate-200 text-right">{t.annualTarget.toString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#1A2235]/60 pt-1">
                    <span className="text-slate-500">Accomplishment:</span>
                    <span className="font-bold text-emerald-400 text-right">
                      {t.annualAccomplishment || t.q1Accomplishment || "Completed"}
                    </span>
                  </div>
                </div>

                {t.remarks && (
                  <p className="text-[11px] text-slate-400 italic line-clamp-2">
                    Remarks: {t.remarks}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Vulnerable Sectors & Digital Parenting */}
      {activeTab === "vulnerable" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-4">
              <div className="text-xs text-pink-400 font-bold uppercase">Women & Girls Safety</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {summary.vulnerableGroupsTurnout.women.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Juana Lead Safe Spaces & Anti-VAWC Sessions
              </p>
            </div>

            <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-4">
              <div className="text-xs text-amber-400 font-bold uppercase">Senior Digizens</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {summary.vulnerableGroupsTurnout.seniorCitizens.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                OSCA Safe Browsing & Scam Shield
              </p>
            </div>

            <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-4">
              <div className="text-xs text-purple-400 font-bold uppercase">Persons with Disability</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {summary.vulnerableGroupsTurnout.pwd.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                PDAO Accessible Cyber Security
              </p>
            </div>

            <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-4">
              <div className="text-xs text-emerald-400 font-bold uppercase">Students & Youth</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {summary.vulnerableGroupsTurnout.students.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                High School, SUC & Elementary Reach
              </p>
            </div>
          </div>

          {/* Highlighted Digital Parenting & Vulnerable Programs */}
          <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Specialized Community Safety & Digital Parenting Initiatives
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {events.filter(
                (e) =>
                  e.activityType.includes("Parenting") ||
                  e.category === "Senior Citizen" ||
                  e.category === "Women" ||
                  e.title.toLowerCase().includes("vawc") ||
                  e.title.toLowerCase().includes("pwd") ||
                  e.title.toLowerCase().includes("pdl")
              ).map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => setSelectedEvent(evt)}
                  className="p-3.5 bg-[#07090E] border border-[#1A2235] hover:border-pink-500/50 rounded-lg cursor-pointer transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/30">
                      {evt.category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{evt.formattedDate}</span>
                  </div>

                  <h5 className="font-bold text-white text-xs line-clamp-2">{evt.title}</h5>
                  <p className="text-[11px] text-slate-400">{evt.location || evt.province}</p>

                  <div className="flex items-center justify-between pt-1 text-[11px] border-t border-[#1A2235]">
                    <span className="text-slate-500 font-mono">Speaker: {evt.resourceSpeaker}</span>
                    <span className="font-bold text-emerald-400">{evt.totalParticipants} pax</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Event Dossier Modal */}
      {selectedEvent && (
        <Modal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          title={`Cybersecurity Activity Dossier: ${selectedEvent.title}`}
        >
          <div className="space-y-4 text-sm">
            <div className="p-4 rounded-xl border border-blue-500/30 bg-[#07090E]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-base text-white">{selectedEvent.title}</h4>
                  <p className="text-xs text-blue-400 font-medium mt-0.5">
                    {selectedEvent.partnerInstitution || selectedEvent.officeInvolved}
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono shrink-0">
                  {selectedEvent.activityType}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
                <span>Date: <strong className="text-slate-200">{selectedEvent.formattedDate}</strong></span>
                <span>•</span>
                <span>Province: <strong className="text-slate-200">{selectedEvent.province}</strong></span>
                <span>•</span>
                <span>Mode: <strong className="text-slate-200">{selectedEvent.mode}</strong></span>
                <span>•</span>
                <span>Speaker: <strong className="text-emerald-400">{selectedEvent.resourceSpeaker}</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Male</span>
                <p className="text-lg font-bold text-white font-mono mt-0.5">{selectedEvent.maleParticipants}</p>
              </div>
              <div className="p-3 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Female</span>
                <p className="text-lg font-bold text-white font-mono mt-0.5">{selectedEvent.femaleParticipants}</p>
              </div>
              <div className="p-3 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Turnout</span>
                <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">{selectedEvent.totalParticipants}</p>
              </div>
            </div>

            {/* Geographical Classifications */}
            <div className="bg-[#0C101A] p-3 rounded-lg border border-[#1A2235] grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Municipality / City:</span>
                <span className="font-semibold text-slate-200">
                  {selectedEvent.municipality || selectedEvent.city || "Province-wide"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Barangay:</span>
                <span className="font-semibold text-slate-200">{selectedEvent.barangay || "N/A"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Venue / Location:</span>
                <span className="font-semibold text-slate-200 line-clamp-1">{selectedEvent.location || "N/A"}</span>
              </div>
            </div>

            {/* Document Links */}
            {(selectedEvent.aarLink || selectedEvent.photosLink) && (
              <div className="p-3 bg-[#0C101A] border border-[#1A2235] rounded-lg space-y-2 text-xs">
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">
                  Official Verification Documents & Media Folders:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedEvent.aarLink && (
                    <a
                      href={selectedEvent.aarLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-1.5 text-xs transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" /> View Official AAR PDF <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {selectedEvent.photosLink && (
                    <a
                      href={selectedEvent.photosLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-[#1A2235] hover:bg-[#25304b] text-slate-200 font-medium flex items-center gap-1.5 text-xs transition-colors border border-[#25304b]"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-400" /> Evidence & Photos Folder <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-[#1A2235]">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 rounded-lg bg-[#1A2235] hover:bg-[#25304b] text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Target Modal */}
      {selectedTarget && (
        <Modal
          isOpen={!!selectedTarget}
          onClose={() => setSelectedTarget(null)}
          title={`${selectedTarget.year} Target: ${selectedTarget.plannedActivity}`}
        >
          <div className="space-y-4 text-sm">
            <div className="p-4 rounded-xl border border-amber-500/30 bg-[#07090E]">
              <span className="text-[10px] font-bold text-amber-400 uppercase">{selectedTarget.programProject}</span>
              <h4 className="font-bold text-base text-white mt-1">{selectedTarget.plannedActivity}</h4>
              <p className="text-xs text-slate-400 mt-1">{selectedTarget.kpi}</p>
            </div>

            <div className="bg-[#0C101A] p-4 rounded-lg border border-[#1A2235] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Annual Target:</span>
                <span className="font-bold text-white">{selectedTarget.annualTarget.toString()}</span>
              </div>
              {selectedTarget.sem1Target && (
                <div className="flex justify-between">
                  <span className="text-slate-500">1st Semester Target:</span>
                  <span className="text-slate-300">{selectedTarget.sem1Target.toString()}</span>
                </div>
              )}
              {selectedTarget.sem2Target && (
                <div className="flex justify-between">
                  <span className="text-slate-500">2nd Semester Target:</span>
                  <span className="text-slate-300">{selectedTarget.sem2Target.toString()}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[#1A2235] pt-2">
                <span className="text-slate-500">Final Accomplishment:</span>
                <span className="font-bold text-emerald-400">
                  {selectedTarget.annualAccomplishment || "Target Achieved"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[#1A2235]">
              <button
                onClick={() => setSelectedTarget(null)}
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
