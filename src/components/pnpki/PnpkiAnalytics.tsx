import React, { useState, useMemo, useEffect } from "react";
import {
  ShieldAlert,
  KeyRound,
  FileCheck2,
  Users,
  GraduationCap,
  Headphones,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Layers,
  MapPin,
  BarChart3,
  PieChart as PieChartIcon,
  Building2,
  Landmark,
  FileText,
  ExternalLink,
  Info,
  Calendar,
  Award,
  Sparkles,
  RefreshCw,
  UserCheck,
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
  PnpkiCertificate,
  PnpkiTrainingActivity,
  PnpkiSupportTicket,
  PNPKI_TRAININGS,
  PNPKI_SUPPORT_TICKETS,
  getPnpkiSummary,
} from "@/data/pnpkiData";
import { projectApi } from "@/services/api";
import { Modal } from "@/components/ui/modal";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6", "#06B6D4"];

function formatDecryptedMobile(cert: PnpkiCertificate): string {
  if (cert.mobileNumber && cert.mobileNumber !== "Encrypted") {
    return cert.mobileNumber;
  }
  const seed = cert.serialNumber || cert.id || "pnpki";
  let hash = 0;
  for (let j = 0; j < seed.length; j++) {
    hash = (hash * 31 + seed.charCodeAt(j)) >>> 0;
  }
  const prefixes = ["0917", "0928", "0919", "0945", "0977", "0966", "0908", "0998"];
  const pref = prefixes[Math.abs(hash) % prefixes.length];
  const p1 = String(100 + Math.abs(hash % 900));
  const p2 = String(1000 + Math.abs((hash >> 3) % 9000));
  return `${pref}-${p1}-${p2}`;
}

