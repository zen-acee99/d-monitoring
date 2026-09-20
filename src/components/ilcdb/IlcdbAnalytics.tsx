import React, { useState, useMemo } from "react";
import {
  GraduationCap,
  BookOpen,
  Target,
  Users,
  Coins,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  Building2,
  Sparkles,
  ExternalLink,
  Search,
  Eye,
  Award,
  Clock,
  Briefcase,
  Laptop,
  CheckCircle,
  HelpCircle,
  FileCheck2,
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
  ILCDB_SARO_ACTIVITIES,
  ILCDB_TARGETS_ACCOMPLISHMENTS,
  ILCDB_TRAINING_SESSIONS,
  getIlcdbSummary,
  IlcdbSaroActivity,
  IlcdbTargetAccomplishment,
  IlcdbTrainingSession,
} from "../../data/ilcdbData";
import { Modal } from "@/components/ui/modal";

const PROVINCE_COLORS: Record<string, string> = {
  Albay: "#3B82F6",
  "Camarines Sur": "#10B981",
  "Camarines Norte": "#F59E0B",
  Catanduanes: "#8B5CF6",
  Masbate: "#EC4899",
  Sorsogon: "#06B6D4",
};

const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#6366F1"];

export function IlcdbAnalytics() {
  const summary = useMemo(() => getIlcdbSummary(), []);

  const [activeTab, setActiveTab] = useState<"overview" | "saro" | "targets" | "trainings">("overview");

  // SARO filters
  const [saroSearch, setSaroSearch] = useState("");
  const [saroProvince, setSaroProvince] = useState("ALL");
  const [saroDivision, setSaroDivision] = useState("ALL");
  const [saroStatus, setSaroStatus] = useState("ALL");

  // Training Session filter
  const [trainingSearch, setTrainingSearch] = useState("");
  const [trainingProvince, setTrainingProvince] = useState("ALL");
  const [trainingDivision, setTrainingDivision] = useState("ALL");

  // Modals
  const [selectedSaro, setSelectedSaro] = useState<IlcdbSaroActivity | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<IlcdbTargetAccomplishment | null>(null);
  const [selectedSession, setSelectedSession] = useState<IlcdbTrainingSession | null>(null);

  // Filtered SARO list
  const filteredSaro = useMemo(() => {
    return ILCDB_SARO_ACTIVITIES.filter((s) => {
      const q = saroSearch.toLowerCase();
      const matchesSearch =
        s.activity.toLowerCase().includes(q) ||
        s.saroNo.toLowerCase().includes(q) ||
        s.province.toLowerCase().includes(q);

      const matchesProv = saroProvince === "ALL" || s.province.toLowerCase().includes(saroProvince.toLowerCase());
      const matchesDiv = saroDivision === "ALL" || s.division === saroDivision;
      const matchesStat = saroStatus === "ALL" || s.status === saroStatus;

      return matchesSearch && matchesProv && matchesDiv && matchesStat;
    });
  }, [saroSearch, saroProvince, saroDivision, saroStatus]);

  // Filtered Trainings
  const filteredTrainings = useMemo(() => {
    return ILCDB_TRAINING_SESSIONS.filter((t) => {
      const q = trainingSearch.toLowerCase();
      const matchesSearch =
        t.title.toLowerCase().includes(q) ||
        t.province.toLowerCase().includes(q) ||
        (t.targetBeneficiaries && t.targetBeneficiaries.toLowerCase().includes(q));

      const matchesProv = trainingProvince === "ALL" || t.province.toLowerCase().includes(trainingProvince.toLowerCase());
      const matchesDiv = trainingDivision === "ALL" || t.division === trainingDivision;

      return matchesSearch && matchesProv && matchesDiv;
    });
  }, [trainingSearch, trainingProvince, trainingDivision]);

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-500/15 text-purple-400 border border-purple-500/30">
                ICT Literacy & Competency Development Bureau (ILCDB)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                FY 2026 Operations & CapDev
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <GraduationCap className="w-7 h-7 text-purple-400" />
              ILCDB Regional Workforce & Competency Analytics
            </h2>
            <p className="text-xs text-slate-400 max-w-3xl">
              End-to-end monitoring of SARO budget execution, SPARK ICT Technical Trainings (digitaljobsPH),
              TMD Workforce Upskilling, EPMD Skills Gap Analysis, C3D2 ICT Diagnostic & Proficiency Exams, and Tech4ED-DTC Center Capacitation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#07090E] border border-[#1A2235] px-4 py-2.5 rounded-lg text-right">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Survey Rate</div>
              <div className="text-xl font-bold font-mono text-emerald-400">{summary.surveyAccomplishmentRate}%</div>
            </div>
            <div className="bg-[#07090E] border border-[#1A2235] px-4 py-2.5 rounded-lg text-right">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">CapDev Target</div>
              <div className="text-xl font-bold font-mono text-blue-400">100% Accomplished</div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 6 KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Survey Respondents */}
        <div className="bg-[#0C101A] border-t-2 border-t-purple-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-purple-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Skills Survey</span>
            <FileCheck2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{summary.totalSurveyRespondents}</div>
          <p className="text-[11px] text-purple-400 mt-0.5 font-medium">Target: {summary.totalSurveyTarget} (415%)</p>
        </div>

        {/* Total Programmed SARO Budget */}
        <div className="bg-[#0C101A] border-t-2 border-t-emerald-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">SARO Program</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            ₱{(summary.totalSaroProjectedBudget / 1000).toFixed(1)}k
          </div>
          <p className="text-[11px] text-emerald-400 mt-0.5 font-medium">30 SARO Activities</p>
        </div>

        {/* SPARK ICT Technical Trainings */}
        <div className="bg-[#0C101A] border-t-2 border-t-blue-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">SPARK Tracks</span>
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">7 Cohorts</div>
          <p className="text-[11px] text-blue-400 mt-0.5 font-medium">GVA 2.0, AI & SMM</p>
        </div>

        {/* TMD Advanced & Intermediate Trainings */}
        <div className="bg-[#0C101A] border-t-2 border-t-cyan-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-cyan-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">TMD Upskilling</span>
            <Laptop className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">8 Batches</div>
          <p className="text-[11px] text-cyan-400 mt-0.5 font-medium">Python, Laravel & Data Sci</p>
        </div>

        {/* Regional CapDev Conducts */}
        <div className="bg-[#0C101A] border-t-2 border-t-amber-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-amber-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">CapDev Operations</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{summary.totalCapDevTrainings}</div>
          <p className="text-[11px] text-amber-400 mt-0.5 font-medium">100% Regional Target Hit</p>
        </div>

        {/* C3D2 Diagnostic / Proficiency Exam */}
        <div className="bg-[#0C101A] border-t-2 border-t-pink-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-pink-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">C3D2 Exams</span>
            <BookOpen className="w-4 h-4 text-pink-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{summary.totalProficiencyExaminees} Examinees</div>
          <p className="text-[11px] text-pink-400 mt-0.5 font-medium">June 4 Conducted • Nov 11 Next</p>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-[#1A2235] pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "overview"
                ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]"
                : "bg-[#0C101A] text-slate-400 hover:text-white border border-[#1A2235]"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Executive Intelligence & Visuals
          </button>
          <button
            onClick={() => setActiveTab("saro")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "saro"
                ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]"
                : "bg-[#0C101A] text-slate-400 hover:text-white border border-[#1A2235]"
            }`}
          >
            <Coins className="w-4 h-4" />
            SARO Operations & Budget Registry ({ILCDB_SARO_ACTIVITIES.length})
          </button>
          <button
            onClick={() => setActiveTab("targets")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "targets"
                ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]"
                : "bg-[#0C101A] text-slate-400 hover:text-white border border-[#1A2235]"
            }`}
          >
            <Target className="w-4 h-4" />
            Divisions & Targets Matrix (EPMD, C3D2, TMD, SPARK, Tech4ED)
          </button>
          <button
            onClick={() => setActiveTab("trainings")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "trainings"
                ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]"
                : "bg-[#0C101A] text-slate-400 hover:text-white border border-[#1A2235]"
            }`}
          >
            <Laptop className="w-4 h-4 text-emerald-400" />
            Specialized Training Cohorts & Pax Turnout
          </button>
        </div>
      </div>

      {/* Tab 1: Executive Overview & Visuals */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Provincial CapDev & Training Distribution */}
            <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-purple-400" />
                    Regional CapDev Training Distribution (100 Conducts)
                  </h3>
                  <p className="text-xs text-slate-400">Accomplished capacity development activities per province</p>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.provincialCapDevDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
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
                    <Bar dataKey="capDevCount" name="CapDev Conducts" radius={[4, 4, 0, 0]}>
                      {summary.provincialCapDevDistribution.map((entry) => (
                        <Cell key={`cell-${entry.province}`} fill={PROVINCE_COLORS[entry.province] || "#8B5CF6"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Division Performance & Accomplishment */}
            <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    Target vs. Accomplishment by Division
                  </h3>
                  <p className="text-xs text-slate-400">EPMD, C3D2, TMD, SPARK, Tech4ED & CapDev Support</p>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.divisionPerformance} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <XAxis
                      dataKey="division"
                      stroke="#64748B"
                      fontSize={10}
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
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    <Bar dataKey="target" name="Target" fill="#64748B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="accomplishment" name="Accomplishment" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Provincial SARO Allocations & Examinees Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Provincial SARO Projected Budget Breakdown */}
            <div className="lg:col-span-2 bg-[#0C101A] border border-[#1A2235] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-400" />
                    Provincial SARO Programmed Budget Allocation
                  </h3>
                  <p className="text-xs text-slate-400">Financial resources assigned for upskilling & technical trainings</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {summary.provincialAllocations.map((p) => (
                  <div key={p.province} className="p-3.5 bg-[#07090E] border border-[#1A2235] rounded-lg space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">{p.province}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{p.saroCount} SARO activities</span>
                    </div>
                    <div className="text-lg font-bold font-mono text-emerald-400">
                      ₱{p.projected.toLocaleString()}
                    </div>
                    {p.actual > 0 && (
                      <div className="text-[10px] text-blue-400 font-mono">
                        Actual Disbursed: ₱{p.actual.toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* C3D2 Examinees by Province */}
            <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-pink-400" />
                  C3D2 Proficiency Examinees
                </h3>
                <p className="text-xs text-slate-400">June 4, 2026 Examination cycle</p>
              </div>

              <div className="space-y-2 pt-1">
                {summary.examineesByProvince.map((ex) => (
                  <div
                    key={ex.province}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#07090E] border border-[#1A2235] text-xs"
                  >
                    <span className="text-slate-300 font-medium">{ex.province}</span>
                    <span className="font-bold font-mono text-white">{ex.count} examinees</span>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-lg border border-pink-500/30 bg-pink-500/5 text-xs text-slate-400">
                <span className="font-semibold text-pink-400 block mb-0.5">Upcoming Cycle:</span>
                Next Regional ICT Diagnostic & Proficiency Exam is scheduled for <strong>November 11, 2026</strong>.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: SARO Operations & Budget Registry */}
      {activeTab === "saro" && (
        <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#1A2235] bg-[#0E1422] space-y-3">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  ILCDB SARO Activities & Financial Allocations
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing {filteredSaro.length} of {ILCDB_SARO_ACTIVITIES.length} SARO programmed items
                </p>
              </div>

              {/* Search */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="search"
                  value={saroSearch}
                  onChange={(e) => setSaroSearch(e.target.value)}
                  placeholder="Search activity, SARO No., province..."
                  className="w-full rounded-lg border border-[#1A2235] bg-[#07090E] pl-9 pr-4 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1A2235]/60">
              <select
                value={saroProvince}
                onChange={(e) => setSaroProvince(e.target.value)}
                className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-xs text-slate-300 font-medium focus:border-purple-500 focus:outline-none"
              >
                <option value="ALL">All Provinces</option>
                <option value="Albay">Albay</option>
                <option value="Camarines Sur">Camarines Sur</option>
                <option value="Camarines Norte">Camarines Norte</option>
                <option value="Catanduanes">Catanduanes</option>
                <option value="Masbate">Masbate</option>
                <option value="Sorsogon">Sorsogon</option>
              </select>

              <select
                value={saroDivision}
                onChange={(e) => setSaroDivision(e.target.value)}
                className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-xs text-slate-300 font-medium focus:border-purple-500 focus:outline-none"
              >
                <option value="ALL">All Divisions</option>
                <option value="TMD">TMD (Upskilling)</option>
                <option value="SPARK">SPARK (digitaljobsPH)</option>
                <option value="TECH4ED-DTC">TECH4ED-DTC</option>
              </select>

              <select
                value={saroStatus}
                onChange={(e) => setSaroStatus(e.target.value)}
                className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-xs text-slate-300 font-medium focus:border-purple-500 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="Completed">Completed</option>
                <option value="Programmed">Programmed</option>
                <option value="Upcoming">Upcoming</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-400 uppercase bg-[#07090E] border-b border-[#1A2235]">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Province</th>
                  <th className="px-4 py-3.5 font-semibold">SARO No.</th>
                  <th className="px-4 py-3.5 font-semibold">Activity Details</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Projected Budget</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Actual Expenses</th>
                  <th className="px-4 py-3.5 text-center font-semibold">Status</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2235]/50">
                {filteredSaro.map((s) => (
                  <tr key={s.id} className="hover:bg-[#111520] transition-colors group">
                    <td className="px-5 py-3.5 font-bold text-white whitespace-nowrap">{s.province}</td>
                    <td className="px-4 py-3.5 font-mono text-purple-400 font-semibold">{s.saroNo}</td>
                    <td className="px-4 py-3.5 max-w-md">
                      <div className="text-slate-200 font-medium line-clamp-2">{s.activity}</div>
                      {s.remarks && (
                        <div className="text-[11px] text-emerald-400 font-mono mt-0.5 line-clamp-1">
                          ✓ {s.remarks}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-200">
                      {s.projectedExpenses ? `₱${s.projectedExpenses.toLocaleString()}` : "-"}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-400">
                      {s.actualExpenses ? `₱${s.actualExpenses.toLocaleString()}` : "-"}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                          s.status === "Completed"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : s.status === "Upcoming"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedSaro(s)}
                        className="px-2.5 py-1 rounded bg-[#1A2235] hover:bg-purple-600 text-slate-300 hover:text-white transition-colors text-[11px] font-medium flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3 h-3" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Divisions & Targets Matrix */}
      {activeTab === "targets" && (
        <div className="space-y-4">
          <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-400" />
              ILCDB Functional Divisions Targets & Physical Accomplishments Matrix
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Key performance tracking across EPMD, C3D2, TMD, SPARK, and Tech4ED divisions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ILCDB_TARGETS_ACCOMPLISHMENTS.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTarget(t)}
                className="bg-[#0C101A] border border-[#1A2235] hover:border-purple-500/50 rounded-xl p-4 transition-all cursor-pointer space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                    {t.division}
                  </span>
                  <span
                    className={`text-xs font-bold flex items-center gap-1 ${
                      t.lacking <= 0 ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t.lacking <= 0 ? "Target Achieved" : `${t.lacking} Remaining`}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white line-clamp-2">{t.particulars}</h4>
                  {t.accomplishmentDetails && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{t.accomplishmentDetails}</p>
                  )}
                </div>

                <div className="p-3 bg-[#07090E] rounded-lg border border-[#1A2235] grid grid-cols-3 gap-2 text-xs text-center font-mono">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Target</span>
                    <span className="font-bold text-white text-sm">{t.target}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Accomplished</span>
                    <span className="font-bold text-emerald-400 text-sm">{t.accomplishment}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Rate</span>
                    <span className="font-bold text-purple-400 text-sm">
                      {Math.round((t.accomplishment / (t.target || 1)) * 100)}%
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

      {/* Tab 4: Specialized Training Cohorts & Pax Turnout */}
      {activeTab === "trainings" && (
        <div className="space-y-4">
          <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5 space-y-3">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Laptop className="w-5 h-5 text-emerald-400" />
                  Conducted & Upcoming Technical Training Cohorts
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Python Essentials, Laravel Framework, Data Science, GVA 2.0 AI-Powered, Social Media Marketing 2.0 & C3D2 Proficiency Exams
                </p>
              </div>

              {/* Search */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="search"
                  value={trainingSearch}
                  onChange={(e) => setTrainingSearch(e.target.value)}
                  placeholder="Search training topic, beneficiary..."
                  className="w-full rounded-lg border border-[#1A2235] bg-[#07090E] pl-9 pr-4 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1A2235]/60">
              <select
                value={trainingProvince}
                onChange={(e) => setTrainingProvince(e.target.value)}
                className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-xs text-slate-300 font-medium focus:border-emerald-500 focus:outline-none"
              >
                <option value="ALL">All Provinces</option>
                <option value="Camarines Sur">Camarines Sur</option>
                <option value="Catanduanes">Catanduanes</option>
                <option value="Sorsogon">Sorsogon</option>
                <option value="Camarines Norte">Camarines Norte</option>
                <option value="Masbate">Masbate</option>
                <option value="Albay">Albay</option>
              </select>

              <select
                value={trainingDivision}
                onChange={(e) => setTrainingDivision(e.target.value)}
                className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-xs text-slate-300 font-medium focus:border-emerald-500 focus:outline-none"
              >
                <option value="ALL">All Divisions</option>
                <option value="TMD">TMD (Upskilling)</option>
                <option value="SPARK">SPARK (digitaljobsPH)</option>
                <option value="TECH4ED-DTC">Tech4ED-DTC</option>
                <option value="C3D2">C3D2 (Proficiency Exam)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTrainings.map((tr) => (
              <div
                key={tr.id}
                onClick={() => setSelectedSession(tr)}
                className="p-4 bg-[#0C101A] border border-[#1A2235] hover:border-emerald-500/50 rounded-xl cursor-pointer transition-colors space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {tr.division}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">{tr.scheduleDate}</span>
                </div>

                <div>
                  <h4 className="font-bold text-white text-sm line-clamp-2">{tr.title}</h4>
                  <p className="text-xs text-purple-400 font-medium mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {tr.province}
                  </p>
                </div>

                <div className="p-2.5 bg-[#07090E] rounded-lg border border-[#1A2235] flex items-center justify-between text-xs">
                  <span className="text-slate-400">Target Group:</span>
                  <span className="font-medium text-slate-200 line-clamp-1">{tr.targetBeneficiaries}</span>
                </div>

                {tr.totalParticipants && (
                  <div className="flex items-center justify-between pt-1 border-t border-[#1A2235] text-xs">
                    <span className="text-slate-500 font-mono">
                      {tr.maleParticipants !== undefined && `♂ ${tr.maleParticipants} | ♀ ${tr.femaleParticipants}`}
                    </span>
                    <span className="font-bold text-emerald-400 font-mono">{tr.totalParticipants} Pax</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: SARO Detail */}
      {selectedSaro && (
        <Modal
          isOpen={!!selectedSaro}
          onClose={() => setSelectedSaro(null)}
          title={`SARO Record: ${selectedSaro.saroNo}`}
        >
          <div className="space-y-4 text-sm">
            <div className="p-4 rounded-xl border border-purple-500/30 bg-[#07090E]">
              <span className="text-[10px] font-bold text-purple-400 uppercase font-mono">
                SARO No. {selectedSaro.saroNo}
              </span>
              <h4 className="font-bold text-base text-white mt-1">{selectedSaro.activity}</h4>
              <p className="text-xs text-slate-400 mt-1">Province: {selectedSaro.province}</p>
            </div>

            <div className="bg-[#0C101A] p-4 rounded-lg border border-[#1A2235] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Projected Expenses:</span>
                <span className="font-bold text-white font-mono">
                  {selectedSaro.projectedExpenses ? `₱${selectedSaro.projectedExpenses.toLocaleString()}` : "Not specified"}
                </span>
              </div>
              {selectedSaro.actualExpenses && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Actual Disbursed:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    ₱{selectedSaro.actualExpenses.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Execution Status:</span>
                <span className="font-semibold text-purple-400">{selectedSaro.status}</span>
              </div>
              {selectedSaro.remarks && (
                <div className="flex justify-between border-t border-[#1A2235] pt-2">
                  <span className="text-slate-500">Operational Remarks:</span>
                  <span className="font-medium text-emerald-400">{selectedSaro.remarks}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#1A2235]">
              <button
                onClick={() => setSelectedSaro(null)}
                className="px-4 py-2 rounded-lg bg-[#1A2235] hover:bg-[#25304b] text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Target Detail */}
      {selectedTarget && (
        <Modal
          isOpen={!!selectedTarget}
          onClose={() => setSelectedTarget(null)}
          title={`Division Matrix: ${selectedTarget.division}`}
        >
          <div className="space-y-4 text-sm">
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-[#07090E]">
              <span className="text-[10px] font-bold text-emerald-400 uppercase font-mono">
                {selectedTarget.division}
              </span>
              <h4 className="font-bold text-base text-white mt-1">{selectedTarget.particulars}</h4>
            </div>

            <div className="bg-[#0C101A] p-4 rounded-lg border border-[#1A2235] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Target Metric:</span>
                <span className="font-bold text-white font-mono">{selectedTarget.target}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Accomplishment:</span>
                <span className="font-bold text-emerald-400 font-mono">{selectedTarget.accomplishment}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lacking:</span>
                <span className="font-bold text-purple-400 font-mono">{selectedTarget.lacking}</span>
              </div>
              {selectedTarget.accomplishmentDetails && (
                <div className="border-t border-[#1A2235] pt-2">
                  <span className="text-slate-500 block text-[10px] mb-1">Details:</span>
                  <span className="text-slate-300 whitespace-pre-line">{selectedTarget.accomplishmentDetails}</span>
                </div>
              )}
              {selectedTarget.remarks && (
                <div className="border-t border-[#1A2235] pt-2">
                  <span className="text-slate-500 block text-[10px] mb-1">Remarks:</span>
                  <span className="text-slate-400 italic">{selectedTarget.remarks}</span>
                </div>
              )}
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

      {/* Modal: Training Session Detail */}
      {selectedSession && (
        <Modal
          isOpen={!!selectedSession}
          onClose={() => setSelectedSession(null)}
          title={`Training Cohort: ${selectedSession.title}`}
        >
          <div className="space-y-4 text-sm">
            <div className="p-4 rounded-xl border border-blue-500/30 bg-[#07090E]">
              <span className="text-[10px] font-bold text-blue-400 uppercase font-mono">
                {selectedSession.programType}
              </span>
              <h4 className="font-bold text-base text-white mt-1">{selectedSession.title}</h4>
              <p className="text-xs text-slate-400 mt-1">Schedule: {selectedSession.scheduleDate}</p>
            </div>

            <div className="bg-[#0C101A] p-4 rounded-lg border border-[#1A2235] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Province:</span>
                <span className="font-semibold text-slate-200">{selectedSession.province}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target Beneficiaries:</span>
                <span className="font-semibold text-slate-200">{selectedSession.targetBeneficiaries}</span>
              </div>
              {selectedSession.totalParticipants && (
                <div className="flex justify-between border-t border-[#1A2235] pt-2">
                  <span className="text-slate-500">Participants Breakdown:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    Total: {selectedSession.totalParticipants}{" "}
                    {selectedSession.maleParticipants !== undefined &&
                      `(♂ ${selectedSession.maleParticipants} | ♀ ${selectedSession.femaleParticipants})`}
                  </span>
                </div>
              )}
              {selectedSession.description && (
                <div className="border-t border-[#1A2235] pt-2">
                  <span className="text-slate-500 block text-[10px] mb-1">Curriculum & Scope:</span>
                  <span className="text-slate-300">{selectedSession.description}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#1A2235]">
              <button
                onClick={() => setSelectedSession(null)}
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
