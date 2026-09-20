import React, { useState } from "react";
import {
  Server,
  Shield,
  Activity,
  Layers,
  CheckCircle2,
  Clock,
  AlertOctagon,
  HardDrive,
  Users,
  Mail,
  Wifi,
  Globe,
  Radio,
  Cpu,
  ArrowRight,
  ShieldAlert,
  Search,
  ExternalLink,
  Lock,
  Filter,
  Network,
  Maximize2,
  FileSpreadsheet,
  Check,
  ChevronRight,
  Sparkles,
  Info
} from "lucide-react";
import {
  MISS_INTERNAL_CONCERNS,
  MISS_EXTERNAL_CONCERNS,
  MISS_INTERNAL_SYSTEMS,
  MISS_NETWORK_MILESTONES,
  MISS_BLOCKED_CATEGORIES,
  MISS_SAMPLE_BLOCKED_IPS,
  MISS_VLAN_SEGMENTATION
} from "@/data/missData";

export function MissAnalytics() {
  const [activeTab, setActiveTab] = useState<"accomplishments" | "network" | "firewall" | "topology">("accomplishments");
  const [ipSearch, setIpSearch] = useState("");
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const totalInternal = MISS_INTERNAL_CONCERNS.reduce((acc, c) => acc + c.count, 0);
  const totalExternal = MISS_EXTERNAL_CONCERNS.reduce((acc, c) => acc + c.count, 0);
  const deployedSystems = MISS_INTERNAL_SYSTEMS.filter((s) => s.status === "Deployed").length;
  const testingSystems = MISS_INTERNAL_SYSTEMS.filter((s) => s.status === "For Testing").length;
  const pendingSystems = MISS_INTERNAL_SYSTEMS.filter((s) => s.status === "Pending").length;

  const filteredIps = MISS_SAMPLE_BLOCKED_IPS.filter((item) =>
    item.ip.includes(ipSearch) || item.risk.toLowerCase().includes(ipSearch.toLowerCase())
  );

  const handleCopyIp = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* ========================================================================= */}
      {/* TOP HERO & SYSTEM OVERVIEW BANNER                                         */}
      {/* ========================================================================= */}
      <div className="bg-[#0C101D] border border-[#18233C] p-6 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                DICT Regional Office No. V
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                MISS Operations
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-900/30">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">
                  Management Information Systems Service (MISS)
                </h1>
                <p className="text-xs text-slate-400">
                  Regional ICT infrastructure, internal enterprise systems, Forcepoint network security, and LGU technical support
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
            <div className="bg-[#111728] border border-[#1C2744] p-3 rounded-xl text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Internal Tickets</div>
              <div className="text-lg font-black text-white font-mono">{totalInternal}</div>
              <div className="text-[10px] text-blue-400">100% DICT R5 Support</div>
            </div>

            <div className="bg-[#111728] border border-[#1C2744] p-3 rounded-xl text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">LGU Assists</div>
              <div className="text-lg font-black text-emerald-400 font-mono">{totalExternal}</div>
              <div className="text-[10px] text-slate-400">Govmail/DNS/Hosting</div>
            </div>

            <div className="bg-[#111728] border border-[#1C2744] p-3 rounded-xl text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Blocked IPs</div>
              <div className="text-lg font-black text-red-400 font-mono">1,086</div>
              <div className="text-[10px] text-slate-400">ASEAN Config</div>
            </div>

            <div className="bg-[#111728] border border-[#1C2744] p-3 rounded-xl text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Live Systems</div>
              <div className="text-lg font-black text-purple-400 font-mono">{deployedSystems} / 9</div>
              <div className="text-[10px] text-amber-400">{testingSystems} in UAT testing</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* NAVIGATION TABS (MATCHING 4 PRESENTATION SLIDES)                           */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 p-1.5 bg-[#0C101D] border border-[#18233C] rounded-2xl overflow-x-auto custom-scrollbar">
        
        <button
          onClick={() => setActiveTab("accomplishments")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "accomplishments"
              ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
              : "text-slate-400 hover:text-white hover:bg-[#141C2E]"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Accomplishments & Systems</span>
        </button>

        <button
          onClick={() => setActiveTab("network")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "network"
              ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
              : "text-slate-400 hover:text-white hover:bg-[#141C2E]"
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Network & Application Milestones</span>
        </button>

        <button
          onClick={() => setActiveTab("firewall")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "firewall"
              ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
              : "text-slate-400 hover:text-white hover:bg-[#141C2E]"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>ASEAN Firewall & URL Filtering</span>
        </button>

        <button
          onClick={() => setActiveTab("topology")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "topology"
              ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
              : "text-slate-400 hover:text-white hover:bg-[#141C2E]"
          }`}
        >
          <Network className="w-4 h-4" />
          <span>Internal Network Topology</span>
        </button>

      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ACCOMPLISHMENTS & SYSTEMS (SLIDE 1)                                */}
      {/* ========================================================================= */}
      {activeTab === "accomplishments" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in">
          
          {/* Left Column: Internal Concerns & External Assists */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Internal Concerns Card */}
            <div className="bg-[#0C101D] border border-[#18233C] p-6 rounded-2xl shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#18233C]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Internal Concerns</h3>
                    <p className="text-[11px] text-slate-400">Total of {totalInternal} technical support items handled for DICT Region 5</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                  {totalInternal} Requests
                </span>
              </div>

              <div className="space-y-3.5">
                {MISS_INTERNAL_CONCERNS.map((item, idx) => (
                  <div key={idx} className="bg-[#111728] border border-[#1C2744] p-3.5 rounded-xl space-y-2 group hover:border-blue-500/40 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 font-mono font-bold text-xs flex items-center justify-center">
                          {item.count}
                        </span>
                        <span className="text-xs font-bold text-slate-200">{item.category}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{item.percentage}%</span>
                    </div>

                    <div className="w-full bg-[#18233C] h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-1">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* External Concerns - Assisted Card */}
            <div className="bg-[#0C101D] border border-[#18233C] p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#18233C]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">External Concerns - Assisted</h3>
                    <p className="text-[11px] text-slate-400">Technical assistance rendered to Local Government Units</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  {totalExternal} LGUs
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {MISS_EXTERNAL_CONCERNS.map((ext, idx) => (
                  <div key={idx} className="bg-[#111728] border border-[#1C2744] p-4 rounded-xl text-center space-y-1">
                    <div className="text-2xl font-black text-emerald-400 font-mono">{ext.count}</div>
                    <div className="text-xs font-bold text-white">{ext.category}</div>
                    <div className="text-[10px] text-slate-400">{ext.beneficiaries}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Internal Systems Portfolio */}
          <div className="lg:col-span-6 bg-[#0C101D] border border-[#18233C] p-6 rounded-2xl shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#18233C]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Internal Systems</h3>
                  <p className="text-[11px] text-slate-400">Regional operational applications managed and developed by MISS</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] font-bold">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {deployedSystems} Deployed
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  {testingSystems} Testing
                </span>
              </div>
            </div>

            {/* Systems Table / List */}
            <div className="space-y-3">
              {MISS_INTERNAL_SYSTEMS.map((sys) => {
                const isDeployed = sys.status === "Deployed";
                const isTesting = sys.status === "For Testing";
                const isPending = sys.status === "Pending";

                return (
                  <div
                    key={sys.id}
                    className="bg-[#111728] border border-[#1C2744] p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-purple-500/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">{sys.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {sys.version}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{sys.description}</p>
                      <div className="text-[10px] text-slate-500">Target Userbase: {sys.userBase}</div>
                    </div>

                    <div className="shrink-0">
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border inline-flex items-center gap-1.5 ${
                          isDeployed
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : isTesting
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isDeployed ? "bg-emerald-400" : isTesting ? "bg-amber-400" : "bg-blue-400"
                          }`}
                        />
                        {sys.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: NETWORK & APPLICATION MILESTONES (SLIDE 2)                          */}
      {/* ========================================================================= */}
      {activeTab === "network" && (
        <div className="space-y-6 animate-in fade-in">
          
          <div className="bg-[#0C101D] border border-[#18233C] p-6 rounded-2xl shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#18233C]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white uppercase tracking-wider">
                    Network & Application Engineering Tasks
                  </h2>
                  <p className="text-xs text-slate-400">
                    Infrastructure milestones accomplished for DICT Regional Office V
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                5 Completed • 1 In Procurement
              </span>
            </div>

            {/* Grid of Milestones */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MISS_NETWORK_MILESTONES.map((m, idx) => {
                const isComplete = m.status === "Completed";

                return (
                  <div
                    key={idx}
                    className="bg-[#111728] border border-[#1C2744] p-5 rounded-2xl space-y-3 flex flex-col justify-between hover:border-blue-500/30 transition-all group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="w-6 h-6 rounded-lg bg-blue-600/10 text-blue-400 font-mono font-bold text-xs flex items-center justify-center">
                          0{idx + 1}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            isComplete
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>

                      <h3 className="text-xs font-black text-white group-hover:text-blue-400 transition-colors">
                        {m.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{m.details}</p>
                    </div>

                    <div className="pt-3 border-t border-[#18233C] flex items-center justify-between text-[10px] text-slate-500">
                      <span>Timeline Status:</span>
                      <span className="font-semibold text-slate-300">{m.dateCompleted}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Technical Highlights Callout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0C101D] border border-[#18233C] p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Forcepoint Firewall</div>
                <div className="text-[11px] text-slate-400">High Availability enterprise cluster installed</div>
              </div>
            </div>

            <div className="bg-[#0C101D] border border-[#18233C] p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">VLAN Network Segregation</div>
                <div className="text-[11px] text-slate-400">VLAN 2600, 2601, and 2602 isolated</div>
              </div>
            </div>

            <div className="bg-[#0C101D] border border-[#18233C] p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">ASEAN Standard Filtering</div>
                <div className="text-[11px] text-slate-400">1,086 IPs & 11 Content categories blocked</div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ASEAN FIREWALL & URL FILTERING (SLIDE 3)                            */}
      {/* ========================================================================= */}
      {activeTab === "firewall" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in">
          
          {/* Left Column: 11 Web Filtering Categories */}
          <div className="lg:col-span-5 bg-[#0C101D] border border-[#18233C] p-6 rounded-2xl shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#18233C]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Web Filtering Categories</h3>
                  <p className="text-[11px] text-slate-400">11 Categories based on ASEAN configurations</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20">
                11 Policies
              </span>
            </div>

            <div className="space-y-2.5 max-h-[580px] overflow-y-auto custom-scrollbar pr-1">
              {MISS_BLOCKED_CATEGORIES.map((cat, idx) => (
                <div
                  key={idx}
                  className="bg-[#111728] border border-[#1C2744] p-3.5 rounded-xl space-y-1.5 hover:border-red-500/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-red-600/20 text-red-400 font-mono text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-white">{cat.name}</span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                        cat.policy === "Security Drop"
                          ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : cat.policy === "Bandwidth Throttle"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                      }`}
                    >
                      {cat.policy}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400">{cat.description}</p>
                  <div className="text-[10px] text-slate-500">Examples: {cat.sampleServices}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: 1086 Blocked IP Addresses Table */}
          <div className="lg:col-span-7 bg-[#0C101D] border border-[#18233C] p-6 rounded-2xl shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-[#18233C]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    IP Address Block-List
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    1,086 IPs Blocked by Forcepoint Firewall based on ASEAN configs
                  </p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ipSearch}
                  onChange={(e) => setIpSearch(e.target.value)}
                  placeholder="Search IP or threat..."
                  className="w-full bg-[#080B14] border border-[#1C2844] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            {/* Table of Sample IPs */}
            <div className="border border-[#18233C] rounded-xl overflow-hidden">
              <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#111728] text-slate-400 font-semibold sticky top-0 border-b border-[#18233C] text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">IP Address</th>
                      <th className="py-2.5 px-3">Threat Category</th>
                      <th className="py-2.5 px-3">Source Profile</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#18233C]/60 text-slate-300 font-mono">
                    {filteredIps.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#111728]/50 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-red-400">{item.ip}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-300 text-[11px]">{item.risk}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-400 text-[11px]">{item.country}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleCopyIp(item.ip)}
                            className="p-1 rounded bg-[#141C2E] hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="Copy IP Address"
                          >
                            {copiedIp === item.ip ? <Check className="w-3 h-3 text-emerald-400" /> : <HardDrive className="w-3 h-3" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex justify-between items-center">
              <span>Showing sample entries from the 1,086 regional firewall blocklist</span>
              <span className="text-emerald-400 font-bold">Firewall Policy: Active Drop</span>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: INTERNAL NETWORK TOPOLOGY (SLIDE 4)                                */}
      {/* ========================================================================= */}
      {activeTab === "topology" && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Main Network Architecture Visualizer */}
          <div className="bg-[#0C101D] border border-[#18233C] p-6 rounded-2xl shadow-xl space-y-6">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[#18233C]">
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-wider">
                  DICT REGION 5 NETWORK TOPOLOGY
                </h2>
                <p className="text-xs text-slate-400">
                  Regional Office V Enterprise Infrastructure with ISP Uplinks, Forcepoint HA Firewall, Core Routing, and Managed Access Points
                </p>
              </div>

              {/* Legend Callout */}
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                <span className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400" /> ISP Uplink
                </span>
                <span className="px-2.5 py-1 rounded bg-lime-500/20 text-lime-300 border border-lime-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-lime-400" /> Unmanaged Switch
                </span>
                <span className="px-2.5 py-1 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-400" /> Firewall
                </span>
                <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Core Switch
                </span>
                <span className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400" /> Manage Switch
                </span>
                <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> Access Point
                </span>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* INTERACTIVE DIAGRAM CANVAS CONTAINER                                      */}
            {/* ========================================================================= */}
            <div className="bg-[#070A14] border border-[#18233C] rounded-2xl p-6 relative overflow-hidden flex flex-col items-center">
              
              {/* VLAN Segmentation Sidecard (Left Float) */}
              <div className="w-full lg:w-auto lg:absolute lg:top-6 lg:left-6 bg-[#0E1424]/90 border border-blue-500/30 p-4 rounded-xl backdrop-blur-sm space-y-2.5 mb-6 lg:mb-0 z-20">
                <div className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  VLAN SEGMENTATION
                </div>
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    <strong>2600</strong> - MISS NETWORK
                  </div>
                  <div className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    <strong>2601</strong> - LAN NETWORK
                  </div>
                  <div className="px-2.5 py-1 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    <strong>2602</strong> - WLAN NETWORK
                  </div>
                </div>
              </div>

              {/* Topology Architecture Tree */}
              <div className="w-full max-w-4xl flex flex-col items-center space-y-6 pt-2">
                
                {/* 1. ISP Tier (Top) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-2xl">
                  
                  {/* ISP 1: Globe */}
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-full bg-sky-600/90 text-white font-bold text-xs py-2 px-3 rounded-xl text-center shadow-lg shadow-sky-900/30 border border-sky-400">
                      <div className="text-[10px] text-sky-200 uppercase font-mono">500 MBPS</div>
                      <div>GLOBE INC</div>
                    </div>
                    <div className="w-0.5 h-4 bg-slate-600" />
                    <div className="w-36 bg-lime-600/90 text-slate-900 font-extrabold text-[10px] py-1.5 px-2 rounded-lg text-center border border-lime-400 uppercase tracking-wider">
                      SWITCH (UNMANAGE)
                    </div>
                    <div className="w-0.5 h-4 bg-slate-600" />
                  </div>

                  {/* ISP 2: GovNet */}
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-full bg-sky-600/90 text-white font-bold text-xs py-2 px-3 rounded-xl text-center shadow-lg shadow-sky-900/30 border border-sky-400">
                      <div className="text-[10px] text-sky-200 uppercase font-mono">1 GB SHARED</div>
                      <div>GOVNET</div>
                    </div>
                    <div className="w-0.5 h-4 bg-slate-600" />
                    <div className="w-36 bg-lime-600/90 text-slate-900 font-extrabold text-[10px] py-1.5 px-2 rounded-lg text-center border border-lime-400 uppercase tracking-wider">
                      SWITCH (UNMANAGE)
                    </div>
                    <div className="w-0.5 h-4 bg-slate-600" />
                  </div>

                  {/* ISP 3: Eastern */}
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-full bg-sky-600/90 text-white font-bold text-xs py-2 px-3 rounded-xl text-center shadow-lg shadow-sky-900/30 border border-sky-400">
                      <div className="text-[10px] text-sky-200 uppercase font-mono">100 MBPS</div>
                      <div>EASTERN</div>
                    </div>
                    <div className="w-0.5 h-4 bg-slate-600" />
                    <div className="w-36 bg-lime-600/90 text-slate-900 font-extrabold text-[10px] py-1.5 px-2 rounded-lg text-center border border-lime-400 uppercase tracking-wider">
                      SWITCH (UNMANAGE)
                    </div>
                    <div className="w-0.5 h-4 bg-slate-600" />
                  </div>

                </div>

                {/* 2. Firewall Redundancy Tier */}
                <div className="w-full max-w-xl border-2 border-red-500/80 bg-red-950/20 rounded-2xl p-3.5 relative">
                  <div className="text-center text-[10px] font-black uppercase tracking-wider text-red-400 mb-2">
                    FIREWALL REDUNDANCY (FORCEPOINT)
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-orange-600 text-white font-bold text-xs py-2.5 px-3 rounded-xl text-center border border-orange-400 shadow-md">
                      FIREWALL 1 (PRIMARY)
                    </div>
                    <div className="bg-orange-600 text-white font-bold text-xs py-2.5 px-3 rounded-xl text-center border border-orange-400 shadow-md">
                      FIREWALL 2 (BACKUP)
                    </div>
                  </div>

                  <div className="text-center text-[9px] font-mono font-bold text-red-300 mt-2">
                    ⇄ FAILOVER & HEARTBEAT SYNC ⇄
                  </div>
                </div>

                {/* Connector to Core */}
                <div className="w-0.5 h-5 bg-slate-500" />

                {/* 3. Core Switch Routing Backbone */}
                <div className="w-full max-w-md bg-emerald-600 text-white font-bold text-xs py-3 px-4 rounded-xl text-center border border-emerald-400 shadow-xl shadow-emerald-950/40">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-100">ROUTING BACKBONE</div>
                  <div className="text-sm font-black">CORE SWITCH</div>
                </div>

                {/* Distribution Links Connector */}
                <div className="flex flex-col items-center">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">DISTRIBUTION LINKS</div>
                  <div className="w-0.5 h-4 bg-slate-500" />
                </div>

                {/* 4. Managed Distribution Switches Tier */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full">
                  
                  {/* Managed Switch 1 */}
                  <div className="bg-[#111728] border border-[#1C2744] p-4 rounded-2xl flex flex-col items-center space-y-3">
                    <div className="w-full bg-purple-600 text-white font-bold text-xs py-2 px-3 rounded-xl text-center border border-purple-400 shadow-md">
                      <div className="text-[9px] text-purple-200 uppercase">DISTRIBUTION SWITCH</div>
                      <div>MANAGE SWITCH 1</div>
                    </div>
                    
                    <div className="w-0.5 h-3 bg-slate-600" />

                    <div className="grid grid-cols-2 gap-2 w-full">
                      <div className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-bold py-1.5 px-2 rounded-lg text-center">
                        ACCESS POINT 1
                      </div>
                      <div className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-bold py-1.5 px-2 rounded-lg text-center">
                        ACCESS POINT 2
                      </div>
                      <div className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-bold py-1.5 px-2 rounded-lg text-center">
                        ACCESS POINT 3
                      </div>
                      <div className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-bold py-1.5 px-2 rounded-lg text-center">
                        ACCESS POINT 4
                      </div>
                    </div>
                  </div>

                  {/* Managed Switch 2 */}
                  <div className="bg-[#111728] border border-[#1C2744] p-4 rounded-2xl flex flex-col items-center space-y-3">
                    <div className="w-full bg-purple-600 text-white font-bold text-xs py-2 px-3 rounded-xl text-center border border-purple-400 shadow-md">
                      <div className="text-[9px] text-purple-200 uppercase">DISTRIBUTION SWITCH</div>
                      <div>MANAGE SWITCH 2</div>
                    </div>
                    
                    <div className="w-0.5 h-3 bg-slate-600" />

                    <div className="grid grid-cols-2 gap-2 w-full">
                      <div className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-bold py-1.5 px-2 rounded-lg text-center">
                        ACCESS POINT 5
                      </div>
                      <div className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-bold py-1.5 px-2 rounded-lg text-center">
                        ACCESS POINT 6
                      </div>
                      <div className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-bold py-1.5 px-2 rounded-lg text-center">
                        ACCESS POINT 7
                      </div>
                      <div className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-bold py-1.5 px-2 rounded-lg text-center">
                        ACCESS POINT 8
                      </div>
                    </div>
                  </div>

                </div>

              </div>

            </div>

            {/* VLAN Subnet Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {MISS_VLAN_SEGMENTATION.map((vlan) => (
                <div key={vlan.vlanId} className={`p-4 rounded-xl border ${vlan.color} space-y-1.5`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs">VLAN {vlan.vlanId}</span>
                    <span className="text-[10px] font-mono text-slate-300">{vlan.subnet}</span>
                  </div>
                  <div className="text-xs font-bold text-white">{vlan.name}</div>
                  <p className="text-[11px] text-slate-300/80 leading-snug">{vlan.purpose}</p>
                </div>
              ))}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