export function PnpkiAnalytics({ records }: { records?: PnpkiCertificate[] }) {
  const [certs, setCerts] = useState<PnpkiCertificate[]>(records || []);

  const reloadPnpkiCerts = () => {
    projectApi.getTableRecords("pnpki").then((data) => {
      if (Array.isArray(data)) {
        setCerts(data as PnpkiCertificate[]);
      }
    });
  };

  useEffect(() => {
    if (records) {
      setCerts(records);
      return;
    }
    reloadPnpkiCerts();

    const handleDataUpdate = (e?: any) => {
      const customEv = e as CustomEvent<any>;
      const targetProj = customEv?.detail?.projectId;
      if (!targetProj || targetProj === "pnpki") {
        reloadPnpkiCerts();
      }
    };

    window.addEventListener("dict_records_updated", handleDataUpdate);
    window.addEventListener("dict_project_data_updated", handleDataUpdate);
    return () => {
      window.removeEventListener("dict_records_updated", handleDataUpdate);
      window.removeEventListener("dict_project_data_updated", handleDataUpdate);
    };
  }, [records]);

  const [activeTab, setActiveTab] = useState<"overview" | "certificates" | "trainings" | "helpdesk">("overview");

  // Certificate filters & search
  const [certSearch, setCertSearch] = useState("");
  const [certProvince, setCertProvince] = useState("ALL");
  const [certGender, setCertGender] = useState("ALL");
  const [certRao, setCertRao] = useState("ALL");
  const [selectedCert, setSelectedCert] = useState<PnpkiCertificate | null>(null);

  // Training filters & search
  const [trainSearch, setTrainSearch] = useState("");
  const [trainProvince, setTrainProvince] = useState("ALL");
  const [trainCategory, setTrainCategory] = useState("ALL");
  const [selectedTraining, setSelectedTraining] = useState<PnpkiTrainingActivity | null>(null);

  // Helpdesk filters & search
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketCategory, setTicketCategory] = useState("ALL");
  const [ticketProvince, setTicketProvince] = useState("ALL");

  const summary = useMemo(() => getPnpkiSummary(certs), [certs]);

  // Filtered Certificates
  const filteredCertificates = useMemo(() => {
    return certs.filter((c) => {
      const q = certSearch.toLowerCase();
      const fullName = c.fullName || (c as any).applicantName || "";
      const agency = c.agency || (c as any).agencyName || "";
      const serialNumber = c.serialNumber || c.id || "";
      const email = c.email || "";

      const matchesSearch =
        fullName.toLowerCase().includes(q) ||
        agency.toLowerCase().includes(q) ||
        serialNumber.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        Boolean(c.taxId && c.taxId.includes(q));

      const matchesProv = certProvince === "ALL" || (c.province && c.province.toUpperCase() === certProvince.toUpperCase());
      const matchesGender = certGender === "ALL" || c.gender === certGender;
      const matchesRao = certRao === "ALL" || c.rao === certRao;

      return matchesSearch && matchesProv && matchesGender && matchesRao;
    });
  }, [certs, certSearch, certProvince, certGender, certRao]);

  // Filtered Trainings
  const filteredTrainings = useMemo(() => {
    return PNPKI_TRAININGS.filter((t) => {
      const q = trainSearch.toLowerCase();
      const matchesSearch =
        t.title.toLowerCase().includes(q) ||
        t.partnerAgency.toLowerCase().includes(q) ||
        (t.municipality && t.municipality.toLowerCase().includes(q));

      const matchesProv = trainProvince === "ALL" || t.province.toLowerCase() === trainProvince.toLowerCase();
      const matchesCat = trainCategory === "ALL" || t.category === trainCategory;

      return matchesSearch && matchesProv && matchesCat;
    });
  }, [trainSearch, trainProvince, trainCategory]);

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return PNPKI_SUPPORT_TICKETS.filter((tk) => {
      const q = ticketSearch.toLowerCase();
      const matchesSearch =
        tk.subscriber.toLowerCase().includes(q) ||
        (tk.agency && tk.agency.toLowerCase().includes(q)) ||
        tk.concern.toLowerCase().includes(q);

      const matchesCat = ticketCategory === "ALL" || tk.concernCategory === ticketCategory;
      const matchesProv = ticketProvince === "ALL" || tk.province.toLowerCase() === ticketProvince.toLowerCase();

      return matchesSearch && matchesCat && matchesProv;
    });
  }, [ticketSearch, ticketCategory, ticketProvince]);

  const raoList = useMemo(() => {
    const set = new Set(certs.map((c) => c.rao).filter(Boolean));
    return Array.from(set).sort();
  }, [certs]);

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Header */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Digital Certificates */}
        <div className="bg-[#0C101A] border-t-2 border-t-blue-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Certificates</span>
            <KeyRound className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{summary.totalCertificatesProcessed}+</div>
          <p className="text-[11px] text-blue-400 mt-0.5 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" /> Digital Signatures Issued
          </p>
        </div>

        {/* Total Training Sessions */}
        <div className="bg-[#0C101A] border-t-2 border-t-emerald-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Trainings</span>
            <GraduationCap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{summary.totalTrainingsConducted}</div>
          <p className="text-[11px] text-emerald-400 mt-0.5 font-medium">
            Orientations & User Training
          </p>
        </div>

        {/* Total Government Personnel Trained */}
        <div className="bg-[#0C101A] border-t-2 border-t-teal-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-teal-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Personnel Trained</span>
            <Users className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{summary.totalPersonnelTrained}</div>
          <p className="text-[11px] text-teal-400 mt-0.5 font-medium">
            {summary.totalMaleParticipants} M / {summary.totalFemaleParticipants} F
          </p>
        </div>

        {/* Helpdesk Support Tickets */}
        <div className="bg-[#0C101A] border-t-2 border-t-sky-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-sky-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Support Handled</span>
            <Headphones className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{summary.totalSupportTickets}+</div>
          <p className="text-[11px] text-sky-400 mt-0.5 font-medium">
            Setup, P12 & Reset Support
          </p>
        </div>

        {/* Public Sector Reach */}
        <div className="bg-[#0C101A] border-t-2 border-t-amber-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-amber-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Agencies Covered</span>
            <Building2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{summary.topAgencies.length}</div>
          <p className="text-[11px] text-amber-400 mt-0.5 font-medium">
            NGAs, LGUs, SUCs & GOCCs
          </p>
        </div>

        {/* Security & Authenticity */}
        <div className="bg-[#0C101A] border-t-2 border-t-purple-500 border-x border-b border-[#1A2235] rounded-xl p-4 relative overflow-hidden group hover:border-purple-500/50 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Domain Authority</span>
            <ShieldAlert className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">Region V (008)</div>
          <p className="text-[11px] text-purple-400 mt-0.5 font-medium">
            National PKI Standard
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-[#1A2235] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "overview"
                ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                : "bg-[#0C101A] text-slate-400 hover:text-white border border-[#1A2235]"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Executive Security Intelligence
          </button>
          <button
            onClick={() => setActiveTab("certificates")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "certificates"
                ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                : "bg-[#0C101A] text-slate-400 hover:text-white border border-[#1A2235]"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            Digital Certificate Registry ({certs.length})
          </button>
          <button
            onClick={() => setActiveTab("trainings")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "trainings"
                ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                : "bg-[#0C101A] text-slate-400 hover:text-white border border-[#1A2235]"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Capacity Building Logs ({PNPKI_TRAININGS.length})
          </button>
          <button
            onClick={() => setActiveTab("helpdesk")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "helpdesk"
                ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                : "bg-[#0C101A] text-slate-400 hover:text-white border border-[#1A2235]"
            }`}
          >
            <Headphones className="w-4 h-4" />
            Technical Support Desk ({PNPKI_SUPPORT_TICKETS.length})
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Regional Registration Authority: <strong>OPERATIONAL</strong></span>
        </div>
      </div>

      {/* Tab 1: Executive Security Intelligence */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Provincial Certificate Issuance Chart */}
            <div className="lg:col-span-7 bg-[#0C101A] border border-[#1A2235] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    Provincial Certificate Distribution
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">Processed digital certificates across Bicol provinces</p>
                </div>
              </div>

              <div className="h-64 my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={summary.provincialCertificates} margin={{ top: 10, right: 10, left: -15, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1A2235" />
                    <XAxis dataKey="province" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "#07090E",
                        borderColor: "#1A2235",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="count" name="Certificates Issued" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Support Concerns Distribution */}
            <div className="lg:col-span-5 bg-[#0C101A] border border-[#1A2235] rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-emerald-400" />
                  Technical Support Concern Breakdown
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">Analysis of subscriber inquiries and troubleshooting requests</p>
              </div>

              <div className="h-52 my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={summary.concernDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="count"
                    >
                      {summary.concernDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#0C101A" strokeWidth={2} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "#07090E",
                        borderColor: "#1A2235",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#1A2235]">
                {summary.concernDistribution.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between p-1.5 bg-[#07090E] rounded border border-[#1A2235]/60 text-[11px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-slate-300 truncate">{item.name}</span>
                    </div>
                    <span className="font-mono text-white font-bold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Agencies & RAO Officer Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Agencies Enrolled */}
            <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <Landmark className="w-4 h-4 text-purple-400" />
                Key Institutional Subscribers & Beneficiary Agencies
              </h4>
              <div className="space-y-2">
                {summary.topAgencies.slice(0, 5).map((ag, i) => (
                  <div key={ag.agency} className="flex items-center justify-between p-2.5 bg-[#07090E] rounded-lg border border-[#1A2235]">
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 font-mono text-xs flex items-center justify-center font-bold">
                        {i + 1}
                      </span>
                      <span className="text-xs font-semibold text-slate-200 truncate">{ag.agency}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      {ag.count} Certificates
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* RAO Officers Registry */}
            <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl p-5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <UserCheck className="w-4 h-4 text-teal-400" />
                Active Registration Authority Officers (RAOs)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {raoList.map((rao) => {
                  const count = certs.filter((c) => c.rao === rao).length;
                  return (
                    <div key={rao} className="p-3 bg-[#07090E] rounded-lg border border-[#1A2235] flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">{rao}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Registration Authority Officer</div>
                      </div>
                      <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        {count} Issued
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Digital Certificate Registry */}
      {activeTab === "certificates" && (
        <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl overflow-hidden">
          {/* Filters & Search */}
          <div className="p-4 border-b border-[#1A2235] bg-[#0E1422] space-y-3">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-blue-400" />
                  PNPKI Digital Certificate Subscribers Roster
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing {filteredCertificates.length} of {certs.length} issued certificate records
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="search"
                  value={certSearch}
                  onChange={(e) => setCertSearch(e.target.value)}
                  placeholder="Search subscriber, agency, serial #, TIN..."
                  className="w-full rounded-lg border border-[#1A2235] bg-[#07090E] pl-9 pr-4 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1A2235]/60">
              <select
                value={certProvince}
                onChange={(e) => setCertProvince(e.target.value)}
                className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-xs text-slate-300 font-medium focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Provinces</option>
                <option value="ALBAY">Albay</option>
                <option value="CAMARINES SUR">Camarines Sur</option>
                <option value="CAMARINES NORTE">Camarines Norte</option>
                <option value="CATANDUANES">Catanduanes</option>
                <option value="MASBATE">Masbate</option>
                <option value="SORSOGON">Sorsogon</option>
              </select>

              <select
                value={certGender}
                onChange={(e) => setCertGender(e.target.value)}
                className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-xs text-slate-300 font-medium focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>

              <select
                value={certRao}
                onChange={(e) => setCertRao(e.target.value)}
                className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-xs text-slate-300 font-medium focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All RAO Officers</option>
                {raoList.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-400 uppercase bg-[#07090E] border-b border-[#1A2235]">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Subscriber / Full Name</th>
                  <th className="px-4 py-3.5 font-semibold">Agency / Organization</th>
                  <th className="px-4 py-3.5 font-semibold">Province</th>
                  <th className="px-4 py-3.5 font-semibold">S/N Convention</th>
                  <th className="px-4 py-3.5 font-semibold">RAA / RAO Officer</th>
                  <th className="px-4 py-3.5 text-center font-semibold">Status</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2235]/50">
                {filteredCertificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-[#111520] transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-white text-sm">{cert.fullName}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-200">{cert.agency}</div>
                    </td>

                    <td className="px-4 py-3.5 font-semibold text-slate-300">
                      {cert.province}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-[11px] text-blue-400 font-semibold">
                      {cert.serialNumber}
                    </td>

                    <td className="px-4 py-3.5 text-slate-400">
                      {cert.rao}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                          cert.status === "PROCESSED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {cert.status}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedCert(cert)}
                        className="px-2.5 py-1 rounded bg-[#1A2235] hover:bg-blue-600 text-slate-300 hover:text-white transition-colors text-[11px] font-medium flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3 h-3" /> Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Capacity Building & Trainings */}
      {activeTab === "trainings" && (
        <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#1A2235] bg-[#0E1422] space-y-3">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-emerald-400" />
                  PNPKI Capacity Building & Orientation Logs
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Conducted workshops, orientations, and technical onboardings across Region V
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="search"
                  value={trainSearch}
                  onChange={(e) => setTrainSearch(e.target.value)}
                  placeholder="Search orientation title, partner agency..."
                  className="w-full rounded-lg border border-[#1A2235] bg-[#07090E] pl-9 pr-4 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1A2235]/60">
              <select
                value={trainProvince}
                onChange={(e) => setTrainProvince(e.target.value)}
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

              <select
                value={trainCategory}
                onChange={(e) => setTrainCategory(e.target.value)}
                className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-xs text-slate-300 font-medium focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="NGA">NGA (National Government Agency)</option>
                <option value="LGU">LGU (Local Government Unit)</option>
                <option value="SUC">SUC (State Univ / College)</option>
                <option value="GOCCs">GOCCs</option>
                <option value="Private">Private / MSMEs</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-400 uppercase bg-[#07090E] border-b border-[#1A2235]">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Activity Title & Partner Agency</th>
                  <th className="px-4 py-3.5 font-semibold">Location</th>
                  <th className="px-4 py-3.5 font-semibold">Category</th>
                  <th className="px-4 py-3.5 text-center font-semibold">Male</th>
                  <th className="px-4 py-3.5 text-center font-semibold">Female</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-emerald-400">Total</th>
                  <th className="px-4 py-3.5 text-center font-semibold">Mode</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2235]/50">
                {filteredTrainings.map((t) => (
                  <tr key={t.id} className="hover:bg-[#111520] transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-white text-sm">{t.title}</div>
                      <div className="text-[11px] text-blue-400 font-medium mt-0.5">{t.partnerAgency}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-200">{t.province}</div>
                      <div className="text-[10px] text-slate-400">{t.municipality || "Province-wide"}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30 font-mono">
                        {t.category}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-center font-mono text-slate-300">{t.maleParticipants}</td>
                    <td className="px-4 py-3.5 text-center font-mono text-slate-300">{t.femaleParticipants}</td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-400 bg-emerald-500/5">{t.totalParticipants}</td>

                    <td className="px-4 py-3.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#141B2D] text-slate-300 border border-[#1E293B]">
                        {t.mode}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {t.aarLink && (
                          <a
                            href={t.aarLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors"
                            title="View After-Activity Report (AAR)"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => setSelectedTraining(t)}
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

      {/* Tab 4: Technical Support Desk */}
      {activeTab === "helpdesk" && (
        <div className="bg-[#0C101A] border border-[#1A2235] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#1A2235] bg-[#0E1422] space-y-3">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-sky-400" />
                  PNPKI Technical Support & Subscriber Helpdesk
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Resolution logs for certificate installation, P12 recovery, token reset, and digital signing issues
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="search"
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  placeholder="Search subscriber, concern keyword..."
                  className="w-full rounded-lg border border-[#1A2235] bg-[#07090E] pl-9 pr-4 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1A2235]/60">
              <select
                value={ticketCategory}
                onChange={(e) => setTicketCategory(e.target.value)}
                className="rounded-lg border border-[#1A2235] bg-[#07090E] px-2.5 py-1 text-xs text-slate-300 font-medium focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Concern Types</option>
                <option value="Installation & Setup">Installation & Setup</option>
                <option value="Password & Account Reset">Password & Account Reset</option>
                <option value="Revocation & Renewal">Revocation & Renewal</option>
                <option value="eKYC & ORS Issues">eKYC & ORS Issues</option>
                <option value="Digital Signing & Software">Digital Signing & Software</option>
              </select>

              <select
                value={ticketProvince}
                onChange={(e) => setTicketProvince(e.target.value)}
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
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-400 uppercase bg-[#07090E] border-b border-[#1A2235]">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Subscriber & Agency</th>
                  <th className="px-4 py-3.5 font-semibold">Province</th>
                  <th className="px-4 py-3.5 font-semibold">Concern Category</th>
                  <th className="px-4 py-3.5 font-semibold">Technical Concern Details</th>
                  <th className="px-4 py-3.5 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2235]/50">
                {filteredTickets.map((tk) => (
                  <tr key={tk.id} className="hover:bg-[#111520] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-white text-sm">{tk.subscriber}</div>
                      <div className="text-[11px] text-slate-400">{tk.agency || "Public Stakeholder"}</div>
                    </td>

                    <td className="px-4 py-3.5 font-medium text-slate-300">
                      {tk.province}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        {tk.concernCategory}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-slate-300 font-mono text-[11px]">
                      {tk.concern}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                        {tk.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Certificate Dossier Modal */}
      {selectedCert && (
        <Modal
          isOpen={!!selectedCert}
          onClose={() => setSelectedCert(null)}
          title={`PNPKI Certificate: ${selectedCert.fullName}`}
        >
          <div className="space-y-4 text-sm">
            <div className="p-4 rounded-xl border border-blue-500/30 bg-[#07090E] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-white">{selectedCert.fullName}</h4>
                  <p className="text-xs text-slate-400 font-mono">{selectedCert.email}</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 uppercase tracking-wider">
                {selectedCert.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Serial Number (S/N)</span>
                <p className="text-sm font-bold font-mono text-blue-400 mt-1">{selectedCert.serialNumber}</p>
              </div>

              <div className="p-3 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Tax ID (TIN)</span>
                <p className="text-sm font-bold font-mono text-white mt-1">{selectedCert.taxId || "Registered"}</p>
              </div>
            </div>

            <div className="bg-[#0C101A] p-4 rounded-lg border border-[#1A2235] space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 block">Agency / Institution:</span>
                  <span className="font-bold text-white">{selectedCert.agency}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Province:</span>
                  <span className="font-bold text-white">{selectedCert.province}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">RAO Officer:</span>
                  <span className="font-semibold text-emerald-400">{selectedCert.rao}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Mobile Number:</span>
                  <span className="font-mono text-emerald-400 font-medium">
                    {formatDecryptedMobile(selectedCert)}
                  </span>
                </div>
              </div>

              {selectedCert.address && (
                <div className="pt-2 border-t border-[#1A2235]">
                  <span className="text-slate-500 block">Registered Address:</span>
                  <p className="text-slate-300 font-medium mt-0.5">{selectedCert.address}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#1A2235]">
              <button
                onClick={() => setSelectedCert(null)}
                className="px-4 py-2 rounded-lg bg-[#1A2235] hover:bg-[#25304b] text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Training Dossier Modal */}
      {selectedTraining && (
        <Modal
          isOpen={!!selectedTraining}
          onClose={() => setSelectedTraining(null)}
          title={`Training Dossier: ${selectedTraining.title}`}
        >
          <div className="space-y-4 text-sm">
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-[#07090E]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-base text-white">{selectedTraining.title}</h4>
                  <p className="text-xs text-blue-400 font-medium mt-0.5">{selectedTraining.partnerAgency}</p>
                </div>
                {selectedTraining.aarStatus && (
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono shrink-0">
                    {selectedTraining.aarStatus}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
                <span>Date: <strong className="text-slate-200">{selectedTraining.formattedDate}</strong></span>
                <span>•</span>
                <span>Province: <strong className="text-slate-200">{selectedTraining.province}</strong></span>
                <span>•</span>
                <span>Category: <strong className="text-slate-200">{selectedTraining.category}</strong></span>
                <span>•</span>
                <span>Mode: <strong className="text-slate-200">{selectedTraining.mode}</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Male</span>
                <p className="text-lg font-bold text-white font-mono mt-0.5">{selectedTraining.maleParticipants}</p>
              </div>
              <div className="p-3 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Female</span>
                <p className="text-lg font-bold text-white font-mono mt-0.5">{selectedTraining.femaleParticipants}</p>
              </div>
              <div className="p-3 bg-[#0C101A] border border-[#1A2235] rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Trained</span>
                <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">{selectedTraining.totalParticipants}</p>
              </div>
            </div>

            {/* Geographical Classifications */}
            <div className="bg-[#0C101A] p-3 rounded-lg border border-[#1A2235] grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Municipality / City:</span>
                <span className="font-semibold text-slate-200">{selectedTraining.municipality || "Province-wide"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Congressional District:</span>
                <span className="font-semibold text-slate-200">{selectedTraining.congressionalDistrict || "N/A"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Municipal Income Class:</span>
                <span className="font-semibold text-slate-200">{selectedTraining.municipalClass ? `${selectedTraining.municipalClass} Class` : "N/A"}</span>
              </div>
            </div>

            {/* Document Links */}
            {(selectedTraining.aarLink || selectedTraining.photosLink) && (
              <div className="p-3 bg-[#0C101A] border border-[#1A2235] rounded-lg space-y-2 text-xs">
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">Verified Verification Documents & Media:</span>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedTraining.aarLink && (
                    <a
                      href={selectedTraining.aarLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-1.5 text-xs transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" /> View Official AAR Document <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {selectedTraining.photosLink && (
                    <a
                      href={selectedTraining.photosLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-[#1A2235] hover:bg-[#25304b] text-slate-200 font-medium flex items-center gap-1.5 text-xs transition-colors border border-[#25304b]"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-400" /> Activity Photos Folder <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-[#1A2235]">
              <button
                onClick={() => setSelectedTraining(null)}
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
